// Axios API client with JWT Bearer interceptor.
// On 401, attempts a token refresh via authService, then retries once.
// Implemented in M1 (stub) — token refresh logic wired in M2.

import axios from 'axios';

// `EXPO_PUBLIC_API_URL` MUST be set in .env / EAS build profile.
// Examples:
//   .env (local dev)        EXPO_PUBLIC_API_URL=http://10.0.2.2:7071/api
//   .env (LAN device)       EXPO_PUBLIC_API_URL=http://10.5.21.134:7071/api
//   eas.json (production)   EXPO_PUBLIC_API_URL=https://api.fittrack.app/api
//
// We deliberately do NOT default to `http://localhost:7071/api`. A silent
// localhost fallback in a production build would either fail mysteriously
// or, worse, hit attacker infrastructure on a shared network. Failing
// loudly at startup is the right trade-off.
const BASE_URL = process.env['EXPO_PUBLIC_API_URL'];
if (!BASE_URL) {
  throw new Error(
    'EXPO_PUBLIC_API_URL is not set. Configure it in mobile/.env (dev) or ' +
      'in your EAS build profile (production). See mobile/README.md.',
  );
}

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach Bearer token (populated in M2).
apiClient.interceptors.request.use((config) => {
  // Token injection wired in M2 (authService.getAccessToken()).
  return config;
});

// Response interceptor — handle 401 with silent refresh (M2) and 429 quota exceeded.
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // 429 — AI quota exceeded
    if (axios.isAxiosError(error) && error.response?.status === 429) {
      const body = error.response.data;
      if (body?.error === 'quota_exceeded') {
        // Attach structured quota info to the error for UI consumption
        (error as QuotaAxiosError).quotaExceeded = {
          feature: body.feature,
          used: body.used,
          limit: body.limit,
          resetsAt: body.resetsAt,
        };
      }
    }
    // 401 handling and token refresh implemented in M2.
    return Promise.reject(error);
  },
);

// ---------------------------------------------------------------------------
// Quota error typing for consumers
// ---------------------------------------------------------------------------

export interface QuotaInfo {
  feature: string;
  used: number;
  limit: number;
  resetsAt: string;
}

export interface QuotaAxiosError {
  quotaExceeded?: QuotaInfo;
}

export function isQuotaExceededError(error: unknown): error is QuotaAxiosError & Error {
  return (
    axios.isAxiosError(error) &&
    error.response?.status === 429 &&
    (error as QuotaAxiosError).quotaExceeded != null
  );
}
