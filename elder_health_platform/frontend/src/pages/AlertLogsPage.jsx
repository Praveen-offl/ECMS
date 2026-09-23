import React, { useMemo, useState } from "react";
import { Bell } from "lucide-react";
import AnomalyLogTable from "../components/anomalies/AnomalyLogTable";
import { useDashboardStore } from "../store/dashboardStore";

const FILTERS = ["all", "info", "warning", "critical"];

export default function AlertLogsPage() {
  const anomalies = useDashboardStore((s) => s.anomalies);
  const acknowledgeAnomaly = useDashboardStore((s) => s.acknowledgeAnomaly);
  const patients = useDashboardStore((s) => s.patients);
  const selectedPatientId = useDashboardStore((s) => s.selectedPatientId);
  const patient = patients.find((p) => p.id === selectedPatientId);

  const [severityFilter, setSeverityFilter] = useState("all");

  const filtered = useMemo(
    () => (severityFilter === "all" ? anomalies : anomalies.filter((a) => a.severity === severityFilter)),
    [anomalies, severityFilter]
  );

  return (
    <div className="space-y-5">
      <div className="bg-surface rounded-[24px] shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center">
            <Bell className="w-4 h-4 text-orange-600" />
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900">Alert Logs</p>
            <p className="text-xs text-gray-400">
              {patient ? `Showing alerts for ${patient.full_name}` : "Select a patient to see their alert history"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setSeverityFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
                severityFilter === f ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <AnomalyLogTable anomalies={filtered} onAcknowledge={acknowledgeAnomaly} />
    </div>
  );
}
