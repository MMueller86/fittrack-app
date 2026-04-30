import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { addWeightHandler, deleteWeightHandler, listWeightsHandler } from './weights';
import { __resetWeightsRepositoryForTests } from '../lib/repositories/weightsRepository';
import { makeContext, makeRequest } from '../test-utils/http';
import { DEV_USER_ID } from '../lib/auth';

// HTTP-handler unit tests for the weight-tracking endpoints.
//
// We use the real in-memory repository (selected by the factory when no
// Cosmos env vars are set) so the tests exercise the full handler →
// repository code path. No mocks of internal modules are needed for the
// happy paths; the singleton is reset between tests for isolation.

const originalEnv = { ...process.env };

beforeEach(() => {
  delete process.env.COSMOS_ENDPOINT;
  delete process.env.COSMOS_KEY;
  __resetWeightsRepositoryForTests();
});

afterEach(() => {
  process.env = { ...originalEnv };
  __resetWeightsRepositoryForTests();
  vi.useRealTimers();
});

describe('GET /api/weights', () => {
  it('returns an empty list for a fresh user', async () => {
    const res = await listWeightsHandler(makeRequest(), makeContext());
    expect(res.status).toBe(200);
    expect(res.jsonBody).toEqual({ entries: [] });
  });

  it('returns previously-added entries newest first', async () => {
    await addWeightHandler(
      makeRequest({ body: { value: 80, unit: 'kg', date: '2026-04-28' } }),
      makeContext(),
    );
    await addWeightHandler(
      makeRequest({ body: { value: 81, unit: 'kg', date: '2026-04-30' } }),
      makeContext(),
    );

    const res = await listWeightsHandler(makeRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = res.jsonBody as { entries: Array<{ value: number; date: string; userId: string }> };
    expect(body.entries.map((e) => e.date)).toEqual(['2026-04-30', '2026-04-28']);
    expect(body.entries.every((e) => e.userId === DEV_USER_ID)).toBe(true);
  });
});

describe('POST /api/weights', () => {
  it('creates an entry with default unit "kg" and today\'s date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-30T10:15:00.000Z'));

    const res = await addWeightHandler(
      makeRequest({ body: { value: 82.5 } }),
      makeContext(),
    );

    expect(res.status).toBe(201);
    const entry = res.jsonBody as {
      id: string;
      userId: string;
      date: string;
      value: number;
      unit: string;
      createdAt: string;
    };
    expect(entry.userId).toBe(DEV_USER_ID);
    expect(entry.value).toBe(82.5);
    expect(entry.unit).toBe('kg');
    expect(entry.date).toBe('2026-04-30');
    expect(entry.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(entry.createdAt).toBe('2026-04-30T10:15:00.000Z');
  });

  it.each([
    ['negative value', { value: -1 }],
    ['zero value', { value: 0 }],
    ['value above max', { value: 1001 }],
    ['NaN value', { value: 'abc' }],
    ['missing value', {}],
  ])('returns 400 on %s', async (_label, body) => {
    const res = await addWeightHandler(makeRequest({ body }), makeContext());
    expect(res.status).toBe(400);
    expect(res.jsonBody).toMatchObject({ error: expect.stringContaining('value') });
  });

  it('returns 400 on invalid unit', async () => {
    const res = await addWeightHandler(
      makeRequest({ body: { value: 80, unit: 'stones' } }),
      makeContext(),
    );
    expect(res.status).toBe(400);
    expect(res.jsonBody).toMatchObject({ error: expect.stringContaining('unit') });
  });

  it('accepts unit "lbs"', async () => {
    const res = await addWeightHandler(
      makeRequest({ body: { value: 180, unit: 'lbs', date: '2026-04-30' } }),
      makeContext(),
    );
    expect(res.status).toBe(201);
    expect((res.jsonBody as { unit: string }).unit).toBe('lbs');
  });

  it.each([
    ['wrong format', '30-04-2026'],
    ['nonsense string', 'yesterday'],
    ['impossible day', '2026-02-30'],
  ])('returns 400 on invalid date (%s)', async (_label, date) => {
    const res = await addWeightHandler(
      makeRequest({ body: { value: 80, unit: 'kg', date } }),
      makeContext(),
    );
    expect(res.status).toBe(400);
    expect(res.jsonBody).toMatchObject({ error: expect.stringContaining('date') });
  });

  it('returns 400 on invalid JSON body', async () => {
    const res = await addWeightHandler(
      makeRequest({ rawBody: '{not json' }),
      makeContext(),
    );
    expect(res.status).toBe(400);
    expect(res.jsonBody).toEqual({ error: 'Invalid JSON body' });
  });
});

describe('DELETE /api/weights/:id', () => {
  it('returns 204 when the entry exists', async () => {
    const created = (await addWeightHandler(
      makeRequest({ body: { value: 80, unit: 'kg', date: '2026-04-30' } }),
      makeContext(),
    )).jsonBody as { id: string };

    const res = await deleteWeightHandler(
      makeRequest({ params: { id: created.id } }),
      makeContext(),
    );
    expect(res.status).toBe(204);

    // List is now empty.
    const list = await listWeightsHandler(makeRequest(), makeContext());
    expect(list.jsonBody).toEqual({ entries: [] });
  });

  it('returns 404 for an unknown id', async () => {
    const res = await deleteWeightHandler(
      makeRequest({ params: { id: 'does-not-exist' } }),
      makeContext(),
    );
    expect(res.status).toBe(404);
    expect(res.jsonBody).toEqual({ error: 'Entry not found' });
  });

  it('returns 400 when id is missing', async () => {
    const res = await deleteWeightHandler(makeRequest({ params: {} }), makeContext());
    expect(res.status).toBe(400);
    expect(res.jsonBody).toEqual({ error: 'Missing id' });
  });
});
