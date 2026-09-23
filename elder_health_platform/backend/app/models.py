"""
models.py
=========
SQLAlchemy ORM models mapping to the tables defined in Phase 1's schema.sql.
Only the subset needed for the telemetry ingestion pipeline (Phase 2) is
declared here; anomaly_logs / fall_events / full user auth models are
introduced in Phase 3 when those subsystems are built.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    room_or_address: Mapped[str | None] = mapped_column(String(150), nullable=True)
    # The friendly identifier sent by the ingesting device/emulator (e.g. "P-1001").
    # WebSocket channels are keyed by this string, not the internal UUID, so the
    # frontend needs it back verbatim to know what to subscribe to.
    external_id: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    # Short human-enterable code a caregiver types in once to link themselves
    # to this patient (see /api/v1/patients/link). Generated at patient
    # creation time — see _generate_invite_code() in main.py.
    invite_code: Mapped[str | None] = mapped_column(String(12), unique=True, nullable=True)


class CaregiverPatientMap(Base):
    __tablename__ = "caregiver_patient_map"

    # Caregivers now live in MongoDB (see app/auth/), identified by their
    # Mongo ObjectId string — NOT a Postgres UUID — so this column has to be
    # a plain string rather than the UUID type used elsewhere in this file.
    caregiver_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    relation: Mapped[str] = mapped_column(String(50), default="primary")
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SensorDevice(Base):
    __tablename__ = "sensor_devices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    device_uid: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="offline")
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Vitals(Base):
    __tablename__ = "vitals"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    device_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("sensor_devices.id"), nullable=True)

    heart_rate: Mapped[int] = mapped_column(Integer, nullable=True)
    spo2: Mapped[int] = mapped_column(Integer, nullable=True)
    bp_systolic: Mapped[int] = mapped_column(Integer, nullable=True)
    bp_diastolic: Mapped[int] = mapped_column(Integer, nullable=True)
    temperature: Mapped[float] = mapped_column(Numeric(4, 1), nullable=True)
    respiration_rate: Mapped[int] = mapped_column(Integer, nullable=True)
    steps_count: Mapped[int] = mapped_column(Integer, nullable=True)
    raw_payload: Mapped[dict] = mapped_column(JSONB, nullable=True)

    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    source_type: Mapped[str] = mapped_column(String(30), nullable=False)
    source_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    sms_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
