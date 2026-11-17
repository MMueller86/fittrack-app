import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env['EXPO_PUBLIC_API_URL'] = 'https://func.example.net/api';

const auth = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  isTokenExpired: vi.fn(),
}));
vi.mock('../authService', () => ({ authService: auth }));

const APP = { version: '1.0.0', variant: 'development', os: 'android', osVersion: '15', deviceModel: 'Pixel 8' } as const;
const EPISODE = '11111111-1111-4111-8111-111111111111';

type Telemetry = typeof import('./telemetry');
let t: Telemetry;
let fetchMock: ReturnType<typeof vi.fn>;

const screenEvent = (i: number) =>
  ({
    type: 'screen', episodeId: EPISODE, name: 'Home', trigger: 'focus', startedAtMs: i,
    durationMs: 1, dataReadyMs: 1, renderMs: 0, result: 'data',
  }) as const;

const sentBatches = () => fetchMock.mock.calls.map((c) => JSON.parse((c[1] as { body: string }).body));

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  auth.getAccessToken.mockReset().mockResolvedValue('tok-secret');
  auth.isTokenExpired.mockReset().mockReturnValue(false);
  fetchMock = vi.fn().mockResolvedValue({ status: 204 });
  vi.stubGlobal('fetch', fetchMock);
  t = await import('./telemetry');
});

afterEach(() => {
  t.setForeground(false);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('telemetry buffer and flush', () => {
  it('keeps at most 200 events and drops the oldest (AC-20)', () => {
    for (let i = 0; i < 250; i += 1) t.record(screenEvent(i));
    t.startTelemetry(APP);
    return t.flush().then(() => {
      const sent = sentBatches().flatMap((b) => b.events as Array<{ startedAtMs: number }>);
      // 3 batches of at most 100 are flushed; the first event left in the buffer is #50
      expect(sent[0]!.startedAtMs).toBe(50);
    });
  });

  it('flushes at 30 queued events', async () => {
    t.startTelemetry(APP);
    for (let i = 0; i < 29; i += 1) t.record(screenEvent(i));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).not.toHaveBeenCalled();
    t.record(screenEvent(29));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentBatches()[0].events).toHaveLength(30);
  });

  it('flushes every 60 s while in the foreground and not in the background', async () => {
    t.startTelemetry(APP);
    t.record(screenEvent(1));
    await vi.advanceTimersByTimeAsync(59_000);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    t.setForeground(false);
    t.record(screenEvent(2));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not flush when not authenticated (no token or expired token)', async () => {
    t.startTelemetry(APP);
    t.record(screenEvent(1));
    auth.getAccessToken.mockResolvedValue(null);
    await t.flush();
    auth.getAccessToken.mockResolvedValue('tok');
    auth.isTokenExpired.mockReturnValue(true);
    await t.flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a rejecting relay call is swallowed, the batch is dropped and not retried (AC-19)', async () => {
    t.startTelemetry(APP);
    fetchMock.mockRejectedValue(new Error('network down'));
    t.record(screenEvent(1));
    await expect(t.flush()).resolves.toBeUndefined();
    await t.flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('record never throws', () => {
    expect(() => t.record(null as never)).not.toThrow();
  });

  it('sends the relay request to /telemetry/client with the bearer token only in the header (AC-18)', async () => {
    t.startTelemetry(APP);
    t.record(screenEvent(1));
    await t.flush();
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe('https://func.example.net/api/telemetry/client');
    expect(init.method).toBe('POST');
    expect(init.headers['Authorization']).toBe('Bearer tok-secret');
    expect(init.body).not.toContain('tok-secret');
    expect(init.body).not.toMatch(/authorization|bearer/i);
    expect(Object.keys(JSON.parse(init.body)).sort()).toEqual(['app', 'events', 'sessionId']);
    expect(JSON.parse(init.body).sessionId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('keeps the batch under the relay limits', async () => {
    t.startTelemetry(APP);
    const stack = 'a'.repeat(1000);
    for (let i = 0; i < 100; i += 1) t.record({ type: 'error', episodeId: EPISODE, name: 'Error', stack });
    await t.flush();
    for (const call of fetchMock.mock.calls) {
      const body = (call[1] as { body: string }).body;
      expect(body.length).toBeLessThanOrEqual(32_768);
      expect(JSON.parse(body).events.length).toBeLessThanOrEqual(100);
    }
  });
});
