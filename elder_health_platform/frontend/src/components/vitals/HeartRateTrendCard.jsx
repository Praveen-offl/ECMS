import React, { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { Heart } from "lucide-react";

export default function HeartRateTrendCard({ latest, history = [] }) {
  const heartRate = latest?.heart_rate;
  const beatDuration = heartRate ? Math.max(0.4, 60 / heartRate) : 1;

  const chartData = useMemo(() => {
    return history
      .filter((r) => r.heart_rate !== null && r.heart_rate !== undefined)
      .slice(-50)
      .map((r) => ({
        time: new Date(r.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        hr: r.heart_rate,
      }));
  }, [history]);

  return (
    <div className="bg-surface rounded-[28px] shadow-sm p-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-900 font-display">Heart Rate Trend</h3>
        <span className="text-xs text-gray-400">Goal 60-100 bpm</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0 h-48">
          {chartData.length < 2 ? (
            <div className="h-full flex items-center justify-center text-xs text-gray-400">
              Waiting for enough readings to plot a trend...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="hrFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 140]} tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 20px -6px rgba(0,0,0,.15)", fontSize: 12 }}
                  labelStyle={{ color: "#6B7280" }}
                />
                <Area type="monotone" dataKey="hr" stroke="#8B5CF6" strokeWidth={2.5} fill="url(#hrFill)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
          <p className="text-[11px] text-gray-400 text-center -mt-1">Past readings this session</p>
        </div>

        <div
          className="relative w-28 h-28 rounded-full flex items-center justify-center shrink-0"
          style={{ boxShadow: "0 16px 32px -12px rgba(139,92,246,.55)" }}
        >
          <div className="absolute inset-0 rounded-full" style={{ background: "linear-gradient(145deg,#8B5CF6,#6366F1)" }} />
          <div className="relative flex flex-col items-center justify-center">
            <Heart
              className="w-4 h-4 text-white mb-0.5"
              fill="currentColor"
              style={{ animation: heartRate ? `count-pulse ${beatDuration}s ease-in-out infinite` : "none" }}
            />
            <p className="text-2xl font-extrabold text-white font-display">{heartRate ?? "--"}</p>
            <p className="text-[10px] text-white/70">bpm</p>
          </div>
        </div>
      </div>
    </div>
  );
}