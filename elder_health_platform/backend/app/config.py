"""
config.py
=========
Centralized environment-driven settings using pydantic-settings.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "Elderly Health Monitoring Platform"
    ENVIRONMENT: str = "development"

    # postgresql+asyncpg://user:password@host:port/dbname
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/elder_health"

    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    # Toggle to skip DB writes when just wiring up the emulator/dashboard early on
    PERSIST_TO_DB: bool = True

    # If set, every newly-ingested patient is automatically routed to this
    # caregiver's alert feed — convenience for local/demo bring-up so
    # /ws/alerts/{id} has somewhere to broadcast to without a manual
    # /api/v1/dev/assign-caregiver call first. Leave unset in real deployments
    # once proper caregiver assignment (via auth) exists.
    DEFAULT_CAREGIVER_ID: str | None = None

    # ------------------------------------------------------------------
    # Phase 5 — Caregiver auth (MongoDB-backed, kept separate from the
    # Postgres telemetry schema above). Signup/login credentials live in
    # their own Mongo collection rather than a Postgres table so the auth
    # store can be swapped/scaled independently of the vitals pipeline.
    # ------------------------------------------------------------------
    MONGO_URI: str = "mongodb://localhost:27017"
    MONGO_DB_NAME: str = "elder_health_auth"
    MONGO_USERS_COLLECTION: str = "caregivers"

    JWT_SECRET_KEY: str = "change-this-secret-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24  # 24h caregiver session

    # ------------------------------------------------------------------
    # Phase 3 — live anomaly detection worker (app/ml/vitals_features.py +
    # anomaly_detector.py's Isolation Forest, run on a background loop —
    # see _anomaly_scan_loop in main.py). Vitals get bucketed into rolling
    # windows of ANOMALY_WINDOW_MINUTES; once a patient has at least
    # ANOMALY_MIN_BASELINE_WINDOWS prior windows of history, the most
    # recent window is scored against them. Defaults are tuned for a real
    # deployment; for a live demo, lower both so it fires within minutes
    # instead of hours (e.g. ANOMALY_WINDOW_MINUTES=1, ANOMALY_MIN_BASELINE_WINDOWS=5).
    # ------------------------------------------------------------------
    ANOMALY_SCAN_INTERVAL_SECONDS: int = 60
    ANOMALY_WINDOW_MINUTES: int = 10
    ANOMALY_MIN_BASELINE_WINDOWS: int = 6
    # IsolationForest's contamination-based predict() is unreliable with the
    # small per-patient baselines a live/short session actually has (tested:
    # it missed a 140bpm reading against a ~71bpm baseline at n=8 windows —
    # isolation-depth scoring needs dozens of samples to discriminate
    # reliably). This z-score safety net — same "ML + rule-based backstop"
    # pattern as thresholds.py alongside the model — catches anything that
    # deviates this many standard deviations from the patient's own
    # baseline on any single feature, regardless of what IsolationForest's
    # binary call says.
    ANOMALY_Z_SCORE_THRESHOLD: float = 3.5


settings = Settings()
