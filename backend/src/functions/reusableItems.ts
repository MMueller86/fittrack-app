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

const NutritionPer100gSchema = z.object({
  calories: positiveNumber,
  protein: positiveNumber,
  carbs: positiveNumber,
  fat: positiveNumber,
  fiber: positiveNumber.optional(),
  salt: positiveNumber.optional(),
});

const PortionSchema = z.object({
  label: z.string().trim().min(1).max(100),
  weightGrams: z.coerce.number().positive(),
});

// Manual entry (flat macros, per-portion)
const ManualCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  calories: positiveNumber,
  protein: positiveNumber,
  carbs: positiveNumber,
  fat: positiveNumber,
  fiber: positiveNumber,
});

// AI-estimated entry (nutritionPer100g-based) — covers both AI estimates and label scans
const AiCreateSchema = z.object({
  sourceType: z.enum(['ai', 'label-scan']),
  name: z.string().trim().min(1).max(200),
  nutritionPer100g: NutritionPer100gSchema,
  portion: PortionSchema.optional(),
  aiConfidence: z.number().min(0).max(1).optional(),
  aiWarnings: z.array(z.string()).optional(),
  searchTerms: z.array(z.string().toLowerCase()).optional(),
});

const CreateReusableItemSchema = z.union([AiCreateSchema, ManualCreateSchema]);

export const searchReusableItemsHandler = withHandler(
  'reusableItems.search',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
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
    const { userId } = await requireUser(request);
    const parsed = await parseBody(request, CreateReusableItemSchema);
    if (!parsed.ok) return parsed.response;

    const d = parsed.data;
    let item;

    if ('sourceType' in d) {
      // AI-estimated product — store nutritionPer100g as primary source
      item = await getReusableItemsRepository().create({
        userId,
        name: d.name,
        nutritionBasis: d.portion ? 'both' : 'per100g',
        nutritionPer100g: {
          calories: d.nutritionPer100g.calories,
          protein: d.nutritionPer100g.protein,
          carbs: d.nutritionPer100g.carbs,
          fat: d.nutritionPer100g.fat,
          ...(d.nutritionPer100g.fiber != null && { fiber: d.nutritionPer100g.fiber }),
        },
        portion: d.portion
          ? { label: d.portion.label, weightGrams: d.portion.weightGrams }
          : undefined,
        isComplete: true,
        sourceType: d.sourceType,
        aiConfidence: d.aiConfidence,
        aiWarnings: d.aiWarnings,
        searchTerms: d.searchTerms,
      });
    } else {
      // Manual flat macros — per-portion entry
      item = await getReusableItemsRepository().create({
        userId,
        name: d.name,
        nutritionBasis: 'perPortion',
        portion: {
          label: '1 serving',
          nutrition: {
            calories: d.calories,
            protein: d.protein,
            carbs: d.carbs,
            fat: d.fat,
            fiber: d.fiber,
          },
        },
        isComplete: true,
        sourceType: 'manual',
      });
    }

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
