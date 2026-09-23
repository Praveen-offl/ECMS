"""
anomaly_detector.py
====================
Behavioral anomaly detection for elderly daily routines using an Isolation
Forest.

Why Isolation Forest for this problem
--------------------------------------
Unlike the rule-based vitals thresholds (Phase 1 §6 / Phase 2 thresholds.py),
"normal" behavior for an elderly patient is *personal* and *multivariate* --
a 3am bathroom visit alone isn't abnormal, three in one night combined with
only 3 hours of sleep and near-zero daytime steps might be. There's no fixed
safe range to check against; instead we need to learn what "a normal day"
looks like for *this specific patient* and flag days that don't fit that
learned pattern. Isolation Forest is a strong fit because:

  1. It's unsupervised -- we never have labeled "this was an anomalous day"
     ground truth for a specific elder in practice, only a history of
     presumed-normal days.
  2. It handles multivariate interactions (sleep x activity x bathroom
     visits together) rather than checking each feature in isolation.
  3. It's cheap to retrain per-patient and interpretable enough for a
     caregiver-facing explanation via per-feature deviation scoring.

How Isolation Forest scoring works (for the project report / viva)
--------------------------------------------------------------------
An Isolation Forest builds an ensemble of random binary trees. Each tree
recursively partitions the feature space with random splits (random feature,
random split value) until every point is isolated in its own leaf.
Anomalies -- points that are "few and different" -- tend to be isolated
after very few splits (short average path length), while normal points
embedded in a dense cluster need many splits to be separated out.

For a sample x, its anomaly score is:

    s(x, n) = 2 ^ ( -E[h(x)] / c(n) )

where:
    E[h(x)]  = the average path length of x across all trees in the forest
    c(n)     = 2*H(n-1) - (2*(n-1)/n)   -- the expected path length of an
               unsuccessful search in a Binary Search Tree of n points,
               used to normalize path length across forests trained on
               different sample sizes
    H(i)     = the harmonic number, ln(i) + Euler-Mascheroni constant (~0.5772)

Interpretation:
    s -> 1        : short average path length -> likely anomaly
    s -> 0.5      : path length close to c(n) -> ambiguous / borderline
    s -> 0 (< 0.5): long average path length -> likely normal

scikit-learn's `IsolationForest.decision_function` returns
`0.5 - s(x, n)` shifted so that negative values indicate anomalies and
positive values indicate normal points; this module re-normalizes that back
to an intuitive 0-1 "anomaly likelihood" for caregiver-facing display.
"""

from __future__ import annotations

import argparse
import json
import logging
import random
from dataclasses import asdict, dataclass, field
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s")
logger = logging.getLogger("anomaly_detector")

FEATURE_COLUMNS = [
    "total_sleep_hours",
    "sleep_onset_deviation_min",   # minutes earlier/later than the patient's usual bedtime
    "wake_time_deviation_min",     # minutes earlier/later than usual wake time
    "bathroom_visits_total",
    "bathroom_visits_night",       # 11pm-6am visits -- clinically notable (nocturia, UTI, etc.)
    "total_steps",
    "longest_inactivity_gap_min",  # longest daytime gap with no movement events
    "meals_logged",
]


# ---------------------------------------------------------------------------
# Daily feature extraction from raw event logs
# ---------------------------------------------------------------------------
@dataclass
class DailyEvents:
    """Raw behavioral events for a single patient-day, as would be aggregated
    from wearable/motion-sensor/bathroom-sensor logs before feature extraction."""
    day: date
    sleep_start: Optional[datetime]
    sleep_end: Optional[datetime]
    bathroom_visit_times: list[datetime] = field(default_factory=list)
    step_events: list[tuple[datetime, int]] = field(default_factory=list)  # (timestamp, step_count_in_interval)
    meal_times: list[datetime] = field(default_factory=list)


class DailyFeatureExtractor:
    """
    Converts a DailyEvents record into the fixed-width numeric feature
    vector the Isolation Forest operates on, using the patient's own
    historical baseline (usual bedtime/wake time) as the reference point
    for deviation-based features.
    """

    def __init__(self, usual_bedtime: time = time(22, 0), usual_wake_time: time = time(7, 0)):
        self.usual_bedtime = usual_bedtime
        self.usual_wake_time = usual_wake_time

    @staticmethod
    def _minutes_between(t1: time, t2: time) -> int:
        """Signed minute difference handling the midnight wrap-around."""
        d1 = timedelta(hours=t1.hour, minutes=t1.minute)
        d2 = timedelta(hours=t2.hour, minutes=t2.minute)
        diff = (d1 - d2).total_seconds() / 60.0
        if diff > 12 * 60:
            diff -= 24 * 60
        elif diff < -12 * 60:
            diff += 24 * 60
        return round(diff)

    def extract(self, events: DailyEvents) -> dict:
        sleep_hours = 0.0
        if events.sleep_start and events.sleep_end:
            sleep_hours = round((events.sleep_end - events.sleep_start).total_seconds() / 3600.0, 2)

        onset_dev = (
            self._minutes_between(events.sleep_start.time(), self.usual_bedtime)
            if events.sleep_start else 0
        )
        wake_dev = (
            self._minutes_between(events.sleep_end.time(), self.usual_wake_time)
            if events.sleep_end else 0
        )

        night_visits = sum(
            1 for t in events.bathroom_visit_times
            if t.time() >= time(23, 0) or t.time() < time(6, 0)
        )

        total_steps = sum(count for _ts, count in events.step_events)

        longest_gap = self._longest_inactivity_gap(events)

        return {
            "day": events.day.isoformat(),
            "total_sleep_hours": sleep_hours,
            "sleep_onset_deviation_min": onset_dev,
            "wake_time_deviation_min": wake_dev,
            "bathroom_visits_total": len(events.bathroom_visit_times),
            "bathroom_visits_night": night_visits,
            "total_steps": total_steps,
            "longest_inactivity_gap_min": longest_gap,
            "meals_logged": len(events.meal_times),
        }

    @staticmethod
    def _longest_inactivity_gap(events: DailyEvents) -> int:
        """Longest gap (minutes) between consecutive daytime activity signals
        (steps or bathroom visits), used as a proxy for prolonged immobility."""
        timestamps = sorted(
            [ts for ts, _c in events.step_events] + list(events.bathroom_visit_times)
        )
        if len(timestamps) < 2:
            return 0
        gaps = [
            (t2 - t1).total_seconds() / 60.0
            for t1, t2 in zip(timestamps, timestamps[1:])
        ]
        return round(max(gaps)) if gaps else 0


# ---------------------------------------------------------------------------
# Isolation Forest wrapper
# ---------------------------------------------------------------------------
@dataclass
class AnomalyResult:
    day: str
    is_anomaly: bool
    anomaly_likelihood: float          # 0-1, higher = more anomalous
    severity: str                       # "info" | "warning" | "critical"
    contributing_features: list[dict]   # sorted by |z-score| descending


class BehavioralAnomalyDetector:
    """
    Per-patient Isolation Forest over the FEATURE_COLUMNS daily feature
    vector. Intended usage:

        detector = BehavioralAnomalyDetector()
        detector.fit(baseline_df)                 # ~14-30 days of normal history
        result = detector.predict(today_features)  # single-day scoring
        detector.save("model_registry/patient_P-1001.joblib")
    """

    def __init__(
        self,
        n_estimators: int = 200,
        contamination: float = 0.05,
        random_state: int = 42,
        feature_columns: Optional[list[str]] = None,
    ):
        self.feature_columns = feature_columns or FEATURE_COLUMNS
        self.model = IsolationForest(
            n_estimators=n_estimators,
            contamination=contamination,
            random_state=random_state,
        )
        self._feature_means: Optional[pd.Series] = None
        self._feature_stds: Optional[pd.Series] = None
        self._is_fitted = False

    # -- training -----------------------------------------------------------
    def fit(self, baseline_df: pd.DataFrame) -> "BehavioralAnomalyDetector":
        """
        baseline_df: DataFrame containing at least self.feature_columns, one
        row per historical period presumed to represent the patient's normal
        routine (e.g. a trailing 14-30 day rolling window for the daily
        behavioral-event features this class was originally designed for,
        or a trailing sequence of vitals aggregation windows — see
        app/ml/vitals_features.py — for the live pipeline's actual data),
        periodically retrained as new confirmed-normal periods accumulate.
        """
        X = baseline_df[self.feature_columns].astype(float)
        self.model.fit(X)
        self._feature_means = X.mean()
        self._feature_stds = X.std().replace(0, 1e-6)  # avoid div-by-zero for constant features
        self._is_fitted = True
        logger.info("Fitted Isolation Forest on %d baseline periods (%d features)", len(X), len(self.feature_columns))
        return self

    # -- inference ------------------------------------------------------------
    def predict(self, day_features: dict) -> AnomalyResult:
        if not self._is_fitted:
            raise RuntimeError("Call fit() with baseline history before predict().")

        X = pd.DataFrame([{k: day_features[k] for k in self.feature_columns}]).astype(float)

        # decision_function: positive = normal, negative = anomaly (sklearn convention).
        raw_score = float(self.model.decision_function(X)[0])
        is_anomaly = bool(self.model.predict(X)[0] == -1)

        # Re-normalize to an intuitive 0-1 "anomaly likelihood" for the UI:
        # raw_score typically falls in roughly [-0.5, 0.5]; clip defensively.
        anomaly_likelihood = float(np.clip(0.5 - raw_score, 0.0, 1.0))

        severity = self._severity_for(anomaly_likelihood, is_anomaly)
        contributing = self._explain(X.iloc[0])

        return AnomalyResult(
            day=str(day_features.get("day", "")),
            is_anomaly=is_anomaly,
            anomaly_likelihood=round(anomaly_likelihood, 4),
            severity=severity,
            contributing_features=contributing,
        )

    @staticmethod
    def _severity_for(likelihood: float, is_anomaly: bool) -> str:
        if not is_anomaly:
            return "info"
        if likelihood >= 0.75:
            return "critical"
        return "warning"

    def _explain(self, row: pd.Series, top_k: int = 3) -> list[dict]:
        """
        Human-readable contributor breakdown: per-feature z-score against
        the fitted baseline mean/std, so a caregiver sees *why* a day was
        flagged (e.g. "night bathroom visits: 4 vs usual 0.8, +5.2 SD").
        """
        z_scores = (row - self._feature_means) / self._feature_stds
        # Clip for display only: a baseline feature that never varies (std -> 0)
        # would otherwise produce an uninformative, enormous z-score the moment
        # it changes at all. Ranking below still uses the unclipped magnitude
        # so genuinely constant-then-changed features still surface first.
        ranked = z_scores.abs().sort_values(ascending=False)
        contributors = []
        for feature in ranked.index[:top_k]:
            z_clipped = float(np.clip(z_scores[feature], -12.0, 12.0))
            contributors.append({
                "feature": feature,
                "value": round(float(row[feature]), 2),
                "baseline_mean": round(float(self._feature_means[feature]), 2),
                "z_score": round(z_clipped, 2),
            })
        return contributors

    # -- persistence ----------------------------------------------------------
    def save(self, path: str | Path) -> None:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(
            {"model": self.model, "means": self._feature_means, "stds": self._feature_stds},
            path,
        )
        logger.info("Model saved to %s", path)

    @classmethod
    def load(cls, path: str | Path) -> "BehavioralAnomalyDetector":
        bundle = joblib.load(path)
        detector = cls()
        detector.model = bundle["model"]
        detector._feature_means = bundle["means"]
        detector._feature_stds = bundle["stds"]
        detector._is_fitted = True
        return detector


# ---------------------------------------------------------------------------
# Synthetic data generator (demo / offline testing without real sensor history)
# ---------------------------------------------------------------------------
def _synthetic_day(day: date, anomalous: bool, rng: random.Random) -> DailyEvents:
    """Generates one synthetic patient-day of routine events, optionally
    perturbed into a plausible anomalous pattern (poor sleep + isolation +
    excess nocturia), for demoing/testing the detector end to end."""
    if not anomalous:
        bedtime_offset = rng.gauss(0, 15)   # minutes around 22:00
        sleep_start = datetime.combine(day, time(22, 0)) + timedelta(minutes=bedtime_offset)
        sleep_hours = rng.gauss(7.2, 0.5)
        sleep_end = sleep_start + timedelta(hours=max(sleep_hours, 4))

        night_visits = rng.choices([0, 1, 2], weights=[0.6, 0.3, 0.1])[0]
        day_visits = rng.randint(2, 5)
        steps = int(rng.gauss(3800, 600))
        meals = 3
    else:
        bedtime_offset = rng.gauss(90, 30)  # much later bedtime
        sleep_start = datetime.combine(day, time(22, 0)) + timedelta(minutes=bedtime_offset)
        sleep_hours = rng.gauss(3.5, 1.0)   # short, fragmented sleep
        sleep_end = sleep_start + timedelta(hours=max(sleep_hours, 1))

        night_visits = rng.choices([3, 4, 5, 6], weights=[0.3, 0.3, 0.25, 0.15])[0]
        day_visits = rng.randint(0, 2)
        steps = int(rng.gauss(600, 300))    # near-sedentary day
        meals = rng.choice([0, 1])          # skipped meals

    bathroom_times = []
    for _ in range(night_visits):
        hour = rng.choice([23, 0, 1, 2, 3, 4, 5])
        bathroom_times.append(datetime.combine(day, time(hour, rng.randint(0, 59))))
    for _ in range(day_visits):
        hour = rng.randint(7, 21)
        bathroom_times.append(datetime.combine(day, time(hour, rng.randint(0, 59))))

    step_events = []
    remaining_steps = max(steps, 0)
    n_intervals = rng.randint(3, 8)
    for i in range(n_intervals):
        hour = rng.randint(7, 20)
        chunk = remaining_steps // (n_intervals - i) if (n_intervals - i) else remaining_steps
        step_events.append((datetime.combine(day, time(hour, rng.randint(0, 59))), max(chunk, 0)))
        remaining_steps -= chunk

    meal_times = [
        datetime.combine(day, time(h, rng.randint(0, 30)))
        for h in rng.sample([8, 13, 19], k=min(meals, 3))
    ]

    return DailyEvents(
        day=day,
        sleep_start=sleep_start,
        sleep_end=sleep_end,
        bathroom_visit_times=sorted(bathroom_times),
        step_events=step_events,
        meal_times=sorted(meal_times),
    )


def build_demo_dataset(n_baseline_days: int = 30, n_test_days: int = 7, anomaly_rate: float = 0.3):
    rng = random.Random(7)
    extractor = DailyFeatureExtractor()

    baseline_rows = []
    start = date.today() - timedelta(days=n_baseline_days + n_test_days)
    for i in range(n_baseline_days):
        day = start + timedelta(days=i)
        baseline_rows.append(extractor.extract(_synthetic_day(day, anomalous=False, rng=rng)))
    baseline_df = pd.DataFrame(baseline_rows)

    test_rows = []
    for i in range(n_test_days):
        day = start + timedelta(days=n_baseline_days + i)
        is_anom = rng.random() < anomaly_rate
        test_rows.append(extractor.extract(_synthetic_day(day, anomalous=is_anom, rng=rng)))
    test_df = pd.DataFrame(test_rows)

    return baseline_df, test_df


# ---------------------------------------------------------------------------
# CLI demo entrypoint
# ---------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(description="Behavioral anomaly detector demo/training CLI")
    parser.add_argument("--baseline-days", type=int, default=30)
    parser.add_argument("--test-days", type=int, default=7)
    parser.add_argument("--contamination", type=float, default=0.05)
    parser.add_argument("--save-model", type=str, default=None, help="Path to persist the fitted model, e.g. model_registry/demo_patient.joblib")
    args = parser.parse_args()

    baseline_df, test_df = build_demo_dataset(args.baseline_days, args.test_days)
    logger.info("Baseline sample:\n%s", baseline_df.to_string(index=False))

    detector = BehavioralAnomalyDetector(contamination=args.contamination)
    detector.fit(baseline_df)

    if args.save_model:
        detector.save(args.save_model)

    print("\n--- Scoring test days ---")
    for _, row in test_df.iterrows():
        result = detector.predict(row.to_dict())
        print(json.dumps(asdict(result), indent=2))


if __name__ == "__main__":
    main()
