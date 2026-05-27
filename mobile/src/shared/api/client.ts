// Axios API client with JWT Bearer interceptor.
// Attaches access_token to requests, handles 401 with silent refresh + retry,
// and surfaces 429 quota errors with structured info.

import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { authService } from '../../services/authService';

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

// Request interceptor — attach Bearer access_token.
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  let token = await authService.getAccessToken();

  // Proactively refresh if token is expired or about to expire.
  // If the refresh fails, keep the existing token and let the server decide:
  // a still-valid token succeeds; a truly expired token gets a 401 which the
  // response interceptor handles (retry refresh → logout).
  if (authService.isTokenExpired(token)) {
    const refreshed = await authService.refreshAccessToken();
    if (refreshed !== null) {
      token = refreshed;
    }
  }

  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

// Response interceptor — handle 401 with silent refresh + retry, and 429 quota exceeded.
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // 401 — attempt silent refresh and retry once
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      error.config &&
      !(error.config as InternalAxiosRequestConfig & { _retry?: boolean })._retry
    ) {
      (error.config as InternalAxiosRequestConfig & { _retry?: boolean })._retry = true;
      const newToken = await authService.refreshAccessToken();
      if (newToken) {
        error.config.headers.set('Authorization', `Bearer ${newToken}`);
        return apiClient(error.config);
      }
      // Refresh failed — clear tokens, emit event for auth gate to catch
      await authService.clearTokens();
      authEvents.emit('logout');
    }

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
    return Promise.reject(error);
  },
);

// ---------------------------------------------------------------------------
// Auth event emitter — lightweight pub/sub for logout signals
// ---------------------------------------------------------------------------

type AuthEventListener = () => void;

export const authEvents = {
  _listeners: [] as AuthEventListener[],
  on(event: 'logout', fn: AuthEventListener) {
    this._listeners.push(fn);
    return () => { this._listeners = this._listeners.filter((l) => l !== fn); };
  },
  emit(event: 'logout') {
    this._listeners.forEach((fn) => fn());
  },
};

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
