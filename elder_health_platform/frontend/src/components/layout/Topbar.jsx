import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { Heart, Search, RefreshCw } from "lucide-react";
import { useDashboardStore } from "../../store/dashboardStore";
import { useAuthStore } from "../../store/authStore";

const NAV_LINKS = [
  { to: "/dashboard", label: "Dashboard", end: true },
  { to: "/dashboard/patients", label: "Patients" },
  { to: "/dashboard/alert-logs", label: "Alert Logs" },
  { to: "/dashboard/settings", label: "Settings" },
];

export default function Topbar({ vitalsConnected, alertsConnected, readingsToday = 0 }) {
  const caregiver = useAuthStore((s) => s.caregiver);
  const patients = useDashboardStore((s) => s.patients);
  const selectedPatientId = useDashboardStore((s) => s.selectedPatientId);
  const patient = patients.find((p) => p.id === selectedPatientId);

  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const isLive = vitalsConnected && alertsConnected;

  return (
    <div className="bg-surface rounded-[24px] shadow-sm px-5 py-3.5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gray-900 flex items-center justify-center">
              <Heart className="w-4 h-4" fill="#bef264" strokeWidth={0} />
            </div>
            <span className="font-display font-extrabold text-base tracking-tight text-gray-900 hidden md:inline">Revive</span>
          </div>

          <nav className="hidden lg:flex items-center gap-5 ml-3 text-sm text-gray-400 font-medium">
            {NAV_LINKS.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => isActive ? "text-gray-900 font-semibold" : "hover:text-gray-600 transition-colors"}
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-400 font-mono hidden sm:inline">
            {clock.toLocaleTimeString([], { hour12: false })}
          </span>

          <span
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{
              background: isLive ? "linear-gradient(135deg,#65A30D,#84CC16)" : "linear-gradient(135deg,#9CA3AF,#D1D5DB)",
              color: "#fff",
            }}
          >
            {isLive ? (
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            ) : (
              <RefreshCw className="w-3 h-3 animate-spin" />
            )}
            {isLive ? "Live" : "Reconnecting"}
          </span>

          <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3.5 py-2 text-sm text-gray-400 w-52">
            <Search className="w-4 h-4" />
            <span>Search patients...</span>
          </div>

          {caregiver && (
            <div className="hidden md:flex items-center gap-2 pl-1">
              <span
                className="w-7 h-7 rounded-full text-white text-xs font-bold font-display flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg,#8B5CF6,#6366F1)" }}
              >
                {caregiver.full_name?.[0]?.toUpperCase() || "C"}
              </span>
              <span className="text-sm font-semibold text-gray-700">{caregiver.full_name}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-3">
        <div>
          <p className="text-xs text-gray-400 font-medium mb-1">Patient Overview</p>
          <p className="text-2xl font-extrabold text-gray-900 font-display">
            {patient ? `${patient.full_name.split(" ").slice(-1)[0]}, Stable.` : "No patient selected"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Live Readings Today</p>
          <p className="text-sm font-bold text-gray-900 font-display">{readingsToday} readings</p>
        </div>
      </div>
    </div>
  );
}