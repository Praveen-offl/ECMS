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
  const isLive = vitalsConnected && alertsConnected;

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-5">
      {/* Top nav bar */}
      <div className="flex items-center justify-between bg-surface rounded-[24px] shadow-sm px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gray-900 flex items-center justify-center">
            <Heart className="w-4 h-4 text-lime-300" fill="currentColor" strokeWidth={0} />
          </div>
          <span className="w-7 h-7 rounded-lg bg-lime-300 flex items-center justify-center font-extrabold text-xs text-gray-900 font-display">
            CW
          </span>
          <nav className="hidden lg:flex items-center gap-5 ml-3 text-sm text-gray-400 font-medium">
            {NAV_LINKS.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  isActive ? "text-gray-900 font-semibold" : "hover:text-gray-600 transition-colors"
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-xs text-gray-400 font-mono">
            {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              isLive ? "bg-lime-100 text-lime-700" : "bg-gray-100 text-gray-500"
            }`}
          >
            <span className="relative flex h-1.5 w-1.5">
              {isLive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-500 opacity-75" />}
              <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isLive ? "bg-lime-500" : "bg-gray-400"}`} />
            </span>
            {isLive ? "Live" : "Reconnecting"}
          </div>
          <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3.5 py-2 text-sm text-gray-400 w-52">
            <Search className="w-4 h-4" />
            <span>Search patients...</span>
          </div>
          {caregiver && (
            <div className="hidden md:flex items-center gap-2 pl-1">
              <span className="w-7 h-7 rounded-full bg-gray-900 text-lime-300 text-xs font-bold font-display flex items-center justify-center shrink-0">
                {caregiver.full_name?.[0]?.toUpperCase() || "C"}
              </span>
              <span className="text-sm font-semibold text-gray-700">{caregiver.full_name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Headline row */}
      <div className="flex items-end justify-between flex-wrap gap-3 px-1">
        <div>
          <p className="text-xs text-gray-400 font-medium mb-1">Patient Overview</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight font-display">
            {patient ? `${patient.full_name.split(" ").slice(-1)[0]}, Stable.` : "No patient selected"}
          </h1>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 font-medium mb-1">Live Readings Today</p>
          <div className="flex items-center gap-1.5 justify-end">
            <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-lg font-bold text-gray-900 font-display">{readingsToday} readings</span>
          </div>
        </div>
      </div>
    </div>
  );
}
