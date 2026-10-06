import React, { useMemo } from "react";
import { Droplet } from "lucide-react";

export default function TopSummaryRow({ latest }) {
  const spo2 = latest?.spo2 ?? null;

  const wellnessScore = useMemo(() => {
    if (!latest) return null;
    const hrScore = latest.heart_rate >= 60 && latest.heart_rate <= 100 ? 100 : 60;
    const spo2Score = latest.spo2 >= 95 ? 100 : 65;
    const respScore = latest.respiration_rate >= 12 && latest.respiration_rate <= 20 ? 100 : 65;
    return Math.round((hrScore + spo2Score + respScore) / 3);
  }, [latest]);

  return (
    <div className="grid grid-cols-5 gap-4">
      <div className="col-span-2 bg-surface rounded-[28px] p-6 shadow-sm flex items-center gap-5">
        <div
          className="relative w-20 h-20 rounded-full flex items-center justify-center shrink-0"
          style={{ background: `conic-gradient(#22C55E ${((wellnessScore ?? 0) / 100) * 360}deg, #F3F4F6 0deg)` }}
        >
          <div className="absolute inset-1.5 bg-surface rounded-full flex items-center justify-center">
            <p className="text-lg font-extrabold text-gray-900 font-display">{wellnessScore ?? "--"}%</p>
          </div>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900 font-display mb-1">Wellness Score</p>
          <p className="text-xs text-gray-400 leading-snug">Derived from deviation across HR, SpO2 & respiration</p>
        </div>
      </div>

      <div
        className="col-span-3 rounded-[28px] p-6 text-white relative overflow-hidden shadow-lg flex flex-col justify-center"
        style={{ background: "linear-gradient(135deg,#0EA5E9,#06B6D4)", boxShadow: "0 12px 28px -10px rgba(14,165,233,.5)" }}
      >
        <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center gap-2 mb-2">
          <Droplet className="w-4 h-4" />
          <p className="text-xs font-semibold uppercase tracking-wide opacity-90">SpO2 Monitor</p>
        </div>
        <p className="relative text-4xl font-extrabold font-display">{spo2 ?? "--"}%</p>
        <p className="relative text-xs opacity-75 mt-1">{spo2 && spo2 < 92 ? "Below normal range" : "Within normal range"}</p>
      </div>
    </div>
  );
}