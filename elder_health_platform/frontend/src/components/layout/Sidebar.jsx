import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LayoutGrid, Heart, Activity, Users, Bell, Settings, LogOut } from "lucide-react";
import { useAuthStore } from "../../store/authStore";

const NAV_ICONS = [
  { icon: Heart, to: "/dashboard", label: "Dashboard", end: true, gradient: "linear-gradient(135deg,#8B5CF6,#6366F1)" },
  { icon: Activity, to: "/dashboard", label: "Vitals & Trends", end: true, gradient: "linear-gradient(135deg,#8B5CF6,#6366F1)" },
  { icon: Users, to: "/dashboard/patients", label: "Patients", gradient: "linear-gradient(135deg,#65A30D,#84CC16)" },
  { icon: Bell, to: "/dashboard/alert-logs", label: "Alert Logs", gradient: "linear-gradient(135deg,#FB923C,#F59E0B)" },
  { icon: Settings, to: "/dashboard/settings", label: "Settings", gradient: "linear-gradient(135deg,#0EA5E9,#06B6D4)" },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside className="hidden md:flex flex-col items-center bg-surface rounded-[28px] shadow-sm py-5 px-3 gap-2 h-fit sticky top-6">
      <NavLink
        to="/dashboard"
        title="Dashboard"
        className="w-10 h-10 rounded-2xl bg-gray-900 flex items-center justify-center mb-2 shadow-sm"
      >
        <LayoutGrid className="w-4.5 h-4.5 text-lime-300" strokeWidth={2.2} />
      </NavLink>
      {NAV_ICONS.map(({ icon: Icon, to, label, end, gradient }) => (
        <NavLink
          key={label}
          to={to}
          end={end}
          title={label}
          className={({ isActive }) =>
            `w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              isActive ? "text-white shadow-md scale-105" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            }`
          }
          style={({ isActive }) => (isActive ? { background: gradient } : {})}
        >
          <Icon className="w-4.5 h-4.5" strokeWidth={2} />
        </NavLink>
      ))}
      <button
        onClick={handleLogout}
        title="Sign out"
        className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:bg-rose-50 hover:text-rose-500 transition-colors mt-2"
      >
        <LogOut className="w-4.5 h-4.5" strokeWidth={2} />
      </button>
    </aside>
  );
}