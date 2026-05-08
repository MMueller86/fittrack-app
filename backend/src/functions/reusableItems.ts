import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { z } from 'zod';

import { requireUser } from '../lib/auth';
import { parseBody, withHandler } from '../lib/http';
import { logEvent } from '../lib/log';
import { getReusableItemsRepository } from '../lib/repositories/reusableItemsRepository';

// GET  /api/reusable-items?query=  — search by name (startsWith, top 20)
// POST /api/reusable-items         — create a new reusable item

const positiveNumber = z.coerce.number().refine(
  (n) => Number.isFinite(n) && n >= 0,
  { message: 'must be a non-negative number' },
);

const CreateReusableItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  calories: positiveNumber,
  protein: positiveNumber,
  carbs: positiveNumber,
  fat: positiveNumber,
  fiber: positiveNumber,
});

export const searchReusableItemsHandler = withHandler(
  'reusableItems.search',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = requireUser(request);
    const query = request.query.get('query') ?? '';
    const repo = getReusableItemsRepository();
    const items = await repo.search(userId, query);
    logEvent(ctx, 'info', 'reusableItems.search', { userId, query, count: items.length });
    return { status: 200, jsonBody: { items } };
  },
);

export const createReusableItemHandler = withHandler(
  'reusableItems.create',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = requireUser(request);
    const parsed = await parseBody(request, CreateReusableItemSchema);
    if (!parsed.ok) return parsed.response;

    const item = await getReusableItemsRepository().create({
      userId,
      name: parsed.data.name,
      nutritionBasis: 'perPortion',
      portion: {
        label: '1 serving',
        nutrition: {
          calories: parsed.data.calories,
          protein: parsed.data.protein,
          carbs: parsed.data.carbs,
          fat: parsed.data.fat,
          fiber: parsed.data.fiber,
        },
      },
      isComplete: true,
      sourceType: 'manual',
    });
    logEvent(ctx, 'info', 'reusableItems.created', { userId, itemId: item.id });
    return { status: 201, jsonBody: { item } };
  },
);

app.http('reusable-items-search', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'reusable-items',
  handler: searchReusableItemsHandler,
});

app.http('reusable-items-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'reusable-items',
  handler: createReusableItemHandler,
});
