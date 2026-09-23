import React from "react";
import { formatRelativeDay } from "../../utils/formatters";

const SEVERITY_PILL = {
  info: "bg-violet-100 text-violet-700",
  warning: "bg-orange-100 text-orange-700",
  critical: "bg-rose-100 text-rose-700",
};

export default function AnomalyLogTable({ anomalies, onAcknowledge }) {
  return (
    <section className="bg-surface rounded-[28px] shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4">
        <p className="text-sm font-semibold text-gray-900">Behavioral Anomaly Log</p>
        <span className="text-xs text-gray-400">{anomalies.length} entries</span>
      </div>

      {anomalies.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-gray-400">
          No anomalies logged yet. This patient's routine is within their learned baseline.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-gray-400 uppercase tracking-wide border-y border-gray-100">
                <th className="px-6 py-2.5 font-semibold">Time</th>
                <th className="px-6 py-2.5 font-semibold">Type</th>
                <th className="px-6 py-2.5 font-semibold">Severity</th>
                <th className="px-6 py-2.5 font-semibold">Description</th>
                <th className="px-6 py-2.5 font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {anomalies.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-6 py-3.5 text-gray-400 whitespace-nowrap text-xs font-medium">
                    {formatRelativeDay(a.time)}
                  </td>
                  <td className="px-6 py-3.5 text-gray-700 font-medium whitespace-nowrap">{a.type}</td>
                  <td className="px-6 py-3.5">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${SEVERITY_PILL[a.severity] || "bg-gray-100 text-gray-600"}`}>
                      {a.severity.charAt(0).toUpperCase() + a.severity.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-gray-500">{a.description}</td>
                  <td className="px-6 py-3.5 text-right">
                    {a.status === "pending" ? (
                      <button onClick={() => onAcknowledge(a.id)} className="text-xs font-semibold text-violet-600 hover:text-violet-800">
                        Acknowledge
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400 capitalize">{a.status}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
