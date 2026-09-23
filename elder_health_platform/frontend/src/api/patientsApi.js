import { httpClient } from "./httpClient";

/**
 * Real patient roster — every field here comes from actual ingested vitals
 * (see backend `_upsert_patient` in main.py). Nothing about who the
 * patients are, their room, or their initials is ever invented client-side.
 * Requires auth: the backend scopes this to only patients linked to the
 * signed-in caregiver (see /api/v1/patients in main.py).
 */
export async function fetchPatients() {
  const { data } = await httpClient.get("/api/v1/patients");
  return data;
}

/**
 * Redeems a patient's invite code, linking them to the signed-in caregiver.
 * Backed by POST /api/v1/patients/link (backend/app/main.py).
 */
export async function linkPatient(inviteCode) {
  const { data } = await httpClient.post("/api/v1/patients/link", { invite_code: inviteCode });
  return data;
}
