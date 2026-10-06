"""
main.py
=======
FastAPI entrypoint for Phase 2: receives vitals from the sensor emulator
(or real devices), persists them, evaluates rule-based thresholds, and
broadcasts live updates + alerts over WebSockets to subscribed dashboards.

Run:
    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import asyncio
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.routes import router as auth_router, get_current_caregiver
from app.auth.schemas import CaregiverResponse
from app.config import settings
from app.database import AsyncSessionLocal, Base, engine, get_db
from app.ml.anomaly_detector import BehavioralAnomalyDetector
from app.ml.vitals_features import VITALS_FEATURE_COLUMNS, bucket_by_window, extract_window_features
from app.models import Alert, CaregiverPatientMap, Patient, SensorDevice, Vitals
from app.mongo import close_mongo_client, init_mongo_indexes
from app.schemas import (
    AlertBroadcast,
    AlertSource,
    AnomalyLogEntry,
    FallEventIngestPayload,
    LinkPatientRequest,
    PatientResponse,
    SeverityLevel,
    VitalsBroadcast,
    VitalsIngestPayload,
    VitalsResponse,
)
from app.thresholds import evaluate_thresholds
from app.websocket_manager import ws_hub

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s")
logger = logging.getLogger("main")

app = FastAPI(title=settings.APP_NAME, version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)


# ---------------------------------------------------------------------------
# Live anomaly detection worker
# ---------------------------------------------------------------------------
def _window_bounds(window_key: str, window_minutes: int) -> tuple[datetime, datetime]:
    start = datetime.fromisoformat(window_key)
    return start, start + timedelta(minutes=window_minutes)


async def _run_anomaly_scan() -> None:
    """
    One pass of the live anomaly-detection worker: for every patient with
    enough vitals history, bucket their readings into rolling windows
    (app/ml/vitals_features.py), fit a per-patient Isolation Forest on all
    but the most recent *closed* window, and score that window against the
    baseline. This is what actually connects app/ml/anomaly_detector.py's
    model to the running system — previously it only ran as an offline CLI
    against synthetic data (see docs/README_PHASE3.md).
    """
    if not settings.PERSIST_TO_DB:
        return  # needs real vitals history in Postgres to have anything to score

    async with AsyncSessionLocal() as db:
        patients = (await db.execute(select(Patient.id, Patient.external_id))).all()

        for patient_uuid, external_id in patients:
            result = await db.execute(
                select(Vitals).where(Vitals.patient_id == patient_uuid).order_by(Vitals.recorded_at.asc())
            )
            rows = result.scalars().all()
            if not rows:
                continue

            buckets = bucket_by_window(rows, settings.ANOMALY_WINDOW_MINUTES)
            window_keys = sorted(buckets.keys())
            if len(window_keys) < settings.ANOMALY_MIN_BASELINE_WINDOWS + 1:
                continue  # not enough rolling history yet to fit a baseline

            *baseline_keys, current_key = window_keys
            current_start, current_end = _window_bounds(current_key, settings.ANOMALY_WINDOW_MINUTES)
            if datetime.now(timezone.utc) < current_end:
                continue  # most recent window is still accumulating readings

            last_ml_alert = await db.execute(
                select(Alert.created_at)
                .where(Alert.patient_id == patient_uuid, Alert.source_type == AlertSource.ANOMALY_ML.value)
                .order_by(Alert.created_at.desc())
                .limit(1)
            )
            last_created_at = last_ml_alert.scalar_one_or_none()
            if last_created_at and current_start <= last_created_at < current_end:
                continue  # already scored/alerted this window

            baseline_df = pd.DataFrame([extract_window_features(buckets[k], k) for k in baseline_keys])
            current_features = extract_window_features(buckets[current_key], current_key)

            try:
                # Small per-patient baselines (a handful of rolling windows,
                # not the 14-30 days anomaly_detector.py's CLI demo assumes)
                # are a known limitation of scoring against a live/short
                # session rather than weeks of history — flagged here rather
                # than glossed over.
                detector = BehavioralAnomalyDetector(feature_columns=VITALS_FEATURE_COLUMNS)
                detector.fit(baseline_df)
                scored = detector.predict(current_features)
            except Exception as exc:
                logger.error("Anomaly scan failed for patient %s: %s", external_id, exc)
                continue

            max_abs_z = max((abs(f["z_score"]) for f in scored.contributing_features), default=0.0)
            is_anomaly = scored.is_anomaly or max_abs_z >= settings.ANOMALY_Z_SCORE_THRESHOLD
            if not is_anomaly:
                continue

            severity = (
                SeverityLevel(scored.severity) if scored.is_anomaly
                else (SeverityLevel.CRITICAL if max_abs_z >= settings.ANOMALY_Z_SCORE_THRESHOLD * 1.7 else SeverityLevel.WARNING)
            )
            top = scored.contributing_features[0] if scored.contributing_features else None
            detail = (
                f"{top['feature'].replace('_', ' ')} was {top['value']} (usual ~{top['baseline_mean']}, {top['z_score']:+.1f} SD)"
                if top else "recent vitals pattern deviates from this patient's baseline"
            )
            message = f"Behavioral anomaly detected — {detail}"

            await _create_and_broadcast_alert(
                db, patient_uuid, external_id or str(patient_uuid),
                AlertSource.ANOMALY_ML, severity, message,
            )


async def _anomaly_scan_loop() -> None:
    while True:
        try:
            await _run_anomaly_scan()
        except Exception:
            logger.exception("Anomaly scan loop iteration failed")
        await asyncio.sleep(settings.ANOMALY_SCAN_INTERVAL_SECONDS)


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def on_startup() -> None:
    if settings.PERSIST_TO_DB:
        async with engine.begin() as conn:
            # In production, migrations (Alembic) own schema changes. This
            # create_all is a convenience for local/dev bring-up only.
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database ready at %s", settings.DATABASE_URL)
    else:
        logger.warning("PERSIST_TO_DB is False — running in in-memory/broadcast-only mode")

    # Caregiver signup/login credentials live in MongoDB, independent of
    # PERSIST_TO_DB (which only toggles the Postgres telemetry writes).
    await init_mongo_indexes()

    app.state.anomaly_scan_task = asyncio.create_task(_anomaly_scan_loop())
    logger.info(
        "Anomaly scan worker started (window=%dmin, baseline=%d windows, interval=%ds)",
        settings.ANOMALY_WINDOW_MINUTES, settings.ANOMALY_MIN_BASELINE_WINDOWS, settings.ANOMALY_SCAN_INTERVAL_SECONDS,
    )


@app.on_event("shutdown")
async def on_shutdown() -> None:
    task = getattr(app.state, "anomaly_scan_task", None)
    if task:
        task.cancel()
    await engine.dispose()
    await close_mongo_client()


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "time": datetime.now(timezone.utc).isoformat()}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
async def _resolve_device(db: AsyncSession, patient_id: uuid.UUID, device_uid: str) -> SensorDevice | None:
    """Look up (or lazily register) the device so vitals rows can FK to it."""
    result = await db.execute(select(SensorDevice).where(SensorDevice.device_uid == device_uid))
    device = result.scalar_one_or_none()
    if device is None:
        device = SensorDevice(patient_id=patient_id, device_uid=device_uid, status="online")
        db.add(device)
        await db.flush()
    else:
        device.status = "online"
        device.last_seen_at = datetime.now(timezone.utc)
    return device


async def _caregiver_ids_for_patient(db: AsyncSession, patient_id: uuid.UUID) -> list[str]:
    result = await db.execute(
        select(CaregiverPatientMap.caregiver_id).where(CaregiverPatientMap.patient_id == patient_id)
    )
    return [str(row[0]) for row in result.all()]


def _safe_patient_uuid(raw_patient_id: str) -> uuid.UUID:
    """
    The emulator uses friendly ids like 'P-1001' for readability. Deterministically
    map non-UUID identifiers to a stable UUID (v5) so foreign keys still work
    without requiring the emulator to know real database UUIDs up front.
    """
    try:
        return uuid.UUID(raw_patient_id)
    except ValueError:
        return uuid.uuid5(uuid.NAMESPACE_DNS, f"elder-health-platform.patient.{raw_patient_id}")


# Excludes visually-ambiguous characters (0/O, 1/I/L) since this code gets
# read off a screen and typed by hand.
_INVITE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def _generate_invite_code(length: int = 8) -> str:
    return "".join(secrets.choice(_INVITE_CODE_ALPHABET) for _ in range(length))


async def _upsert_patient(
    db: AsyncSession,
    patient_uuid: uuid.UUID,
    external_id: str,
    display_name: str | None,
    room: str | None,
) -> Patient:
    """
    Ensures a real `patients` row exists for whoever is sending data, so the
    frontend's patient roster (`GET /api/v1/patients`) is always backed by
    actual ingested data rather than anything hardcoded client-side. If the
    sender didn't provide a display_name (e.g. a bare device just posting
    numbers), falls back to the external_id itself rather than inventing one.
    """
    result = await db.execute(select(Patient).where(Patient.id == patient_uuid))
    patient = result.scalar_one_or_none()

    if patient is None:
        patient = Patient(
            id=patient_uuid,
            external_id=external_id,
            full_name=display_name or external_id,
            room_or_address=room,
            invite_code=_generate_invite_code(),
        )
        db.add(patient)
        await db.flush()
        logger.info("New patient %r created — invite code: %s", patient.full_name, patient.invite_code)

        # Convenience for local/demo bring-up: auto-route this new patient's
        # alerts to a default caregiver if one is configured, so a fresh
        # checkout doesn't require the caregiver to redeem an invite code
        # first. In real use, caregivers link themselves via the patient's
        # invite_code instead (POST /api/v1/patients/link) — leave this
        # unset outside local/demo bring-up.
        if settings.DEFAULT_CAREGIVER_ID:
            db.add(CaregiverPatientMap(
                caregiver_id=settings.DEFAULT_CAREGIVER_ID,
                patient_id=patient_uuid,
            ))
            await db.flush()
    else:
        changed = False
        if display_name and patient.full_name != display_name:
            patient.full_name = display_name
            changed = True
        if room and patient.room_or_address != room:
            patient.room_or_address = room
            changed = True
        if patient.external_id != external_id:
            patient.external_id = external_id
            changed = True
        if patient.invite_code is None:
            # Backfill for patients created before invite codes existed.
            patient.invite_code = _generate_invite_code()
            changed = True
        if changed:
            await db.flush()

    return patient


async def _latest_alert_severity(db: AsyncSession, patient_uuid: uuid.UUID) -> SeverityLevel:
    result = await db.execute(
        select(Alert.severity).where(Alert.patient_id == patient_uuid).order_by(Alert.created_at.desc()).limit(1)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return SeverityLevel.INFO
    return SeverityLevel(row)


async def _create_and_broadcast_alert(
    db: AsyncSession,
    patient_uuid: uuid.UUID,
    external_patient_id: str,
    source_type: AlertSource,
    severity: SeverityLevel,
    message: str,
    created_at: datetime | None = None,
) -> AlertBroadcast:
    """
    Persists an Alert row (when PERSIST_TO_DB) and fans it out over
    /ws/alerts/{caregiver_id} to every caregiver linked to this patient.
    Shared by the rule-based threshold path, the fall-detection ingest
    endpoint, and the live anomaly-detection background worker below —
    one code path so every alert source behaves identically.
    """
    alert_id = uuid.uuid4()
    created_at = created_at or datetime.now(timezone.utc)

    if settings.PERSIST_TO_DB:
        db.add(Alert(
            id=alert_id,
            patient_id=patient_uuid,
            source_type=source_type.value,
            severity=severity.value,
            message=message,
        ))
        await db.commit()

    alert_payload = AlertBroadcast(
        alert_id=str(alert_id),
        patient_id=external_patient_id,
        source_type=source_type,
        severity=severity,
        message=message,
        created_at=created_at,
    )
    logger.warning("ALERT[%s/%s] patient=%s %s", source_type.value, severity.value.upper(), external_patient_id, message)

    caregiver_ids = await _caregiver_ids_for_patient(db, patient_uuid) if settings.PERSIST_TO_DB else []
    for caregiver_id in caregiver_ids:
        await ws_hub.broadcast_alert_to_caregiver(caregiver_id, alert_payload.model_dump(mode="json"))

    return alert_payload


HONORIFICS = {"mr", "mr.", "mrs", "mrs.", "ms", "ms.", "dr", "dr.", "miss", "master"}


def _initials(name: str) -> str:
    parts = [p for p in name.split() if p and p.lower().strip(".") not in {h.strip(".") for h in HONORIFICS}]
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()


# ---------------------------------------------------------------------------
# REST: vitals ingestion
# ---------------------------------------------------------------------------
@app.post("/api/v1/vitals/ingest", response_model=VitalsResponse, status_code=201)
async def ingest_vitals(payload: VitalsIngestPayload, db: AsyncSession = Depends(get_db)) -> VitalsResponse:
    patient_uuid = _safe_patient_uuid(payload.patient_id)

    vitals_row = Vitals(
        patient_id=patient_uuid,
        heart_rate=payload.heart_rate,
        spo2=payload.spo2,
        bp_systolic=payload.bp_systolic,
        bp_diastolic=payload.bp_diastolic,
        temperature=payload.temperature,
        respiration_rate=payload.respiration_rate,
        steps_count=payload.steps_count or 0,
        raw_payload=payload.model_dump(mode="json"),
        recorded_at=payload.recorded_at,
    )

    if settings.PERSIST_TO_DB:
        await _upsert_patient(db, patient_uuid, payload.patient_id, payload.display_name, payload.room)
        device = await _resolve_device(db, patient_uuid, payload.device_uid)
        vitals_row.device_id = device.id
        db.add(vitals_row)
        await db.flush()
        await db.commit()
        await db.refresh(vitals_row)
    else:
        vitals_row.id = -1  # placeholder when running without persistence

    # --- Rule-based threshold evaluation (Phase 1 safety net) ---
    findings = evaluate_thresholds(payload)
    flags = [flag for flag, _severity, _msg in findings]

    # --- Broadcast the live vitals reading to dashboard subscribers ---
    broadcast = VitalsBroadcast(
        patient_id=payload.patient_id,
        heart_rate=payload.heart_rate,
        spo2=payload.spo2,
        bp_systolic=payload.bp_systolic,
        bp_diastolic=payload.bp_diastolic,
        temperature=payload.temperature,
        respiration_rate=payload.respiration_rate,
        steps_count=payload.steps_count or 0,
        recorded_at=payload.recorded_at,
        flags=flags,
    )
    await ws_hub.broadcast_vitals(payload.patient_id, broadcast.model_dump(mode="json"))

    # --- Create + broadcast an alert for every threshold breach ---
    if findings:
        for flag_code, severity, message in findings:
            await _create_and_broadcast_alert(
                db, patient_uuid, payload.patient_id, AlertSource.VITALS_RULE, severity, message,
            )

    return VitalsResponse(
        id=vitals_row.id,
        patient_id=payload.patient_id,
        device_uid=payload.device_uid,
        heart_rate=payload.heart_rate,
        spo2=payload.spo2,
        bp_systolic=payload.bp_systolic,
        bp_diastolic=payload.bp_diastolic,
        temperature=payload.temperature,
        respiration_rate=payload.respiration_rate,
        steps_count=payload.steps_count or 0,
        recorded_at=payload.recorded_at,
    )


@app.post("/api/v1/fall-events/ingest", response_model=AlertBroadcast, status_code=201)
async def ingest_fall_event(payload: FallEventIngestPayload, db: AsyncSession = Depends(get_db)) -> AlertBroadcast:
    """
    Receives a confirmed fall detection from app/cv/fall_detector.py's
    FallAlertDispatcher (run as a separate process pointed at this API via
    --api-url). This is what actually connects the CV pipeline to the live
    dashboard — previously this endpoint didn't exist, so fall_detector.py
    could only log to its own console.
    """
    patient_uuid = _safe_patient_uuid(payload.patient_id)

    if settings.PERSIST_TO_DB:
        # A fall event may be the very first thing ever received for a
        # patient (e.g. a camera-only room with no wearable), so make sure
        # a patient row — and its invite code — exist.
        await _upsert_patient(db, patient_uuid, payload.patient_id, None, None)

    severity = SeverityLevel.CRITICAL if payload.confidence_score >= 0.5 else SeverityLevel.WARNING
    message = f"Possible fall detected (pose confidence {payload.confidence_score:.0%})"

    return await _create_and_broadcast_alert(
        db, patient_uuid, payload.patient_id, AlertSource.FALL_DETECTION, severity, message,
        created_at=payload.detected_at,
    )


@app.get("/api/v1/patients", response_model=list[PatientResponse])
async def list_patients(
    caregiver: CaregiverResponse = Depends(get_current_caregiver),
    db: AsyncSession = Depends(get_db),
) -> list[PatientResponse]:
    """
    Real patient roster — but now scoped to only the patients linked to the
    requesting caregiver via `caregiver_patient_map` (see /api/v1/patients/link
    below for how that link gets created). This is what the frontend's
    sidebar/patient switcher fetches.
    """
    result = await db.execute(
        select(Patient)
        .join(CaregiverPatientMap, CaregiverPatientMap.patient_id == Patient.id)
        .where(CaregiverPatientMap.caregiver_id == caregiver.id)
        .order_by(Patient.full_name)
    )
    patients = result.scalars().all()

    responses = []
    for p in patients:
        severity = await _latest_alert_severity(db, p.id)
        responses.append(PatientResponse(
            id=p.external_id or str(p.id),
            full_name=p.full_name,
            room=p.room_or_address,
            initials=_initials(p.full_name),
            latest_status=severity,
            invite_code=p.invite_code,
        ))
    return responses


@app.post("/api/v1/patients/link", response_model=PatientResponse)
async def link_patient(
    payload: LinkPatientRequest,
    caregiver: CaregiverResponse = Depends(get_current_caregiver),
    db: AsyncSession = Depends(get_db),
) -> PatientResponse:
    """
    Redeem a patient's invite code to add that patient to the requesting
    caregiver's roster. This is the caregiver-facing counterpart to the
    /api/v1/dev/assign-caregiver debug endpoint below — the real way a
    patient ends up linked to a caregiver.
    """
    code = payload.invite_code.strip().upper()
    result = await db.execute(select(Patient).where(Patient.invite_code == code))
    patient = result.scalar_one_or_none()
    if patient is None:
        raise HTTPException(status_code=404, detail="No patient found for that invite code.")

    existing = await db.execute(
        select(CaregiverPatientMap).where(
            CaregiverPatientMap.caregiver_id == caregiver.id,
            CaregiverPatientMap.patient_id == patient.id,
        )
    )
    if existing.scalar_one_or_none() is None:
        db.add(CaregiverPatientMap(caregiver_id=caregiver.id, patient_id=patient.id, relation="linked"))
        await db.commit()

    severity = await _latest_alert_severity(db, patient.id)
    return PatientResponse(
        id=patient.external_id or str(patient.id),
        full_name=patient.full_name,
        room=patient.room_or_address,
        initials=_initials(patient.full_name),
        latest_status=severity,
        invite_code=patient.invite_code,
    )


@app.get("/api/v1/vitals/{patient_id}/latest", response_model=VitalsResponse)
async def latest_vitals(patient_id: str, db: AsyncSession = Depends(get_db)) -> VitalsResponse:
    patient_uuid = _safe_patient_uuid(patient_id)
    result = await db.execute(
        select(Vitals).where(Vitals.patient_id == patient_uuid).order_by(Vitals.recorded_at.desc()).limit(1)
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="No vitals recorded yet for this patient")

    return VitalsResponse(
        id=row.id,
        patient_id=patient_id,
        device_uid=row.device_id and str(row.device_id) or "",
        heart_rate=row.heart_rate,
        spo2=row.spo2,
        bp_systolic=row.bp_systolic,
        bp_diastolic=row.bp_diastolic,
        temperature=float(row.temperature),
        respiration_rate=row.respiration_rate,
        steps_count=row.steps_count,
        recorded_at=row.recorded_at,
    )


ALERT_SOURCE_LABELS = {
    AlertSource.VITALS_RULE.value: "Vitals Rule",
    AlertSource.ANOMALY_ML.value: "Behavioral",
    AlertSource.FALL_DETECTION.value: "Fall Detection",
    AlertSource.MANUAL.value: "Manual",
}


@app.get("/api/v1/anomalies/{patient_id}", response_model=list[AnomalyLogEntry])
async def get_anomaly_log(
    patient_id: str,
    caregiver: CaregiverResponse = Depends(get_current_caregiver),
    db: AsyncSession = Depends(get_db),
) -> list[AnomalyLogEntry]:
    """
    Historical alert log for a patient — backs the frontend's Alert Logs
    page (AnomalyLogTable), which previously had nothing to read since this
    endpoint didn't exist (anomaliesApi.fetchAnomalyLog failed soft to []).
    Every alert this system creates — rule-based, ML, or fall-detection —
    lands in the same `alerts` table, so one query here covers all three.

    Scoped to the requesting caregiver's own roster, same as
    GET /api/v1/patients — closes the gap where any logged-in caregiver
    could previously read any patient's history by guessing their id.
    """
    patient_uuid = _safe_patient_uuid(patient_id)

    linked = await db.execute(
        select(CaregiverPatientMap).where(
            CaregiverPatientMap.caregiver_id == caregiver.id,
            CaregiverPatientMap.patient_id == patient_uuid,
        )
    )
    if linked.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Patient not found in your roster.")

    result = await db.execute(
        select(Alert).where(Alert.patient_id == patient_uuid).order_by(Alert.created_at.desc()).limit(200)
    )
    rows = result.scalars().all()

    return [
        AnomalyLogEntry(
            id=str(r.id),
            time=r.created_at,
            type=ALERT_SOURCE_LABELS.get(r.source_type, r.source_type),
            severity=SeverityLevel(r.severity),
            description=r.message,
            status=r.status,
        )
        for r in rows
    ]


# ---------------------------------------------------------------------------
# WebSockets
# ---------------------------------------------------------------------------
@app.websocket("/ws/vitals/{patient_id}")
async def ws_vitals(websocket: WebSocket, patient_id: str) -> None:
    await ws_hub.vitals.connect(patient_id, websocket)
    try:
        while True:
            # Dashboard doesn't need to send anything; we just keep the
            # connection alive and drain any client pings/keepalive frames.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await ws_hub.vitals.disconnect(patient_id, websocket)


@app.websocket("/ws/alerts/{caregiver_id}")
async def ws_alerts(websocket: WebSocket, caregiver_id: str) -> None:
    await ws_hub.alerts.connect(caregiver_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await ws_hub.alerts.disconnect(caregiver_id, websocket)


# ---------------------------------------------------------------------------
# Dev convenience: manually seed a caregiver<->patient mapping without going
# through the invite-code flow (/api/v1/patients/link). Handy for local
# testing/scripts; caregivers in the real app link via invite code instead.
# ---------------------------------------------------------------------------
@app.post("/api/v1/dev/assign-caregiver")
async def dev_assign_caregiver(caregiver_id: str, patient_id: str, db: AsyncSession = Depends(get_db)) -> dict:
    if not settings.PERSIST_TO_DB:
        raise HTTPException(status_code=400, detail="PERSIST_TO_DB is disabled")
    mapping = CaregiverPatientMap(
        caregiver_id=caregiver_id,
        patient_id=_safe_patient_uuid(patient_id),
    )
    db.add(mapping)
    await db.commit()
    return {"status": "assigned", "caregiver_id": caregiver_id, "patient_id": patient_id}
