"""
vitals_features.py
===================
Feature extraction for the *live* anomaly detection pipeline (see
app/main.py's background anomaly scan loop), as opposed to the offline
demo/CLI in anomaly_detector.py.

Why this exists separately from anomaly_detector.py's FEATURE_COLUMNS
-----------------------------------------------------------------------
anomaly_detector.py's DailyFeatureExtractor was designed against discrete
behavioral-event logs (sleep start/end timestamps, bathroom visit
timestamps, meal timestamps) — the kind of data a dedicated
activity/motion-sensor subsystem would produce. This platform's actual
ingestion pipeline (app/main.py `/api/v1/vitals/ingest`, fed by
sensor_emulator/) only ever receives continuous *vitals* readings (heart
rate, SpO2, blood pressure, temperature, respiration, step count) — there
is no sleep/bathroom/meal event stream to feed DailyFeatureExtractor with.

Rather than fabricate behavioral data the system doesn't actually collect,
this module defines a second, honest feature set built entirely from real
ingested `Vitals` rows, aggregated over rolling time windows (not calendar
days, since a live stream has no natural day boundary during a short
demo/session). The same `BehavioralAnomalyDetector` (Isolation Forest)
class from anomaly_detector.py is reused unmodified for the actual model —
only the feature columns and how they're extracted differ.
"""

from __future__ import annotations

from datetime import datetime
from statistics import mean

VITALS_FEATURE_COLUMNS = [
    "avg_heart_rate",
    "avg_spo2",
    "avg_bp_systolic",
    "avg_bp_diastolic",
    "avg_temperature",
    "avg_respiration_rate",
    "total_steps",
    "reading_count",  # proxy for wearable activity/monitoring density in the window
]


def extract_window_features(rows: list, window_label: str = "") -> dict:
    """
    rows: a list of objects with .heart_rate, .spo2, .bp_systolic,
    .bp_diastolic, .temperature, .respiration_rate, .steps_count attributes
    (SQLAlchemy `Vitals` rows satisfy this directly) covering one rolling
    time window for a single patient.
    """
    def _safe_mean(values: list) -> float:
        clean = [v for v in values if v is not None]
        return round(mean(clean), 2) if clean else 0.0

    return {
        "day": window_label,
        "avg_heart_rate": _safe_mean([r.heart_rate for r in rows]),
        "avg_spo2": _safe_mean([r.spo2 for r in rows]),
        "avg_bp_systolic": _safe_mean([r.bp_systolic for r in rows]),
        "avg_bp_diastolic": _safe_mean([r.bp_diastolic for r in rows]),
        "avg_temperature": _safe_mean([float(r.temperature) if r.temperature is not None else None for r in rows]),
        "avg_respiration_rate": _safe_mean([r.respiration_rate for r in rows]),
        "total_steps": sum(r.steps_count or 0 for r in rows),
        "reading_count": len(rows),
    }


def bucket_by_window(rows: list, window_minutes: int) -> dict[str, list]:
    """
    Groups Vitals rows (must be ordered oldest-first, each with .recorded_at)
    into fixed-size trailing windows keyed by the window's start timestamp
    (ISO string), so a rolling baseline of "normal" windows can be built and
    the most recent window scored against it.
    """
    buckets: dict[str, list] = {}
    for row in rows:
        ts: datetime = row.recorded_at
        epoch_minutes = int(ts.timestamp() // 60)
        window_start_minutes = (epoch_minutes // window_minutes) * window_minutes
        window_start = datetime.fromtimestamp(window_start_minutes * 60, tz=ts.tzinfo)
        key = window_start.isoformat()
        buckets.setdefault(key, []).append(row)
    return buckets
