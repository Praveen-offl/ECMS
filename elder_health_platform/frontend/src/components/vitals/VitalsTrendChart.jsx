import React from "react";
import { LineChart, Line, ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import { Droplet, Footprints, Moon } from "lucide-react";

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Second row of the vitals section: a gradient SpO2 "monitor" card (the
 * reference design's signature gradient panel), a wellness radial score
 * synthesized from how far current vitals sit from baseline, and a daily
 * activity progress card. Kept as one component since these three panels
 * are visually and narratively one row, not independent widgets.
 */
export default function VitalsTrendChart({ latest, history }) {
  const spo2 = latest?.spo2 ?? 0;
  const heartRate = latest?.heart_rate ?? 74;
  const respirationRate = latest?.respiration_rate ?? 16;

  const wellnessRaw = 100 - Math.abs(heartRate - 74) * 0.6 - Math.abs(spo2 - 97) * 1.5 - Math.abs(respirationRate - 16) * 0.8;
  const wellness = Math.round(clamp(wellnessRaw, 40, 100));
  const wellnessColor = wellness >= 80 ? "#84CC16" : wellness >= 60 ? "#FB923C" : "#F43F5E";

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      <div
        className="rounded-[28px] p-5 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0EA5E9 0%, #14B8A6 100%)" }}
      >
        <div className="flex items-center gap-1.5 text-xs font-medium opacity-90 mb-1">
          <Droplet className="w-3.5 h-3.5" /> SPO2 MONITOR
        </div>
        <p className="text-3xl font-extrabold mb-3 font-display">{spo2}%</p>
        <div className="h-14 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <Line type="monotone" dataKey="spo2" stroke="#ffffff" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-surface rounded-[28px] shadow-sm p-5 flex flex-col items-center justify-center">
        <p className="text-sm font-semibold text-gray-900 self-start mb-2">Wellness Score</p>
        <div className="relative w-24 h-24">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart innerRadius="75%" outerRadius="100%" data={[{ value: wellness }]} startAngle={90} endAngle={-270}>
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar dataKey="value" cornerRadius={20} fill={wellnessColor} background={{ fill: "#F3F4F6" }} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-extrabold text-gray-900 font-display">{wellness}%</span>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 mt-2 text-center">Derived from deviation across HR, SpO2 &amp; respiration</p>
      </div>

      <div className="bg-surface rounded-[28px] shadow-sm p-5">
        <p className="text-sm font-semibold text-gray-900 mb-4">Today's Activity</p>
        <div className="space-y-4">
          <ActivityBar icon={Footprints} label="Steps" value={3240} goal={4000} color="#FB923C" />
          <ActivityBar icon={Moon} label="Sleep (hrs)" value={6.8} goal={8} color="#8B5CF6" decimals={1} />
        </div>
      </div>
    </section>
  );
}

function ActivityBar({ icon: Icon, label, value, goal, color, decimals = 0 }) {
  const pct = Math.min(100, Math.round((value / goal) * 100));
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
          <Icon className="w-3.5 h-3.5" style={{ color }} /> {label}
        </span>
        <span className="text-xs font-semibold text-gray-700">
          {value.toFixed(decimals)}/{goal}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
