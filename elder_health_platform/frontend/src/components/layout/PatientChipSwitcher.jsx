import React from "react";
import { Link } from "react-router-dom";
import { useDashboardStore } from "../../store/dashboardStore";

const STATUS_DOT = {
  info: "bg-lime-400",
  warning: "bg-orange-400",
  critical: "bg-rose-500",
};

/**
 * Pill-style patient switcher, populated entirely from the real
 * `/api/v1/patients` roster (see api/patientsApi.js + dashboardStore).
 * Each chip's status dot reflects that patient's most recent real alert
 * severity, not a placeholder.
 */
export default function PatientChipSwitcher() {
  const patients = useDashboardStore((s) => s.patients);
  const patientsLoading = useDashboardStore((s) => s.patientsLoading);
  const selectedPatientId = useDashboardStore((s) => s.selectedPatientId);
  const setSelectedPatientId = useDashboardStore((s) => s.setSelectedPatientId);

  if (patientsLoading) {
    return <div className="px-1 text-sm text-gray-400">Loading patients...</div>;
  }

  if (patients.length === 0) {
    return (
      <div className="px-1 text-sm text-gray-400">
        No patients linked yet — enter an invite code on the{" "}
        <Link to="/dashboard/patients" className="font-semibold text-violet-600 hover:text-violet-800">
          Patients tab
        </Link>{" "}
        to add one.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-1 flex-wrap">
      {patients.map((p) => {
        const active = p.id === selectedPatientId;
        return (
          <button
            key={p.id}
            onClick={() => setSelectedPatientId(p.id)}
            className={`flex items-center gap-2 pl-1.5 pr-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
              active ? "bg-gray-900 text-white" : "bg-surface text-gray-500 hover:bg-gray-100"
            }`}
          >
            <span className="relative shrink-0">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  active ? "bg-lime-300 text-gray-900" : "bg-gray-100 text-gray-500"
                }`}
              >
                {p.initials}
              </span>
              <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${STATUS_DOT[p.latest_status] || "bg-gray-300"}`} />
            </span>
            {p.full_name}
          </button>
        );
      })}
    </div>
  );
}
