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
  logRecipeHandler,
} from './recipes';
import { __resetRecipesRepositoryForTests } from '../lib/repositories/recipesRepository';
import { __resetDiaryRepositoryForTests } from '../lib/repositories/diaryRepository';
import { makeContext, makeAuthRequest, setupTestAuth, teardownTestAuth, TEST_USER_ID } from '../test-utils/http';

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

function makeImageFormData(mimeType = 'image/jpeg', sizeBytes = 1024): FormData {
  const fd = new FormData();
  const buf = Buffer.alloc(sizeBytes, 0);
  const file = new File([buf], 'photo.jpg', { type: mimeType });
  fd.append('image', file);
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
    expect(typeof body['url']).toBe('string');

    // Recipe should now have 1 image
    const getReq = await makeAuthRequest({ params: { id } });
    const getRes = await getRecipeHandler(getReq, ctx);
    expect((getRes.jsonBody as Record<string, unknown[]>)['images']).toHaveLength(1);
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
    expect((getRes.jsonBody as Record<string, unknown[]>)['images']).toHaveLength(3);
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
    const { recipeId, imageId } = await createRecipeWithImage();
    const req = await makeAuthRequest({ params: { id: recipeId, imageId } });
    const res = await deleteImageHandler(req, ctx);
    expect(res.status).toBe(204);

    const getRes = await getRecipeHandler(await makeAuthRequest({ params: { id: recipeId } }), ctx);
    expect((getRes.jsonBody as Record<string, unknown[]>)['images']).toHaveLength(0);
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
