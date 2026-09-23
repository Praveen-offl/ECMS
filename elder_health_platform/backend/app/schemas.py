"""
schemas.py
==========
Pydantic models defining the request/response/broadcast contracts for the
vitals ingestion API and WebSocket channels. Kept separate from the
SQLAlchemy ORM models (app/models.py) so the wire format can evolve
independently of the storage schema.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Enums (mirror the Postgres ENUM types defined in schema.sql)
# ---------------------------------------------------------------------------
class SeverityLevel(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class AlertSource(str, Enum):
    VITALS_RULE = "vitals_rule"
    ANOMALY_ML = "anomaly_ml"
    FALL_DETECTION = "fall_detection"
    MANUAL = "manual"


# ---------------------------------------------------------------------------
# Inbound: what the sensor emulator / real device posts
# ---------------------------------------------------------------------------
class VitalsMeta(BaseModel):
    simulated: bool = False
    anomaly_active: bool = False
    anomaly_type: Optional[str] = None


class VitalsIngestPayload(BaseModel):
    patient_id: str = Field(..., description="UUID or emulator patient identifier")
    device_uid: str = Field(..., description="Physical/emulated device identifier")

    # Optional identity fields so a Patient record can be created/kept in
    # sync from real ingested data, instead of the frontend ever having to
    # hardcode who a patient_id belongs to.
    display_name: Optional[str] = Field(default=None, description="Patient full name, if known to the sender")
    room: Optional[str] = Field(default=None, description="Room/location label, if known to the sender")

    heart_rate: int = Field(..., ge=0, le=300, description="Beats per minute")
    spo2: int = Field(..., ge=0, le=100, description="Blood oxygen saturation %")
    bp_systolic: int = Field(..., ge=0, le=300)
    bp_diastolic: int = Field(..., ge=0, le=200)
    temperature: float = Field(..., ge=25.0, le=45.0, description="Degrees Celsius")
    respiration_rate: int = Field(..., ge=0, le=80, description="Breaths per minute")
    steps_count: Optional[int] = Field(default=0, ge=0)

    recorded_at: datetime = Field(default_factory=datetime.utcnow)
    meta: Optional[VitalsMeta] = None

    @field_validator("bp_diastolic")
    @classmethod
    def diastolic_below_systolic(cls, v: int, info) -> int:
        systolic = info.data.get("bp_systolic")
        if systolic is not None and v >= systolic:
            raise ValueError("bp_diastolic must be lower than bp_systolic")
        return v


# ---------------------------------------------------------------------------
# Outbound: persisted reading returned via REST
# ---------------------------------------------------------------------------
class VitalsResponse(BaseModel):
    id: int
    patient_id: str
    device_uid: str
    heart_rate: int
    spo2: int
    bp_systolic: int
    bp_diastolic: int
    temperature: float
    respiration_rate: int
    steps_count: int
    recorded_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Outbound: WebSocket broadcast envelopes
# ---------------------------------------------------------------------------
class VitalsBroadcast(BaseModel):
    """Payload pushed to /ws/vitals/{patient_id} on every new reading."""
    type: str = "vitals_update"
    patient_id: str
    heart_rate: int
    spo2: int
    bp_systolic: int
    bp_diastolic: int
    temperature: float
    respiration_rate: int
    steps_count: int
    recorded_at: datetime
    flags: list[str] = Field(default_factory=list, description="Threshold breach labels, e.g. ['heart_rate_critical']")


class AlertBroadcast(BaseModel):
    """Payload pushed to /ws/alerts/{caregiver_id} when a threshold/anomaly/fall alert fires."""
    type: str = "alert"
    alert_id: str
    patient_id: str
    source_type: AlertSource
    severity: SeverityLevel
    message: str
    created_at: datetime


# ---------------------------------------------------------------------------
# Outbound: historical alert log (backs GET /api/v1/anomalies/{patient_id},
# which the frontend's Alert Logs page reads — shape matches what
# AnomalyLogTable.jsx already expects: id/time/type/severity/description/status)
# ---------------------------------------------------------------------------
class AnomalyLogEntry(BaseModel):
    id: str
    time: datetime
    type: str
    severity: SeverityLevel
    description: str
    status: str


class DeviceStatusBroadcast(BaseModel):
    type: str = "device_status"
    device_uid: str
    patient_id: str
    status: str
    last_seen_at: datetime


# ---------------------------------------------------------------------------
# Outbound: patient roster (backs the frontend's patient list/switcher —
# no data is ever hardcoded client-side, it all comes from here)
# ---------------------------------------------------------------------------
class PatientResponse(BaseModel):
    id: str
    full_name: str
    room: Optional[str] = None
    initials: str
    latest_status: SeverityLevel = SeverityLevel.INFO
    # Only ever populated for a caregiver who is already linked to this
    # patient (see /api/v1/patients and /api/v1/patients/link in main.py) —
    # it's the code that grants access, so it's not exposed more broadly.
    invite_code: Optional[str] = None

    class Config:
        from_attributes = True


class LinkPatientRequest(BaseModel):
    invite_code: str = Field(min_length=4, max_length=12)


# ---------------------------------------------------------------------------
# Inbound: fall events from the CV pipeline (app/cv/fall_detector.py's
# FallAlertDispatcher._post_to_backend posts exactly this shape)
# ---------------------------------------------------------------------------
class FallEventIngestPayload(BaseModel):
    patient_id: str
    confidence_score: float = Field(ge=0.0, le=1.0)
    pose_keypoints: dict = Field(default_factory=dict)
    detected_at: datetime
