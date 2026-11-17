// api events produced by the apiClient interceptors (AC-14..16, AC-18, AC-26). client.test.ts stays untouched.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';

process.env['EXPO_PUBLIC_API_URL'] = 'http://localhost:7071/api';

const mocks = vi.hoisted(() => ({
  record: vi.fn(),
  getAccessToken: vi.fn(),
  isTokenExpired: vi.fn(),
  refreshAccessToken: vi.fn(),
}));

vi.mock('../../services/telemetry/telemetry', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/telemetry/telemetry')>()),
  record: mocks.record,
}));
vi.mock('../../services/authService', () => ({
  authService: {
    getAccessToken: mocks.getAccessToken,
    isTokenExpired: mocks.isTokenExpired,
    refreshAccessToken: mocks.refreshAccessToken,
    clearTokens: vi.fn().mockResolvedValue(undefined),
  },
}));

const UUID = '3f2a9c1e-7b4d-4e8a-9c3b-1a2b3c4d5e6f';
type Api = Record<string, unknown> & { type: string };
const apiEvents = (): Api[] => mocks.record.mock.calls.map((c) => c[0] as Api).filter((e) => e.type === 'api');
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function httpError(status: number, config: InternalAxiosRequestConfig): AxiosError {
  return new axios.AxiosError('failed', 'ERR_BAD_RESPONSE', config, {}, {
    status, statusText: String(status), headers: {}, config, data: {},
  });
}

let apiClient: Awaited<typeof import('../../shared/api/client')>['apiClient'];
let seenHeaders: Array<Record<string, unknown>>;

function useAdapter(handler: (config: InternalAxiosRequestConfig, call: number) => Promise<unknown> | unknown) {
  let call = 0;
  apiClient.defaults.adapter = vi.fn().mockImplementation(async (config: InternalAxiosRequestConfig) => {
    call += 1;
    seenHeaders.push({ ...(config.headers.toJSON() as Record<string, unknown>) });
    await sleep(20);
    const result = await handler(config, call);
    return { status: 200, statusText: 'OK', headers: {}, config, data: { ok: true }, ...(result as object) };
  });
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] });
  vi.resetModules();
  mocks.record.mockReset();
  mocks.getAccessToken.mockReset().mockResolvedValue('secret-access-token');
  mocks.isTokenExpired.mockReset().mockReturnValue(false);
  mocks.refreshAccessToken.mockReset().mockResolvedValue('secret-refreshed-token');
  seenHeaders = [];
  ({ apiClient } = await import('../../shared/api/client'));
});

afterEach(() => vi.useRealTimers());

describe('api telemetry', () => {
  it('first-attempt success gives exactly one event with attempts = 1 (AC-14)', async () => {
    useAdapter(() => ({}));
    const p = apiClient.get(`/weights/${UUID}?x=1`);
    await vi.advanceTimersByTimeAsync(100);
    await p;

    const events = apiEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      route: 'GET /api/weights/{id}', source: 'ui', status: 200, attempts: 1,
      attemptMs: [20], attemptStatus: [200], retryWaitMs: 0, durationMs: 20,
    });
    expect(events[0]).not.toHaveProperty('tokenRefreshMs');
    expect(events[0]).not.toHaveProperty('errorClass');
  });

  it('sends the same request ID header on every attempt', async () => {
    useAdapter((config, call) => {
      if (call < 3) throw httpError(503, config);
      return {};
    });
    const p = apiClient.get('/weights');
    await vi.advanceTimersByTimeAsync(10_000);
    await p;
    const ids = seenHeaders.map((h) => h['x-fittrack-request-id']);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toBe(apiEvents()[0]!['clientRequestId']);
  });

  it('a GET retried twice gives one event, attempts = 3, retryWaitMs 4500 (AC-15, AC-26)', async () => {
    useAdapter((config, call) => {
      if (call < 3) throw httpError(503, config);
      return {};
    });
    const p = apiClient.get('/recipes');
    await vi.advanceTimersByTimeAsync(10_000);
    await p;

    const events = apiEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      attempts: 3, attemptStatus: [503, 503, 200], attemptMs: [20, 20, 20], retryWaitMs: 4_500, status: 200,
    });
    expect(events[0]!['durationMs'] as number).toBeGreaterThanOrEqual(4_500);
  });

  it('a failed request gives one event with the final status and error class', async () => {
    useAdapter((config) => {
      throw httpError(503, config);
    });
    const expectation = expect(apiClient.get('/recipes')).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(10_000);
    await expectation;
    const events = apiEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ attempts: 3, status: 503, errorClass: 'http', retryWaitMs: 4_500 });
  });

  it('a POST is not retried and keeps the method in the route', async () => {
    useAdapter((config) => {
      throw httpError(500, config);
    });
    await expect(Promise.all([apiClient.post('/diary/meals', { secret: 'free text' }), vi.advanceTimersByTimeAsync(100)])).rejects.toThrow();
    expect(apiEvents()[0]).toMatchObject({ route: 'POST /api/diary/meals', attempts: 1, status: 500 });
  });

  it('records tokenRefreshMs only when a refresh happened, tokenRefreshOk reflects the outcome (AC-16, AC-26)', async () => {
    useAdapter(() => ({}));
    mocks.isTokenExpired.mockReturnValue(true);
    mocks.refreshAccessToken.mockImplementation(async () => {
      await sleep(50);
      return 'secret-refreshed-token';
    });
    let p = apiClient.get('/weights');
    await vi.advanceTimersByTimeAsync(200);
    await p;
    expect(apiEvents()[0]).toMatchObject({ tokenRefreshMs: 50, tokenRefreshOk: true });

    mocks.refreshAccessToken.mockImplementation(async () => {
      await sleep(30);
      return null;
    });
    p = apiClient.get('/profile/me');
    await vi.advanceTimersByTimeAsync(200);
    await p;
    expect(apiEvents()[1]).toMatchObject({ tokenRefreshMs: 30, tokenRefreshOk: false });

    mocks.isTokenExpired.mockReturnValue(false);
    p = apiClient.get('/diary/changes/meals');
    await vi.advanceTimersByTimeAsync(100);
    await p;
    expect(apiEvents()[2]).not.toHaveProperty('tokenRefreshMs');
    expect(apiEvents()[2]).not.toHaveProperty('tokenRefreshOk');
  });

  it('a 401 with refresh and re-run stays one event and carries the refresh time', async () => {
    useAdapter((config, call) => {
      if (call === 1) throw httpError(401, config);
      return {};
    });
    mocks.refreshAccessToken.mockImplementation(async () => {
      await sleep(25);
      return 'secret-refreshed-token';
    });
    const p = apiClient.get('/weights');
    await vi.advanceTimersByTimeAsync(300);
    await p;
    expect(apiEvents()).toHaveLength(1);
    expect(apiEvents()[0]).toMatchObject({ attempts: 2, attemptStatus: [401, 200], tokenRefreshMs: 25, tokenRefreshOk: true });
  });

  it('the serialised events contain no token, body, query string, resource ID or user data (AC-18)', async () => {
    useAdapter(() => ({}));
    const p = Promise.all([
      apiClient.get(`/recipes/${UUID}?query=banane&email=a@b.de`),
      apiClient.post('/diary/meals', { name: 'Mein Frühstück', email: 'a@b.de' }),
      apiClient.get('/food-products/4006381333931', { telemetrySource: 'sync' }),
    ]);
    await vi.advanceTimersByTimeAsync(200);
    await p;

    const serialised = JSON.stringify(mocks.record.mock.calls.map((c) => c[0]));
    expect(apiEvents()).toHaveLength(3);
    for (const forbidden of ['secret-access-token', 'Bearer', 'Authorization', UUID, 'banane', 'a@b.de', 'Mein Frühstück', '4006381333931', '?']) {
      expect(serialised).not.toContain(forbidden);
    }
    expect(apiEvents().map((e) => e['route'])).toEqual([
      'GET /api/recipes/{id}', 'POST /api/diary/meals', 'GET /api/food-products/{id}',
    ]);
  });
});
