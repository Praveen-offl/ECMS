import React, { useEffect, useState } from "react";
import { Wind, Activity, Thermometer } from "lucide-react";

const TILES = [
  { key: "spo2", icon: Wind, label: "SpO2", unit: "%", gradient: "linear-gradient(135deg,#0EA5E9,#06B6D4)" },
  { key: "bp", icon: Activity, label: "Blood Pressure", unit: "mmHg", gradient: "linear-gradient(135deg,#F43F5E,#FB7185)" },
  { key: "temp", icon: Thermometer, label: "Temperature", unit: "°C", gradient: "linear-gradient(135deg,#FB923C,#F59E0B)" },
  { key: "resp", icon: Wind, label: "Respiration", unit: "br/min", gradient: "linear-gradient(135deg,#65A30D,#84CC16)" },
];

function VitalTile({ icon: Icon, label, value, unit, gradient }) {
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (value === undefined || value === null) return;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 400);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div className="vital-tile rounded-2xl p-4 flex items-center gap-3 hover-lift" style={{ background: gradient }}>
      <span className="tile-icon w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
        <Icon className="w-4.5 h-4.5 text-white" />
      </span>
      <div>
        <p className="tile-label text-xs font-medium">{label}</p>
        <p className={`text-lg font-bold font-display ${pulse ? "animate-count-pulse" : ""}`}>
          {value ?? "--"} <span className="text-xs font-medium opacity-80">{unit}</span>
        </p>
      </div>
    </div>
  );
}

export default function VitalsMonitor({ latest }) {
  const values = {
    spo2: latest?.spo2,
    bp: latest ? `${latest.bp_systolic}/${latest.bp_diastolic}` : null,
    temp: latest?.temperature,
    resp: latest?.respiration_rate,
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {TILES.map((t) => (
        <VitalTile key={t.key} icon={t.icon} label={t.label} value={values[t.key]} unit={t.unit} gradient={t.gradient} />
      ))}
    </div>
  );
}