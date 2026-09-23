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
  {
    icon: HeartPulse,
    bg: "bg-violet-100",
    color: "#8B5CF6",
    title: "Real-Time Vitals Monitoring",
    desc: "Heart rate, SpO2, blood pressure, temperature and respiration streamed live from wearable sensors and pushed straight to the caregiver dashboard.",
  },
  {
    icon: Video,
    bg: "bg-sky-100",
    color: "#0EA5E9",
    title: "Computer-Vision Fall Detection",
    desc: "An on-device CV model watches for falls in real time and fires an instant alert with a snapshot the moment one is detected.",
  },
  {
    icon: BrainCircuit,
    bg: "bg-rose-100",
    color: "#F43F5E",
    title: "ML-Powered Anomaly Detection",
    desc: "A trained anomaly model continuously scores incoming vitals against each patient's baseline to catch subtle deterioration before it becomes critical.",
  },
  {
    icon: Bell,
    bg: "bg-orange-100",
    color: "#FB923C",
    title: "Instant Caregiver Alerts",
    desc: "Rule-based vitals thresholds, ML anomalies, and fall events are all routed over WebSockets straight to the assigned caregiver — no polling, no delay.",
  },
  {
    icon: Users,
    bg: "bg-lime-100",
    color: "#65A30D",
    title: "Multi-Patient Roster",
    desc: "Caregivers switch between every patient assigned to them from a single console, with live status indicators for each.",
  },
  {
    icon: Activity,
    bg: "bg-indigo-100",
    color: "#6366F1",
    title: "Historical Trend Charts",
    desc: "Every reading is persisted, so caregivers can trace how a vital has trended over the last hours or days, not just the current value.",
  },
];

const VITALS_STRIP = [
  { icon: Heart, label: "Heart Rate", color: "#8B5CF6" },
  { icon: Wind, label: "SpO2", color: "#0EA5E9" },
  { icon: Activity, label: "Blood Pressure", color: "#F43F5E" },
  { icon: Thermometer, label: "Temperature", color: "#FB923C" },
];

const STEPS = [
  {
    n: "01",
    title: "Sensors stream vitals",
    desc: "Wearable and ambient sensors (or the built-in emulator) continuously report vitals for each patient.",
  },
  {
    n: "02",
    title: "The backend scores every reading",
    desc: "Rule-based thresholds and a trained ML model check each reading for anomalies as it arrives.",
  },
  {
    n: "03",
    title: "Caregivers see it live",
    desc: "Vitals, trends, and alerts land on the dashboard over WebSockets the instant something happens.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <div
        className="h-2"
        style={{ background: "linear-gradient(90deg, #14B8A6 0%, #0EA5E9 55%, #6366F1 100%)" }}
      />

      {/* Nav */}
      <header className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-6">
        <div className="flex items-center justify-between bg-surface rounded-[24px] shadow-sm px-5 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gray-900 flex items-center justify-center">
              <Heart className="w-4 h-4 text-lime-300" fill="currentColor" strokeWidth={0} />
            </div>
            <span className="w-7 h-7 rounded-lg bg-lime-300 flex items-center justify-center font-extrabold text-xs text-gray-900 font-display">
              CW
            </span>
            <span className="ml-2 font-display font-bold text-gray-900 hidden sm:inline">
              CareWatch
            </span>
          </div>

          <nav className="hidden lg:flex items-center gap-6 text-sm text-gray-500 font-medium">
            <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-gray-900 transition-colors">How it works</a>
            <a href="#about" className="hover:text-gray-900 transition-colors">About</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="text-sm font-semibold text-gray-600 hover:text-gray-900 px-3 py-2 transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="flex items-center gap-1.5 bg-gray-900 text-white text-sm font-semibold px-4 py-2.5 rounded-full hover:bg-gray-800 transition-colors"
            >
              Get Started <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-14 pb-10">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-1.5 bg-lime-100 text-lime-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
            <Radio className="w-3.5 h-3.5" /> Live vitals · Fall detection · ML anomaly alerts
          </span>
          <h1 className="text-4xl sm:text-6xl font-extrabold text-gray-900 tracking-tight font-display leading-[1.05]">
            Smart Elderly Care
            <br />
            Monitoring System
          </h1>
          <p className="mt-5 text-base sm:text-lg text-gray-500 max-w-xl">
            CareWatch keeps a continuous eye on every vital that matters — heart rate, SpO2,
            blood pressure, temperature, and falls — and gets caregivers to the right patient
            the moment something looks wrong.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/login"
              className="flex items-center gap-2 bg-gray-900 text-white text-sm font-semibold px-6 py-3.5 rounded-full hover:bg-gray-800 transition-colors"
            >
              Open Caregiver Dashboard <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#how-it-works"
              className="flex items-center gap-2 bg-surface text-gray-700 text-sm font-semibold px-6 py-3.5 rounded-full shadow-sm hover:shadow transition-shadow"
            >
              See how it works
            </a>
          </div>

          <div className="mt-6 flex items-center gap-4 text-xs text-gray-400 font-medium">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-lime-500" /> Real-time WebSocket alerts</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-lime-500" /> No setup for caregivers</span>
          </div>
        </div>

        {/* Live vitals strip */}
        <div className="mt-12 bg-surface rounded-[28px] shadow-sm p-5 sm:p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {VITALS_STRIP.map(({ icon: Icon, label, color }) => (
            <div key={label} className="flex items-center gap-3">
              <span
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${color}1A` }}
              >
                <Icon className="w-4.5 h-4.5" style={{ color }} />
              </span>
              <div>
                <p className="text-[11px] text-gray-400 font-medium">{label}</p>
                <p className="text-sm font-bold text-gray-900 font-display">Live</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-14">
        <div className="max-w-xl mb-10">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Platform</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight font-display">
            Everything a caregiver needs, in one console
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, bg, color, title, desc }) => (
            <div key={title} className="bg-surface rounded-[24px] shadow-sm p-6">
              <span className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${bg}`}>
                <Icon className="w-5 h-5" style={{ color }} />
              </span>
              <h3 className="text-base font-bold text-gray-900 font-display mb-1.5">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-14">
        <div className="bg-gray-900 rounded-[32px] p-8 sm:p-12">
          <p className="text-xs text-lime-300 font-semibold uppercase tracking-wide mb-2">How it works</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-display mb-10 max-w-lg">
            From sensor reading to caregiver alert, in real time
          </h2>

          <div className="grid sm:grid-cols-3 gap-8">
            {STEPS.map(({ n, title, desc }) => (
              <div key={n}>
                <p className="text-lime-300 font-display font-extrabold text-3xl mb-3">{n}</p>
                <h3 className="text-white font-bold font-display mb-2">{title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="about" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-14">
        <div className="bg-surface rounded-[28px] shadow-sm p-8 sm:p-12 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 font-display tracking-tight mb-1.5">
              Ready to monitor your patients?
            </h2>
            <p className="text-sm text-gray-500 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-500" /> Sign in to reach the caregiver dashboard.
            </p>
          </div>
          <Link
            to="/login"
            className="flex items-center gap-2 bg-gray-900 text-white text-sm font-semibold px-6 py-3.5 rounded-full hover:bg-gray-800 transition-colors shrink-0"
          >
            Sign In <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 text-xs text-gray-400 text-center">
        CareWatch — Smart Elderly Care Monitoring System
      </footer>
    </div>
  );
}
