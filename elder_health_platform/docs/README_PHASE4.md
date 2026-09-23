# Phase 4 — Caregiver React Dashboard

## What's included
```
frontend/
├── index.html
├── package.json / vite.config.js / tailwind.config.js / postcss.config.js
├── .env.example
└── src/
    ├── main.jsx / App.jsx
    ├── styles/index.css
    ├── api/
    │   ├── httpClient.js       # axios instance, env-driven base URL
    │   ├── vitalsApi.js         # GET latest vitals (REST fallback before first WS message)
    │   └── anomaliesApi.js       # GET anomaly history (fails soft — endpoint lands in integration phase)
    ├── sockets/
    │   └── socketClient.js        # reconnecting WebSocket wrapper (see note below)
    ├── hooks/
    │   ├── useVitalsSocket.js      # subscribes to /ws/vitals/{patientId}
    │   └── useAlertsSocket.js       # subscribes to /ws/alerts/{caregiverId}
    ├── store/
    │   └── dashboardStore.js         # Zustand: patients, anomaly log, active fall alert
    ├── components/
    │   ├── layout/ (Sidebar, Topbar)
    │   ├── vitals/ (VitalCard, VitalsMonitor, VitalsTrendChart)
    │   ├── anomalies/ (AnomalyLogTable)
    │   └── alerts/ (FallAlertModal)
    ├── pages/DashboardPage.jsx
    └── utils/ (thresholds.js, formatters.js)
```

Also included at the project root: **`caregiver_dashboard_preview.jsx`** — a
self-contained interactive version of this same dashboard with simulated
data, so you can see and click through the design (including triggering the
fall alert modal) without running the backend at all.

## ⚠️ One deliberate stack adjustment: socket.io-client → native WebSocket

The Phase 1 tech stack listed `socket.io-client`. The Phase 2 backend was
built with **FastAPI's native WebSocket support**, not `python-socketio` —
a plain `@app.websocket(...)` endpoint doesn't speak the Socket.IO
handshake protocol, so `socket.io-client` cannot connect to it as-is.

Rather than silently forcing a mismatch, `sockets/socketClient.js` uses the
browser's native `WebSocket` API (with reconnect + exponential backoff)
against the actual `/ws/vitals/{id}` and `/ws/alerts/{id}` endpoints
`main.py` serves. Every component talks to `createReconnectingSocket()`,
not `WebSocket` directly, so if you'd prefer to swap the backend to
`python-socketio` later, only this one file changes.

## 1. Install & run

```bash
cd frontend
npm install
cp .env.example .env   # point VITE_API_URL / VITE_WS_URL at your backend
npm run dev
```

Open http://localhost:5173. Make sure the Phase 2/3 backend is running
(`uvicorn app.main:app --reload --port 8000`) and the sensor emulator is
streaming, so `/ws/vitals/P-1001` etc. actually has data to push.

> **Verified:** this project was `npm install`'d and `npm run build`'d
> successfully during development — it compiles cleanly with no errors
> (one expected chunk-size warning from bundling recharts, not a bug).

## 2. Design notes

This is a monitoring console used repeatedly, often during a stressful
moment — clarity and low cognitive load mattered more than decoration, so
the design borrows directly from real clinical bedside monitors rather
than a generic "SaaS dashboard" look:

- **Per-vital trace colors** mirror the color coding used on actual
  multi-parameter patient monitors (HR green, SpO2 cyan/blue, BP
  magenta/pink, temp amber, respiration violet) — each `VitalCard` carries
  its color as a left border accent and sparkline stroke.
- **Monospace numerals** (`JetBrains Mono`) for every vital number and
  timestamp, echoing the segmented-digit readouts on real monitor hardware
  and giving the data visual authority distinct from the UI chrome.
- **Manrope** for headings/labels, **Inter** for table/body text — a
  deliberate three-face system (display / data / body) rather than one
  font doing every job.
- A calm ink-navy background (`#0B1220`), not pure black, so the palette
  reads as considered software rather than a "hacker terminal" cliché —
  color is spent almost entirely on the vitals/severity signal, not on
  chrome.
- The one deliberately bold moment is the **Emergency Fall Alert modal**:
  a pulsing red ring behind the alert icon, a full-screen dark scrim, and a
  primary red "Call Emergency Contact" action — reserved entirely for that
  one truly urgent state so it doesn't compete with the calm baseline UI.

## 3. Wiring notes for the next phase

- `anomaliesApi.fetchAnomalyLog` already calls the `/api/v1/anomalies/{patient_id}`
  endpoint specified in the Phase 1 API contract; it just isn't implemented
  in `main.py` yet (that's Phase 3's `anomaly_detector.py` output landing
  in the DB, wired up during integration).
- `FallAlertModal` expects an `AlertBroadcast` with `source_type: "fall_detection"`
  pushed over `/ws/alerts/{caregiver_id}` — `fall_detector.py` currently
  POSTs to `/api/v1/fall-events/ingest`, which also needs to be added to
  `main.py` (mirroring the vitals ingestion → alert broadcast pattern
  already built in Phase 2) so a confirmed fall actually reaches this
  modal end-to-end.
- Patient roster and `caregiverId` are hardcoded (`store/dashboardStore.js`)
  since authentication hasn't been built. Swap in a real `/api/v1/patients`
  fetch once auth exists.

## Next step

Phase 5 will wire these loose ends together (fall-event ingestion endpoint,
anomaly persistence, auth), add unit tests across the stack, and prepare
the viva Q&A materials.

## Update: mock data removed, patient roster is now real

The frontend no longer hardcodes anything — including the patient list
itself. Two backend changes made this possible (`GET /api/v1/patients` and
an automatic patient-record upsert on ingestion), and this was
end-to-end tested against a real local PostgreSQL instance during
development (three patients ingested → roster fetched → names, rooms,
initials, and live alert-severity status dots all came back correctly
derived from the ingested data, including catching and fixing a real bug
where "Mr. Arun Mehta" initialed as "MM" instead of "AM" because of the
honorific prefix).

**What changed:**
- `backend/app/main.py` — `_upsert_patient()` creates/updates a real
  `patients` row from whatever `display_name`/`room` the ingesting device
  sends (falls back to the raw `patient_id` if no name is given, never
  invents one). New `GET /api/v1/patients` returns this real roster,
  including each patient's most recent alert severity for the status dot.
- `backend/app/models.py` — `Patient` gained `room_or_address` and
  `external_id` (the friendly id like `P-1001` that WebSocket channels are
  keyed by, since it differs from the internal UUID primary key).
- `backend/sensor_emulator/sensor_emulator.py` — now sends `display_name`
  and `room` on every reading, so patient identity flows from real
  ingested data rather than the frontend guessing it.
- `frontend/src/api/patientsApi.js` — new, fetches the real roster.
- `frontend/src/store/dashboardStore.js` — `patients` is now fetched state,
  not a hardcoded array. `DashboardPage` polls it every 15s so new patients
  or status changes show up without a manual refresh.
- Removed entirely: the "Simulate Fall Alert" demo button and its
  `onDemoFallAlert` plumbing in `PatientChipSwitcher`. Fall alerts now only
  ever arrive from the real `/ws/alerts/{caregiver_id}` channel.
- If no patients exist yet (fresh database, emulator not started), the
  dashboard shows an explicit empty state rather than silently rendering
  blank or fake cards.

**Still a known placeholder, not mock data:** `DEMO_CAREGIVER_ID` in
`.env` / `dashboardStore.js`. This isn't invented application data — it's
a stand-in for the caregiver identity that would normally come from a
login session, which hasn't been built yet. Set
`DEFAULT_CAREGIVER_ID` in the backend `.env` to the same UUID so newly
ingested patients auto-route their alerts there; otherwise use the
`/api/v1/dev/assign-caregiver` endpoint manually per patient.

## Update: auth, invite-code linking, and live ML/CV alert integration

Several of this doc's open items are now closed:

- **`DEMO_CAREGIVER_ID` is gone.** Caregiver signup/login is real (MongoDB +
  JWT — `backend/app/auth/`), `caregiverId` in the frontend now comes from
  the authenticated session (`store/authStore.js`), and `GET /api/v1/patients`
  is scoped server-side to each caregiver's own roster via
  `caregiver_patient_map`, linked through per-patient invite codes
  (`POST /api/v1/patients/link`) rather than a hardcoded id.
- **`/api/v1/fall-events/ingest` now exists.** `fall_detector.py`'s
  `FallAlertDispatcher` reaches a real endpoint, which creates an `Alert`
  and broadcasts it over `/ws/alerts/{caregiver_id}` — a confirmed fall
  now actually reaches `FallAlertModal` end-to-end, not just the CV
  process's own console.
- **`anomaly_detector.py`'s Isolation Forest is now live**, not just an
  offline CLI. `main.py` runs a background scan loop scoring each
  patient's real vitals history on a rolling window basis (see
  `README_PHASE3.md`'s "Live integration" section for the full design,
  including a real bug caught during testing: `IsolationForest.predict()`
  alone missed an obvious anomaly at small sample sizes, fixed with a
  z-score backstop).
- **`GET /api/v1/anomalies/{patient_id}` now exists**, so the alerts the
  two points above create are actually readable after the fact — this doc
  originally flagged it as unimplemented; `AnomalyLogTable` was silently
  getting an empty list every time before this. Scoped to the requesting
  caregiver's own roster, same as the patients list.
