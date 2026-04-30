import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'node:crypto';

import { requireUser } from '../lib/auth';
import { getWeightsRepository } from '../lib/repositories/weightsRepository';
import type { WeightEntry, WeightUnit } from '@fittrack/shared';

// GET    /api/weights     — list entries for current user (newest first)
// POST   /api/weights     — add weight entry for current user
// DELETE /api/weights/:id — delete entry owned by current user

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
  return !Number.isNaN(d.getTime());
}

app.http('weights-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'weights',
  handler: async (request: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = requireUser(request);
    const repo = getWeightsRepository();
    const entries = await repo.list(userId);
    return { status: 200, jsonBody: { entries } };
  },
});

app.http('weights-add', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'weights',
  handler: async (request: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
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
  },
});

// DELETE /api/weights/:id — remove an entry owned by the current user.
app.http('weights-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'weights/{id}',
  handler: async (request: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
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
  },
});
