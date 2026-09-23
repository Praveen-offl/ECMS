# Phase 2 — Simulated Vitals Telemetry Engine

## What's included
```
backend/
├── app/
│   ├── main.py               # FastAPI app: ingestion endpoint + WebSocket broadcast
│   ├── schemas.py             # Pydantic request/response/broadcast models
│   ├── websocket_manager.py    # Connection registry + fan-out (ConnectionManager, WebSocketHub)
│   ├── thresholds.py            # Rule-based vitals safety net (Phase 1 §6)
│   ├── models.py                 # SQLAlchemy ORM (subset needed for Phase 2)
│   ├── database.py                # Async engine/session
│   └── config.py                   # Env-driven settings
├── sensor_emulator/
│   └── sensor_emulator.py           # Multi-patient realistic vitals generator
├── requirements.txt
└── .env.example
```

## 1. Install

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # edit DATABASE_URL to match your local Postgres
```

## 2. Database

Run the Phase 1 `schema.sql` against your PostgreSQL instance first:

```bash
createdb elder_health
psql elder_health -f ../schema.sql
```

> Note: `app/main.py` also runs `Base.metadata.create_all()` on startup as a
> dev convenience so the app is runnable even before you've applied
> `schema.sql` manually — but `schema.sql` remains the source of truth
> (enums, constraints, triggers) once Alembic migrations are introduced.

If you want to try the pipeline **without** setting up Postgres at all, set
`PERSIST_TO_DB=false` in `.env` — vitals will still be validated, broadcast
over WebSocket, and threshold-checked; they just won't be written to disk.

## 3. Run the backend

```bash
uvicorn app.main:app --reload --port 8000
```

Verify: `curl http://localhost:8000/health`

## 4. Run the sensor emulator

In a second terminal:

```bash
cd backend/sensor_emulator
pip install httpx
python sensor_emulator.py --api-url http://localhost:8000 --interval 3 --anomaly-probability 0.03
```

You'll see three simulated patients (Mrs. Kalyani Rao, Mr. Arun Mehta, Mrs.
Fatima Sheikh) streaming vitals every 3 seconds, each with roughly a 3%
per-tick chance of entering a multi-reading anomaly episode (tachycardia,
bradycardia, hypoxia, fever, hypotension, or hypertensive crisis).

## 5. Watch it live

Open a WebSocket to a patient's vitals channel, e.g. with `websocat` or the
browser console:

```js
const ws = new WebSocket("ws://localhost:8000/ws/vitals/P-1001");
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

To also see alerts, first register a caregiver mapping (dev-only helper
endpoint, since auth isn't built until a later phase):

```bash
curl -X POST "http://localhost:8000/api/v1/dev/assign-caregiver?caregiver_id=<some-uuid>&patient_id=P-1001"
```

```js
const alerts = new WebSocket("ws://localhost:8000/ws/alerts/<some-uuid>");
alerts.onmessage = (e) => console.log(JSON.parse(e.data));
```

## What happens on each ingested reading

1. `POST /api/v1/vitals/ingest` validates the payload (Pydantic — e.g.
   diastolic must be lower than systolic, all values within physiological
   bounds).
2. The reading is persisted to `vitals` (if `PERSIST_TO_DB=true`).
3. `evaluate_thresholds()` checks it against the Phase 1 warning/critical
   bands for HR, SpO2, BP, temperature, and respiration.
4. The raw reading is broadcast to every dashboard subscribed to
   `/ws/vitals/{patient_id}`.
5. Any threshold breach creates an `alerts` row and is broadcast to every
   caregiver subscribed to `/ws/alerts/{caregiver_id}` who is mapped to
   that patient.

## Next step

Phase 3 will replace/augment step 3 with the ML-based Isolation
Forest/LSTM behavioral anomaly detector and add the MediaPipe/YOLOv8-Pose
fall-detection worker, both writing into `anomaly_logs` / `fall_events`
and reusing the same `ws_hub` broadcast plumbing built here.
