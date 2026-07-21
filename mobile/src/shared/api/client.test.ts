// Tests for the cold-start retry interceptor added to apiClient.
// Verifies: GET 502/503/504 and ECONNABORTED are retried up to 2 times;
//           POST/PUT/DELETE and 4xx responses are never retried;
//           the existing 401 refresh-and-retry flow is not broken.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import type { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// Set the required env var at module-evaluation time.
// client.ts reads process.env at module load, and this file uses only dynamic
// imports (inside beforeEach) so the env var is set before the module loads.
process.env['EXPO_PUBLIC_API_URL'] = 'http://localhost:7071/api';

// Mock authService so the request interceptor (which reads tokens) does not
// attempt to access expo-secure-store in the Node test environment.
vi.mock('../../services/authService', () => ({
  authService: {
    getAccessToken: vi.fn().mockResolvedValue('mock-token'),
    isTokenExpired: vi.fn().mockReturnValue(false),
    refreshAccessToken: vi.fn().mockResolvedValue('refreshed-token'),
    clearTokens: vi.fn().mockResolvedValue(undefined),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHttpError(status: number, config: InternalAxiosRequestConfig): AxiosError {
  const response: AxiosResponse = {
    status,
    statusText: String(status),
    headers: {},
    config,
    data: {},
  };
  return new axios.AxiosError(
    `Request failed with status code ${status}`,
    'ERR_BAD_RESPONSE',
    config,
    {},
    response,
  );
}

function makeTimeoutError(config: InternalAxiosRequestConfig): AxiosError {
  return new axios.AxiosError(
    'timeout of 15000ms exceeded',
    'ECONNABORTED',
    config,
    {},
    undefined,
  );
}

function makeOkResponse(config: InternalAxiosRequestConfig): AxiosResponse {
  return { status: 200, statusText: 'OK', headers: {}, config, data: { ok: true } };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('apiClient — cold-start retry interceptor', () => {
  // apiClient is re-imported fresh for each test to avoid cross-test state leakage
  // from _retryCount fields accumulated on config objects.
  let apiClient: Awaited<typeof import('./client')>['apiClient'];

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    // Re-register the mock after resetModules so the freshly loaded client.ts
    // still receives the mock when it imports authService.
    vi.doMock('../../services/authService', () => ({
      authService: {
        getAccessToken: vi.fn().mockResolvedValue('mock-token'),
        isTokenExpired: vi.fn().mockReturnValue(false),
        refreshAccessToken: vi.fn().mockResolvedValue('refreshed-token'),
        clearTokens: vi.fn().mockResolvedValue(undefined),
      },
    }));
    ({ apiClient } = await import('./client'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // AC1 / AC2 — retryable GET scenarios
  // -------------------------------------------------------------------------

  it('GET 503 → 503 → 200: third attempt succeeds (AC1)', async () => {
    let callCount = 0;
    apiClient.defaults.adapter = vi.fn().mockImplementation(
      async (config: InternalAxiosRequestConfig) => {
        callCount++;
        if (callCount <= 2) throw makeHttpError(503, config);
        return makeOkResponse(config);
      },
    );

    const responsePromise = apiClient.get('/warmup');
    // Advance past the first retry delay (1 500 ms) then the second (3 000 ms).
    await vi.advanceTimersByTimeAsync(1_500);
    await vi.advanceTimersByTimeAsync(3_000);

    const response = await responsePromise;
    expect(response.data).toEqual({ ok: true });
    expect(callCount).toBe(3);
  });

  it('GET ECONNABORTED → 200: second attempt succeeds (AC2)', async () => {
    let callCount = 0;
    apiClient.defaults.adapter = vi.fn().mockImplementation(
      async (config: InternalAxiosRequestConfig) => {
        callCount++;
        if (callCount === 1) throw makeTimeoutError(config);
        return makeOkResponse(config);
      },
    );

    const responsePromise = apiClient.get('/warmup');
    await vi.advanceTimersByTimeAsync(1_500);

    const response = await responsePromise;
    expect(response.data).toEqual({ ok: true });
    expect(callCount).toBe(2);
  });

  it('GET 503 × 3: error thrown after exactly 3 attempts (AC1)', async () => {
    let callCount = 0;
    apiClient.defaults.adapter = vi.fn().mockImplementation(
      async (config: InternalAxiosRequestConfig) => {
        callCount++;
        throw makeHttpError(503, config);
      },
    );

    // Attach the .rejects handler BEFORE advancing timers to prevent an
    // "unhandled rejection" window between when the final retry fails and
    // when the awaited assertion catches it.
    const expectation = expect(apiClient.get('/warmup')).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(1_500);
    await vi.advanceTimersByTimeAsync(3_000);
    await expectation;

    expect(callCount).toBe(3);
  });

  // -------------------------------------------------------------------------
  // AC3 — non-GET methods are never retried
  // -------------------------------------------------------------------------

  it('POST 503: no retry, immediate error (AC3)', async () => {
    let callCount = 0;
    apiClient.defaults.adapter = vi.fn().mockImplementation(
      async (config: InternalAxiosRequestConfig) => {
        callCount++;
        throw makeHttpError(503, config);
      },
    );

    await expect(apiClient.post('/meals', {})).rejects.toThrow();
    expect(callCount).toBe(1);
  });

  // -------------------------------------------------------------------------
  // AC4 — 4xx responses are never retried
  // -------------------------------------------------------------------------

  it('GET 400: no retry (AC4)', async () => {
    let callCount = 0;
    apiClient.defaults.adapter = vi.fn().mockImplementation(
      async (config: InternalAxiosRequestConfig) => {
        callCount++;
        throw makeHttpError(400, config);
      },
    );

    await expect(apiClient.get('/warmup')).rejects.toThrow();
    expect(callCount).toBe(1);
  });

  // -------------------------------------------------------------------------
  // AC9 — existing 401 refresh-and-retry flow must not regress
  // -------------------------------------------------------------------------

  it('GET 401: refresh-and-retry succeeds, cold-start retry does NOT trigger (AC9)', async () => {
    let callCount = 0;
    apiClient.defaults.adapter = vi.fn().mockImplementation(
      async (config: InternalAxiosRequestConfig) => {
        callCount++;
        // First call → 401; second call (after token refresh) → 200
        if (callCount === 1) throw makeHttpError(401, config);
        return makeOkResponse(config);
      },
    );

    // No timer advancement needed: 401 retry does not use setTimeout
    const response = await apiClient.get('/profile');
    expect(response.data).toEqual({ ok: true });
    // Exactly 2 calls: the original 401 and one retry after refresh
    expect(callCount).toBe(2);
  });

  // -------------------------------------------------------------------------
  // AC10 — 429 quota errors must not be retried and quota info must be attached
  // -------------------------------------------------------------------------

  it('GET 429 quota_exceeded: not retried, quotaExceeded attached (AC10)', async () => {
    let callCount = 0;
    apiClient.defaults.adapter = vi.fn().mockImplementation(
      async (config: InternalAxiosRequestConfig) => {
        callCount++;
        const err = makeHttpError(429, config);
        // Overwrite response body with quota payload
        (err.response as AxiosResponse).data = {
          error: 'quota_exceeded',
          feature: 'ai_meal_scan',
          used: 5,
          limit: 5,
          resetsAt: '2026-07-21T00:00:00Z',
        };
        throw err;
      },
    );

    const { isQuotaExceededError } = await import('./client');
    const error = await apiClient.get('/ai').catch((e) => e);

    expect(callCount).toBe(1); // no retry
    expect(isQuotaExceededError(error)).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect((error as { quotaExceeded?: { feature: string } }).quotaExceeded?.feature).toBe(
      'ai_meal_scan',
    );
  });
});
