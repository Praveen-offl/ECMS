import React from "react";
import { LineChart, Line, ResponsiveContainer, XAxis, RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import { Droplet, Activity, Thermometer, Wind } from "lucide-react";
import VitalCard from "./VitalCard";
import { statusForVital } from "../../utils/thresholds";

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

const SECONDARY_CHANNELS = [
  { key: "spo2", label: "SpO2", unit: "%", icon: Droplet, color: "#0EA5E9", bg: "bg-sky-50", field: "spo2" },
  { key: "bp", label: "Blood Pressure", unit: "mmHg", icon: Activity, color: "#F43F5E", bg: "bg-rose-50", field: "bp_systolic" },
  { key: "temperature", label: "Temperature", unit: "\u00b0C", icon: Thermometer, color: "#FB923C", bg: "bg-orange-50", field: "temperature" },
  { key: "respirationRate", label: "Respiration", unit: "br/min", icon: Wind, color: "#8B5CF6", bg: "bg-violet-50", field: "respiration_rate" },
];

/**
 * Live Vitals Monitor: a large Heart Rate trend + radial-ring card (the
 * signature element, echoing the reference's chart+ring pairing) plus a
 * row of compact stat cards for the remaining four vitals.
 */
export default function VitalsMonitor({ latest, history }) {
  const heartRate = latest?.heart_rate;
  const ringValue = heartRate ? clamp(((heartRate - 40) / 100) * 100, 8, 100) : 0;

  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 bg-surface rounded-[28px] shadow-sm p-6">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold text-gray-900">Heart Rate Trend</p>
          <span className="text-xs text-gray-400">Goal 60-100 bpm</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex-1 h-40 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="t" hide />
                <Line type="monotone" dataKey="heart_rate" stroke="#8B5CF6" strokeWidth={3} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="relative shrink-0 w-28 h-28 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius="72%" outerRadius="100%" data={[{ value: ringValue }]} startAngle={90} endAngle={-270}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar dataKey="value" cornerRadius={20} fill="#8B5CF6" background={{ fill: "#F3F0FF" }} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-extrabold text-gray-900 font-display">{heartRate ?? "--"}</span>
              <span className="text-[10px] text-gray-400 font-medium">bpm</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
        {SECONDARY_CHANNELS.map((ch) => {
          const rawValue = latest?.[ch.field];
          const displayValue = ch.key === "bp" && latest ? `${latest.bp_systolic}/${latest.bp_diastolic}` : rawValue;
          const statusKey = ch.key === "bp" ? "bpSystolic" : ch.key;
          const status = statusForVital(statusKey, rawValue);
          return (
            <VitalCard
              key={ch.key}
              icon={ch.icon}
              label={ch.label}
              unit={ch.unit}
              value={displayValue}
              status={status}
              color={ch.color}
              bg={ch.bg}
            />
          );
        })}
      </div>
    </section>
  );
}
