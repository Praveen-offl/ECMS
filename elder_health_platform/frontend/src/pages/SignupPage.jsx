import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Heart,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  HeartPulse,
  Bell,
  Video,
  Loader2,
} from "lucide-react";
import { signup as signupRequest } from "../api/authApi";
import { useAuthStore } from "../store/authStore";

export default function SignupPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setError("Fill in your name, email, and a password to continue.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const data = await signupRequest({ fullName, email, password });
      setSession({ access_token: data.access_token, caregiver: data.caregiver });
      navigate("/dashboard");
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || "Couldn't create your account. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-4xl bg-surface rounded-[32px] shadow-sm overflow-hidden grid md:grid-cols-2">
        {/* Brand panel */}
        <div className="hidden md:flex flex-col justify-between p-9 relative overflow-hidden" style={{ background: "linear-gradient(160deg,#111827,#1e1b4b 70%,#0f172a)" }}>
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-30 blur-3xl animate-float pointer-events-none" style={{ background: "radial-gradient(circle, #14B8A6, transparent 70%)" }} />
          <div className="absolute bottom-10 -left-10 w-48 h-48 rounded-full opacity-20 blur-3xl animate-float pointer-events-none" style={{ background: "radial-gradient(circle, #8B5CF6, transparent 70%)", animationDelay: "2s" }} />

          <div className="relative">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <Heart className="w-4.5 h-4.5" fill="#bef264" strokeWidth={0} />
              </div>
              <span className="font-display font-extrabold text-xl tracking-tight text-white">Revive</span>
            </div>

            <h2 className="text-white text-2xl font-extrabold font-display tracking-tight mt-8 leading-snug">
              Smart Elderly Care<br />Monitoring System
            </h2>
            <p className="text-gray-400 text-sm mt-3 leading-relaxed max-w-xs">
              Create a caregiver account to start watching live vitals, fall alerts, and
              anomaly detections for your patients.
            </p>
          </div>

          <div className="space-y-3 relative">
            {[
              { icon: HeartPulse, text: "Live vitals for every patient", gradient: "linear-gradient(135deg,#8B5CF6,#6366F1)" },
              { icon: Video, text: "Real-time fall detection", gradient: "linear-gradient(135deg,#0EA5E9,#06B6D4)" },
              { icon: Bell, text: "Instant caregiver alerts", gradient: "linear-gradient(135deg,#FB923C,#F59E0B)" },
            ].map(({ icon: Icon, text, gradient }) => (
              <div key={text} className="flex items-center gap-2.5 text-sm text-gray-200">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: gradient }}>
                  <Icon className="w-3.5 h-3.5 text-white" />
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
            Create your account
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Full name</label>
              <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-3">
                <User className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  className="bg-transparent outline-none text-sm text-gray-900 placeholder:text-gray-400 w-full"
                  autoComplete="name"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Email</label>
              <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-3">
                <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@revive.io"
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
                  placeholder="At least 8 characters"
                  className="bg-transparent outline-none text-sm text-gray-900 placeholder:text-gray-400 w-full"
                  autoComplete="new-password"
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
              className="w-full flex items-center justify-center gap-2 text-white text-sm font-semibold py-3.5 rounded-2xl hover:opacity-90 transition-opacity mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg,#111827,#1e1b4b)" }}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Creating account...
                </>
              ) : (
                <>
                  Create Account <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-xs text-gray-400 mt-5 text-center">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-gray-700 hover:text-gray-900">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}