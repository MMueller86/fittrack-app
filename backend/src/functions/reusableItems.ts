import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { z } from 'zod';

import { requireUser } from '../lib/auth';
import { parseBody, withHandler } from '../lib/http';
import { logEvent } from '../lib/log';
import { getDiaryRepository } from '../lib/repositories/diaryRepository';
import { getReusableItemsRepository, type UpdateReusableItemInput } from '../lib/repositories/reusableItemsRepository';
import { getUserFoodRelationRepository } from '../lib/repositories/userFoodRelationRepository';
import { tokenizeProduct } from '../lib/tokenize';
import { enqueueEnrichment } from '../lib/queueClient';
import { uploadProductImage, deleteProductImage, generateProductImageSasUrl } from '../lib/storage';

// GET    /api/reusable-items?query=              — search / list all
// POST   /api/reusable-items                     — create a new reusable item
// PATCH  /api/reusable-items/:id                 — update name/brand/nutrition
// DELETE /api/reusable-items/:id                 — delete item (diary snapshots remain)
// POST   /api/reusable-items/:id/image           — upload product photo
// GET    /api/reusable-items/:id/image           — get SAS URL for product photo
// DELETE /api/reusable-items/:id/image           — delete product photo

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
  sugar: positiveNumber.optional(),
  saturatedFat: positiveNumber.optional(),
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
    /** Custom search terms — merged with auto-generated tokens on the server */
    searchTerms: z.array(z.string().toLowerCase().trim().min(1).max(50)).max(50).optional(),
    /** When true, recalculate macros for all diary items linked to this product */
    updateHistory: z.boolean().optional(),
  })
  .refine(
    (d) => d.name !== undefined || d.brand !== undefined || d.nutritionPer100g !== undefined || d.portion !== undefined || d.searchTerms !== undefined,
    { message: 'At least one field must be provided' },
  );

export const getReusableItemByIdHandler = withHandler(
  'reusableItems.getById',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const id = request.params['id'];
    if (!id) return { status: 400, jsonBody: { error: 'Missing id' } };
    const item = await getReusableItemsRepository().getById(userId, id);
    if (!item) return { status: 404, jsonBody: { error: 'Not found' } };
    logEvent(ctx, 'info', 'reusableItems.getById', { userId, id });
    return { status: 200, jsonBody: { item } };
  },
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
          ...(d.nutritionPer100g.salt != null && { salt: d.nutritionPer100g.salt }),
          ...(d.nutritionPer100g.sugar != null && { sugar: d.nutritionPer100g.sugar }),
          ...(d.nutritionPer100g.saturatedFat != null && { saturatedFat: d.nutritionPer100g.saturatedFat }),
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
    // Awaited — ensures the queue message is sent before the response returns.
    // Errors are swallowed inside enqueueEnrichment so this never blocks the 201.
    await enqueueEnrichment(userId, item.id, ctx);
    return { status: 201, jsonBody: { item } };
  },
);

app.http('reusable-items-get-by-id', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'reusable-items/{id}',
  handler: getReusableItemByIdHandler,
});

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

    // Recompute searchTerms from updated name + brand, merged with any
    // custom terms the client sent (e.g. manually added tags like "magerquark").
    // Only reset searchTermsEnriched when name or brand actually changes
    // (otherwise custom tag edits would needlessly re-trigger AI enrichment).
    const updatedName = fields.name ?? existing.name;
    const updatedBrand = fields.brand ?? existing.brand;
    const nameOrBrandChanged = fields.name !== undefined || fields.brand !== undefined;
    const autoTokens = tokenizeProduct(updatedName, updatedBrand);
    const clientTerms = fields.searchTerms ?? [];
    const mergedSearchTerms = [...new Set([...autoTokens, ...clientTerms])];
    const updateInput: UpdateReusableItemInput = {
      ...fields,
      searchTerms: mergedSearchTerms,
      ...(nameOrBrandChanged && { searchTermsEnriched: false }),
    };

    const item = await repo.update(userId, id, updateInput);
    if (!item) return { status: 404, jsonBody: { error: 'Item not found' } };

    // Fire-and-forget: sync denormalized nutrition in all UserFoodRelations for this item
    if (item.nutritionPer100g !== undefined) {
      void (async () => {
        try {
          const ufRepo = getUserFoodRelationRepository();
          await ufRepo.updateNutritionDenormalized(
            userId,
            item.id,
            item.nutritionPer100g!,
            item.portion ?? null,
          );
        } catch {
          // Non-critical — log but don't fail the request
        }
      })();
    }

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
    // Awaited — ensures the queue message is sent before the response returns.
    await enqueueEnrichment(userId, id, ctx);
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

// ---------------------------------------------------------------------------
// Product Image Endpoints
// ---------------------------------------------------------------------------

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

export const uploadProductImageHandler = withHandler(
  'reusableItems.image.upload',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const id = request.params['id'];
    if (!id) return { status: 400, jsonBody: { error: 'Missing item id' } };

    const repo = getReusableItemsRepository();
    const item = await repo.getById(userId, id);
    if (!item) return { status: 404, jsonBody: { error: 'Item not found' } };
    if (item.userId !== userId) return { status: 403, jsonBody: { error: 'Forbidden' } };

    const formData = await request.formData();
    const file = formData.get('image');
    if (!file || typeof file === 'string') {
      return { status: 400, jsonBody: { error: 'image field is required (multipart/form-data)' } };
    }
    const mimeType = file.type as string;
    if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
      return { status: 415, jsonBody: { error: 'Only image/jpeg and image/png are supported' } };
    }
    const arrayBuffer = await file.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      return { status: 413, jsonBody: { error: 'Image must be ≤ 10 MB' } };
    }

    const buffer = Buffer.from(arrayBuffer);
    const blobName = await uploadProductImage(userId, id, buffer, mimeType as 'image/jpeg' | 'image/png');

    // Delete old image if present (one image per product)
    if (item.imageUrl && item.imageUrl !== blobName) {
      await deleteProductImage(item.imageUrl).catch(() => {});
    }

    await repo.update(userId, id, { imageUrl: blobName } as Parameters<typeof repo.update>[2]);
    logEvent(ctx, 'info', 'reusableItems.image.uploaded', { userId, itemId: id });
    return { status: 201, jsonBody: { imageUrl: blobName } };
  },
);

export const getProductImageHandler = withHandler(
  'reusableItems.image.get',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const id = request.params['id'];
    if (!id) return { status: 400, jsonBody: { error: 'Missing item id' } };

    const item = await getReusableItemsRepository().getById(userId, id);
    if (!item) return { status: 404, jsonBody: { error: 'Item not found' } };
    if (!item.imageUrl) return { status: 404, jsonBody: { error: 'No image' } };

    const sasUrl = await generateProductImageSasUrl(item.imageUrl);
    logEvent(ctx, 'info', 'reusableItems.image.get', { userId, itemId: id });
    return { status: 200, jsonBody: { url: sasUrl } };
  },
);

export const deleteProductImageHandler = withHandler(
  'reusableItems.image.delete',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const id = request.params['id'];
    if (!id) return { status: 400, jsonBody: { error: 'Missing item id' } };

    const repo = getReusableItemsRepository();
    const item = await repo.getById(userId, id);
    if (!item) return { status: 404, jsonBody: { error: 'Item not found' } };
    if (item.userId !== userId) return { status: 403, jsonBody: { error: 'Forbidden' } };
    if (!item.imageUrl) return { status: 204 };

    await deleteProductImage(item.imageUrl).catch(() => {});
    await repo.update(userId, id, { imageUrl: undefined } as Parameters<typeof repo.update>[2]);
    logEvent(ctx, 'info', 'reusableItems.image.deleted', { userId, itemId: id });
    return { status: 204 };
  },
);

app.http('reusable-items-upload-image', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'reusable-items/{id}/image',
  handler: uploadProductImageHandler,
});

app.http('reusable-items-get-image', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'reusable-items/{id}/image',
  handler: getProductImageHandler,
});

app.http('reusable-items-delete-image', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'reusable-items/{id}/image',
  handler: deleteProductImageHandler,
});

