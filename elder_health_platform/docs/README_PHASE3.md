# Phase 3 — AI Behavioral Anomaly Detection & Fall Detection

## What's included
```
backend/app/
├── ml/
│   ├── anomaly_detector.py     # Isolation Forest over daily routine features
│   └── model_registry/          # fitted per-patient models get saved here (.joblib)
└── cv/
    ├── fall_detector.py          # OpenCV + MediaPipe Pose fall detection
    └── fall_snapshots/            # confirmed-fall frame captures land here
```

## 1. Install

```bash
cd backend
pip install -r requirements.txt
```

> `mediapipe` is pinned to `0.10.14`. Newer wheels on some platforms ship
> only the newer Tasks API and drop `mediapipe.solutions`, which this
> script relies on for its zero-config, no-external-model-download
> experience. If you upgrade mediapipe and hit
> `AttributeError: module 'mediapipe' has no attribute 'solutions'`,
> reinstall the pinned version.

---

## 2. `anomaly_detector.py` — Behavioral Anomaly Detection

### Run the built-in demo
```bash
cd app/ml
python anomaly_detector.py --baseline-days 30 --test-days 7 --contamination 0.05 \
    --save-model model_registry/demo_patient.joblib
```
This generates 30 days of synthetic "normal" routine data (sleep, bathroom
visits, steps, meals) for one patient, fits the Isolation Forest, then
scores 7 new days (some deliberately perturbed into an anomalous pattern:
late bedtime, fragmented sleep, excess night bathroom visits, near-zero
steps, skipped meals) and prints a JSON report per day, e.g.:

```json
{
  "day": "2026-08-08",
  "is_anomaly": true,
  "anomaly_likelihood": 0.5773,
  "severity": "warning",
  "contributing_features": [
    {"feature": "total_sleep_hours", "value": 3.15, "baseline_mean": 7.21, "z_score": -8.75},
    {"feature": "sleep_onset_deviation_min", "value": 123.0, "baseline_mean": 0.73, "z_score": 8.25}
  ]
}
```

### Using it as a module (how a Phase-later worker would call it)
```python
from app.ml.anomaly_detector import BehavioralAnomalyDetector, DailyFeatureExtractor

detector = BehavioralAnomalyDetector(contamination=0.05)
detector.fit(baseline_df)                 # baseline_df: last 14-30 "normal" days for this patient
result = detector.predict(todays_features)  # dict with FEATURE_COLUMNS keys
detector.save(f"model_registry/{patient_id}.joblib")

# later, without retraining:
detector = BehavioralAnomalyDetector.load(f"model_registry/{patient_id}.joblib")
```

> **This CLI still runs on synthetic data and is the reference example for
> `DailyFeatureExtractor`'s original design** — a discrete
> sleep/bathroom/meal event log this platform doesn't actually ingest (see
> below). **The live system integration is a parallel path**: `main.py`
> runs a background `_anomaly_scan_loop` that reuses this same
> `BehavioralAnomalyDetector` class (now generalized to accept any
> `feature_columns`) against real ingested `Vitals` rows instead — see
> `app/ml/vitals_features.py` and "Live integration" below.

### Feature set
`total_sleep_hours`, `sleep_onset_deviation_min`, `wake_time_deviation_min`,
`bathroom_visits_total`, `bathroom_visits_night`, `total_steps`,
`longest_inactivity_gap_min`, `meals_logged` — see the module docstring for
the Isolation Forest scoring math (path-length-based anomaly score) and why
it fits this per-patient, unsupervised, multivariate problem better than
fixed thresholds. **These specific features require a sleep/bathroom/meal
event stream this platform's ingestion pipeline doesn't collect** (it only
ingests continuous vitals) — this feature set stays as designed for that
future data source; the live worker uses a different, smaller feature set
built from data the system actually has (see below).

### Live integration
`app/main.py` runs `_anomaly_scan_loop()` on a background `asyncio` task
(started in the FastAPI `startup` event, interval configurable via
`ANOMALY_SCAN_INTERVAL_SECONDS`). Each pass, for every patient:
1. Buckets their `Vitals` history into rolling windows
   (`ANOMALY_WINDOW_MINUTES`) via `app/ml/vitals_features.bucket_by_window`.
2. Once at least `ANOMALY_MIN_BASELINE_WINDOWS` prior *closed* windows
   exist, extracts `VITALS_FEATURE_COLUMNS` (avg heart rate/SpO2/BP/temp/
   respiration, total steps, reading count) per window via
   `extract_window_features`.
3. Fits `BehavioralAnomalyDetector(feature_columns=VITALS_FEATURE_COLUMNS)`
   on the baseline windows and scores the most recent closed window.
4. **Combines the model's verdict with a z-score backstop**
   (`ANOMALY_Z_SCORE_THRESHOLD`, default 3.5 SD on any single feature) —
   testing showed `IsolationForest.predict()`'s contamination-based
   threshold misses clearly anomalous points when the baseline is only a
   handful of windows (as a live/short session realistically has), the
   same way `thresholds.py` backstops unambiguous vitals breaches
   independent of any model. This is documented, not hidden: with only a
   few hours of a specific patient's history, expect the *z-score signal*
   to be doing most of the real detection work; the multivariate
   Isolation Forest signal gets more discriminative as more baseline
   windows accumulate over days.
5. On a flag, creates an `Alert` (`source_type=anomaly_ml`) and broadcasts
   it over `/ws/alerts/{caregiver_id}` — the same path threshold and fall
   alerts use, so the dashboard needs no special-casing per alert source.



## 3. `fall_detector.py` — Computer Vision Fall Detection

### Run against your webcam
```bash
cd app/cv
python fall_detector.py --source 0 --patient-id P-1001 --show
```
Press `q` to quit the preview window. Confirmed falls are logged to the
console and saved as JPEGs under `fall_snapshots/`.

### Run against a video file (e.g. a recorded fall test clip)
```bash
python fall_detector.py --source /path/to/test_fall.mp4 --patient-id P-1001 --show
```

### Run headless (no GUI, e.g. on a server) and forward alerts to the backend
```bash
python fall_detector.py --source 0 --patient-id P-1001 \
    --api-url http://localhost:8000 --snapshot-dir fall_snapshots
```
This POSTs to `{api_url}/api/v1/fall-events/ingest` on every confirmed fall.
That endpoint is now live in `main.py`: it upserts the patient if needed,
creates an `Alert` (`source_type=fall_detection`, severity `critical` at
confidence ≥ 0.5 else `warning`), and broadcasts it to every caregiver
linked to that patient over `/ws/alerts/{caregiver_id}` — the same path
threshold and anomaly alerts use.

### Tuning
| Flag | Default | Effect |
|---|---|---|
| `--aspect-ratio-threshold` | 1.2 | Higher = requires a more clearly horizontal bounding box before flagging |
| `--torso-angle-threshold` | 55.0 | Degrees from vertical; higher = more tolerant of leaning/bending |
| `--min-drop-velocity` | 250.0 | px/sec of downward centroid motion required to *enter* a suspected-fall state |
| `--min-consecutive-frames` | 5 | Frames the breach must persist before confirming |
| `--cooldown-seconds` | 8.0 | Lockout after a confirmed fall before re-arming |

### Why three signals instead of one
Aspect ratio alone false-positives on someone tying their shoes; torso
angle alone false-positives on someone lying down on a couch on purpose;
velocity alone is noisy frame-to-frame. Requiring geometry breach **plus**
a fast downward motion to *enter* suspicion, then requiring that breach to
**persist** for several frames to *confirm*, is what keeps this usable
without constant false alarms. The module docstring in `fall_detector.py`
walks through the full state machine (`NORMAL -> SUSPECTED -> FALL_CONFIRMED`).

### Validation without a camera
The geometry (`compute_pose_metrics`) and state machine
(`FallStateMachine`) are deliberately decoupled from the MediaPipe/OpenCV
I/O layer, so they can be — and were — unit tested with synthetic landmark
coordinates standing in for standing vs. fallen poses, confirming:
- standing posture never triggers an alert,
- a fast transition into a horizontal pose triggers a confirmed fall within
  the configured consecutive-frame window,
- a slow, deliberate posture change (low vertical velocity) does **not**
  trigger a fall,
- the detector correctly re-arms to `NORMAL` after the cooldown once
  posture recovers.

## Next step

Phase 4 will build the React caregiver dashboard consuming the
`/ws/vitals`, `/ws/alerts`, and (newly added) `/ws/fall-detection`
channels this phase's outputs feed into, plus REST views over
`anomaly_logs` and `fall_events` history.
