import React from "react";
import { Link } from "react-router-dom";
import { useDashboardStore } from "../../store/dashboardStore";

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
    <div className="flex flex-wrap gap-2 px-1">
      {patients.map((p) => {
        const isSelected = p.id === selectedPatientId;
        return (
          <button
            key={p.id}
            onClick={() => setSelectedPatientId(p.id)}
            className={`flex items-center gap-2 pl-1.5 pr-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
              isSelected ? "text-white shadow-md scale-105" : "bg-surface text-gray-600 hover:bg-gray-50 shadow-sm"
            }`}
            style={isSelected ? { background: "linear-gradient(135deg,#8B5CF6,#6366F1)" } : {}}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                isSelected ? "bg-white/25 text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              {p.initials}
            </span>
            {p.full_name}
            {p.latest_status && p.latest_status !== "info" && (
              <span
                className={`w-1.5 h-1.5 rounded-full ${p.latest_status === "critical" ? "bg-rose-400" : "bg-orange-400"} ${isSelected ? "" : "animate-pulse"}`}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}