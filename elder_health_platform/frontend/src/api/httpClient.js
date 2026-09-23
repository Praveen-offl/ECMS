import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
export const WS_BASE_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000";

export const httpClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
});

// Attach the caregiver's JWT (issued by /api/v1/auth/login|signup) to every
// request once one exists. Reads directly from the persisted zustand auth
// store's localStorage key rather than importing the store here, so this
// module has no circular dependency on store/authStore.js.
httpClient.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem("carewatch-auth");
    const token = raw ? JSON.parse(raw)?.state?.token : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // Corrupt/missing storage just means the request goes out unauthenticated.
  }
  return config;
});
