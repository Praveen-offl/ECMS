import React, { useMemo } from "react";
import { Droplet, Footprints, Moon } from "lucide-react";

export default function VitalsTrendChart({ latest, history }) {
  const spo2 = latest?.spo2 ?? null;

  // Simple composite "wellness score" from how close HR/SpO2/respiration
  // are to their normal ranges — a presentational summary, not a model.
  const wellnessScore = useMemo(() => {
    if (!latest) return null;
    const hrScore = latest.heart_rate >= 60 && latest.heart_rate <= 100 ? 100 : 60;
    const spo2Score = latest.spo2 >= 95 ? 100 : 65;
    const respScore = latest.respiration_rate >= 12 && latest.respiration_rate <= 20 ? 100 : 65;
    return Math.round((hrScore + spo2Score + respScore) / 3);
  }, [latest]);

  // NOTE: steps/sleep aren't part of this app's real vitals ingestion
  // pipeline (see app/ml/vitals_features.py's docstring on this same gap)
  // — these two numbers are illustrative placeholders, not live data.
  // Swap in real fields here once/if a steps or sleep source exists.
  const steps = 3240;
  const stepsGoal = 4000;
  const sleepHrs = 6.8;
  const sleepGoal = 8;

  return (
    <div className="grid sm:grid-cols-3 gap-4">
      <div
        className="rounded-[28px] p-6 text-white relative overflow-hidden shadow-lg"
        style={{ background: "linear-gradient(135deg,#0EA5E9,#06B6D4)", boxShadow: "0 12px 28px -10px rgba(14,165,233,.5)" }}
      >
        <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center gap-2 mb-4">
          <Droplet className="w-4 h-4" />
          <p className="text-xs font-semibold uppercase tracking-wide opacity-90">SpO2 Monitor</p>
        </div>
        <p className="relative text-4xl font-extrabold font-display">{spo2 ?? "--"}%</p>
        <p className="relative text-xs opacity-75 mt-1">{spo2 && spo2 < 92 ? "Below normal range" : "Within normal range"}</p>
      </div>

      <div className="bg-surface rounded-[28px] p-6 shadow-sm">
        <p className="text-sm font-bold text-gray-900 font-display mb-4">Wellness Score</p>
        <div className="flex items-center justify-center">
          <div
            className="relative w-28 h-28 rounded-full flex items-center justify-center"
            style={{
              background: `conic-gradient(#65A30D ${((wellnessScore ?? 0) / 100) * 360}deg, #F3F4F6 0deg)`,
            }}
          >
            <div className="absolute inset-2 bg-surface rounded-full flex items-center justify-center">
              <p className="text-2xl font-extrabold text-gray-900 font-display">{wellnessScore ?? "--"}%</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-400 text-center mt-4">Derived from deviation across HR, SpO2 & respiration</p>
      </div>

      <div className="bg-surface rounded-[28px] p-6 shadow-sm">
        <p className="text-sm font-bold text-gray-900 font-display mb-4">Today's Activity</p>

        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="flex items-center gap-1.5 text-gray-500 font-medium"><Footprints className="w-3.5 h-3.5 text-orange-500" /> Steps</span>
            <span className="text-gray-900 font-semibold">{steps}/{stepsGoal}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, (steps / stepsGoal) * 100)}%`, background: "linear-gradient(90deg,#FB923C,#F59E0B)" }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="flex items-center gap-1.5 text-gray-500 font-medium"><Moon className="w-3.5 h-3.5 text-violet-500" /> Sleep (hrs)</span>
            <span className="text-gray-900 font-semibold">{sleepHrs}/{sleepGoal}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, (sleepHrs / sleepGoal) * 100)}%`, background: "linear-gradient(90deg,#8B5CF6,#6366F1)" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}