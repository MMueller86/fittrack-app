// Axios API client with JWT Bearer interceptor.
// On 401, attempts a token refresh via authService, then retries once.
// Implemented in M1 (stub) — token refresh logic wired in M2.

import axios from 'axios';

const BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:7071/api';

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

// Response interceptor — handle 401 with silent refresh (M2).
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // 401 handling and token refresh implemented in M2.
    return Promise.reject(error);
  },
);
