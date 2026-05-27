import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { requireUser } from '../lib/auth';
import { parseBody, withHandler } from '../lib/http';
import { logEvent } from '../lib/log';
import { getWeightsRepository } from '../lib/repositories/weightsRepository';
import type { WeightEntry } from '@fittrack/shared';

// GET    /api/weights     — list entries for current user (newest first)
// POST   /api/weights     — add weight entry for current user
// DELETE /api/weights/:id — delete entry owned by current user
//
// Handlers are exported as named functions so they can be unit-tested
// directly (with a mocked repository) without spinning up the Functions
// host. The `app.http(...)` registrations at the bottom of the file are
// the only side effects of importing this module.
//
// Cross-cutting concerns are delegated:
//   - `withHandler` adds structured logging + uniform 500 fallback
//   - `parseBody`   runs the body through a Zod schema with consistent 400s
//   - `logEvent`    is used for handler-specific events

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ISO `YYYY-MM-DD` that survives a UTC round-trip. Catches inputs that
// JavaScript's Date silently rolls over, e.g. `2026-02-30` becoming Mar 2.
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be ISO YYYY-MM-DD')
  .refine(
    (value) => {
      const d = new Date(`${value}T00:00:00Z`);
      if (Number.isNaN(d.getTime())) return false;
      const [y, m, day] = value.split('-').map(Number);
      return (
        d.getUTCFullYear() === y &&
        d.getUTCMonth() + 1 === m &&
        d.getUTCDate() === day
      );
    },
    { message: 'must be ISO YYYY-MM-DD' },
  );

// Accept JSON numbers or numeric strings (mobile clients sometimes
// serialise <TextInput> values as strings). `z.coerce.number()` performs
// the JS Number(...) coercion before validation; the result is always a
// `number` so the inferred output type stays clean.
const positiveWeight = z.coerce
  .number()
  .refine(
    (n) => Number.isFinite(n) && n > 0 && n <= 1000,
    { message: 'must be a positive number \u2264 1000' },
  );

const AddWeightBodySchema = z.object({
  value: positiveWeight,
  unit: z.enum(['kg', 'lbs']).default('kg'),
  date: isoDate.optional(),
});

export const listWeightsHandler = withHandler(
  'weights.list',
  async (request: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const repo = getWeightsRepository();
    const entries = await repo.list(userId);
    return { status: 200, jsonBody: { entries } };
  },
);

export const addWeightHandler = withHandler(
  'weights.add',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);

    const parsed = await parseBody(request, AddWeightBodySchema);
    if (!parsed.ok) return parsed.response;

    const entry: WeightEntry = {
      id: randomUUID(),
      userId,
      date: parsed.data.date ?? todayIso(),
      value: parsed.data.value,
      // `.default('kg')` populates the runtime value but Zod 3.25's
      // inferred output type is `'kg' | 'lbs' | undefined`. The fallback
      // here is defensive and never hit at runtime.
      unit: parsed.data.unit ?? 'kg',
      createdAt: new Date().toISOString(),
    };

    const repo = getWeightsRepository();
    const saved = await repo.add(entry);
    logEvent(ctx, 'info', 'weight.created', {
      handler: 'weights.add',
      userId,
      entryId: saved.id,
    });
    return { status: 201, jsonBody: saved };
  },
);

export const deleteWeightHandler = withHandler(
  'weights.delete',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const id = request.params.id;
    if (!id) {
      return { status: 400, jsonBody: { error: 'Missing id' } };
    }
    const repo = getWeightsRepository();
    const deleted = await repo.delete(userId, id);
    if (!deleted) {
      return { status: 404, jsonBody: { error: 'Entry not found' } };
    }
    logEvent(ctx, 'info', 'weight.deleted', {
      handler: 'weights.delete',
      userId,
      entryId: id,
    });
    return { status: 204 };
  },
);

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
