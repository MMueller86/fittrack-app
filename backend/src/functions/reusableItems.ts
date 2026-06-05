import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { z } from 'zod';

import { requireUser } from '../lib/auth';
import { parseBody, withHandler } from '../lib/http';
import { logEvent } from '../lib/log';
import { getDiaryRepository } from '../lib/repositories/diaryRepository';
import { getReusableItemsRepository, type UpdateReusableItemInput } from '../lib/repositories/reusableItemsRepository';
import { tokenizeProduct } from '../lib/tokenize';
import { enqueueEnrichment } from '../lib/queueClient';

// GET    /api/reusable-items?query=  — search / list all (empty query = all)
// POST   /api/reusable-items         — create a new reusable item
// PATCH  /api/reusable-items/:id     — update name/brand/nutrition; optionally update diary history
// DELETE /api/reusable-items/:id     — delete item (diary snapshots remain)

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

// AI-estimated entry (nutritionPer100g-based) — covers AI estimates, label scans and manual per-100g entries
const AiCreateSchema = z.object({
  sourceType: z.enum(['ai', 'label-scan', 'manual']),
  name: z.string().trim().min(1).max(200),
  brand: z.string().trim().max(100).optional(),
  nutritionPer100g: NutritionPer100gSchema,
  portion: PortionSchema.optional(),
  aiConfidence: z.number().min(0).max(1).optional(),
  aiWarnings: z.array(z.string()).optional(),
  searchTerms: z.array(z.string().toLowerCase()).optional(),
});

const CreateReusableItemSchema = z.union([AiCreateSchema, ManualCreateSchema]);

const UpdateReusableItemSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    brand: z.string().trim().max(100).nullable().optional(),
    nutritionPer100g: NutritionPer100gSchema.optional(),
    portion: PortionSchema.nullable().optional(),
    /** When true, recalculate macros for all diary items linked to this product */
    updateHistory: z.boolean().optional(),
  })
  .refine(
    (d) => d.name !== undefined || d.brand !== undefined || d.nutritionPer100g !== undefined || d.portion !== undefined,
    { message: 'At least one field must be provided' },
  );

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
        brand: d.brand,
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
        searchTerms: [...new Set([...tokenizeProduct(d.name, d.brand), ...(d.searchTerms ?? [])])],
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
        searchTerms: tokenizeProduct(d.name),
      });
    }

    logEvent(ctx, 'info', 'reusableItems.created', { userId, itemId: item.id });
    // Fire-and-forget: enqueue AI keyword enrichment (errors are swallowed inside enqueueEnrichment)
    void enqueueEnrichment(userId, item.id, ctx);
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

export const updateReusableItemHandler = withHandler(
  'reusableItems.update',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const id = request.params['id'];
    if (!id) return { status: 400, jsonBody: { error: 'Missing item id' } };

    const parsed = await parseBody(request, UpdateReusableItemSchema);
    if (!parsed.ok) return parsed.response;
    const { updateHistory, brand: brandRaw, ...rest } = parsed.data;
    const fields = { ...rest, ...(brandRaw !== undefined ? { brand: brandRaw ?? undefined } : {}) };

    const repo = getReusableItemsRepository();

    // Verify ownership
    const existing = await repo.getById(userId, id);
    if (!existing) return { status: 404, jsonBody: { error: 'Item not found' } };
    if (existing.userId !== userId) return { status: 403, jsonBody: { error: 'Forbidden' } };

    // Recompute searchTerms from updated name + brand.
    // Reset searchTermsEnriched so the AI re-enriches with the new name/brand.
    const updatedName = fields.name ?? existing.name;
    const updatedBrand = fields.brand ?? existing.brand;
    const updateInput: UpdateReusableItemInput = {
      ...fields,
      searchTerms: tokenizeProduct(updatedName, updatedBrand),
      searchTermsEnriched: false,
    };

    const item = await repo.update(userId, id, updateInput);
    if (!item) return { status: 404, jsonBody: { error: 'Item not found' } };

    let updatedItemCount = 0;
    if (updateHistory && item.nutritionPer100g) {
      const newPortionGrams = item.portion?.weightGrams;
      updatedItemCount = await getDiaryRepository().updateMacrosBySourceId(
        userId,
        id,
        item.nutritionPer100g,
        newPortionGrams,
      );
    }

    logEvent(ctx, 'info', 'reusableItems.updated', { userId, itemId: id, updateHistory: !!updateHistory, updatedItemCount });
    // Fire-and-forget: re-enqueue AI enrichment so updated name/brand gets new keywords
    void enqueueEnrichment(userId, id, ctx);
    return { status: 200, jsonBody: { item, updatedItemCount } };
  },
);

export const deleteReusableItemHandler = withHandler(
  'reusableItems.delete',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const id = request.params['id'];
    if (!id) return { status: 400, jsonBody: { error: 'Missing item id' } };

    const repo = getReusableItemsRepository();

    const existing = await repo.getById(userId, id);
    if (!existing) return { status: 404, jsonBody: { error: 'Item not found' } };
    if (existing.userId !== userId) return { status: 403, jsonBody: { error: 'Forbidden' } };

    // Count diary usage before deleting (for response info)
    const diaryUsageCount = await getDiaryRepository().countBySourceId(userId, id);

    await repo.remove(userId, id);

    logEvent(ctx, 'info', 'reusableItems.deleted', { userId, itemId: id, diaryUsageCount });
    return { status: 200, jsonBody: { deleted: true, diaryUsageCount } };
  },
);

app.http('reusable-items-update', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'reusable-items/{id}',
  handler: updateReusableItemHandler,
});

app.http('reusable-items-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'reusable-items/{id}',
  handler: deleteReusableItemHandler,
});
