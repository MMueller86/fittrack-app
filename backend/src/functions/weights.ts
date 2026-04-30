import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'node:crypto';

import { requireUser } from '../lib/auth';
import { getWeightsRepository } from '../lib/repositories/weightsRepository';
import type { WeightEntry, WeightUnit } from '@fittrack/shared';

// GET    /api/weights     — list entries for current user (newest first)
// POST   /api/weights     — add weight entry for current user
// DELETE /api/weights/:id — delete entry owned by current user
//
// Handlers are exported as named functions so they can be unit-tested
// directly (with a mocked repository) without spinning up the Functions
// host. The `app.http(...)` registrations at the bottom of the file are
// the only side effects of importing this module.

interface AddWeightBody {
  value?: unknown;
  unit?: unknown;
  date?: unknown;
}

const VALID_UNITS: readonly WeightUnit[] = ['kg', 'lbs'];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  // Reject dates that JavaScript silently rolls over (e.g. 2026-02-30 → Mar 2).
  const [y, m, day] = value.split('-').map(Number);
  return d.getUTCFullYear() === y && d.getUTCMonth() + 1 === m && d.getUTCDate() === day;
}

export async function listWeightsHandler(
  request: HttpRequest,
  _ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const { userId } = requireUser(request);
  const repo = getWeightsRepository();
  const entries = await repo.list(userId);
  return { status: 200, jsonBody: { entries } };
}

export async function addWeightHandler(
  request: HttpRequest,
  _ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const { userId } = requireUser(request);

  let body: AddWeightBody;
  try {
    body = (await request.json()) as AddWeightBody;
  } catch {
    return { status: 400, jsonBody: { error: 'Invalid JSON body' } };
  }

  const value = typeof body.value === 'number' ? body.value : Number(body.value);
  if (!Number.isFinite(value) || value <= 0 || value > 1000) {
    return { status: 400, jsonBody: { error: 'Field "value" must be a positive number ≤ 1000' } };
  }

  const unit = (body.unit ?? 'kg') as WeightUnit;
  if (!VALID_UNITS.includes(unit)) {
    return { status: 400, jsonBody: { error: `Field "unit" must be one of ${VALID_UNITS.join(', ')}` } };
  }

  const date = typeof body.date === 'string' && body.date.length > 0 ? body.date : todayIso();
  if (!isValidDate(date)) {
    return { status: 400, jsonBody: { error: 'Field "date" must be ISO YYYY-MM-DD' } };
  }

  const entry: WeightEntry = {
    id: randomUUID(),
    userId,
    date,
    value,
    unit,
    createdAt: new Date().toISOString(),
  };

  const repo = getWeightsRepository();
  const saved = await repo.add(entry);
  return { status: 201, jsonBody: saved };
}

export async function deleteWeightHandler(
  request: HttpRequest,
  _ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const { userId } = requireUser(request);
  const id = request.params.id;
  if (!id) {
    return { status: 400, jsonBody: { error: 'Missing id' } };
  }
  const repo = getWeightsRepository();
  const deleted = await repo.delete(userId, id);
  if (!deleted) {
    return { status: 404, jsonBody: { error: 'Entry not found' } };
  }
  return { status: 204 };
}

app.http('weights-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'weights',
  handler: listWeightsHandler,
});

app.http('weights-add', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'weights',
  handler: addWeightHandler,
});

app.http('weights-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'weights/{id}',
  handler: deleteWeightHandler,
});
