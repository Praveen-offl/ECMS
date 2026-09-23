import React, { useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import PatientChipSwitcher from "../components/layout/PatientChipSwitcher";
import FallAlertModal from "../components/alerts/FallAlertModal";
import { useVitalsSocket } from "../hooks/useVitalsSocket";
import { useAlertsSocket } from "../hooks/useAlertsSocket";
import { fetchAnomalyLog } from "../api/anomaliesApi";
import { fetchPatients } from "../api/patientsApi";
import { useDashboardStore } from "../store/dashboardStore";
import { useAuthStore } from "../store/authStore";

const PATIENTS_POLL_MS = 15000; // periodic refresh so new patients/status changes surface without a reload

/**
 * Shared shell for every /dashboard/* route (Dashboard, Patients, Alert
 * Logs, Settings — see App.jsx). Owns the patient roster poll and the live
 * vitals/alerts sockets so the sidebar's "Live" indicator, the fall-alert
 * modal, and the patient switcher all stay correct no matter which tab is
 * open. Page-specific content renders via <Outlet/>; the live vitals
 * reading + history are handed down through the outlet context so
 * DashboardHome can render them without every other page needing to know
 * about the socket.
 */
export default function DashboardLayout() {
  const caregiverId = useAuthStore((s) => s.caregiver?.id);
  const selectedPatientId = useDashboardStore((s) => s.selectedPatientId);
  const setPatients = useDashboardStore((s) => s.setPatients);
  const setPatientsError = useDashboardStore((s) => s.setPatientsError);
  const setAnomalies = useDashboardStore((s) => s.setAnomalies);
  const addAnomaly = useDashboardStore((s) => s.addAnomaly);
  const activeFallAlert = useDashboardStore((s) => s.activeFallAlert);
  const setActiveFallAlert = useDashboardStore((s) => s.setActiveFallAlert);
  const dismissFallAlert = useDashboardStore((s) => s.dismissFallAlert);

  const [readingsToday, setReadingsToday] = useState(0);
  const hadPatientsRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const load = () =>
      fetchPatients()
        .then((rows) => {
          if (cancelled) return;
          if (rows.length === 0 && hadPatientsRef.current) {
            // Defensive fix: a periodic refresh coming back empty right
            // after we previously had a working roster is far more likely
            // a transient hiccup (backend restart/reload, a slow request,
            // etc.) than the caregiver's roster actually being cleared —
            // there's no "unlink patient" feature that would do that. Don't
            // let one bad poll response blank out an otherwise-working
            // dashboard; just log it and try again next interval.
            console.warn("Patients refresh came back empty after previously having patients — keeping last known roster.");
            return;
          }
          if (rows.length > 0) hadPatientsRef.current = true;
          setPatients(rows);
        })
        .catch((err) => { if (!cancelled) setPatientsError(err.message); });

    load();
    const interval = setInterval(load, PATIENTS_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [setPatients, setPatientsError]);

  const { latest, history, connected: vitalsConnected } = useVitalsSocket(selectedPatientId);

  useEffect(() => {
    if (latest) setReadingsToday((n) => n + 1);
  }, [latest]);

  const { connected: alertsConnected } = useAlertsSocket(caregiverId, (alertPayload) => {
    if (alertPayload.type !== "alert") return;

    if (alertPayload.source_type === "fall_detection" && alertPayload.patient_id === selectedPatientId) {
      setActiveFallAlert(alertPayload);
      return;
    }

    addAnomaly({
      id: alertPayload.alert_id,
      time: alertPayload.created_at,
      type: alertPayload.source_type === "anomaly_ml" ? "Behavioral" : "Vitals Rule",
      severity: alertPayload.severity,
      description: alertPayload.message,
    });
  });

  useEffect(() => {
    if (!selectedPatientId) return undefined;
    let cancelled = false;
    setReadingsToday(0);
    fetchAnomalyLog(selectedPatientId).then((rows) => {
      if (!cancelled) setAnomalies(rows);
    });
    return () => { cancelled = true; };
  }, [selectedPatientId, setAnomalies]);

  return (
    <div className="min-h-screen bg-canvas p-4 sm:p-6">
      <div
        className="h-2 rounded-full mb-4"
        style={{ background: "linear-gradient(90deg, #14B8A6 0%, #0EA5E9 55%, #6366F1 100%)" }}
      />

      <div className="flex gap-4 max-w-[1400px] mx-auto">
        <Sidebar />

        <main className="flex-1 min-w-0 space-y-5">
          <Topbar vitalsConnected={vitalsConnected} alertsConnected={alertsConnected} readingsToday={readingsToday} />
          <PatientChipSwitcher />

          <Outlet context={{ latest, history }} />
        </main>
      </div>

      <FallAlertModal alert={activeFallAlert} onAcknowledge={dismissFallAlert} />
    </div>
  );
}