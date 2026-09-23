import { httpClient } from "./httpClient";

/**
 * Fetches the most recent persisted vitals reading for a patient — used to
 * populate the dashboard before the first live WebSocket message arrives,
 * so the UI never opens on an empty state.
 */
export async function fetchLatestVitals(patientId) {
  const { data } = await httpClient.get(`/api/v1/vitals/${patientId}/latest`);
  return data;
}
