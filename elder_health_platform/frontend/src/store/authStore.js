import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Session store for the caregiver auth flow. Backed by the real
 * /api/v1/auth/signup and /api/v1/auth/login endpoints (backend/app/auth/),
 * which persist credentials in MongoDB and return a JWT. This store just
 * holds that token + the caregiver profile client-side; httpClient.js reads
 * the token straight out of this store's persisted localStorage entry
 * ("carewatch-auth") to authenticate every subsequent API call.
 */
export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      caregiver: null, // { id, full_name, email, created_at }

      /** Call with the TokenResponse returned by signup()/login() in api/authApi.js */
      setSession: ({ access_token, caregiver }) =>
        set({ token: access_token, caregiver }),

      logout: () => set({ token: null, caregiver: null }),
    }),
    { name: "carewatch-auth" }
  )
);

export const selectIsAuthenticated = (s) => Boolean(s.token);
