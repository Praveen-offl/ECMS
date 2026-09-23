import { create } from "zustand";

export const useDashboardStore = create((set, get) => ({
  patients: [],
  patientsLoading: true,
  patientsError: null,
  setPatients: (patients) =>
    set((state) => ({
      patients,
      patientsLoading: false,
      patientsError: null,
      // Keep the current selection if it still exists in the refreshed
      // roster; otherwise default to the first real patient returned.
      selectedPatientId:
        patients.find((p) => p.id === state.selectedPatientId)?.id || patients[0]?.id || null,
    })),
  setPatientsError: (err) => set({ patientsLoading: false, patientsError: err }),

  selectedPatientId: null,
  setSelectedPatientId: (id) => set({ selectedPatientId: id }),

  anomalies: [],
  addAnomaly: (anomaly) =>
    set((state) => ({ anomalies: [{ ...anomaly, status: anomaly.status || "pending" }, ...state.anomalies] })),
  acknowledgeAnomaly: (id) =>
    set((state) => ({
      anomalies: state.anomalies.map((a) => (a.id === id ? { ...a, status: "acknowledged" } : a)),
    })),
  setAnomalies: (list) => set({ anomalies: list }),

  activeFallAlert: null,
  setActiveFallAlert: (alert) => set({ activeFallAlert: alert }),
  dismissFallAlert: () => {
    const current = get().activeFallAlert;
    if (current) {
      get().addAnomaly({
        id: current.alert_id || Date.now(),
        time: current.created_at,
        type: "Fall Detection",
        severity: "critical",
        description: current.message || "Fall event acknowledged by caregiver",
        status: "acknowledged",
      });
    }
    set({ activeFallAlert: null });
  },
}));
