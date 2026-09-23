import { httpClient } from "./httpClient";

/**
 * Historical alert log for a patient — backed by GET /api/v1/anomalies/{patient_id}
 * (backend/app/main.py), which returns every alert ever created for that
 * patient (rule-based, ML, or fall-detection — they all land in the same
 * `alerts` table). Scoped server-side to patients linked to the signed-in
 * caregiver. Still fails soft to an empty list on error (e.g. a transient
 * network hiccup) so the dashboard keeps working off live WebSocket
 * pushes rather than hard-failing the page.
 */
export async function fetchAnomalyLog(patientId) {
  try {
    const { data } = await httpClient.get(`/api/v1/anomalies/${patientId}`);
    return data;
  } catch (err) {
    console.warn(`Couldn't load alert history for ${patientId}; using live-only data.`, err.message);
    return [];
  }
}
