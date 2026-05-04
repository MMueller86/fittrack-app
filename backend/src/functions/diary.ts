import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { z } from 'zod';

import { requireUser } from '../lib/auth';
import { parseBody, withHandler } from '../lib/http';
import { logEvent } from '../lib/log';
import { getDiaryRepository } from '../lib/repositories/diaryRepository';

// GET    /api/diary?date=YYYY-MM-DD             — meals + day summary
// POST   /api/diary/meals                        — create meal
// DELETE /api/diary/meals/:id                    — delete meal + items
// POST   /api/diary/meals/:id/items              — add item
// DELETE /api/diary/meals/:id/items/:itemId      — remove item

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be ISO YYYY-MM-DD')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return false;
    const [y, m, day] = v.split('-').map(Number);
    return d.getUTCFullYear() === y && d.getUTCMonth() + 1 === m && d.getUTCDate() === day;
  }, { message: 'must be a real calendar date' });

const MealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);

const CreateMealSchema = z.object({
  date: isoDate,
  type: MealTypeSchema,
  name: z.string().trim().min(1).max(100).optional(),
});

const positiveNumber = z.coerce.number().refine(
  (n) => Number.isFinite(n) && n >= 0,
  { message: 'must be a non-negative number' },
);

const AddItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  calories: positiveNumber,
  proteinG: positiveNumber,
  carbsG: positiveNumber,
  fatG: positiveNumber,
  fiberG: positiveNumber,
  quantity: z.coerce.number().positive().optional(),
  unit: z.string().trim().max(50).optional(),
});

// GET /api/diary?date=YYYY-MM-DD
export const getDiaryHandler = withHandler(
  'diary.get',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = requireUser(request);
    const date = request.query.get('date');
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { status: 400, jsonBody: { error: 'Query param "date" must be YYYY-MM-DD' } };
    }
    const repo = getDiaryRepository();
    const result = await repo.getDay(userId, date);
    logEvent(ctx, 'info', 'diary.get', { userId, date, mealCount: result.meals.length });
    return { status: 200, jsonBody: result };
  },
);

// POST /api/diary/meals
export const createMealHandler = withHandler(
  'diary.meals.create',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = requireUser(request);
    const parsed = await parseBody(request, CreateMealSchema);
    if (!parsed.ok) return parsed.response;

    const mealTypeName = parsed.data.type.charAt(0).toUpperCase() + parsed.data.type.slice(1);
    const meal = await getDiaryRepository().createMeal({
      userId,
      date: parsed.data.date,
      type: parsed.data.type,
      name: parsed.data.name ?? mealTypeName,
    });
    logEvent(ctx, 'info', 'diary.meal.created', { userId, mealId: meal.id, type: meal.type });
    return { status: 201, jsonBody: { meal } };
  },
);

// DELETE /api/diary/meals/:id
export const deleteMealHandler = withHandler(
  'diary.meals.delete',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = requireUser(request);
    const mealId = request.params['id'];
    if (!mealId) return { status: 400, jsonBody: { error: 'Missing meal id' } };

    const deleted = await getDiaryRepository().deleteMeal(userId, mealId);
    if (!deleted) return { status: 404, jsonBody: { error: 'Meal not found' } };
    logEvent(ctx, 'info', 'diary.meal.deleted', { userId, mealId });
    return { status: 204 };
  },
);

// POST /api/diary/meals/:id/items
export const addItemHandler = withHandler(
  'diary.items.add',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = requireUser(request);
    const mealId = request.params['id'];
    if (!mealId) return { status: 400, jsonBody: { error: 'Missing meal id' } };

    const parsed = await parseBody(request, AddItemSchema);
    if (!parsed.ok) return parsed.response;

    try {
      const meal = await getDiaryRepository().addItem(userId, mealId, parsed.data);
      logEvent(ctx, 'info', 'diary.item.added', { userId, mealId });
      return { status: 201, jsonBody: { meal } };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('not found')) return { status: 404, jsonBody: { error: msg } };
      throw e;
    }
  },
);

// DELETE /api/diary/meals/:id/items/:itemId
export const deleteItemHandler = withHandler(
  'diary.items.delete',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = requireUser(request);
    const mealId = request.params['id'];
    const itemId = request.params['itemId'];
    if (!mealId || !itemId) return { status: 400, jsonBody: { error: 'Missing meal or item id' } };

    const meal = await getDiaryRepository().deleteItem(userId, mealId, itemId);
    if (!meal) return { status: 404, jsonBody: { error: 'Item not found' } };
    logEvent(ctx, 'info', 'diary.item.deleted', { userId, mealId, itemId });
    return { status: 200, jsonBody: { meal } };
  },
);

// --- Route registrations ---

app.http('diary-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'diary',
  handler: getDiaryHandler,
});

app.http('diary-meals-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'diary/meals',
  handler: createMealHandler,
});

app.http('diary-meals-update', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'diary/meals/{id}',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented' } }),
});

app.http('diary-meals-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'diary/meals/{id}',
  handler: deleteMealHandler,
});

app.http('diary-items-add', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'diary/meals/{id}/items',
  handler: addItemHandler,
});

app.http('diary-items-update', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'diary/meals/{id}/items/{itemId}',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented' } }),
});

app.http('diary-items-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'diary/meals/{id}/items/{itemId}',
  handler: deleteItemHandler,
});
