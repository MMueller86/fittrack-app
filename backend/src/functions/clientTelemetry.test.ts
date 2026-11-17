import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { InvocationContext } from '@azure/functions';

import {
  clientEventActorFields,
  clientTelemetryHandler,
  resetClientTelemetryRateLimit,
} from './clientTelemetry';
import { makeAuthRequest, makeRequest, setupTestAuth, teardownTestAuth, TEST_USER_ID } from '../test-utils/http';

const SESSION = '11111111-1111-4111-8111-111111111111';
const EPISODE = '22222222-2222-4222-8222-222222222222';
const REQUEST_ID = '33333333-3333-4333-8333-333333333333';

interface Captured { level: string; line: Record<string, unknown> }

function makeCapturingContext(): { ctx: InvocationContext; lines: Captured[] } {
  const lines: Captured[] = [];
  const sink = (level: string) => (msg: unknown) => {
    lines.push({ level, line: JSON.parse(String(msg)) as Record<string, unknown> });
  };
  const ctx = {
    log: sink('info'),
    warn: sink('warn'),
    error: sink('error'),
    info: () => {},
    debug: () => {},
    trace: () => {},
    invocationId: 'test-invocation',
  } as unknown as InvocationContext;
  return { ctx, lines };
}

const traces = (lines: Captured[]) => lines.filter((l) => String(l.line.event).startsWith('client.'));

const app = { version: '1.2.3', variant: 'preview', os: 'android', osVersion: '15', deviceModel: 'Pixel 8 (test)' };

const apiEvent = {
  type: 'api', episodeId: EPISODE, clientRequestId: REQUEST_ID, route: 'GET /api/diary/day/{date}',
  source: 'ui', screen: 'Home', startedAtMs: 1200, status: 200, durationMs: 340, attempts: 2,
  attemptMs: [200, 140], attemptStatus: [0, 200], retryWaitMs: 500, tokenRefreshMs: 80, tokenRefreshOk: true,
};

const allEvents = [
  { type: 'episode', episodeId: EPISODE, trigger: 'cold_start', jsEntryPerfMs: 900 },
  { type: 'milestone', episodeId: EPISODE, name: 'auth_ready', atMs: 1500, authPath: 'valid', authMs: 120 },
  apiEvent,
  {
    type: 'screen', episodeId: EPISODE, name: 'Home', trigger: 'cold_start', startedAtMs: 1000,
    durationMs: 900, dataReadyMs: 700, renderMs: 200, result: 'data',
  },
  { type: 'error', episodeId: EPISODE, name: 'TypeError', stack: 'at foo (bar.js:1:1)' },
];

const batch = (events: unknown[] = allEvents) => ({ app, sessionId: SESSION, events });

async function post(body: unknown, ctx = makeCapturingContext().ctx) {
  return clientTelemetryHandler(await makeAuthRequest({ body }), ctx);
}

beforeAll(async () => { await setupTestAuth(); });
afterAll(() => { teardownTestAuth(); });
beforeEach(() => { resetClientTelemetryRateLimit(); vi.useRealTimers(); });

describe('POST /api/telemetry/client', () => {
  it('returns 401 without a Bearer token (AC-3)', async () => {
    const { ctx, lines } = makeCapturingContext();
    const res = await clientTelemetryHandler(makeRequest({ body: batch() }), ctx);
    expect(res.status).toBe(401);
    expect(traces(lines)).toEqual([]);
  });

  it('writes one batch trace and one trace per event with exact fields and returns 204 (AC-5, AC-30)', async () => {
    const { ctx, lines } = makeCapturingContext();
    const res = await post(batch(), ctx);
    expect(res.status).toBe(204);
    expect(res.jsonBody).toBeUndefined();

    const written = traces(lines).map((l) => l.line);
    expect(written).toHaveLength(6);
    const strip = ({ ts: _ts, level: _level, ...rest }: Record<string, unknown>) => rest;
    expect(strip(written[0]!)).toEqual({
      event: 'client.batch', session_id: SESSION, app_version: '1.2.3', app_variant: 'preview',
      os: 'android', os_version: '15', device_model: 'Pixel 8 (test)', received_events: 5,
    });
    expect(strip(written[1]!)).toEqual({
      event: 'client.episode', episode_id: EPISODE, trigger: 'cold_start', js_entry_perf_ms: 900, userId: TEST_USER_ID,
    });
    expect(strip(written[2]!)).toEqual({
      event: 'client.milestone', episode_id: EPISODE, name: 'auth_ready', at_ms: 1500,
      auth_path: 'valid', auth_ms: 120, userId: TEST_USER_ID,
    });
    expect(strip(written[3]!)).toEqual({
      event: 'client.api', episode_id: EPISODE, client_request_id: REQUEST_ID, route: 'GET /api/diary/day/{date}',
      source: 'ui', screen: 'Home', started_at_ms: 1200, status: 200, client_ms: 340, attempts: 2,
      attempt_ms: '200,140', attempt_status: '0,200', retry_wait_ms: 500, token_refresh_ms: 80,
      token_refresh_ok: true, userId: TEST_USER_ID,
    });
    expect(strip(written[4]!)).toEqual({
      event: 'client.screen', episode_id: EPISODE, name: 'Home', trigger: 'cold_start', started_at_ms: 1000,
      client_ms: 900, data_ready_ms: 700, render_ms: 200, result: 'data', userId: TEST_USER_ID,
    });
    expect(strip(written[5]!)).toEqual({
      event: 'client.error', episode_id: EPISODE, name: 'TypeError', stack: 'at foo (bar.js:1:1)', userId: TEST_USER_ID,
    });
  });

  it('adds userId to event traces only through clientEventActorFields (AC-8)', async () => {
    expect(clientEventActorFields('u-1')).toEqual({ userId: 'u-1' });
    const { ctx, lines } = makeCapturingContext();
    await post(batch(), ctx);
    const events = traces(lines).filter((l) => l.line.event !== 'client.batch');
    expect(events.every((l) => l.line.userId === TEST_USER_ID)).toBe(true);
    const serialized = JSON.stringify(lines);
    expect(serialized).not.toMatch(/authorization|bearer|@/i);
  });

  it('accepts an empty events array and writes only the batch trace', async () => {
    const { ctx, lines } = makeCapturingContext();
    expect((await post(batch([]), ctx)).status).toBe(204);
    expect(traces(lines).map((l) => l.line.event)).toEqual(['client.batch']);
  });

  const invalidCases: Array<[string, unknown]> = [
    ['unknown top-level key', { ...batch(), extra: 1 }],
    ['unknown event key', batch([{ ...allEvents[0], extra: 1 }])],
    ['unknown app key', { ...batch(), app: { ...app, extra: 1 } }],
    ['more than 100 events', batch(Array.from({ length: 101 }, () => allEvents[0]))],
    ['route with query string', batch([{ ...apiEvent, route: 'GET /api/foods?q=abc' }])],
    ['route with uppercase segment', batch([{ ...apiEvent, route: 'GET /api/Diary' }])],
    ['route over 120 chars', batch([{ ...apiEvent, route: `GET /api/${'a'.repeat(120)}` }])],
    ['unknown enumeration value', batch([{ ...allEvents[1], name: 'bogus' }])],
    ['missing episodeId', batch([{ type: 'episode', trigger: 'cold_start' }])],
    ['time above 604800000', batch([{ ...allEvents[1], atMs: 604_800_001 }])],
    ['negative time', batch([{ ...allEvents[1], atMs: -1 }])],
    ['non-integer time', batch([{ ...allEvents[1], atMs: 1.5 }])],
    ['status above 599', batch([{ ...apiEvent, status: 600 }])],
    ['attempts above 3', batch([{ ...apiEvent, attempts: 4 }])],
    ['four attempt entries', batch([{ ...apiEvent, attemptMs: [1, 2, 3, 4] }])],
    ['durationMs above 600000', batch([{ ...apiEvent, durationMs: 600_001 }])],
    ['retryWaitMs above 10000', batch([{ ...apiEvent, retryWaitMs: 10_001 }])],
    ['stack above 1000 chars', batch([{ ...allEvents[4], stack: 'x'.repeat(1001) }])],
    ['error name with disallowed chars', batch([{ ...allEvents[4], name: 'a<b>' }])],
    ['deviceModel with disallowed chars', { ...batch(), app: { ...app, deviceModel: 'x;y' } }],
    ['backgroundMs on cold start', batch([{ ...allEvents[0], backgroundMs: 5 }])],
    ['jsEntryPerfMs on resume', batch([{ type: 'episode', episodeId: EPISODE, trigger: 'resume', jsEntryPerfMs: 5 }])],
    ['non-uuid sessionId', { ...batch(), sessionId: 'abc' }],
  ];

  it.each(invalidCases)('rejects %s with 400 and writes no event trace (AC-4, AC-30)', async (_name, body) => {
    const { ctx, lines } = makeCapturingContext();
    const res = await post(body, ctx);
    expect(res.status).toBe(400);
    expect(traces(lines)).toEqual([]);
  });

  it('accepts a resume episode with backgroundMs', async () => {
    const res = await post(batch([{ type: 'episode', episodeId: EPISODE, trigger: 'resume', backgroundMs: 5000 }]));
    expect(res.status).toBe(204);
  });

  it('rejects a body above 32 KB with 400 and writes no event trace (AC-4)', async () => {
    const { ctx, lines } = makeCapturingContext();
    const res = await clientTelemetryHandler(
      await makeAuthRequest({ rawBody: JSON.stringify({ ...batch([]), pad: 'x'.repeat(33 * 1024) }) }),
      ctx,
    );
    expect(res.status).toBe(400);
    expect(traces(lines)).toEqual([]);
  });

  it('rejects a body whose declared content-length exceeds 32 KB', async () => {
    const res = await clientTelemetryHandler(
      await makeAuthRequest({ body: batch(), headers: { 'content-length': String(40 * 1024) } }),
      makeCapturingContext().ctx,
    );
    expect(res.status).toBe(400);
  });

  it('rejects invalid JSON with 400', async () => {
    const res = await clientTelemetryHandler(await makeAuthRequest({ rawBody: '{nope' }), makeCapturingContext().ctx);
    expect(res.status).toBe(400);
  });

  it('answers the 11th batch within a minute with a body-less 429, never as error (AC-6)', async () => {
    for (let i = 0; i < 10; i += 1) {
      expect((await post(batch([]))).status).toBe(204);
    }
    const { ctx, lines } = makeCapturingContext();
    const res = await post(batch(), ctx);
    expect(res.status).toBe(429);
    expect(res.jsonBody).toBeUndefined();
    expect(res.body).toBeUndefined();
    expect(traces(lines)).toEqual([]);
    expect(lines.some((l) => l.level === 'error')).toBe(false);
  });

  it('accepts batches again after the one-minute window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-16T10:00:00Z'));
    for (let i = 0; i < 10; i += 1) await post(batch([]));
    expect((await post(batch([]))).status).toBe(429);
    vi.setSystemTime(new Date('2026-11-16T10:01:01Z'));
    expect((await post(batch([]))).status).toBe(204);
  });
});
