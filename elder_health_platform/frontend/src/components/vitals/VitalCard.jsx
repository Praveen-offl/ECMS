import React from "react";
import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";

const STATUS_PILL = {
  normal: "bg-lime-100 text-lime-700",
  warning: "bg-orange-100 text-orange-700",
  critical: "bg-rose-100 text-rose-700",
};

/**
 * A single vital as a compact stat card with an icon chip, big number, and
 * a small radial "ring" indicator — echoing the reference design's ring +
 * number pattern (see the big Heart Rate card in VitalsMonitor for the
 * full-size version of this same idea).
 */
export default function VitalCard({ icon: Icon, label, unit, value, status, color, bg, ringValue }) {
  return (
    <div className="bg-surface rounded-2xl p-4 flex items-center gap-3">
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
        {Icon && <Icon className="w-4.5 h-4.5" style={{ color }} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-gray-400 font-medium truncate">{label}</p>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${STATUS_PILL[status]}`}>
            {status}
          </span>
        </div>
        <p className="text-lg font-bold text-gray-900 font-display">
          {value ?? "--"} <span className="text-xs text-gray-400 font-medium">{unit}</span>
        </p>
      </div>
      {ringValue !== undefined && (
        <div className="w-10 h-10 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ value: ringValue }]} startAngle={90} endAngle={-270}>
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar dataKey="value" cornerRadius={10} fill={color} background={{ fill: "#F3F4F6" }} />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
