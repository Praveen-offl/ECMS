import React from "react";
import { Check, AlertTriangle, AlertCircle, Info } from "lucide-react";

const SEVERITY_STYLE = {
  critical: { badge: "bg-rose-100 text-rose-700", icon: AlertCircle, dot: "bg-rose-500" },
  warning: { badge: "bg-orange-100 text-orange-700", icon: AlertTriangle, dot: "bg-orange-500" },
  info: { badge: "bg-sky-100 text-sky-700", icon: Info, dot: "bg-sky-500" },
};

export default function AnomalyLogTable({ anomalies = [], onAcknowledge }) {
  return (
    <div className="bg-surface rounded-[28px] shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
        <p className="text-sm font-bold text-gray-900 font-display">Anomaly Log</p>
        <span className="text-xs text-gray-400">{anomalies.length} entries</span>
      </div>

      {anomalies.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-gray-400">No alerts for this patient yet.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {anomalies.map((a) => {
            const style = SEVERITY_STYLE[a.severity] || SEVERITY_STYLE.info;
            const Icon = style.icon;
            const acknowledged = a.status === "acknowledged";
            return (
              <div key={a.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50/60 transition-colors">
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${style.badge}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">{a.description}</p>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${style.badge}`}>{a.severity}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {a.type} · {new Date(a.time).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {onAcknowledge && (
                  <button
                    onClick={() => onAcknowledge(a.id)}
                    disabled={acknowledged}
                    className={`shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                      acknowledged ? "bg-lime-100 text-lime-700 cursor-default" : "bg-gray-100 text-gray-600 hover:bg-gray-900 hover:text-white"
                    }`}
                  >
                    <Check className="w-3 h-3" /> {acknowledged ? "Acknowledged" : "Acknowledge"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}