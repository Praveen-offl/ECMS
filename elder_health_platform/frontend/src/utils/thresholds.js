/**
 * Mirrors backend/app/thresholds.py (Phase 1 §6 / Phase 2). Kept as the
 * single source of truth for *display* severity (card border color, status
 * pill) so the UI never contradicts what the backend already decided when
 * it created an alert — this is a presentation-layer duplicate of the same
 * bands, not an independent decision.
 */
export const VITAL_RANGES = {
  heartRate: { warn: [60, 100], crit: [50, 120] },
  spo2: { warn: [95, 100], crit: [90, 100] },
  bpSystolic: { warn: [90, 130], crit: [80, 150] },
  temperature: { warn: [36.1, 37.2], crit: [35.5, 38.0] },
  respirationRate: { warn: [12, 20], crit: [8, 24] },
};

export function statusForVital(vitalKey, value) {
  if (value === undefined || value === null) return "normal";
  const range = VITAL_RANGES[vitalKey];
  if (!range) return "normal";
  const [critLo, critHi] = range.crit;
  const [warnLo, warnHi] = range.warn;
  if (value < critLo || value > critHi) return "critical";
  if (value < warnLo || value > warnHi) return "warning";
  return "normal";
}

export const SEVERITY_BADGE_CLASSES = {
  normal: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30",
  info: "bg-sky-400/10 text-sky-300 border-sky-400/30",
  warning: "bg-amber-400/10 text-amber-300 border-amber-400/30",
  critical: "bg-red-500/10 text-red-300 border-red-500/40",
};
