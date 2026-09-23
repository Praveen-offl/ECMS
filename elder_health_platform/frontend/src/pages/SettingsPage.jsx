import React from "react";
import { useNavigate } from "react-router-dom";
import { Settings as SettingsIcon, Mail, User, Calendar, LogOut, Shield } from "lucide-react";
import { useAuthStore } from "../store/authStore";

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" });
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const caregiver = useAuthStore((s) => s.caregiver);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="bg-surface rounded-[28px] shadow-sm p-6">
        <div className="flex items-center gap-2 mb-6">
          <span className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center">
            <SettingsIcon className="w-4 h-4 text-gray-600" />
          </span>
          <p className="text-sm font-semibold text-gray-900">Caregiver Profile</p>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <span className="w-16 h-16 rounded-full bg-gray-900 text-lime-300 flex items-center justify-center text-xl font-extrabold font-display shrink-0">
            {caregiver?.full_name?.[0]?.toUpperCase() || "C"}
          </span>
          <div>
            <p className="text-lg font-bold text-gray-900 font-display">{caregiver?.full_name || "Caregiver"}</p>
            <p className="text-sm text-gray-400">{caregiver?.email}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3">
            <User className="w-4 h-4 text-gray-400 shrink-0" />
            <div>
              <p className="text-[11px] text-gray-400 font-medium">Full name</p>
              <p className="text-sm font-medium text-gray-900">{caregiver?.full_name || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3">
            <Mail className="w-4 h-4 text-gray-400 shrink-0" />
            <div>
              <p className="text-[11px] text-gray-400 font-medium">Email</p>
              <p className="text-sm font-medium text-gray-900">{caregiver?.email || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3">
            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
            <div>
              <p className="text-[11px] text-gray-400 font-medium">Caregiver since</p>
              <p className="text-sm font-medium text-gray-900">{formatDate(caregiver?.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3">
            <Shield className="w-4 h-4 text-gray-400 shrink-0" />
            <div>
              <p className="text-[11px] text-gray-400 font-medium">Account ID</p>
              <p className="text-sm font-medium text-gray-900 font-mono">{caregiver?.id || "—"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-[28px] shadow-sm p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">Sign out</p>
          <p className="text-xs text-gray-400 mt-0.5">Ends this caregiver session on this device.</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 bg-rose-50 text-rose-600 text-sm font-semibold px-4 py-2.5 rounded-full hover:bg-rose-100 transition-colors shrink-0"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </div>
  );
}
