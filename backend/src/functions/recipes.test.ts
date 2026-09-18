import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

// Mock storage — no real Azure Blob calls in unit tests
vi.mock('../lib/storage', () => ({
  uploadRecipeImage: () => Promise.resolve({ blobName: 'u1/r1/img1.jpg', imageId: 'img1' }),
  deleteRecipeImage: () => Promise.resolve(undefined),
  generateRecipeImageSasUrl: () => Promise.resolve('https://blob.example.com/img?sas=token'),
}));

import {
  listRecipesHandler,
  createRecipeHandler,
  getRecipeHandler,
  updateRecipeHandler,
  deleteRecipeHandler,
  uploadImageHandler,
  deleteImageHandler,
  reorderImagesHandler,
  updateImageHeroCropHandler,
  logRecipeHandler,
} from './recipes';
import { __resetRecipesRepositoryForTests } from '../lib/repositories/recipesRepository';
import { __resetDiaryRepositoryForTests } from '../lib/repositories/diaryRepository';
import {
  makeContext,
  makeAuthRequest,
  makeRequest,
  setupTestAuth,
  signTestToken,
  teardownTestAuth,
  TEST_USER_ID,
} from '../test-utils/http';
import { DEFAULT_RECIPE_IMAGE_HERO_CROP } from '../../../shared/types/recipeImageHeroCrop';

beforeAll(async () => {
  await setupTestAuth();
});

afterAll(() => {
  teardownTestAuth();
});

beforeEach(() => {
  __resetRecipesRepositoryForTests();
  __resetDiaryRepositoryForTests();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ctx = makeContext();

const baseIngredient = {
  id: '00000000-0000-0000-0000-000000000001',
  displayName: 'Mehl',
  inputMode: 'grams',
  inputAmount: 550,
  amountGrams: 550,
  unit: 'g',
  linkedProductId: null,
  linkedReusableItemId: null,
  isAiEstimate: false,
  nutritionPer100g: { calories: 340, protein: 10, carbs: 72, fat: 1, fiber: 3 },
  nutritionContribution: { calories: 1870, protein: 55, carbs: 396, fat: 5.5, fiber: 16.5 },
};

const seasoningIngredient = {
  id: '00000000-0000-0000-0000-000000000002',
  displayName: 'Salz',
  inputMode: 'grams',
  inputAmount: null,
  amountGrams: null,
  unit: 'nach Geschmack',
  amountLabel: 'nach Geschmack',
  linkedProductId: null,
  linkedReusableItemId: null,
  isAiEstimate: false,
  category: 'seasoning',
  nutritionPer100g: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  nutritionContribution: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
};

const baseStep = {
  order: 1,
  description: 'Zutaten mischen.',
};

async function createTestRecipe() {
  const req = await makeAuthRequest({
    body: {
      name: 'Sauerteigbrot',
      portions: 4,
      ingredients: [baseIngredient],
      steps: [baseStep],
      tags: ['Brot'],
    },
  });
  const res = await createRecipeHandler(req, ctx);
  expect(res.status).toBe(201);
  return res.jsonBody as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// POST /recipes — createRecipe
// ---------------------------------------------------------------------------

describe('POST /recipes — createRecipe', () => {
  it('returns 201 with calculated nutrition', async () => {
    const recipe = await createTestRecipe();
    expect(recipe['name']).toBe('Sauerteigbrot');
    expect(recipe['portions']).toBe(4);
    expect((recipe['nutritionTotal'] as Record<string, number>)['calories']).toBeGreaterThan(0);
    expect((recipe['nutritionPerPortion'] as Record<string, number>)['calories']).toBeGreaterThan(0);
    expect(recipe['images']).toEqual([]);
    expect(recipe['ownerUserId']).toBe(TEST_USER_ID);
  });

  it('returns 400 for missing name', async () => {
    const req = await makeAuthRequest({ body: { portions: 2, ingredients: [], steps: [], tags: [] } });
    const res = await createRecipeHandler(req, ctx);
    expect(res.status).toBe(400);
  });

  it('returns 400 for zero portions', async () => {
    const req = await makeAuthRequest({
      body: { name: 'Test', portions: 0, ingredients: [], steps: [], tags: [] },
    });
    const res = await createRecipeHandler(req, ctx);
    // portions: 0 fails coerce.number().positive()
    expect(res.status).toBe(400);
  });

  it('returns 401 without token', async () => {
    const { makeRequest } = await import('../test-utils/http');
    const req = makeRequest({ body: { name: 'X', portions: 1, ingredients: [], steps: [], tags: [] } });
    const res = await createRecipeHandler(req, ctx);
    expect(res.status).toBe(401);
  });

  it('accepts a legacy ingredient payload without extension fields', async () => {
    const recipe = await createTestRecipe();
    const ingredients = recipe['ingredients'] as Array<Record<string, unknown>>;

    expect(ingredients[0]?.['category']).toBeUndefined();
    expect(ingredients[0]?.['amountLabel']).toBeUndefined();
    expect(ingredients[0]?.['kitchenAmountText']).toBeUndefined();
  });

  it('strips step notes and ignores a root-level notes field', async () => {
    const req = await makeAuthRequest({
      body: {
        name: 'Notizen-Rezept',
        portions: 2,
        ingredients: [baseIngredient],
        steps: [{ ...baseStep, notes: 'Bei niedriger Hitze arbeiten.' }],
        tags: [],
        notes: 'Kein persistentes Rezeptfeld',
      },
    });
    const res = await createRecipeHandler(req, ctx);
    expect(res.status).toBe(201);

    const recipe = res.jsonBody as Record<string, unknown>;
    expect(recipe['notes']).toBeUndefined();
    expect((recipe['steps'] as Array<Record<string, unknown>>)[0]).not.toHaveProperty('notes');
  });

  it('accepts an indeterminate seasoning and preserves its display metadata', async () => {
    const req = await makeAuthRequest({
      body: {
        name: 'Kartoffelsalat',
        portions: 2,
        ingredients: [seasoningIngredient],
        steps: [baseStep],
        tags: [],
      },
    });
    const res = await createRecipeHandler(req, ctx);
    expect(res.status).toBe(201);

    const recipe = res.jsonBody as Record<string, unknown>;
    const ingredient = (recipe['ingredients'] as Array<Record<string, unknown>>)[0]!;
    expect(ingredient).toMatchObject({
      category: 'seasoning',
      inputAmount: null,
      amountGrams: null,
      amountLabel: 'nach Geschmack',
    });
    expect(ingredient['kitchenAmountText']).toBeUndefined();
    expect(recipe['nutritionTotal']).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

    const getRes = await getRecipeHandler(
      await makeAuthRequest({ params: { id: String(recipe['id']) } }),
      ctx,
    );
    expect(getRes.status).toBe(200);
    const roundTrippedIngredient = (
      (getRes.jsonBody as Record<string, unknown>)['ingredients'] as Array<Record<string, unknown>>
    )[0]!;
    expect(roundTrippedIngredient['amountLabel']).toBe('nach Geschmack');
    expect(roundTrippedIngredient['kitchenAmountText']).toBeUndefined();
  });

  it('preserves optional portion metadata on a food ingredient', async () => {
    const req = await makeAuthRequest({
      body: {
        name: 'Toast',
        portions: 1,
        ingredients: [{
          ...baseIngredient,
          inputMode: 'portion',
          inputAmount: 2,
          amountGrams: 100,
          unit: 'Scheibe',
          category: 'food',
          portionWeightGrams: 50,
          portionLabel: 'Scheibe',
        }],
        steps: [],
        tags: [],
      },
    });
    const res = await createRecipeHandler(req, ctx);
    expect(res.status).toBe(201);

    const ingredient = ((res.jsonBody as Record<string, unknown>)['ingredients'] as Array<Record<string, unknown>>)[0]!;
    expect(ingredient).toMatchObject({ portionWeightGrams: 50, portionLabel: 'Scheibe' });
  });

  it.each([
    ['null', null],
    ['zero', 0],
    ['negative', -1],
  ])('rejects a food ingredient with %s amountGrams', async (_label, amountGrams) => {
    const req = await makeAuthRequest({
      body: {
        name: 'Ungültiges Rezept',
        portions: 1,
        ingredients: [{ ...baseIngredient, category: 'food', amountGrams }],
        steps: [],
        tags: [],
      },
    });
    const res = await createRecipeHandler(req, ctx);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /recipes — listRecipes
// ---------------------------------------------------------------------------

describe('GET /recipes — listRecipes', () => {
  it('returns empty list initially', async () => {
    const req = await makeAuthRequest();
    const res = await listRecipesHandler(req, ctx);
    expect(res.status).toBe(200);
    expect((res.jsonBody as { recipes: unknown[] })['recipes']).toHaveLength(0);
  });

  it('returns created recipe', async () => {
    await createTestRecipe();
    const req = await makeAuthRequest();
    const res = await listRecipesHandler(req, ctx);
    expect(res.status).toBe(200);
    expect((res.jsonBody as { recipes: unknown[] })['recipes']).toHaveLength(1);
  });

  it('returns 401 without token', async () => {
    const { makeRequest } = await import('../test-utils/http');
    const req = makeRequest();
    const res = await listRecipesHandler(req, ctx);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /recipes/:id — getRecipe
// ---------------------------------------------------------------------------

describe('GET /recipes/:id — getRecipe', () => {
  it('returns recipe with SAS URLs for images', async () => {
    const created = await createTestRecipe();
    const req = await makeAuthRequest({ params: { id: String(created['id']) } });
    const res = await getRecipeHandler(req, ctx);
    expect(res.status).toBe(200);
    expect((res.jsonBody as Record<string, unknown>)['id']).toBe(created['id']);
  });

  it('returns 404 for unknown id', async () => {
    const req = await makeAuthRequest({ params: { id: 'nonexistent' } });
    const res = await getRecipeHandler(req, ctx);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PUT /recipes/:id — updateRecipe
// ---------------------------------------------------------------------------

describe('PUT /recipes/:id — updateRecipe', () => {
  it('updates name and recalculates nutrition', async () => {
    const created = await createTestRecipe();
    const req = await makeAuthRequest({
      params: { id: String(created['id']) },
      body: { name: 'Roggenbrot', portions: 2 },
    });
    const res = await updateRecipeHandler(req, ctx);
    expect(res.status).toBe(200);
    expect((res.jsonBody as Record<string, unknown>)['name']).toBe('Roggenbrot');
    expect((res.jsonBody as Record<string, unknown>)['portions']).toBe(2);
  });

  it('returns 404 for unknown id', async () => {
    const req = await makeAuthRequest({
      params: { id: 'none' },
      body: { name: 'X' },
    });
    const res = await updateRecipeHandler(req, ctx);
    expect(res.status).toBe(404);
  });

  it('accepts an indeterminate seasoning on update', async () => {
    const created = await createTestRecipe();
    const req = await makeAuthRequest({
      params: { id: String(created['id']) },
      body: { ingredients: [seasoningIngredient] },
    });
    const res = await updateRecipeHandler(req, ctx);
    expect(res.status).toBe(200);

    const ingredient = ((res.jsonBody as Record<string, unknown>)['ingredients'] as Array<Record<string, unknown>>)[0]!;
    expect(ingredient).toMatchObject({ category: 'seasoning', amountGrams: null, amountLabel: 'nach Geschmack' });
    expect(ingredient['kitchenAmountText']).toBeUndefined();
  });

  it('strips step notes and ignores a root-level notes field', async () => {
    const created = await createTestRecipe();
    const req = await makeAuthRequest({
      params: { id: String(created['id']) },
      body: {
        steps: [{ ...baseStep, notes: 'Mit Ruhe backen.' }],
        notes: 'Kein persistentes Rezeptfeld',
      },
    });
    const res = await updateRecipeHandler(req, ctx);
    expect(res.status).toBe(200);

    const recipe = res.jsonBody as Record<string, unknown>;
    expect(recipe['notes']).toBeUndefined();
    expect((recipe['steps'] as Array<Record<string, unknown>>)[0]).not.toHaveProperty('notes');
  });

  it('rejects an invalid food amount on update', async () => {
    const created = await createTestRecipe();
    const req = await makeAuthRequest({
      params: { id: String(created['id']) },
      body: { ingredients: [{ ...baseIngredient, category: 'food', amountGrams: null }] },
    });
    const res = await updateRecipeHandler(req, ctx);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// DELETE /recipes/:id — deleteRecipe
// ---------------------------------------------------------------------------

describe('DELETE /recipes/:id — deleteRecipe', () => {
  it('deletes recipe and returns 204', async () => {
    const created = await createTestRecipe();
    const req = await makeAuthRequest({ params: { id: String(created['id']) } });
    const res = await deleteRecipeHandler(req, ctx);
    expect(res.status).toBe(204);

    // Verify gone
    const getReq = await makeAuthRequest({ params: { id: String(created['id']) } });
    const getRes = await getRecipeHandler(getReq, ctx);
    expect(getRes.status).toBe(404);
  });

  it('returns 404 for unknown id', async () => {
    const req = await makeAuthRequest({ params: { id: 'none' } });
    const res = await deleteRecipeHandler(req, ctx);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /recipes/:id/log — logRecipe
// ---------------------------------------------------------------------------

describe('POST /recipes/:id/log — logRecipe', () => {
  it('creates diary item with snapshot nutrition', async () => {
    const created = await createTestRecipe();

    // Create a diary meal first
    const { getDiaryRepository } = await import('../lib/repositories/diaryRepository');
    const diaryRepo = getDiaryRepository();
    const meal = await diaryRepo.createMeal({
      userId: TEST_USER_ID,
      date: '2026-06-02',
      type: 'dinner',
      name: 'Abendessen',
    });

    const req = await makeAuthRequest({
      params: { id: String(created['id']) },
      body: { portions: 2, mealId: meal.id },
    });
    const res = await logRecipeHandler(req, ctx);
    expect(res.status).toBe(200);

    const updatedMeal = res.jsonBody as { items: Array<Record<string, unknown>> };
    expect(updatedMeal.items).toHaveLength(1);
    const item = updatedMeal.items[0];
    expect(item['sourceType']).toBe('recipe');
    expect(item['recipeId']).toBe(created['id']);
    expect(item['recipePortions']).toBe(2);
    // Nutrition must be a snapshot (2 portions)
    const perPortion = (created['nutritionPerPortion'] as Record<string, number>)['calories'];
    expect((item['macros'] as Record<string, number>)['calories']).toBeCloseTo(perPortion * 2, 0);
  });

  it('returns 404 for unknown recipe id', async () => {
    const req = await makeAuthRequest({
      params: { id: 'none' },
      body: { portions: 1, mealId: 'any' },
    });
    const res = await logRecipeHandler(req, ctx);
    expect(res.status).toBe(404);
  });

  it('returns 400 for missing mealId', async () => {
    const created = await createTestRecipe();
    const req = await makeAuthRequest({
      params: { id: String(created['id']) },
      body: { portions: 1 },
    });
    const res = await logRecipeHandler(req, ctx);
    expect(res.status).toBe(400);
  });

  it('returns 400 for zero portions', async () => {
    const created = await createTestRecipe();
    const req = await makeAuthRequest({
      params: { id: String(created['id']) },
      body: { portions: 0, mealId: 'meal-1' },
    });
    const res = await logRecipeHandler(req, ctx);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /recipes/:id/images — uploadImage
// ---------------------------------------------------------------------------

function makeImageFormData(
  mimeType = 'image/jpeg',
  sizeBytes = 1024,
  heroCrop?: string | Record<string, unknown>,
): FormData {
  const fd = new FormData();
  const buf = Buffer.alloc(sizeBytes, 0);
  const file = new File([buf], 'photo.jpg', { type: mimeType });
  fd.append('image', file);
  if (heroCrop !== undefined) {
    fd.append('heroCrop', typeof heroCrop === 'string' ? heroCrop : JSON.stringify(heroCrop));
  }
  return fd;
}

describe('POST /recipes/:id/images — uploadImage', () => {
  it('returns 201 and appends image to recipe', async () => {
    const created = await createTestRecipe();
    const id = String(created['id']);
    const req = await makeAuthRequest({ params: { id }, formData: makeImageFormData() });
    const res = await uploadImageHandler(req, ctx);
    expect(res.status).toBe(201);
    const body = res.jsonBody as Record<string, unknown>;
    expect(body['id']).toBe('img1');
    expect(body['order']).toBe(1);
    expect(body['heroCrop']).toEqual(DEFAULT_RECIPE_IMAGE_HERO_CROP);
    expect(typeof body['url']).toBe('string');

    // Recipe should now have 1 image
    const getReq = await makeAuthRequest({ params: { id } });
    const getRes = await getRecipeHandler(getReq, ctx);
    expect((getRes.jsonBody as Record<string, unknown[]>)['images']).toHaveLength(1);
  });

  it('stores a validated heroCrop supplied in multipart form data', async () => {
    const created = await createTestRecipe();
    const id = String(created['id']);
    const heroCrop = {
      version: 1,
      frame: 'instagram-recipe-v1',
      focusX: 0.21,
      focusY: 0.74,
      zoom: 1.35,
    };

    const res = await uploadImageHandler(
      await makeAuthRequest({ params: { id }, formData: makeImageFormData('image/jpeg', 1024, heroCrop) }),
      ctx,
    );

    expect(res.status).toBe(201);
    expect(res.jsonBody).toMatchObject({ heroCrop });

    const getRes = await getRecipeHandler(await makeAuthRequest({ params: { id } }), ctx);
    expect((getRes.jsonBody as { images: Array<Record<string, unknown>> }).images[0]?.['heroCrop']).toEqual(heroCrop);
  });

  it('rejects invalid heroCrop metadata before uploading the image', async () => {
    const created = await createTestRecipe();
    const id = String(created['id']);
    const res = await uploadImageHandler(
      await makeAuthRequest({
        params: { id },
        formData: makeImageFormData('image/jpeg', 1024, { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, zoom: 0.5 }),
      }),
      ctx,
    );

    expect(res.status).toBe(400);
  });

  it('keeps the legacy heroCrop default when an image is read without metadata', async () => {
    const created = await createTestRecipe();
    const id = String(created['id']);
    const repo = (await import('../lib/repositories/recipesRepository')).getRecipesRepository();
    await repo.update(TEST_USER_ID, id, {
      images: [{ id: 'legacy-image', blobName: 'u1/r1/legacy.jpg', order: 1 }],
    });

    const fetched = await repo.get(TEST_USER_ID, id);
    expect(fetched?.images[0]?.heroCrop).toEqual(DEFAULT_RECIPE_IMAGE_HERO_CROP);
  });

  it('returns 201 for multiple sequential uploads (multi-image)', async () => {
    const created = await createTestRecipe();
    const id = String(created['id']);

    await uploadImageHandler(await makeAuthRequest({ params: { id }, formData: makeImageFormData() }), ctx);
    await uploadImageHandler(await makeAuthRequest({ params: { id }, formData: makeImageFormData() }), ctx);
    const res = await uploadImageHandler(
      await makeAuthRequest({ params: { id }, formData: makeImageFormData() }),
      ctx,
    );
    expect(res.status).toBe(201);

    const getRes = await getRecipeHandler(await makeAuthRequest({ params: { id } }), ctx);
    expect((getRes.jsonBody as Record<string, unknown[]>)['images']).toMatchObject([
      { order: 1 },
      { order: 2 },
      { order: 3 },
    ]);
  });

  it('appends after the highest persisted image order', async () => {
    const created = await createTestRecipe();
    const id = String(created['id']);
    const repo = (await import('../lib/repositories/recipesRepository')).getRecipesRepository();
    await repo.update(TEST_USER_ID, id, {
      images: [
        { id: 'img1', blobName: 'u1/r1/img1.jpg', order: 2 },
        { id: 'img2', blobName: 'u1/r1/img2.jpg', order: 5 },
      ],
    });

    const res = await uploadImageHandler(
      await makeAuthRequest({ params: { id }, formData: makeImageFormData() }),
      ctx,
    );
    expect(res.status).toBe(201);
    expect((res.jsonBody as Record<string, unknown>)['order']).toBe(6);
  });

  it('returns 400 when no image field in form data', async () => {
    const created = await createTestRecipe();
    const emptyFd = new FormData();
    const req = await makeAuthRequest({ params: { id: String(created['id']) }, formData: emptyFd });
    const res = await uploadImageHandler(req, ctx);
    expect(res.status).toBe(400);
  });

  it('returns 400 for unsupported MIME type', async () => {
    const created = await createTestRecipe();
    const req = await makeAuthRequest({
      params: { id: String(created['id']) },
      formData: makeImageFormData('image/gif'),
    });
    const res = await uploadImageHandler(req, ctx);
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown recipe id', async () => {
    const req = await makeAuthRequest({ params: { id: 'nonexistent' }, formData: makeImageFormData() });
    const res = await uploadImageHandler(req, ctx);
    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    const { makeRequest } = await import('../test-utils/http');
    const req = makeRequest({ params: { id: 'any' }, formData: makeImageFormData() });
    const res = await uploadImageHandler(req, ctx);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// DELETE /recipes/:id/images/:imageId — deleteImage
// ---------------------------------------------------------------------------

describe('DELETE /recipes/:id/images/:imageId — deleteImage', () => {
  async function createRecipeWithImage() {
    const created = await createTestRecipe();
    const id = String(created['id']);
    const uploadReq = await makeAuthRequest({ params: { id }, formData: makeImageFormData() });
    const uploadRes = await uploadImageHandler(uploadReq, ctx);
    const imageId = (uploadRes.jsonBody as Record<string, unknown>)['id'] as string;
    return { recipeId: id, imageId };
  }

  it('removes image and re-orders remaining images', async () => {
    const { recipeId } = await createRecipeWithImage();
    const repo = (await import('../lib/repositories/recipesRepository')).getRecipesRepository();
    await repo.update(TEST_USER_ID, recipeId, {
      images: [
        {
          id: 'img1',
          blobName: 'u1/r1/img1.jpg',
          order: 1,
          heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusX: 0.2 },
        },
        {
          id: 'img2',
          blobName: 'u1/r1/img2.jpg',
          order: 2,
          heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusY: 0.7 },
        },
        {
          id: 'img3',
          blobName: 'u1/r1/img3.jpg',
          order: 3,
          heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, zoom: 1.4 },
        },
      ],
    });

    const req = await makeAuthRequest({ params: { id: recipeId, imageId: 'img2' } });
    const res = await deleteImageHandler(req, ctx);
    expect(res.status).toBe(204);

    const getRes = await getRecipeHandler(await makeAuthRequest({ params: { id: recipeId } }), ctx);
    expect((getRes.jsonBody as Record<string, unknown[]>)['images']).toMatchObject([
      { id: 'img1', order: 1, heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusX: 0.2 } },
      { id: 'img3', order: 2 },
    ]);
  });

  it('returns 404 for unknown imageId', async () => {
    const { recipeId } = await createRecipeWithImage();
    const req = await makeAuthRequest({ params: { id: recipeId, imageId: 'no-such-image' } });
    const res = await deleteImageHandler(req, ctx);
    expect(res.status).toBe(404);
  });

  it('returns 404 for unknown recipe id', async () => {
    const req = await makeAuthRequest({ params: { id: 'nonexistent', imageId: 'img1' } });
    const res = await deleteImageHandler(req, ctx);
    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    const { makeRequest } = await import('../test-utils/http');
    const req = makeRequest({ params: { id: 'any', imageId: 'img1' } });
    const res = await deleteImageHandler(req, ctx);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PUT /recipes/:id/images/order — reorderImages
// ---------------------------------------------------------------------------

describe('PUT /recipes/:id/images/order — reorderImages', () => {
  async function createRecipeWithImages() {
    const created = await createTestRecipe();
    const recipeId = String(created['id']);
    const repo = (await import('../lib/repositories/recipesRepository')).getRecipesRepository();
    await repo.update(TEST_USER_ID, recipeId, {
      images: [
        {
          id: 'img1',
          blobName: 'u1/r1/img1.jpg',
          order: 1,
          heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusX: 0.2 },
        },
        {
          id: 'img2',
          blobName: 'u1/r1/img2.jpg',
          order: 2,
          heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusY: 0.7 },
        },
        {
          id: 'img3',
          blobName: 'u1/r1/img3.jpg',
          order: 3,
          heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, zoom: 1.4 },
        },
      ],
    });
    return recipeId;
  }

  it('reorders images when imageIds are a complete permutation', async () => {
    const recipeId = await createRecipeWithImages();
    const req = await makeAuthRequest({
      params: { id: recipeId },
      body: { imageIds: ['img3', 'img1', 'img2'] },
    });

    const res = await reorderImagesHandler(req, ctx);

    expect(res.status).toBe(200);
    expect((res.jsonBody as { images: Array<Record<string, unknown>> }).images).toMatchObject([
      { id: 'img3', order: 1, heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, zoom: 1.4 } },
      { id: 'img1', order: 2, heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusX: 0.2 } },
      { id: 'img2', order: 3, heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusY: 0.7 } },
    ]);

    const getRes = await getRecipeHandler(await makeAuthRequest({ params: { id: recipeId } }), ctx);
    expect((getRes.jsonBody as Record<string, unknown[]>)['images']).toMatchObject([
      { id: 'img3', order: 1, heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, zoom: 1.4 } },
      { id: 'img1', order: 2, heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusX: 0.2 } },
      { id: 'img2', order: 3, heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusY: 0.7 } },
    ]);
  });

  it('returns 400 when imageIds omit an existing image', async () => {
    const recipeId = await createRecipeWithImages();
    const res = await reorderImagesHandler(
      await makeAuthRequest({ params: { id: recipeId }, body: { imageIds: ['img3', 'img1'] } }),
      ctx,
    );

    expect(res.status).toBe(400);
  });

  it('returns 400 when imageIds contain duplicates or unknown images', async () => {
    const recipeId = await createRecipeWithImages();

    const duplicateRes = await reorderImagesHandler(
      await makeAuthRequest({ params: { id: recipeId }, body: { imageIds: ['img1', 'img1', 'img3'] } }),
      ctx,
    );
    const unknownRes = await reorderImagesHandler(
      await makeAuthRequest({ params: { id: recipeId }, body: { imageIds: ['img1', 'img2', 'missing'] } }),
      ctx,
    );

    expect(duplicateRes.status).toBe(400);
    expect(unknownRes.status).toBe(400);
  });

  it('returns 404 for an unknown recipe id', async () => {
    const res = await reorderImagesHandler(
      await makeAuthRequest({ params: { id: 'nonexistent' }, body: { imageIds: [] } }),
      ctx,
    );

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PUT /recipes/:id/images/:imageId/hero-crop — updateImageHeroCrop
// ---------------------------------------------------------------------------

describe('PUT /recipes/:id/images/:imageId/hero-crop — updateImageHeroCrop', () => {
  async function createRecipeWithImage() {
    const created = await createTestRecipe();
    const recipeId = String(created['id']);
    await uploadImageHandler(
      await makeAuthRequest({ params: { id: recipeId }, formData: makeImageFormData() }),
      ctx,
    );
    return recipeId;
  }

  it('updates the crop for an image owned by the authenticated user', async () => {
    const recipeId = await createRecipeWithImage();
    const heroCrop = {
      version: 1,
      frame: 'instagram-recipe-v1',
      focusX: 0.12,
      focusY: 0.88,
      zoom: 1.8,
    };

    const res = await updateImageHeroCropHandler(
      await makeAuthRequest({ params: { id: recipeId, imageId: 'img1' }, body: { heroCrop } }),
      ctx,
    );

    expect(res.status).toBe(200);
    expect(res.jsonBody).toMatchObject({ id: 'img1', heroCrop });
    const fetched = await getRecipeHandler(await makeAuthRequest({ params: { id: recipeId } }), ctx);
    expect((fetched.jsonBody as { images: Array<Record<string, unknown>> }).images[0]?.['heroCrop']).toEqual(heroCrop);
  });

  it('rejects invalid crop payloads', async () => {
    const recipeId = await createRecipeWithImage();
    const res = await updateImageHeroCropHandler(
      await makeAuthRequest({
        params: { id: recipeId, imageId: 'img1' },
        body: { heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusX: 2 } },
      }),
      ctx,
    );

    expect(res.status).toBe(400);
  });

  it('does not allow another user to update the image metadata', async () => {
    const recipeId = await createRecipeWithImage();
    const token = await signTestToken('different-user');
    const res = await updateImageHeroCropHandler(
      makeRequest({
        params: { id: recipeId, imageId: 'img1' },
        headers: { authorization: `Bearer ${token}` },
        body: { heroCrop: DEFAULT_RECIPE_IMAGE_HERO_CROP },
      }),
      ctx,
    );

    expect(res.status).toBe(404);
  });
});
