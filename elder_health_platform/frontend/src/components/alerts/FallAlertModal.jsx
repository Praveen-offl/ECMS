import React from "react";
import { AlertTriangle, Check, Phone } from "lucide-react";
import { useDashboardStore } from "../../store/dashboardStore";
import { formatTime } from "../../utils/formatters";

/**
 * The one deliberately bold moment in an otherwise calm, light UI: a
 * pulsing rose ring and a solid red primary action, reserved entirely for
 * this genuinely urgent state so it doesn't compete with the everyday
 * palette used everywhere else on the dashboard.
 */
export default function FallAlertModal({ alert, onAcknowledge }) {
  const patients = useDashboardStore((s) => s.patients);
  if (!alert) return null;

  const patient = patients.find((p) => p.id === alert.patient_id) || { full_name: "Unknown patient", room: "" };
  const confidencePct = alert.confidence != null ? Math.round(alert.confidence * 100) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm bg-surface rounded-[28px] shadow-xl overflow-hidden">
        <div className="px-7 pt-8 pb-6 text-center">
          <div className="relative inline-flex items-center justify-center mb-4">
            <span className="animate-ping absolute inline-flex h-16 w-16 rounded-full bg-rose-400 opacity-25" />
            <span className="relative inline-flex items-center justify-center h-16 w-16 rounded-full bg-rose-50 border border-rose-100">
              <AlertTriangle className="w-7 h-7 text-rose-500" />
            </span>
          </div>
          <h3 className="text-xl font-extrabold text-gray-900 font-display">Fall Detected</h3>
          <p className="text-sm text-gray-500 mt-1">
            {patient.full_name} {patient.room && <>&middot; {patient.room}</>}
          </p>
          <div className="mt-3 flex items-center justify-center gap-3 text-xs text-gray-400 font-medium">
            <span>{formatTime(alert.created_at)}</span>
            {confidencePct !== null && (
              <>
                <span className="w-1 h-1 rounded-full bg-gray-300" />
                <span>Confidence {confidencePct}%</span>
              </>
            )}
          </div>
          {alert.message && <p className="mt-3 text-sm text-gray-600">{alert.message}</p>}
        </div>

        <div className="px-7 pb-7 flex flex-col gap-2.5">
          <button
            onClick={onAcknowledge}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold transition-colors"
          >
            <Phone className="w-4 h-4" />
            Call Emergency Contact
          </button>
          <button
            onClick={onAcknowledge}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition-colors"
          >
            <Check className="w-4 h-4" />
            Acknowledge &amp; Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
