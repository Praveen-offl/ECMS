"""
sensor_emulator.py
===================
Simulates one or more wearable vitals devices for elderly patients.

Design goals
------------
1. Realism: readings follow a circadian baseline (HR/RR dip at night, rise
   slightly midday) plus small-step random-walk noise so consecutive
   readings look physiologically continuous rather than pure white noise.
2. Controlled anomalies: each patient independently enters "anomaly
   episodes" at a configurable probability. During an episode, one vital
   (or a correlated cluster, e.g. tachycardia + low SpO2) is pushed outside
   safe range for a few consecutive readings, then relaxes back to baseline
   -- mimicking a real transient medical event rather than a single-sample
   glitch.
3. Concurrency: every patient runs as an independent asyncio task, each
   posting to the FastAPI ingestion endpoint on its own interval, so the
   emulator scales to many simulated patients from one process.

Usage
-----
    python sensor_emulator.py --api-url http://localhost:8000 --interval 3

Environment variables (override CLI defaults):
    EMULATOR_API_URL, EMULATOR_INTERVAL_SEC, EMULATOR_ANOMALY_PROB
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import math
import os
import random
import signal
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

import httpx

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger("sensor_emulator")


# ---------------------------------------------------------------------------
# Patient simulation profile
# ---------------------------------------------------------------------------
@dataclass
class PatientProfile:
    patient_id: str
    device_uid: str
    display_name: str
    room: str = ""

    # Personal baselines (center of each vital's "normal for this patient")
    baseline_hr: float = 72.0
    baseline_spo2: float = 97.0
    baseline_systolic: float = 122.0
    baseline_diastolic: float = 78.0
    baseline_temp: float = 36.7
    baseline_resp: float = 16.0

    # Random-walk state (mutated over time so readings drift smoothly)
    _hr_state: float = field(init=False, default=0.0)
    _spo2_state: float = field(init=False, default=0.0)
    _sys_state: float = field(init=False, default=0.0)
    _dia_state: float = field(init=False, default=0.0)
    _temp_state: float = field(init=False, default=0.0)
    _resp_state: float = field(init=False, default=0.0)

    # Anomaly episode state
    in_anomaly: bool = field(init=False, default=False)
    anomaly_type: Optional[str] = field(init=False, default=None)
    anomaly_readings_left: int = field(init=False, default=0)


ANOMALY_TYPES = [
    "tachycardia",      # HR spikes high
    "bradycardia",      # HR drops low
    "hypoxia",           # SpO2 drops
    "fever",              # temperature rises
    "hypotension",         # BP drops
    "hypertensive_crisis",  # BP spikes
]


def circadian_multiplier(now: datetime, peak_hour: float = 15.0, amplitude: float = 0.04) -> float:
    """
    Returns a small multiplicative factor (~0.96-1.04) that nudges vitals
    based on time of day: vitals trend slightly lower overnight and
    slightly higher in the afternoon, matching typical human circadian
    rhythm for heart rate / respiration.
    """
    hour = now.hour + now.minute / 60.0
    phase = 2 * math.pi * (hour - peak_hour) / 24.0
    return 1.0 + amplitude * math.cos(phase)


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


class VitalsGenerator:
    """Produces one realistic (or anomalous) vitals reading per call."""

    def __init__(self, profile: PatientProfile, anomaly_probability: float, anomaly_duration_range=(3, 8)):
        self.profile = profile
        self.anomaly_probability = anomaly_probability
        self.anomaly_duration_range = anomaly_duration_range

    def _maybe_start_anomaly(self) -> None:
        p = self.profile
        if p.in_anomaly:
            return
        if random.random() < self.anomaly_probability:
            p.in_anomaly = True
            p.anomaly_type = random.choice(ANOMALY_TYPES)
            p.anomaly_readings_left = random.randint(*self.anomaly_duration_range)
            logger.warning(
                "[%s] Anomaly episode START type=%s duration=%d readings",
                p.display_name, p.anomaly_type, p.anomaly_readings_left,
            )

    def _apply_anomaly_bias(self) -> dict:
        """Returns additive/multiplicative bias applied on top of baseline for the active anomaly."""
        p = self.profile
        bias = {"hr": 0.0, "spo2": 0.0, "sys": 0.0, "dia": 0.0, "temp": 0.0, "resp": 0.0}
        if not p.in_anomaly:
            return bias

        if p.anomaly_type == "tachycardia":
            bias["hr"] = random.uniform(35, 55)
            bias["resp"] = random.uniform(3, 6)
        elif p.anomaly_type == "bradycardia":
            bias["hr"] = -random.uniform(20, 30)
        elif p.anomaly_type == "hypoxia":
            bias["spo2"] = -random.uniform(8, 14)
            bias["hr"] = random.uniform(10, 20)
        elif p.anomaly_type == "fever":
            bias["temp"] = random.uniform(1.3, 2.5)
            bias["hr"] = random.uniform(10, 18)
        elif p.anomaly_type == "hypotension":
            bias["sys"] = -random.uniform(25, 35)
            bias["dia"] = -random.uniform(12, 18)
            bias["hr"] = random.uniform(8, 15)
        elif p.anomaly_type == "hypertensive_crisis":
            bias["sys"] = random.uniform(35, 55)
            bias["dia"] = random.uniform(15, 25)

        p.anomaly_readings_left -= 1
        if p.anomaly_readings_left <= 0:
            logger.info("[%s] Anomaly episode END type=%s", p.display_name, p.anomaly_type)
            p.in_anomaly = False
            p.anomaly_type = None
        return bias

    def next_reading(self) -> dict:
        p = self.profile
        self._maybe_start_anomaly()
        bias = self._apply_anomaly_bias()

        now = datetime.now(timezone.utc)
        circadian = circadian_multiplier(now)

        # Bounded random walk: small step each tick, mean-reverting toward 0
        p._hr_state = clamp(p._hr_state + random.uniform(-1.2, 1.2) - 0.1 * p._hr_state, -8, 8)
        p._spo2_state = clamp(p._spo2_state + random.uniform(-0.3, 0.3) - 0.1 * p._spo2_state, -1.5, 1.5)
        p._sys_state = clamp(p._sys_state + random.uniform(-1.5, 1.5) - 0.1 * p._sys_state, -6, 6)
        p._dia_state = clamp(p._dia_state + random.uniform(-1.0, 1.0) - 0.1 * p._dia_state, -4, 4)
        p._temp_state = clamp(p._temp_state + random.uniform(-0.05, 0.05) - 0.1 * p._temp_state, -0.3, 0.3)
        p._resp_state = clamp(p._resp_state + random.uniform(-0.4, 0.4) - 0.1 * p._resp_state, -2, 2)

        heart_rate = round((p.baseline_hr + p._hr_state) * circadian + bias["hr"])
        spo2 = round(clamp(p.baseline_spo2 + p._spo2_state + bias["spo2"], 70, 100))
        systolic = round(p.baseline_systolic + p._sys_state + bias["sys"])
        diastolic = round(p.baseline_diastolic + p._dia_state + bias["dia"])
        temperature = round(p.baseline_temp + p._temp_state + bias["temp"], 1)
        respiration = round((p.baseline_resp + p._resp_state) * circadian + bias["resp"])

        return {
            "patient_id": p.patient_id,
            "device_uid": p.device_uid,
            "display_name": p.display_name,
            "room": p.room,
            "heart_rate": int(clamp(heart_rate, 25, 220)),
            "spo2": int(spo2),
            "bp_systolic": int(clamp(systolic, 60, 220)),
            "bp_diastolic": int(clamp(diastolic, 35, 140)),
            "temperature": float(clamp(temperature, 33.0, 42.0)),
            "respiration_rate": int(clamp(respiration, 4, 45)),
            "steps_count": random.randint(0, 12),
            "recorded_at": now.isoformat(),
            "meta": {
                "simulated": True,
                "anomaly_active": p.in_anomaly,
                "anomaly_type": p.anomaly_type,
            },
        }


# ---------------------------------------------------------------------------
# Networking: post readings to the FastAPI ingestion endpoint
# ---------------------------------------------------------------------------
async def run_patient_stream(
    client: httpx.AsyncClient,
    generator: VitalsGenerator,
    api_url: str,
    interval_sec: float,
    stop_event: asyncio.Event,
) -> None:
    endpoint = f"{api_url.rstrip('/')}/api/v1/vitals/ingest"
    name = generator.profile.display_name

    while not stop_event.is_set():
        payload = generator.next_reading()
        try:
            resp = await client.post(endpoint, json=payload, timeout=5.0)
            if resp.status_code >= 400:
                logger.error("[%s] Ingest rejected (%s): %s", name, resp.status_code, resp.text)
            else:
                logger.info(
                    "[%s] HR=%d SpO2=%d%% BP=%d/%d Temp=%.1f RR=%d%s",
                    name,
                    payload["heart_rate"], payload["spo2"],
                    payload["bp_systolic"], payload["bp_diastolic"],
                    payload["temperature"], payload["respiration_rate"],
                    "  [ANOMALY]" if payload["meta"]["anomaly_active"] else "",
                )
        except httpx.RequestError as exc:
            logger.error("[%s] Connection error posting to %s: %s", name, endpoint, exc)

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=interval_sec)
        except asyncio.TimeoutError:
            pass  # normal tick


DEFAULT_PATIENTS = [
    PatientProfile(patient_id="P-1001", device_uid="WRIST-BAND-1001", display_name="Mrs. Kalyani Rao", room="Room 4B",
                    baseline_hr=74, baseline_spo2=97, baseline_systolic=128, baseline_diastolic=80),
    PatientProfile(patient_id="P-1002", device_uid="WRIST-BAND-1002", display_name="Mr. Arun Mehta", room="Room 2A",
                    baseline_hr=68, baseline_spo2=96, baseline_systolic=118, baseline_diastolic=76),
    PatientProfile(patient_id="P-1003", device_uid="WRIST-BAND-1003", display_name="Mrs. Fatima Sheikh", room="Room 6C",
                    baseline_hr=80, baseline_spo2=95, baseline_systolic=134, baseline_diastolic=84),
]


async def main_async(args: argparse.Namespace) -> None:
    stop_event = asyncio.Event()

    def _handle_signal(*_: object) -> None:
        logger.info("Shutdown signal received, stopping emulator...")
        stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _handle_signal)
        except NotImplementedError:
            # signal handlers are not available on Windows event loops
            pass

    generators = [
        VitalsGenerator(profile, anomaly_probability=args.anomaly_probability)
        for profile in DEFAULT_PATIENTS
    ]

    logger.info(
        "Starting emulator for %d patients -> %s (interval=%.1fs, anomaly_prob=%.2f)",
        len(generators), args.api_url, args.interval, args.anomaly_probability,
    )

    async with httpx.AsyncClient() as client:
        tasks = [
            asyncio.create_task(run_patient_stream(client, gen, args.api_url, args.interval, stop_event))
            for gen in generators
        ]
        await stop_event.wait()
        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)

    logger.info("Emulator stopped cleanly.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Elderly health monitoring sensor emulator")
    parser.add_argument(
        "--api-url",
        default=os.environ.get("EMULATOR_API_URL", "http://localhost:8000"),
        help="Base URL of the FastAPI backend (default: http://localhost:8000)",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=float(os.environ.get("EMULATOR_INTERVAL_SEC", 3.0)),
        help="Seconds between readings per patient (default: 3.0)",
    )
    parser.add_argument(
        "--anomaly-probability",
        type=float,
        default=float(os.environ.get("EMULATOR_ANOMALY_PROB", 0.03)),
        help="Per-tick probability [0-1] a patient enters an anomaly episode (default: 0.03)",
    )
    return parser.parse_args()


if __name__ == "__main__":
    try:
        asyncio.run(main_async(parse_args()))
    except KeyboardInterrupt:
        sys.exit(0)
