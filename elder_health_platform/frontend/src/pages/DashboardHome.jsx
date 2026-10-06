import React from "react";
import { useOutletContext, Link } from "react-router-dom";
import TopSummaryRow from "../components/vitals/TopSummaryRow";
import HeartRateTrendCard from "../components/vitals/HeartRateTrendCard";
import VitalsMonitor from "../components/vitals/VitalsMonitor";
import AnomalyLogTable from "../components/anomalies/AnomalyLogTable";
import { useDashboardStore } from "../store/dashboardStore";

export default function DashboardHome() {
  const { latest, history } = useOutletContext();

  const selectedPatientId = useDashboardStore((s) => s.selectedPatientId);
  const patientsLoading = useDashboardStore((s) => s.patientsLoading);
  const anomalies = useDashboardStore((s) => s.anomalies);
  const acknowledgeAnomaly = useDashboardStore((s) => s.acknowledgeAnomaly);

  if (!patientsLoading && !selectedPatientId) {
    return (
      <div className="bg-surface rounded-[28px] shadow-sm p-10 text-center text-gray-500 text-sm">
        No patients linked to your account yet. Head to the{" "}
        <Link to="/dashboard/patients" className="font-semibold text-violet-600 hover:text-violet-800">
          Patients tab
        </Link>{" "}
        and enter a patient's invite code to add them to your roster.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <TopSummaryRow latest={latest} />
      <HeartRateTrendCard latest={latest} history={history} />
      <VitalsMonitor latest={latest} />
      <AnomalyLogTable anomalies={anomalies} onAcknowledge={acknowledgeAnomaly} />
    </div>
  );
}