import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { z } from 'zod';
import type { RecipeImage } from '@fittrack/shared';
// Use a relative path so the compiled JS resolves to dist/shared/lib/recipeCalculator.js
// instead of @fittrack/shared (which points to TypeScript source at runtime).
import { calculateRecipeNutrition } from '../../../shared/lib/recipeCalculator';

import { requireUser } from '../lib/auth';
import { withHandler } from '../lib/http';
import { logEvent } from '../lib/log';
import { getDiaryRepository } from '../lib/repositories/diaryRepository';
import { getRecipesRepository } from '../lib/repositories/recipesRepository';
import {
  deleteRecipeImage,
  generateRecipeImageSasUrl,
  uploadRecipeImage,
} from '../lib/storage';

// ---------------------------------------------------------------------------
// Routes:
// GET    /api/recipes                        — list user's recipes
// POST   /api/recipes                        — create recipe
// GET    /api/recipes/:id                    — get recipe detail (with SAS URLs)
// PUT    /api/recipes/:id                    — update recipe
// DELETE /api/recipes/:id                    — delete recipe + all blobs
// POST   /api/recipes/:id/images             — upload image (multipart)
// DELETE /api/recipes/:id/images/:imageId    — delete one image
// POST   /api/recipes/:id/log               — log portion into diary
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const positiveNumber = z.coerce.number().refine(
  (n) => Number.isFinite(n) && n >= 0,
  { message: 'must be a non-negative number' },
);

const NutritionPer100gSchema = z.object({
  calories: positiveNumber,
  protein: positiveNumber,
  carbs: positiveNumber,
  fat: positiveNumber,
  fiber: positiveNumber,
});

const RecipeIngredientSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().trim().min(1).max(200),
  inputMode: z.enum(['grams', 'portion']),
  inputAmount: z.coerce.number().positive(),
  amountGrams: z.coerce.number().positive(),
  unit: z.string().trim().min(1).max(50),
  linkedProductId: z.string().nullable(),
  linkedReusableItemId: z.string().nullable(),
  isAiEstimate: z.boolean(),
  nutritionPer100g: NutritionPer100gSchema,
  nutritionContribution: NutritionPer100gSchema,
});

const RecipeStepSchema = z.object({
  order: z.coerce.number().int().positive(),
  title: z.string().trim().max(200).optional(),
  description: z.string().trim().min(1).max(2000),
  notes: z.string().trim().max(1000).optional(),
});

const CreateRecipeSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  portions: z.coerce.number().positive(),
  ingredients: z.array(RecipeIngredientSchema).max(100),
  steps: z.array(RecipeStepSchema).max(50),
  tags: z.array(z.string().trim().max(50)).max(20),
});

const UpdateRecipeSchema = CreateRecipeSchema.partial();

const LogRecipeSchema = z.object({
  portions: z.coerce.number().positive().max(50),
  mealId: z.string().min(1),
});

const IMAGE_MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'] as const;
type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

// ---------------------------------------------------------------------------
// Helper: attach SAS URLs to recipe images
// ---------------------------------------------------------------------------

async function attachSasUrls(images: RecipeImage[]): Promise<RecipeImage[]> {
  return Promise.all(
    images.map(async (img) => ({
      ...img,
      url: await generateRecipeImageSasUrl(img.blobName),
    })),
  );
}

// ---------------------------------------------------------------------------
// GET /recipes
// ---------------------------------------------------------------------------

export const listRecipesHandler = withHandler(
  'recipes.list',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const repo = getRecipesRepository();
    const recipes = await repo.list(userId);

    // Attach a SAS URL only for the first image of each recipe (thumbnail).
    // The detail route attaches URLs for all images via attachSasUrls().
    const recipesWithThumbnails = await Promise.all(
      recipes.map(async (recipe) => {
        if (recipe.images.length === 0) return recipe;
        const [first, ...rest] = recipe.images;
        const url = await generateRecipeImageSasUrl(first!.blobName);
        return { ...recipe, images: [{ ...first!, url }, ...rest] };
      }),
    );

    logEvent(ctx, 'info', 'recipes.list', { userId, count: recipes.length });
    return { status: 200, jsonBody: { recipes: recipesWithThumbnails } };
  },
);

// ---------------------------------------------------------------------------
// POST /recipes
// ---------------------------------------------------------------------------

export const createRecipeHandler = withHandler(
  'recipes.create',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);

    const body = await request.json();
    const parsed = CreateRecipeSchema.safeParse(body);
    if (!parsed.success) {
      return { status: 400, jsonBody: { error: parsed.error.issues[0]?.message ?? 'Invalid request' } };
    }

    const { name, description, portions, ingredients, steps, tags } = parsed.data;
    const { nutritionTotal, nutritionPerPortion } = calculateRecipeNutrition(ingredients, portions);

    const repo = getRecipesRepository();
    const recipe = await repo.create(userId, {
      name,
      description,
      portions,
      ingredients,
      steps,
      tags,
      nutritionTotal,
      nutritionPerPortion,
    });

    logEvent(ctx, 'info', 'recipe.created', { userId, recipeId: recipe.id });
    return { status: 201, jsonBody: recipe };
  },
);

// ---------------------------------------------------------------------------
// GET /recipes/:id
// ---------------------------------------------------------------------------

export const getRecipeHandler = withHandler(
  'recipes.get',
  async (request: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const id = request.params['id'];
    if (!id) return { status: 400, jsonBody: { error: 'Missing recipe id' } };

    const repo = getRecipesRepository();
    const recipe = await repo.get(userId, id);
    if (!recipe) return { status: 404, jsonBody: { error: 'Recipe not found' } };

    // Generate short-lived SAS URLs for all images
    const imagesWithUrls = await attachSasUrls(recipe.images);
    return { status: 200, jsonBody: { ...recipe, images: imagesWithUrls } };
  },
);

// ---------------------------------------------------------------------------
// PUT /recipes/:id
// ---------------------------------------------------------------------------

export const updateRecipeHandler = withHandler(
  'recipes.update',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const id = request.params['id'];
    if (!id) return { status: 400, jsonBody: { error: 'Missing recipe id' } };

    const body = await request.json();
    const parsed = UpdateRecipeSchema.safeParse(body);
    if (!parsed.success) {
      return { status: 400, jsonBody: { error: parsed.error.issues[0]?.message ?? 'Invalid request' } };
    }

    const repo = getRecipesRepository();
    const existing = await repo.get(userId, id);
    if (!existing) return { status: 404, jsonBody: { error: 'Recipe not found' } };

    // Recalculate nutrition if ingredients or portions changed
    const ingredients = parsed.data.ingredients ?? existing.ingredients;
    const portions = parsed.data.portions ?? existing.portions;
    const { nutritionTotal, nutritionPerPortion } = calculateRecipeNutrition(ingredients, portions);

    const updated = await repo.update(userId, id, {
      ...parsed.data,
      nutritionTotal,
      nutritionPerPortion,
    });

    logEvent(ctx, 'info', 'recipe.updated', { userId, recipeId: id });
    return { status: 200, jsonBody: updated };
  },
);

// ---------------------------------------------------------------------------
// DELETE /recipes/:id
// ---------------------------------------------------------------------------

export const deleteRecipeHandler = withHandler(
  'recipes.delete',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const id = request.params['id'];
    if (!id) return { status: 400, jsonBody: { error: 'Missing recipe id' } };

    const repo = getRecipesRepository();
    const recipe = await repo.get(userId, id);
    if (!recipe) return { status: 404, jsonBody: { error: 'Recipe not found' } };

    // Delete all blobs first — if Cosmos delete fails, blobs are still gone
    // (no dangling blob reference in Cosmos since doc is deleted next)
    await Promise.all(recipe.images.map((img) => deleteRecipeImage(img.blobName)));
    await repo.delete(userId, id);

    logEvent(ctx, 'info', 'recipe.deleted', { userId, recipeId: id, blobsDeleted: recipe.images.length });
    return { status: 204 };
  },
);

// ---------------------------------------------------------------------------
// POST /recipes/:id/images — multipart upload
// ---------------------------------------------------------------------------

export const uploadImageHandler = withHandler(
  'recipes.uploadImage',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const id = request.params['id'];
    if (!id) return { status: 400, jsonBody: { error: 'Missing recipe id' } };

    const repo = getRecipesRepository();
    const recipe = await repo.get(userId, id);
    if (!recipe) return { status: 404, jsonBody: { error: 'Recipe not found' } };

    const formData = await request.formData();
    const imageFile = formData.get('image');
    if (!imageFile || typeof imageFile === 'string') {
      return { status: 400, jsonBody: { error: 'Missing image file' } };
    }

    const mimeType = imageFile.type as AllowedMimeType;
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return { status: 400, jsonBody: { error: 'Image must be image/jpeg or image/png' } };
    }

    const buffer = Buffer.from(await imageFile.arrayBuffer());
    if (buffer.byteLength > IMAGE_MAX_BYTES) {
      return { status: 400, jsonBody: { error: 'Image exceeds 8 MB limit' } };
    }

    const { blobName, imageId } = await uploadRecipeImage(userId, id, buffer, mimeType);

    const newImage: RecipeImage = {
      id: imageId,
      blobName,
      order: recipe.images.length + 1,
    };

    const updatedImages = [...recipe.images, newImage];
    await repo.update(userId, id, { images: updatedImages });

    const sasUrl = await generateRecipeImageSasUrl(blobName);
    logEvent(ctx, 'info', 'recipe.imageUploaded', { userId, recipeId: id, imageId });
    return { status: 201, jsonBody: { ...newImage, url: sasUrl } };
  },
);

// ---------------------------------------------------------------------------
// DELETE /recipes/:id/images/:imageId
// ---------------------------------------------------------------------------

export const deleteImageHandler = withHandler(
  'recipes.deleteImage',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const recipeId = request.params['id'];
    const imageId = request.params['imageId'];
    if (!recipeId || !imageId) return { status: 400, jsonBody: { error: 'Missing id' } };

    const repo = getRecipesRepository();
    const recipe = await repo.get(userId, recipeId);
    if (!recipe) return { status: 404, jsonBody: { error: 'Recipe not found' } };

    const image = recipe.images.find((img) => img.id === imageId);
    if (!image) return { status: 404, jsonBody: { error: 'Image not found' } };

    await deleteRecipeImage(image.blobName);
    const updatedImages = recipe.images
      .filter((img) => img.id !== imageId)
      .map((img, idx) => ({ ...img, order: idx + 1 }));

    await repo.update(userId, recipeId, { images: updatedImages });
    logEvent(ctx, 'info', 'recipe.imageDeleted', { userId, recipeId, imageId });
    return { status: 204 };
  },
);

// ---------------------------------------------------------------------------
// POST /recipes/:id/log — snapshot portion into diary
// ---------------------------------------------------------------------------

export const logRecipeHandler = withHandler(
  'recipes.log',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const id = request.params['id'];
    if (!id) return { status: 400, jsonBody: { error: 'Missing recipe id' } };

    const body = await request.json();
    const parsed = LogRecipeSchema.safeParse(body);
    if (!parsed.success) {
      return { status: 400, jsonBody: { error: parsed.error.issues[0]?.message ?? 'Invalid request' } };
    }

    const { portions, mealId } = parsed.data;

    const repo = getRecipesRepository();
    const recipe = await repo.get(userId, id);
    if (!recipe) return { status: 404, jsonBody: { error: 'Recipe not found' } };

    // Snapshot: calories = nutritionPerPortion × portions logged
    const snap = {
      calories: Math.round(recipe.nutritionPerPortion.calories * portions * 10) / 10,
      protein: Math.round(recipe.nutritionPerPortion.protein * portions * 10) / 10,
      carbs: Math.round(recipe.nutritionPerPortion.carbs * portions * 10) / 10,
      fat: Math.round(recipe.nutritionPerPortion.fat * portions * 10) / 10,
      fiber: Math.round(recipe.nutritionPerPortion.fiber * portions * 10) / 10,
    };

    const diaryRepo = getDiaryRepository();
    const meal = await diaryRepo.addItem(userId, mealId, {
      name: recipe.name,
      calories: snap.calories,
      protein: snap.protein,
      carbs: snap.carbs,
      fat: snap.fat,
      fiber: snap.fiber,
      quantity: portions,
      unit: portions === 1 ? 'Portion' : 'Portionen',
      sourceType: 'recipe',
      recipeId: id,
      recipePortions: portions,
    });

    // Fire-and-forget: increment usage counter (don't block response)
    repo.incrementUsage(userId, id).catch(() => {});

    logEvent(ctx, 'info', 'recipe.logged', { userId, recipeId: id, portions, mealId });
    return { status: 200, jsonBody: meal };
  },
);

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

app.http('recipes-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'recipes',
  handler: listRecipesHandler,
});

app.http('recipes-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'recipes',
  handler: createRecipeHandler,
});

app.http('recipes-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'recipes/{id}',
  handler: getRecipeHandler,
});

app.http('recipes-update', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'recipes/{id}',
  handler: updateRecipeHandler,
});

app.http('recipes-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'recipes/{id}',
  handler: deleteRecipeHandler,
});

app.http('recipes-upload-image', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'recipes/{id}/images',
  handler: uploadImageHandler,
});

app.http('recipes-delete-image', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'recipes/{id}/images/{imageId}',
  handler: deleteImageHandler,
});

app.http('recipes-log', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'recipes/{id}/log',
  handler: logRecipeHandler,
});
