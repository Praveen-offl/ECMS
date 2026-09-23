"""
thresholds.py
=============
Static rule-based safety net (Phase 1, section 6). Runs synchronously on
every ingested reading, independent of the Phase 3 ML anomaly engine, so
that unambiguous out-of-range vitals always trigger an alert even before
any model is trained.
"""

from __future__ import annotations

from app.schemas import SeverityLevel, VitalsIngestPayload

# (warning_low, critical_low, warning_high, critical_high) -- None means "no bound on that side"
RANGES: dict[str, tuple[float | None, float | None, float | None, float | None]] = {
    "heart_rate":        (50, None, 120, None),
    "spo2":               (90, None, None, None),   # only a low side matters clinically
    "bp_systolic":         (80, None, 150, None),
    "temperature":           (35.5, None, 38.0, None),
    "respiration_rate":       (8, None, 24, None),
}

# critical cutoffs (stricter than the warning band above)
CRITICAL: dict[str, tuple[float | None, float | None]] = {
    "heart_rate": (None, None),          # handled by explicit logic below (spec: <50 or >120 critical)
    "spo2": (None, 90),                    # <90 critical
    "bp_systolic": (None, None),
    "temperature": (None, None),
    "respiration_rate": (None, None),
}


def evaluate_thresholds(payload: VitalsIngestPayload) -> list[tuple[str, SeverityLevel, str]]:
    """
    Returns a list of (flag_code, severity, human_message) tuples for every
    vital that breaches the warning/critical bands defined in Phase 1.
    """
    findings: list[tuple[str, SeverityLevel, str]] = []

    hr = payload.heart_rate
    if hr < 50 or hr > 120:
        findings.append(("heart_rate_critical", SeverityLevel.CRITICAL, f"Heart rate critical: {hr} bpm"))
    elif hr < 60 or hr > 100:
        findings.append(("heart_rate_warning", SeverityLevel.WARNING, f"Heart rate out of normal range: {hr} bpm"))

    spo2 = payload.spo2
    if spo2 < 90:
        findings.append(("spo2_critical", SeverityLevel.CRITICAL, f"SpO2 critical: {spo2}%"))
    elif spo2 < 95:
        findings.append(("spo2_warning", SeverityLevel.WARNING, f"SpO2 below normal: {spo2}%"))

    sys_bp = payload.bp_systolic
    if sys_bp > 150 or sys_bp < 80:
        findings.append(("bp_critical", SeverityLevel.CRITICAL, f"Blood pressure critical: {sys_bp}/{payload.bp_diastolic} mmHg"))
    elif sys_bp > 130 or sys_bp < 90:
        findings.append(("bp_warning", SeverityLevel.WARNING, f"Blood pressure out of normal range: {sys_bp}/{payload.bp_diastolic} mmHg"))

    temp = payload.temperature
    if temp > 38.0 or temp < 35.5:
        findings.append(("temperature_critical", SeverityLevel.CRITICAL, f"Temperature critical: {temp}\u00b0C"))
    elif temp > 37.2 or temp < 36.1:
        findings.append(("temperature_warning", SeverityLevel.WARNING, f"Temperature out of normal range: {temp}\u00b0C"))

    resp = payload.respiration_rate
    if resp > 24 or resp < 8:
        findings.append(("respiration_critical", SeverityLevel.CRITICAL, f"Respiration rate critical: {resp} breaths/min"))
    elif resp > 20 or resp < 12:
        findings.append(("respiration_warning", SeverityLevel.WARNING, f"Respiration rate out of normal range: {resp} breaths/min"))

    return findings
