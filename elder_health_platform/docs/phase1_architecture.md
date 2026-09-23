# Phase 1 — Architecture, Database Design & API Contract
## Intelligent Elderly Health Monitoring, Behavioral Analysis & Emergency Response Platform

---

## 1. System Architecture

### 1.1 High-Level Component View

```
                              ┌─────────────────────────────────────────┐
                              │           SENSOR EMULATOR LAYER          │
                              │  Python daemon(s) simulating:            │
                              │   - Wearable vitals (HR, SpO2, BP, Temp) │
                              │   - Motion/accelerometer stream          │
                              │   - Webcam frames (fall detection feed)  │
                              └───────────────┬───────────────────────────┘
                                              │ HTTP POST / MQTT publish
                                              ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND — FastAPI (ASGI)                          │
│                                                                                 │
│  ┌────────────────┐   ┌───────────────────┐   ┌──────────────────────────┐   │
│  │  REST API Layer │   │  WebSocket Gateway │   │   Background Workers      │   │
│  │  (ingestion,    │   │  (live push to     │   │   - Anomaly Detector      │   │
│  │   CRUD, auth)   │   │   dashboard)        │   │     (Isolation Forest)   │   │
│  └───────┬─────────┘   └─────────┬───────────┘   │   - Fall Detection CV    │   │
│          │                       │                │     (MediaPipe/YOLOv8)  │   │
│          ▼                       ▼                │   - Alert Dispatcher    │   │
│  ┌──────────────────────────────────────┐          │     (Twilio SMS)        │   │
│  │        Service / Domain Layer         │◄─────────┴──────────────────────┘   │
│  │  (business rules, threshold engine)   │                                      │
│  └───────┬───────────────────────────────┘                                      │
│          ▼                                                                       │
│  ┌──────────────────────────────────────┐                                      │
│  │     Data Access Layer (SQLAlchemy)     │                                      │
│  └───────┬───────────────────────────────┘                                      │
└──────────┼────────────────────────────────────────────────────────────────────┘
           ▼
   ┌───────────────┐        ┌──────────────────┐
   │  PostgreSQL    │        │  Redis (optional) │
   │  (system of    │        │  pub/sub for WS   │
   │   record)      │        │  fan-out + cache  │
   └───────────────┘        └──────────────────┘

                              ▲ WebSocket (live vitals/alerts) + REST (history, auth)
                              │
              ┌───────────────┴────────────────────┐
              │        FRONTEND — React (Vite)       │
              │  Caregiver Dashboard                 │
              │   - Live vitals charts (Recharts)    │
              │   - Emergency alert banner/toasts    │
              │   - Patient profile & history         │
              │   - Socket.io-client subscriptions    │
              └───────────────────────────────────────┘
```

### 1.2 Data Flow Summary

1. **Ingestion** — Sensor Emulator pushes vitals every N seconds via `POST /api/v1/vitals/ingest` (HTTP) or an MQTT topic `sensors/{device_uid}/vitals` (bridged into FastAPI via an MQTT client running as a background task).
2. **Persistence** — Every reading is written to the `vitals` hypertable-style table in PostgreSQL.
3. **Real-time fan-out** — On write, the same payload is pushed to all WebSocket subscribers on `/ws/vitals/{patient_id}`.
4. **Anomaly analysis** — A rolling-window background worker periodically (or on each batch) runs the Isolation Forest / LSTM model against recent vitals + behavioral features (sleep, activity, meal-time deviation) and writes to `anomaly_logs` if the anomaly score crosses threshold.
5. **Vision pipeline** — A separate async worker consumes camera frames, runs MediaPipe Pose / YOLOv8-Pose, computes fall heuristics (torso angle, centroid velocity, aspect-ratio collapse), and on positive detection writes to `fall_events`.
6. **Alerting** — Any anomaly/fall event that exceeds severity threshold creates a row in `alerts`, is pushed over `/ws/alerts/{caregiver_id}`, and triggers a Twilio SMS via the Alert Dispatcher.
7. **Caregiver dashboard** — React app authenticates, subscribes to WebSocket channels for its assigned patients, and renders live charts + alert banners; REST endpoints back historical views.

### 1.3 Why This Architecture

- **Separation of ingestion vs. analysis vs. delivery** lets each piece scale/fail independently (e.g., the CV worker can run on a GPU-enabled process separate from the API).
- **WebSockets for push, REST for pull** — dashboards need sub-second vitals updates (push) but also paginated historical queries (pull); mixing both is standard for telemetry dashboards.
- **PostgreSQL** chosen over MongoDB here because vitals/alerts are highly relational (patient ↔ device ↔ caregiver ↔ alert) and benefit from constraints, joins, and time-range indexing; JSONB columns are used where flexibility is still needed (e.g., raw device metadata, pose keypoints).

---

## 2. Backend Directory Structure (FastAPI)

```
backend/
├── app/
│   ├── main.py                      # FastAPI app factory, startup/shutdown events
│   ├── core/
│   │   ├── config.py                 # Pydantic Settings (env vars)
│   │   ├── security.py               # JWT, password hashing
│   │   └── logging_config.py
│   ├── db/
│   │   ├── session.py                 # SQLAlchemy engine/session
│   │   ├── base.py                    # Declarative base import hub
│   │   └── migrations/                # Alembic migrations
│   ├── models/                        # SQLAlchemy ORM models
│   │   ├── user.py
│   │   ├── patient.py
│   │   ├── sensor_device.py
│   │   ├── vitals.py
│   │   ├── anomaly_log.py
│   │   ├── fall_event.py
│   │   └── alert.py
│   ├── schemas/                       # Pydantic request/response models
│   │   ├── user.py
│   │   ├── patient.py
│   │   ├── vitals.py
│   │   ├── anomaly.py
│   │   └── alert.py
│   ├── api/
│   │   ├── deps.py                    # shared dependencies (auth, db session)
│   │   └── v1/
│   │       ├── router.py              # aggregates all routers
│   │       ├── auth.py
│   │       ├── patients.py
│   │       ├── devices.py
│   │       ├── vitals.py
│   │       ├── anomalies.py
│   │       ├── fall_events.py
│   │       └── alerts.py
│   ├── ws/
│   │   ├── connection_manager.py      # tracks active sockets per patient/caregiver
│   │   ├── vitals_socket.py
│   │   └── alerts_socket.py
│   ├── services/
│   │   ├── vitals_service.py
│   │   ├── alert_service.py           # threshold engine + Twilio dispatch
│   │   └── caregiver_service.py
│   ├── ml/
│   │   ├── anomaly_detector.py        # Isolation Forest / LSTM wrapper
│   │   ├── feature_engineering.py
│   │   └── model_registry/            # saved .pkl / .pt model artifacts
│   ├── cv/
│   │   ├── pose_estimator.py          # MediaPipe / YOLOv8-Pose wrapper
│   │   ├── fall_classifier.py         # heuristic + ML fall scoring
│   │   └── frame_source.py            # webcam / RTSP frame reader
│   ├── workers/
│   │   ├── anomaly_worker.py          # periodic anomaly scan (APScheduler/Celery)
│   │   ├── fall_detection_worker.py
│   │   └── mqtt_bridge.py
│   └── tests/
│       ├── test_vitals_api.py
│       ├── test_anomaly_engine.py
│       └── test_alerts.py
├── sensor_emulator/
│   ├── vitals_generator.py            # Phase 2
│   └── profiles/                      # per-patient simulation profiles
├── alembic.ini
├── requirements.txt
├── Dockerfile
└── docker-compose.yml
```

## 3. Frontend Directory Structure (React + Vite)

```
frontend/
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── api/
│   │   ├── axiosClient.js
│   │   ├── authApi.js
│   │   ├── patientsApi.js
│   │   ├── vitalsApi.js
│   │   └── alertsApi.js
│   ├── sockets/
│   │   ├── socketClient.js            # socket.io-client init
│   │   ├── useVitalsSocket.js         # custom hook
│   │   └── useAlertsSocket.js
│   ├── store/                         # Zustand/Redux slices
│   │   ├── authStore.js
│   │   ├── patientStore.js
│   │   └── alertStore.js
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── DashboardPage.jsx
│   │   ├── PatientDetailPage.jsx
│   │   └── AlertsPage.jsx
│   ├── components/
│   │   ├── layout/ (Sidebar, Topbar, ProtectedRoute)
│   │   ├── vitals/ (VitalsLineChart, VitalsCard, VitalsHistoryTable)
│   │   ├── alerts/ (AlertBanner, AlertToast, AlertList)
│   │   ├── patient/ (PatientCard, PatientProfileForm)
│   │   └── fall/ (FallEventCard, PoseSnapshotViewer)
│   ├── hooks/
│   │   └── useAuth.js
│   ├── utils/
│   │   ├── thresholds.js              # client-side display thresholds
│   │   └── formatters.js
│   └── styles/
│       └── index.css                  # Tailwind entrypoint
├── index.html
├── tailwind.config.js
├── vite.config.js
└── package.json
```

---

## 4. Database Schema (PostgreSQL)

Design notes:
- `users` holds both caregivers and admins; patients get their own row in `patients` (a patient may or may not have a login).
- `caregiver_patient_map` is a many-to-many join so one caregiver can monitor multiple patients and (optionally) a patient can have multiple caregivers.
- `vitals` is the highest-write-volume table — indexed on `(patient_id, recorded_at DESC)` for fast "latest N readings" queries.
- `anomaly_logs` and `fall_events` are kept separate because they come from different engines (tabular ML vs. CV) and have different payload shapes, but both feed into the unified `alerts` table for caregiver-facing notification.
- JSONB columns (`raw_payload`, `pose_keypoints`, `medical_conditions`) preserve flexibility without sacrificing relational integrity elsewhere.

The full DDL is in `schema.sql` (generated alongside this document). Summary of tables:

| Table | Purpose | Key Columns |
|---|---|---|
| `users` | Login identities for caregivers/admins | id, email, password_hash, role |
| `patients` | Elderly patient profile | id, full_name, dob, medical_conditions (JSONB) |
| `caregiver_patient_map` | Caregiver ↔ patient assignment | caregiver_id, patient_id, relation |
| `sensor_devices` | Registered wearables/cameras per patient | id, patient_id, device_type, device_uid, status |
| `vitals` | Time-series physiological readings | id, patient_id, device_id, heart_rate, spo2, bp, temp, recorded_at |
| `anomaly_logs` | Behavioral/vitals anomaly detections | id, patient_id, anomaly_type, score, severity, detected_at |
| `fall_events` | CV-detected fall incidents | id, patient_id, confidence_score, pose_keypoints, detected_at |
| `alerts` | Unified caregiver-facing alert feed | id, patient_id, source_type, severity, status, created_at |

---

## 5. API Endpoint Design

### 5.1 REST Endpoints (prefix `/api/v1`)

**Auth**
| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Register caregiver/admin account |
| POST | `/auth/login` | Returns JWT access + refresh token |
| POST | `/auth/refresh` | Rotate access token |
| GET | `/auth/me` | Current authenticated user profile |

**Patients**
| Method | Path | Description |
|---|---|---|
| POST | `/patients` | Create patient profile |
| GET | `/patients` | List patients assigned to current caregiver |
| GET | `/patients/{patient_id}` | Patient detail |
| PUT | `/patients/{patient_id}` | Update patient profile |
| DELETE | `/patients/{patient_id}` | Soft-delete/archive patient |
| POST | `/patients/{patient_id}/caregivers` | Assign a caregiver to a patient |

**Sensor Devices**
| Method | Path | Description |
|---|---|---|
| POST | `/devices` | Register a new device for a patient |
| GET | `/devices?patient_id=` | List devices for a patient |
| PATCH | `/devices/{device_id}/status` | Update online/offline/battery status |

**Vitals**
| Method | Path | Description |
|---|---|---|
| POST | `/vitals/ingest` | Emulator/device pushes a new reading (also fans out over WS) |
| GET | `/vitals/{patient_id}` | Paginated/time-ranged historical vitals (`?from=&to=&limit=`) |
| GET | `/vitals/{patient_id}/latest` | Most recent reading snapshot |

**Anomalies**
| Method | Path | Description |
|---|---|---|
| GET | `/anomalies/{patient_id}` | List behavioral/vitals anomalies (filter by date/severity) |
| GET | `/anomalies/{patient_id}/{anomaly_id}` | Anomaly detail incl. feature contribution |

**Fall Events**
| Method | Path | Description |
|---|---|---|
| GET | `/fall-events/{patient_id}` | List fall detections |
| GET | `/fall-events/{patient_id}/{event_id}` | Detail incl. pose snapshot reference |

**Alerts**
| Method | Path | Description |
|---|---|---|
| GET | `/alerts?status=&severity=` | List alerts (filterable) for caregiver's patients |
| POST | `/alerts/{alert_id}/acknowledge` | Mark alert as seen |
| POST | `/alerts/{alert_id}/resolve` | Close out an alert with resolution notes |

### 5.2 WebSocket Channels

| Channel | Direction | Payload | Purpose |
|---|---|---|---|
| `/ws/vitals/{patient_id}` | Server → Client | `{ heart_rate, spo2, bp_systolic, bp_diastolic, temperature, respiration_rate, recorded_at }` | Live chart updates on dashboard |
| `/ws/alerts/{caregiver_id}` | Server → Client | `{ alert_id, patient_id, source_type, severity, message, created_at }` | Real-time emergency notification, drives toast/SMS |
| `/ws/fall-detection/{patient_id}` | Server → Client | `{ event_id, confidence_score, detected_at, snapshot_url }` | Immediate fall alert with visual evidence |
| `/ws/device-status/{patient_id}` | Server → Client | `{ device_id, status, battery_level, last_seen }` | Device connectivity monitoring |

Auth for WebSockets: JWT passed as a query param or `Sec-WebSocket-Protocol` header at handshake, validated in `connection_manager.py` before accepting the connection.

---

## 6. Alert Severity & Threshold Model (used across Phases 2–3)

| Vital | Normal Range | Warning | Critical |
|---|---|---|---|
| Heart Rate (bpm) | 60–100 | 50–59 or 101–120 | <50 or >120 |
| SpO2 (%) | ≥95 | 90–94 | <90 |
| Systolic BP (mmHg) | 90–130 | 131–150 or 80–89 | >150 or <80 |
| Temperature (°C) | 36.1–37.2 | 37.3–38.0 or 35.5–36.0 | >38.0 or <35.5 |
| Respiration Rate (breaths/min) | 12–20 | 21–24 or 8–11 | >24 or <8 |

These static thresholds are the **rule-based safety net**; the Isolation Forest/LSTM engine in Phase 3 supplements this by catching *pattern* anomalies (e.g., a "normal-range" heart rate that's still a sharp deviation from that specific patient's baseline).

---

## Next Step

Once you confirm Phase 1 (architecture, directory layout, schema, API contract) looks correct, I'll proceed to **Phase 2: Simulated Vitals Telemetry Engine** — the Python sensor emulator daemon and the FastAPI ingestion endpoint + WebSocket fan-out implementation.
