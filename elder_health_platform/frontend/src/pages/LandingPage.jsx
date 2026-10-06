import React from "react";
import { Link } from "react-router-dom";
import {
  Heart,
  Activity,
  ShieldAlert,
  Bell,
  Users,
  Radio,
  ArrowRight,
  HeartPulse,
  Thermometer,
  Wind,
  Video,
  BrainCircuit,
  CheckCircle2,
} from "lucide-react";

const FEATURES = [
  { icon: HeartPulse, accent: "#8B5CF6", accent2: "#6366F1", title: "Real-Time Vitals Monitoring", desc: "Heart rate, SpO2, blood pressure, temperature and respiration streamed live from wearable sensors straight to the caregiver dashboard." },
  { icon: Video, accent: "#0EA5E9", accent2: "#06B6D4", title: "Computer-Vision Fall Detection", desc: "An on-device pose model watches for falls in real time and fires an instant alert the moment one is detected." },
  { icon: BrainCircuit, accent: "#F43F5E", accent2: "#FB7185", title: "ML-Powered Anomaly Detection", desc: "An Isolation Forest model continuously scores incoming vitals against each patient's own baseline." },
  { icon: Bell, accent: "#FB923C", accent2: "#F59E0B", title: "Instant Caregiver Alerts", desc: "Rule-based, ML, and fall alerts are routed over WebSockets straight to the assigned caregiver — no polling, no delay." },
  { icon: Users, accent: "#65A30D", accent2: "#84CC16", title: "Multi-Patient Roster", desc: "Caregivers switch between every patient assigned to them, with live status indicators for each." },
  { icon: Activity, accent: "#6366F1", accent2: "#818CF8", title: "Historical Trend Charts", desc: "Every reading is persisted, so caregivers can trace how a vital has trended over hours or days." },
];

const VITALS_STRIP = [
  { icon: Heart, label: "Heart Rate", gradient: "linear-gradient(135deg,#8B5CF6,#6366F1)", shadow: "rgba(99,102,241,.5)" },
  { icon: Wind, label: "SpO2", gradient: "linear-gradient(135deg,#0EA5E9,#06B6D4)", shadow: "rgba(14,165,233,.5)" },
  { icon: Activity, label: "Blood Pressure", gradient: "linear-gradient(135deg,#F43F5E,#FB7185)", shadow: "rgba(244,63,94,.5)" },
  { icon: Thermometer, label: "Temperature", gradient: "linear-gradient(135deg,#FB923C,#F59E0B)", shadow: "rgba(251,146,60,.5)" },
];

const STEPS = [
  { n: "01", title: "Sensors stream vitals", desc: "Wearable and ambient sensors (or the built-in emulator) continuously report vitals for each patient." },
  { n: "02", title: "The backend scores every reading", desc: "Rule-based thresholds and a trained ML model check each reading for anomalies as it arrives." },
  { n: "03", title: "Caregivers see it live", desc: "Vitals, trends, and alerts land on the dashboard over WebSockets the instant something happens." },
];

const STATS = [
  { value: "< 1s", label: "Alert latency" },
  { value: "24/7", label: "Live monitoring" },
  { value: "3", label: "Alert sources" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas overflow-x-hidden">
      <div className="h-2" style={{ background: "linear-gradient(90deg, #14B8A6 0%, #0EA5E9 55%, #6366F1 100%)" }} />

      {/* Nav */}
      <header className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-6 relative z-10">
        <div className="flex items-center justify-between bg-surface rounded-[24px] shadow-sm px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center shrink-0 shadow-sm">
              <Heart className="w-4.5 h-4.5" fill="#bef264" strokeWidth={0} />
            </div>
            <span className="font-display font-extrabold text-xl tracking-tight text-gray-900">Revive</span>
          </div>
          <nav className="hidden lg:flex items-center gap-6 text-sm text-gray-500 font-medium">
            <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-gray-900 transition-colors">How it works</a>
            <a href="#about" className="hover:text-gray-900 transition-colors">About</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="text-sm font-semibold text-gray-600 hover:text-gray-900 px-3 py-2 transition-colors">Sign in</Link>
            <Link to="/signup" className="flex items-center gap-1.5 bg-gray-900 text-white text-sm font-semibold px-4 py-2.5 rounded-full hover:bg-gray-800 hover:scale-105 transition-all">
              Get Started <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative hero-wash">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-14 pb-10 overflow-hidden relative">
          <div className="absolute top-10 right-0 w-96 h-96 rounded-full opacity-50 blur-3xl animate-float pointer-events-none" style={{ background: "radial-gradient(circle, #14B8A6, transparent 70%)" }} />
          <div className="absolute top-40 right-40 w-72 h-72 rounded-full opacity-40 blur-3xl animate-float pointer-events-none" style={{ background: "radial-gradient(circle, #6366F1, transparent 70%)", animationDelay: "2s" }} />
          <div className="absolute -top-10 left-1/3 w-64 h-64 rounded-full opacity-30 blur-3xl animate-float pointer-events-none" style={{ background: "radial-gradient(circle, #F43F5E, transparent 70%)", animationDelay: "1s" }} />

          <div className="max-w-3xl relative animate-fade-in-up">
            <span className="inline-flex items-center gap-1.5 bg-lime-100 text-lime-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
              <Radio className="w-3.5 h-3.5 animate-pulse" /> Live vitals · Fall detection · ML anomaly alerts
            </span>
            <h1 className="text-4xl sm:text-6xl font-extrabold text-gray-900 tracking-tight font-display leading-[1.05]">
              Smart Elderly Care<br />Monitoring System
            </h1>
            <p className="mt-5 text-base sm:text-lg text-gray-500 max-w-xl">
              Revive keeps a continuous eye on every vital that matters — heart rate, SpO2,
              blood pressure, temperature, and falls — and gets caregivers to the right patient
              the moment something looks wrong.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/login" className="flex items-center gap-2 bg-gray-900 text-white text-sm font-semibold px-6 py-3.5 rounded-full hover:bg-gray-800 hover:scale-105 transition-all shadow-lg shadow-gray-900/10">
                Open Caregiver Dashboard <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#how-it-works" className="flex items-center gap-2 bg-surface text-gray-700 text-sm font-semibold px-6 py-3.5 rounded-full shadow-sm hover:shadow-md transition-shadow">
                See how it works
              </a>
            </div>
            <div className="mt-6 flex items-center gap-4 text-xs text-gray-400 font-medium">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-lime-500" /> Real-time WebSocket alerts</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-lime-500" /> No setup for caregivers</span>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap gap-6 relative animate-fade-in-up animate-delay-200">
            {STATS.map(({ value, label }) => (
              <div key={label} className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-gray-900 font-display">{value}</span>
                <span className="text-xs text-gray-400 font-medium">{label}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 relative animate-fade-in-up animate-delay-300">
            {VITALS_STRIP.map(({ icon: Icon, label, gradient, shadow }) => (
              <div key={label} className="vital-tile rounded-[22px] p-4 flex items-center gap-3 shadow-lg" style={{ background: gradient, boxShadow: `0 10px 24px -8px ${shadow}` }}>
                <span className="tile-icon w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
                  <Icon className="w-4.5 h-4.5 text-white" />
                </span>
                <div>
                  <p className="tile-label text-[11px] font-medium">{label}</p>
                  <p className="text-sm font-bold font-display">Live</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-14">
        <div className="max-w-xl mb-10 animate-fade-in-up">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Platform</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight font-display">
            Everything a caregiver needs, in one console
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, accent, accent2, title, desc }, i) => (
            <div
              key={title}
              className="feature-card bg-surface rounded-[24px] shadow-sm p-6 hover-lift animate-fade-in-up"
              style={{ animationDelay: `${i * 80}ms`, "--accent": accent, "--accent2": accent2 }}
            >
              <span className="feature-icon w-11 h-11 rounded-xl flex items-center justify-center mb-4 shadow-md">
                <Icon className="w-5 h-5 text-white" />
              </span>
              <h3 className="text-base font-bold text-gray-900 font-display mb-1.5">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-14">
        <div className="bg-gray-900 rounded-[32px] p-8 sm:p-12 relative overflow-hidden">
          <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full opacity-20 blur-3xl animate-float pointer-events-none" style={{ background: "radial-gradient(circle, #14B8A6, transparent 70%)" }} />
          <p className="text-xs text-lime-300 font-semibold uppercase tracking-wide mb-2 relative">How it works</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-display mb-10 max-w-lg relative">
            From sensor reading to caregiver alert, in real time
          </h2>
          <div className="grid sm:grid-cols-3 gap-8 relative">
            {STEPS.map(({ n, title, desc }, i) => (
              <div key={n} className="animate-fade-in-up" style={{ animationDelay: `${i * 120}ms` }}>
                <p className="text-lime-300 font-display font-extrabold text-3xl mb-3">{n}</p>
                <h3 className="text-white font-bold font-display mb-2">{title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="about" className="max-w-[1400px] mx-auto px-4 sm:px-6 pb-16">
        <div className="rounded-[32px] p-10 sm:p-14 text-center relative overflow-hidden shadow-2xl" style={{ background: "linear-gradient(120deg,#14B8A6,#0EA5E9 55%,#6366F1)" }}>
          <div className="absolute -top-16 -left-16 w-72 h-72 rounded-full bg-white/10 blur-3xl animate-float pointer-events-none" />
          <div className="absolute -bottom-20 -right-10 w-80 h-80 rounded-full bg-white/10 blur-3xl animate-float pointer-events-none" style={{ animationDelay: "2.5s" }} />
          <h2 className="relative text-2xl sm:text-4xl font-extrabold text-white font-display tracking-tight mb-3 flex items-center justify-center gap-2">
            Ready to monitor your patients?
          </h2>
          <p className="relative text-white/80 text-sm sm:text-base mb-7 flex items-center justify-center gap-1.5">
            <ShieldAlert className="w-4 h-4" /> Sign in to reach the live caregiver dashboard.
          </p>
          <Link to="/login" className="relative inline-flex items-center gap-2 bg-white text-gray-900 text-sm font-semibold px-7 py-3.5 rounded-full shadow-lg hover:scale-105 transition-transform">
            Sign In <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 text-xs text-gray-400 text-center">
        Revive — Smart Elderly Care Monitoring System
      </footer>
    </div>
  );
}