"""
fall_detector.py
=================
Standalone computer-vision fall detector using OpenCV for frame capture and
MediaPipe Pose for skeletal landmark extraction.

Detection approach
-------------------
A fall is not just "the person is horizontal" (bending to tie a shoe or
sitting on the floor to stretch would false-positive on that alone). This
detector combines three independent signals, each cheap to compute per
frame, and requires more than one to agree before raising an alert:

1. Body bounding-box aspect ratio
   aspect_ratio = width(bbox) / height(bbox)
   A standing person's landmark bounding box is tall and narrow
   (aspect_ratio << 1). A person on the ground is wide and short
   (aspect_ratio > 1). A sudden jump from a low to a high aspect ratio is
   the primary geometric signature of a fall.

2. Torso angle from vertical
   Using the vector from the shoulder midpoint to the hip midpoint,
   theta = angle between that vector and the vertical (y) axis, in degrees.
   Standing/sitting upright: theta is near 0 deg. Lying flat: theta
   approaches 90 deg. This catches falls where the bounding box aspect
   ratio alone is ambiguous (e.g. a fall against a wall).

3. Vertical centroid velocity
   The hip-center's y-pixel-position change per second. A genuine fall
   involves a *fast* downward motion, unlike slowly sitting or lying down
   deliberately. This is the key differentiator that suppresses false
   positives from voluntary floor-level activity (e.g. stretching,
   picking something up).

State machine (per-track, single primary subject assumed for the PBL scope):

    NORMAL --(aspect/angle breach + fast downward motion)--> SUSPECTED
    SUSPECTED --(breach persists >= MIN_CONSECUTIVE_FRAMES)--> FALL_CONFIRMED
    SUSPECTED --(breach clears before confirmation)--> NORMAL
    FALL_CONFIRMED --(cooldown elapsed AND posture recovered)--> NORMAL

This hysteresis (require N consecutive frames, then a cooldown before
re-arming) avoids alert spam from single-frame pose-estimation noise or a
brief stumble-and-recover.
"""

from __future__ import annotations

import argparse
import logging
import math
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Optional

import cv2
import mediapipe as mp
import numpy as np

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s")
logger = logging.getLogger("fall_detector")

mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils

# Landmark indices we rely on (MediaPipe Pose's 33-point topology)
L_SHOULDER, R_SHOULDER = mp_pose.PoseLandmark.LEFT_SHOULDER, mp_pose.PoseLandmark.RIGHT_SHOULDER
L_HIP, R_HIP = mp_pose.PoseLandmark.LEFT_HIP, mp_pose.PoseLandmark.RIGHT_HIP


# ---------------------------------------------------------------------------
# Pure-geometry layer (kept separate from MediaPipe I/O so it's unit-testable
# with synthetic landmark coordinates, no camera or model inference needed)
# ---------------------------------------------------------------------------
@dataclass
class PoseMetrics:
    aspect_ratio: float          # bbox width / height, in pixels
    torso_angle_deg: float       # 0 = perfectly upright, 90 = horizontal
    centroid_y_px: float         # hip-midpoint y coordinate, pixels
    bbox: tuple[int, int, int, int]  # x_min, y_min, x_max, y_max
    n_visible_landmarks: int


def compute_pose_metrics(
    landmarks,
    frame_width: int,
    frame_height: int,
    visibility_threshold: float = 0.5,
) -> Optional[PoseMetrics]:
    """
    landmarks: a MediaPipe NormalizedLandmarkList-like sequence of 33 items,
    each with .x, .y in [0,1] (normalized) and .visibility in [0,1].
    Returns None if too few landmarks are confidently visible to trust the
    frame (e.g. subject partially out of frame).
    """
    visible_points = [
        (lm.x * frame_width, lm.y * frame_height)
        for lm in landmarks
        if lm.visibility >= visibility_threshold
    ]
    if len(visible_points) < 6:
        return None

    xs = [p[0] for p in visible_points]
    ys = [p[1] for p in visible_points]
    x_min, x_max = min(xs), max(xs)
    y_min, y_max = min(ys), max(ys)
    width = max(x_max - x_min, 1e-3)
    height = max(y_max - y_min, 1e-3)
    aspect_ratio = width / height

    def _pt(idx) -> Optional[tuple[float, float]]:
        lm = landmarks[idx]
        if lm.visibility < visibility_threshold:
            return None
        return (lm.x * frame_width, lm.y * frame_height)

    l_sh, r_sh = _pt(L_SHOULDER), _pt(R_SHOULDER)
    l_hip, r_hip = _pt(L_HIP), _pt(R_HIP)

    if l_sh and r_sh and l_hip and r_hip:
        shoulder_mid = ((l_sh[0] + r_sh[0]) / 2, (l_sh[1] + r_sh[1]) / 2)
        hip_mid = ((l_hip[0] + r_hip[0]) / 2, (l_hip[1] + r_hip[1]) / 2)
        dx = hip_mid[0] - shoulder_mid[0]
        dy = hip_mid[1] - shoulder_mid[1]
        # angle between the torso vector and the vertical axis (0,1)
        torso_angle = math.degrees(math.atan2(abs(dx), abs(dy) + 1e-6))
        centroid_y = hip_mid[1]
    else:
        # Fall back to bbox-derived approximation if hips/shoulders are occluded
        torso_angle = math.degrees(math.atan2(width, height))
        centroid_y = (y_min + y_max) / 2

    return PoseMetrics(
        aspect_ratio=aspect_ratio,
        torso_angle_deg=torso_angle,
        centroid_y_px=centroid_y,
        bbox=(int(x_min), int(y_min), int(x_max), int(y_max)),
        n_visible_landmarks=len(visible_points),
    )


# ---------------------------------------------------------------------------
# State machine
# ---------------------------------------------------------------------------
class FallState(str, Enum):
    NORMAL = "normal"
    SUSPECTED = "suspected"
    FALL_CONFIRMED = "fall_confirmed"


@dataclass
class FallDetectorConfig:
    aspect_ratio_threshold: float = 1.2       # width/height > this suggests horizontal posture
    torso_angle_threshold_deg: float = 55.0     # torso closer to horizontal than this
    min_drop_velocity_px_s: float = 250.0        # required downward speed to treat as a fall, not a slow sit
    min_consecutive_frames: int = 5               # frames the breach must persist to confirm
    cooldown_seconds: float = 8.0                   # lockout after a confirmed fall before re-arming
    velocity_window_frames: int = 4                  # frames used to estimate vertical velocity


class FallStateMachine:
    """
    Consumes a stream of (PoseMetrics, timestamp) and decides when to raise
    a confirmed fall alert, using the hysteresis logic described in the
    module docstring.
    """

    def __init__(self, config: FallDetectorConfig):
        self.config = config
        self.state = FallState.NORMAL
        self._consecutive_breach_frames = 0
        self._last_alert_time: Optional[float] = None
        self._centroid_history: list[tuple[float, float]] = []  # (timestamp, centroid_y_px)

    def _vertical_velocity_px_s(self) -> float:
        hist = self._centroid_history[-self.config.velocity_window_frames:]
        if len(hist) < 2:
            return 0.0
        (t0, y0), (t1, y1) = hist[0], hist[-1]
        dt = max(t1 - t0, 1e-3)
        return (y1 - y0) / dt  # positive = moving down (image y grows downward)

    def update(self, metrics: Optional[PoseMetrics], timestamp: float) -> tuple[FallState, bool]:
        """
        Returns (current_state, alert_just_triggered). alert_just_triggered
        is True exactly once, on the frame where state transitions into
        FALL_CONFIRMED.
        """
        cfg = self.config
        alert_triggered = False

        if metrics is None:
            # No confident pose this frame: don't advance the breach counter,
            # but don't reset it either (brief occlusion shouldn't erase progress).
            return self.state, False

        self._centroid_history.append((timestamp, metrics.centroid_y_px))
        if len(self._centroid_history) > cfg.velocity_window_frames + 2:
            self._centroid_history.pop(0)

        velocity = self._vertical_velocity_px_s()

        geometry_breach = (
            metrics.aspect_ratio > cfg.aspect_ratio_threshold
            or metrics.torso_angle_deg > cfg.torso_angle_threshold_deg
        )

        # Cooldown lockout after a confirmed fall
        if self.state == FallState.FALL_CONFIRMED:
            if self._last_alert_time is not None and (timestamp - self._last_alert_time) >= cfg.cooldown_seconds:
                if not geometry_breach:
                    self.state = FallState.NORMAL
                    self._consecutive_breach_frames = 0
            return self.state, False

        if geometry_breach:
            # Require the fast-downward-motion signal only to *enter*
            # SUSPECTED (catches the fall's onset); once suspected, geometry
            # persistence alone is enough to confirm (the person may now be
            # motionless on the floor, velocity ~ 0).
            entering_from_normal = self.state == FallState.NORMAL
            fast_drop = velocity >= cfg.min_drop_velocity_px_s

            if entering_from_normal and not fast_drop:
                # Slow posture change (e.g. sitting down deliberately) -- ignore.
                self._consecutive_breach_frames = 0
                return self.state, False

            self.state = FallState.SUSPECTED
            self._consecutive_breach_frames += 1

            if self._consecutive_breach_frames >= cfg.min_consecutive_frames:
                self.state = FallState.FALL_CONFIRMED
                self._last_alert_time = timestamp
                alert_triggered = True
        else:
            self.state = FallState.NORMAL
            self._consecutive_breach_frames = 0

        return self.state, alert_triggered


# ---------------------------------------------------------------------------
# Alert dispatch (pluggable: console log, snapshot save, optional backend POST)
# ---------------------------------------------------------------------------
class FallAlertDispatcher:
    def __init__(self, patient_id: str, api_url: Optional[str] = None, snapshot_dir: Optional[str] = None):
        self.patient_id = patient_id
        self.api_url = api_url
        self.snapshot_dir = Path(snapshot_dir) if snapshot_dir else None
        if self.snapshot_dir:
            self.snapshot_dir.mkdir(parents=True, exist_ok=True)

    def dispatch(self, frame: np.ndarray, metrics: PoseMetrics) -> None:
        detected_at = datetime.now(timezone.utc)
        snapshot_path = None

        if self.snapshot_dir:
            filename = f"fall_{self.patient_id}_{detected_at.strftime('%Y%m%dT%H%M%S%f')}.jpg"
            snapshot_path = str(self.snapshot_dir / filename)
            cv2.imwrite(snapshot_path, frame)

        logger.critical(
            "FALL DETECTED patient=%s aspect_ratio=%.2f torso_angle=%.1f deg at %s%s",
            self.patient_id, metrics.aspect_ratio, metrics.torso_angle_deg,
            detected_at.isoformat(),
            f" snapshot={snapshot_path}" if snapshot_path else "",
        )

        if self.api_url:
            self._post_to_backend(metrics, detected_at, snapshot_path)

    def _post_to_backend(self, metrics: PoseMetrics, detected_at: datetime, snapshot_path: Optional[str]) -> None:
        # Imported lazily so `requests` is only required when --api-url is used.
        try:
            import requests
        except ImportError:
            logger.error("`requests` not installed; cannot POST fall event. pip install requests")
            return

        payload = {
            "patient_id": self.patient_id,
            "confidence_score": min(1.0, round(metrics.aspect_ratio / 2.0, 3)),
            "pose_keypoints": {
                "aspect_ratio": metrics.aspect_ratio,
                "torso_angle_deg": metrics.torso_angle_deg,
                "bbox": metrics.bbox,
            },
            "detected_at": detected_at.isoformat(),
        }
        endpoint = f"{self.api_url.rstrip('/')}/api/v1/fall-events/ingest"
        try:
            resp = requests.post(endpoint, json=payload, timeout=5.0)
            if resp.status_code >= 400:
                logger.error("Backend rejected fall event (%s): %s", resp.status_code, resp.text)
        except requests.RequestException as exc:
            logger.error("Could not reach backend at %s: %s", endpoint, exc)


# ---------------------------------------------------------------------------
# Main capture / inference loop
# ---------------------------------------------------------------------------
def _draw_overlay(frame: np.ndarray, metrics: Optional[PoseMetrics], state: FallState) -> None:
    color = {
        FallState.NORMAL: (0, 200, 0),
        FallState.SUSPECTED: (0, 200, 255),
        FallState.FALL_CONFIRMED: (0, 0, 255),
    }[state]

    if metrics:
        x0, y0, x1, y1 = metrics.bbox
        cv2.rectangle(frame, (x0, y0), (x1, y1), color, 2)
        cv2.putText(
            frame, f"AR:{metrics.aspect_ratio:.2f} angle:{metrics.torso_angle_deg:.0f}deg",
            (x0, max(y0 - 10, 15)), cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2,
        )

    label = {
        FallState.NORMAL: "MONITORING",
        FallState.SUSPECTED: "POSSIBLE FALL - CONFIRMING",
        FallState.FALL_CONFIRMED: "FALL DETECTED",
    }[state]
    cv2.putText(frame, label, (15, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2)


def run(
    source: str | int,
    patient_id: str,
    config: FallDetectorConfig,
    api_url: Optional[str] = None,
    snapshot_dir: Optional[str] = "fall_snapshots",
    show_window: bool = False,
) -> None:
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video source: {source}")

    state_machine = FallStateMachine(config)
    dispatcher = FallAlertDispatcher(patient_id, api_url=api_url, snapshot_dir=snapshot_dir)

    logger.info("Starting fall detection for patient_id=%s source=%s", patient_id, source)

    with mp_pose.Pose(
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
        model_complexity=1,
    ) as pose:
        frame_idx = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                logger.info("End of stream / camera read failure. Stopping.")
                break

            frame_idx += 1
            timestamp = time.time()
            h, w = frame.shape[:2]

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            rgb.flags.writeable = False
            results = pose.process(rgb)
            rgb.flags.writeable = True

            metrics = None
            if results.pose_landmarks:
                metrics = compute_pose_metrics(results.pose_landmarks.landmark, w, h)
                mp_drawing.draw_landmarks(frame, results.pose_landmarks, mp_pose.POSE_CONNECTIONS)

            state, alert_triggered = state_machine.update(metrics, timestamp)

            if alert_triggered and metrics is not None:
                dispatcher.dispatch(frame, metrics)

            _draw_overlay(frame, metrics, state)

            if show_window:
                cv2.imshow("Fall Detection", frame)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

    cap.release()
    if show_window:
        cv2.destroyAllWindows()
    logger.info("Fall detection stopped after %d frames.", frame_idx)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="OpenCV + MediaPipe Pose fall detector")
    parser.add_argument("--source", default="0", help="Camera index (e.g. 0) or path/URL to a video file/stream")
    parser.add_argument("--patient-id", default="P-1001", help="Patient identifier tagged on alerts")
    parser.add_argument("--api-url", default=None, help="Optional backend base URL to POST fall events to")
    parser.add_argument("--snapshot-dir", default="fall_snapshots", help="Directory to save confirmed-fall frame snapshots")
    parser.add_argument("--show", action="store_true", help="Display the annotated video window (requires a GUI environment)")
    parser.add_argument("--aspect-ratio-threshold", type=float, default=1.2)
    parser.add_argument("--torso-angle-threshold", type=float, default=55.0)
    parser.add_argument("--min-drop-velocity", type=float, default=250.0)
    parser.add_argument("--min-consecutive-frames", type=int, default=5)
    parser.add_argument("--cooldown-seconds", type=float, default=8.0)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    source: str | int = int(args.source) if args.source.isdigit() else args.source

    cfg = FallDetectorConfig(
        aspect_ratio_threshold=args.aspect_ratio_threshold,
        torso_angle_threshold_deg=args.torso_angle_threshold,
        min_drop_velocity_px_s=args.min_drop_velocity,
        min_consecutive_frames=args.min_consecutive_frames,
        cooldown_seconds=args.cooldown_seconds,
    )

    run(
        source=source,
        patient_id=args.patient_id,
        config=cfg,
        api_url=args.api_url,
        snapshot_dir=args.snapshot_dir,
        show_window=args.show,
    )
