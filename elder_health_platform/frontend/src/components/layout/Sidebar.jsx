import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LayoutGrid, Heart, Activity, Users, Bell, Settings, LogOut } from "lucide-react";
import { useAuthStore } from "../../store/authStore";

const NAV_ICONS = [
  { icon: Heart, to: "/dashboard", label: "Dashboard", end: true },
  { icon: Activity, to: "/dashboard", label: "Vitals & Trends", end: true },
  { icon: Users, to: "/dashboard/patients", label: "Patients" },
  { icon: Bell, to: "/dashboard/alert-logs", label: "Alert Logs" },
  { icon: Settings, to: "/dashboard/settings", label: "Settings" },
];

/**
 * Floating pill icon-rail sidebar. Patient switching lives in the top
 * chip row (see DashboardLayout) rather than here, matching the reference
 * layout's minimal icon-only left rail. Every icon routes somewhere real —
 * see App.jsx for the nested /dashboard/* routes.
 */
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
        className="w-10 h-10 rounded-2xl bg-gray-900 flex items-center justify-center mb-2"
      >
        <LayoutGrid className="w-4.5 h-4.5 text-white" strokeWidth={2.2} />
      </NavLink>
      {NAV_ICONS.map(({ icon: Icon, to, label, end }) => (
        <NavLink
          key={label}
          to={to}
          end={end}
          title={label}
          className={({ isActive }) =>
            `w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              isActive ? "bg-lime-300 text-gray-900" : "text-gray-400 hover:bg-gray-100"
            }`
          }
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
