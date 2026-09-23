-- ============================================================================
-- Elderly Health Monitoring Platform — PostgreSQL Schema (Phase 1)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- ENUM TYPES
-- ----------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('admin', 'caregiver');
CREATE TYPE device_type AS ENUM ('wearable', 'camera', 'motion_sensor', 'other');
CREATE TYPE device_status AS ENUM ('online', 'offline', 'low_battery', 'error');
CREATE TYPE anomaly_type AS ENUM ('vitals_deviation', 'behavioral_pattern', 'sleep_disruption', 'activity_drop');
CREATE TYPE severity_level AS ENUM ('info', 'warning', 'critical');
CREATE TYPE alert_source AS ENUM ('vitals_rule', 'anomaly_ml', 'fall_detection', 'manual');
CREATE TYPE alert_status AS ENUM ('pending', 'acknowledged', 'resolved');
CREATE TYPE fall_event_status AS ENUM ('unconfirmed', 'confirmed', 'false_positive');

-- ----------------------------------------------------------------------------
-- USERS  (caregivers / admins — login identities)
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name       VARCHAR(150) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    phone           VARCHAR(20),
    password_hash   TEXT NOT NULL,
    role            user_role NOT NULL DEFAULT 'caregiver',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- PATIENTS
-- ----------------------------------------------------------------------------
CREATE TABLE patients (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name            VARCHAR(150) NOT NULL,
    date_of_birth        DATE NOT NULL,
    gender               VARCHAR(20),
    medical_conditions   JSONB DEFAULT '[]'::JSONB,     -- e.g. ["hypertension", "diabetes_type2"]
    emergency_contact_name  VARCHAR(150),
    emergency_contact_phone VARCHAR(20),
    room_or_address      TEXT,
    baseline_profile     JSONB DEFAULT '{}'::JSONB,     -- personalized vitals baselines for ML
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- CAREGIVER <-> PATIENT ASSIGNMENT (many-to-many)
-- ----------------------------------------------------------------------------
CREATE TABLE caregiver_patient_map (
    caregiver_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    relation        VARCHAR(50) DEFAULT 'primary',       -- primary / secondary / family
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (caregiver_id, patient_id)
);

-- ----------------------------------------------------------------------------
-- SENSOR DEVICES
-- ----------------------------------------------------------------------------
CREATE TABLE sensor_devices (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    device_uid      VARCHAR(100) NOT NULL UNIQUE,        -- physical/emulated device identifier
    device_type     device_type NOT NULL,
    label           VARCHAR(100),                        -- "Living room camera", "Wrist band"
    status          device_status NOT NULL DEFAULT 'offline',
    battery_level   SMALLINT,                             -- 0-100, nullable for mains-powered devices
    last_seen_at    TIMESTAMPTZ,
    metadata        JSONB DEFAULT '{}'::JSONB,           -- firmware version, calibration, etc.
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_devices_patient ON sensor_devices(patient_id);

-- ----------------------------------------------------------------------------
-- VITALS  (high write-volume time-series table)
-- ----------------------------------------------------------------------------
CREATE TABLE vitals (
    id                  BIGSERIAL PRIMARY KEY,
    patient_id          UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    device_id           UUID REFERENCES sensor_devices(id) ON DELETE SET NULL,
    heart_rate          SMALLINT,             -- bpm
    spo2                SMALLINT,             -- %
    bp_systolic         SMALLINT,             -- mmHg
    bp_diastolic        SMALLINT,             -- mmHg
    temperature         NUMERIC(4,1),         -- Celsius
    respiration_rate    SMALLINT,             -- breaths/min
    steps_count         INTEGER,              -- cumulative or interval step count
    raw_payload         JSONB,                -- original emulator/device payload for audit
    recorded_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Critical for "latest N readings" / range queries per patient
CREATE INDEX idx_vitals_patient_time ON vitals (patient_id, recorded_at DESC);

-- ----------------------------------------------------------------------------
-- ANOMALY LOGS  (ML behavioral / vitals-pattern detections)
-- ----------------------------------------------------------------------------
CREATE TABLE anomaly_logs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id          UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    anomaly_type        anomaly_type NOT NULL,
    model_used          VARCHAR(50) NOT NULL,   -- 'isolation_forest_v1', 'lstm_v1'
    anomaly_score       NUMERIC(6,4) NOT NULL,  -- normalized model output
    severity            severity_level NOT NULL,
    contributing_features JSONB DEFAULT '{}'::JSONB, -- feature importance / deviation breakdown
    description         TEXT,
    window_start        TIMESTAMPTZ NOT NULL,
    window_end          TIMESTAMPTZ NOT NULL,
    detected_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved            BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_anomaly_patient_time ON anomaly_logs (patient_id, detected_at DESC);

-- ----------------------------------------------------------------------------
-- FALL EVENTS  (Computer Vision pipeline output)
-- ----------------------------------------------------------------------------
CREATE TABLE fall_events (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id          UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    device_id           UUID REFERENCES sensor_devices(id) ON DELETE SET NULL,
    confidence_score    NUMERIC(5,4) NOT NULL,   -- 0..1 model confidence
    pose_keypoints       JSONB,                   -- MediaPipe/YOLOv8 landmark snapshot at detection
    snapshot_path        TEXT,                    -- stored frame image reference
    status               fall_event_status NOT NULL DEFAULT 'unconfirmed',
    detected_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_by            UUID REFERENCES users(id),
    reviewed_at             TIMESTAMPTZ
);

CREATE INDEX idx_fall_events_patient_time ON fall_events (patient_id, detected_at DESC);

-- ----------------------------------------------------------------------------
-- ALERTS  (unified caregiver-facing notification feed)
-- ----------------------------------------------------------------------------
CREATE TABLE alerts (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id          UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    source_type         alert_source NOT NULL,
    source_id           UUID,                    -- FK-like pointer to anomaly_logs.id or fall_events.id (nullable, polymorphic)
    severity            severity_level NOT NULL,
    message             TEXT NOT NULL,
    status              alert_status NOT NULL DEFAULT 'pending',
    sms_sent            BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_by     UUID REFERENCES users(id),
    acknowledged_at     TIMESTAMPTZ,
    resolved_by         UUID REFERENCES users(id),
    resolved_at         TIMESTAMPTZ,
    resolution_notes    TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alerts_patient_status ON alerts (patient_id, status);
CREATE INDEX idx_alerts_created ON alerts (created_at DESC);

-- ----------------------------------------------------------------------------
-- updated_at auto-touch trigger (applied to mutable tables)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_users
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_patients
    BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
