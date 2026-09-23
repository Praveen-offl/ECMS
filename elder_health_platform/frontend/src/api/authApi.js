import { httpClient } from "./httpClient";

/**
 * Caregiver signup/login against the FastAPI auth router backed by
 * MongoDB (see backend/app/auth/routes.py). All three endpoints return
 * shapes matching TokenResponse / CaregiverResponse in backend/app/auth/schemas.py.
 */
export async function signup({ fullName, email, password }) {
  const { data } = await httpClient.post("/api/v1/auth/signup", {
    full_name: fullName,
    email,
    password,
  });
  return data;
}

export async function login({ email, password }) {
  const { data } = await httpClient.post("/api/v1/auth/login", { email, password });
  return data;
}

export async function fetchMe() {
  const { data } = await httpClient.get("/api/v1/auth/me");
  return data;
}
