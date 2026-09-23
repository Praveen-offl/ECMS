import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, HeartPulse, Bell, Video, Loader2 } from "lucide-react";
import { login as loginRequest } from "../api/authApi";
import { useAuthStore } from "../store/authStore";

export default function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      setError("Enter both an email and a password to continue.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      // Real credential check against MongoDB via backend/app/auth/routes.py.
      const data = await loginRequest({ email, password });
      setSession({ access_token: data.access_token, caregiver: data.caregiver });
      navigate("/dashboard");
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || "Couldn't sign in. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-4xl bg-surface rounded-[32px] shadow-sm overflow-hidden grid md:grid-cols-2">
        {/* Brand panel */}
        <div className="hidden md:flex flex-col justify-between bg-gray-900 p-9 relative overflow-hidden">
          <div
            className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, #14B8A6, transparent 70%)" }}
          />
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                <Heart className="w-4 h-4 text-lime-300" fill="currentColor" strokeWidth={0} />
              </div>
              <span className="w-7 h-7 rounded-lg bg-lime-300 flex items-center justify-center font-extrabold text-xs text-gray-900 font-display">
                CW
              </span>
            </div>

            <h2 className="text-white text-2xl font-extrabold font-display tracking-tight mt-8 leading-snug">
              Smart Elderly Care
              <br />
              Monitoring System
            </h2>
            <p className="text-gray-400 text-sm mt-3 leading-relaxed max-w-xs">
              Sign in to watch live vitals, fall alerts, and anomaly detections for every
              patient assigned to you.
            </p>
          </div>

          <div className="space-y-3 relative">
            {[
              { icon: HeartPulse, text: "Live vitals for every patient" },
              { icon: Video, text: "Real-time fall detection" },
              { icon: Bell, text: "Instant caregiver alerts" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2.5 text-sm text-gray-300">
                <span className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-lime-300" />
                </span>
                {text}
              </div>
            ))}
          </div>
        </div>

        {/* Form panel */}
        <div className="p-8 sm:p-10 flex flex-col justify-center">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-600 mb-6 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to home
          </Link>

          <p className="text-xs text-gray-400 font-medium mb-1">Caregiver access</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-display tracking-tight mb-6">
            Sign in to CareWatch
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Email</label>
              <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-3">
                <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@carewatch.io"
                  className="bg-transparent outline-none text-sm text-gray-900 placeholder:text-gray-400 w-full"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Password</label>
              <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-3">
                <Lock className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-transparent outline-none text-sm text-gray-900 placeholder:text-gray-400 w-full"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-gray-400 hover:text-gray-600 shrink-0"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white text-sm font-semibold py-3.5 rounded-2xl hover:bg-gray-800 transition-colors mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Signing in...
                </>
              ) : (
                <>
                  Sign In <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-xs text-gray-400 mt-5 text-center">
            New caregiver?{" "}
            <Link to="/signup" className="font-semibold text-gray-700 hover:text-gray-900">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
