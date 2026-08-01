import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';

import { addItemHandler, createMealHandler, updateItemHandler, setDayTypeHandler, getDiaryHandler } from './diary';
import { __resetDiaryRepositoryForTests, computeSummary } from '../lib/repositories/diaryRepository';
import { getDayMetaRepository, __resetDayMetaRepositoryForTests } from '../lib/repositories/dayMetaRepository';
import { makeContext, makeAuthRequest, setupTestAuth, teardownTestAuth } from '../test-utils/http';
import { getUserFoodRelationRepository, __resetUserFoodRelationRepositoryForTests } from '../lib/repositories/userFoodRelationRepository';
import type { SpecialActivity } from '@fittrack/shared';

// Unit tests for POST /api/diary/meals/:id/items
//
// Uses the real in-memory diary repository (no Cosmos env vars set).
// Each test creates a fresh meal first, then exercises addItemHandler.

const originalEnv = { ...process.env };

beforeAll(async () => {
  await setupTestAuth();
});

afterAll(() => {
  teardownTestAuth();
});

beforeEach(() => {
  delete process.env.COSMOS_ENDPOINT;
  delete process.env.COSMOS_KEY;
  __resetDiaryRepositoryForTests();
});

afterEach(() => {
  Object.assign(process.env, originalEnv);
  __resetDiaryRepositoryForTests();
});

/** Create a meal and return its id. */
async function createMeal(): Promise<string> {
  const res = await createMealHandler(
    await makeAuthRequest({ body: { date: '2026-05-08', type: 'breakfast' } }),
    makeContext(),
  );
  const body = res.jsonBody as { meal: { id: string } };
  return body.meal.id;
}

// ---------------------------------------------------------------------------
// Product input (productId + productName + pre-calculated nutrition)
// ---------------------------------------------------------------------------

describe('POST /api/diary/meals/:id/items â€” product input', () => {
  it('accepts productName + productId + calculatedNutrition and returns 201', async () => {
    const mealId = await createMeal();
    const res = await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: {
          productId: 'openFoodFacts:abc123',
          productName: 'Lebkuchen',
          inputMode: 'portion',
          inputAmount: 2,
          amountGrams: 60,
          calculatedNutrition: { calories: 220, protein: 3, carbs: 42, fat: 6, fiber: 1.5 },
        },
      }),
      makeContext(),
    );
    expect(res.status).toBe(201);
    const body = res.jsonBody as { meal: { items: { name: string }[] } };
    expect(body.meal.items[0]!.name).toBe('Lebkuchen');
  });

  it('returns 400 when neither name nor productName is provided', async () => {
    const mealId = await createMeal();
    const res = await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: {
          productId: 'openFoodFacts:abc123',
          inputMode: 'grams',
          inputAmount: 100,
          amountGrams: 100,
          calculatedNutrition: { calories: 400, protein: 10, carbs: 50, fat: 8 },
        },
      }),
      makeContext(),
    );
    expect(res.status).toBe(400);
  });

  it('stores inputAmount as quantity (not amountGrams) when inputMode is portion', async () => {
    const mealId = await createMeal();
    const res = await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: {
          productId: 'openFoodFacts:abc123',
          productName: 'Lebkuchen',
          inputMode: 'portion',
          inputAmount: 2,
          amountGrams: 66,
          calculatedNutrition: { calories: 242, protein: 3, carbs: 44, fat: 6, fiber: 1.6 },
        },
      }),
      makeContext(),
    );
    expect(res.status).toBe(201);
    const body = res.jsonBody as { meal: { items: { quantity: number; unit: string }[] } };
    expect(body.meal.items[0]!.quantity).toBe(2);   // inputAmount, NOT amountGrams (66)
    expect(body.meal.items[0]!.unit).toBe('portion');
  });

  it('stores amountGrams as quantity when inputMode is grams', async () => {
    const mealId = await createMeal();
    const res = await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: {
          productId: 'openFoodFacts:abc123',
          productName: 'Lebkuchen',
          inputMode: 'grams',
          inputAmount: 50,
          amountGrams: 50,
          calculatedNutrition: { calories: 183, protein: 2.3, carbs: 33, fat: 4.5 },
        },
      }),
      makeContext(),
    );
    expect(res.status).toBe(201);
    const body = res.jsonBody as { meal: { items: { quantity: number; unit: string }[] } };
    expect(body.meal.items[0]!.quantity).toBe(50);
    expect(body.meal.items[0]!.unit).toBe('g');
  });

  // --- Fiber regression tests ---
  // These tests guard against the bug where fiber was missing from calculatedNutrition
  // on the client side, causing the backend to store fiber=0 and the summary to show 0.

  it('speichert fiber aus calculatedNutrition korrekt in macros', async () => {
    const mealId = await createMeal();
    const res = await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: {
          productId: 'lib:vollkornbrot',
          productName: 'Vollkornbrot',
          inputMode: 'grams',
          inputAmount: 100,
          amountGrams: 100,
          calculatedNutrition: { calories: 240, protein: 8, carbs: 44, fat: 3, fiber: 6 },
        },
      }),
      makeContext(),
    );
    expect(res.status).toBe(201);
    const body = res.jsonBody as { meal: { items: { macros: { fiber: number } }[] } };
    expect(body.meal.items[0]!.macros.fiber).toBe(6);
  });

  it('speichert fiber=0 wenn calculatedNutrition kein fiber enthält (kein Absturz)', async () => {
    const mealId = await createMeal();
    const res = await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: {
          productId: 'lib:butter',
          productName: 'Butter',
          inputMode: 'grams',
          inputAmount: 10,
          amountGrams: 10,
          calculatedNutrition: { calories: 74, protein: 0.1, carbs: 0, fat: 8.2 }, // kein fiber
        },
      }),
      makeContext(),
    );
    expect(res.status).toBe(201);
    const body = res.jsonBody as { meal: { items: { macros: { fiber: number } }[] } };
    expect(body.meal.items[0]!.macros.fiber).toBe(0); // ?? 0 Fallback
  });

  it('rechnet fiber korrekt in die Tagessummary ein (End-to-End über addItem→computeSummary)', async () => {
    const mealId = await createMeal();

    // Eintrag 1: fiber=6 via calculatedNutrition (Produkt-Pfad)
    await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: {
          productName: 'Vollkornbrot',
          inputMode: 'grams',
          inputAmount: 100,
          amountGrams: 100,
          calculatedNutrition: { calories: 240, protein: 8, carbs: 44, fat: 3, fiber: 6 },
        },
      }),
      makeContext(),
    );

    // Eintrag 2: fiber=2.5 via Flat-Macros (manueller Pfad) — Rückgabe enthält beide Items
    const res2 = await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: { name: 'Apfel', calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.5 },
      }),
      makeContext(),
    );
    expect(res2.status).toBe(201);

    // addItem gibt die vollständige Mahlzeit zurück — daraus Summary direkt berechnen
    const meal = (res2.jsonBody as { meal: import('@fittrack/shared').Meal }).meal;
    const summary = computeSummary([meal]);
    expect(summary.fiber).toBeCloseTo(8.5, 1); // 6 (Vollkornbrot) + 2.5 (Apfel)
  });
});

// ---------------------------------------------------------------------------
// Flat macros input (manual mode — existing behaviour)
// ---------------------------------------------------------------------------

describe('POST /api/diary/meals/:id/items â€” flat macros input', () => {
  it('accepts flat macros and returns 201', async () => {
    const mealId = await createMeal();
    const res = await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: { name: 'RÃ¼hrei', calories: 180, protein: 14, carbs: 2, fat: 12, fiber: 0 },
      }),
      makeContext(),
    );
    expect(res.status).toBe(201);
    const body = res.jsonBody as { meal: { items: { name: string }[] } };
    expect(body.meal.items[0]!.name).toBe('RÃ¼hrei');
  });

  it('returns 400 when calories is missing', async () => {
    const mealId = await createMeal();
    const res = await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: { name: 'RÃ¼hrei', protein: 14, carbs: 2, fat: 12 },
      }),
      makeContext(),
    );
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Calculated input (quantityMode â€” existing behaviour)
// ---------------------------------------------------------------------------

describe('POST /api/diary/meals/:id/items â€” quantityMode input', () => {
  it('accepts quantityMode=grams + nutritionPer100g and returns 201', async () => {
    const mealId = await createMeal();
    const res = await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: {
          name: 'Haferflocken',
          quantityMode: 'grams',
          quantity: 80,
          nutritionPer100g: { calories: 370, protein: 13, carbs: 58, fat: 7, fiber: 10 },
        },
      }),
      makeContext(),
    );
    expect(res.status).toBe(201);
  });

  it('returns 400 when mealId is missing', async () => {
    const res = await addItemHandler(
      await makeAuthRequest({
        params: {},
        body: { name: 'x', calories: 100, protein: 5, carbs: 10, fat: 3, fiber: 0 },
      }),
      makeContext(),
    );
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// computeSummary — Robustheit
// ---------------------------------------------------------------------------

describe('computeSummary', () => {
  it('gibt Nullwerte zurück wenn keine Meals vorhanden', () => {
    const result = computeSummary([]);
    expect(result).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  });

  it('wirft nicht wenn meal.items undefined ist (Altdaten aus Cosmos)', () => {
    const malformed = [{ id: '1', items: undefined }] as unknown as import('@fittrack/shared').Meal[];
    expect(() => computeSummary(malformed)).not.toThrow();
    expect(computeSummary(malformed)).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  });

  it('wirft nicht wenn meal.items null ist', () => {
    const malformed = [{ id: '1', items: null }] as unknown as import('@fittrack/shared').Meal[];
    expect(() => computeSummary(malformed)).not.toThrow();
  });

  it('summiert Makros korrekt über mehrere Meals', () => {
    const meals = [
      {
        id: '1',
        items: [
          { macros: { calories: 300, protein: 20, carbs: 40, fat: 8, fiber: 3 } },
          { macros: { calories: 100, protein: 5, carbs: 15, fat: 2, fiber: 1 } },
        ],
      },
      {
        id: '2',
        items: [
          { macros: { calories: 200, protein: 10, carbs: 25, fat: 5, fiber: 2 } },
        ],
      },
    ] as unknown as import('@fittrack/shared').Meal[];
    const result = computeSummary(meals);
    expect(result.calories).toBe(600);
    expect(result.protein).toBe(35);
    expect(result.carbs).toBe(80);
    expect(result.fat).toBe(15);
    expect(result.fiber).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/diary/meals/:id/items/:itemId — updateItemHandler
// ---------------------------------------------------------------------------

describe('PUT /api/diary/meals/:id/items/:itemId — updateItemHandler', () => {
  beforeEach(() => {
    __resetDayMetaRepositoryForTests();
  });

  afterEach(() => {
    __resetDayMetaRepositoryForTests();
  });

  it('scales macros proportionally for a manual item (grams mode)', async () => {
    const mealId = await createMeal();
    // Add a manual item: 100g → 200 kcal
    const addRes = await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: {
          name: 'Banane',
          calories: 200,
          protein: 2,
          carbs: 40,
          fat: 1,
          fiber: 2,
        },
      }),
      makeContext(),
    );
    expect(addRes.status).toBe(201);
    const item = (addRes.jsonBody as { meal: { items: Array<{ id: string; quantity: number }> } }).meal.items[0];
    expect(item.quantity).toBe(1); // default quantity for flat-macro items

    // Update to 200g (ratio 200/1 = 200x)
    const res = await updateItemHandler(
      await makeAuthRequest({
        params: { id: mealId, itemId: item.id },
        body: { inputMode: 'grams', amountGrams: 200 },
      }),
      makeContext(),
    );
    expect(res.status).toBe(200);
    const updatedMeal = (res.jsonBody as { meal: { items: Array<{ quantity: number; unit: string; macros: { calories: number } }> } }).meal;
    const updatedItem = updatedMeal.items[0];
    expect(updatedItem.quantity).toBe(200);
    expect(updatedItem.unit).toBe('g');
    expect(updatedItem.macros.calories).toBe(40000); // 200 × 200 kcal
  });

  it('returns 404 when meal does not exist', async () => {
    const res = await updateItemHandler(
      await makeAuthRequest({
        params: { id: 'nonexistent-meal', itemId: 'nonexistent-item' },
        body: { inputMode: 'grams', amountGrams: 100 },
      }),
      makeContext(),
    );
    expect(res.status).toBe(404);
  });

  it('returns 404 when item does not exist in meal', async () => {
    const mealId = await createMeal();
    const res = await updateItemHandler(
      await makeAuthRequest({
        params: { id: mealId, itemId: 'ghost-item' },
        body: { inputMode: 'grams', amountGrams: 100 },
      }),
      makeContext(),
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 for missing required field (no amountGrams in grams mode)', async () => {
    const mealId = await createMeal();
    const res = await updateItemHandler(
      await makeAuthRequest({
        params: { id: mealId, itemId: 'any-id' },
        body: { inputMode: 'grams' }, // amountGrams missing
      }),
      makeContext(),
    );
    expect(res.status).toBe(400);
  });

  it('scales macros proportionally for an OFf item (sourceId starts with openFoodFacts:)', async () => {
    const mealId = await createMeal();
    // Add an OFf item via the product input path with calculatedNutrition
    const addRes = await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: {
          productId: 'openFoodFacts:3017620422003',
          productName: 'Nutella',
          inputMode: 'grams',
          inputAmount: 100,
          amountGrams: 100,
          calculatedNutrition: { calories: 539, protein: 6.3, carbs: 57.5, fat: 30.9, fiber: 0 },
        },
      }),
      makeContext(),
    );
    expect(addRes.status).toBe(201);
    const item = (addRes.jsonBody as { meal: { items: Array<{ id: string; quantity: number; macros: { calories: number } }> } }).meal.items[0];
    expect(item.quantity).toBe(100);
    expect(item.macros.calories).toBe(539);

    // Update to 50g — should scale proportionally (ratio = 50/100 = 0.5)
    const res = await updateItemHandler(
      await makeAuthRequest({
        params: { id: mealId, itemId: item.id },
        body: { inputMode: 'grams', amountGrams: 50 },
      }),
      makeContext(),
    );
    expect(res.status).toBe(200);
    const updatedItem = (res.jsonBody as { meal: { items: Array<{ quantity: number; macros: { calories: number; protein: number } }> } }).meal.items[0];
    expect(updatedItem.quantity).toBe(50);
    expect(updatedItem.macros.calories).toBe(269.5);
    expect(updatedItem.macros.protein).toBe(3.2);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/diary/:date/day-type — workoutType support
// ---------------------------------------------------------------------------

describe('PUT /api/diary/:date/day-type with workoutType', () => {
  beforeEach(() => {
    __resetDayMetaRepositoryForTests();
  });

  afterEach(() => {
    __resetDayMetaRepositoryForTests();
  });

  it('stores workoutType and returns it in GET response', async () => {
    // Set training day + gym workout
    const putRes = await setDayTypeHandler(
      await makeAuthRequest({
        params: { date: '2026-05-08' },
        body: { dayType: 'training', workoutType: 'gym' },
      }),
      makeContext(),
    );
    expect(putRes.status).toBe(200);
    const meta = (putRes.jsonBody as { dayMeta: { dayType: string; workoutType: string } }).dayMeta;
    expect(meta.dayType).toBe('training');
    expect(meta.workoutType).toBe('gym');

    // Verify directly via repository
    const repo = getDayMetaRepository();
    const stored = await repo.get('test-user-abc-123', '2026-05-08');
    expect(stored?.workoutType).toBe('gym');
  });

  it('clears workoutType when switching to rest day', async () => {
    // First set training + bouldering
    await setDayTypeHandler(
      await makeAuthRequest({
        params: { date: '2026-05-08' },
        body: { dayType: 'training', workoutType: 'bouldering' },
      }),
      makeContext(),
    );
    // Then switch to rest
    const restRes = await setDayTypeHandler(
      await makeAuthRequest({
        params: { date: '2026-05-08' },
        body: { dayType: 'rest' },
      }),
      makeContext(),
    );
    expect(restRes.status).toBe(200);
    const meta = (restRes.jsonBody as { dayMeta: { dayType: string; workoutType?: string } }).dayMeta;
    expect(meta.dayType).toBe('rest');
    expect(meta.workoutType).toBeUndefined();

    // Verify directly via repository
    const repo = getDayMetaRepository();
    const stored = await repo.get('test-user-abc-123', '2026-05-08');
    expect(stored?.workoutType).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// recordUsage — foodRefType mapping per sourceType
// ---------------------------------------------------------------------------

describe('addItemHandler — recordUsage foodRefType mapping', () => {
  beforeEach(() => {
    __resetUserFoodRelationRepositoryForTests();
  });

  afterEach(() => {
    __resetUserFoodRelationRepositoryForTests();
  });

  it('creates UserFoodRelation with foodRefType "recipe" when sourceType is "recipe"', async () => {
    const mealId = await createMeal();
    const res = await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: {
          productId: 'recipe:abc-123',
          productName: 'Pasta al Pomodoro',
          sourceType: 'recipe',
          inputMode: 'portion',
          inputAmount: 1,
          amountGrams: 400,
          calculatedNutrition: { calories: 520, protein: 18, carbs: 72, fat: 14, fiber: 4 },
        },
      }),
      makeContext(),
    );
    expect(res.status).toBe(201);

    // Flush the fire-and-forget recordUsage microtask
    await new Promise<void>(resolve => setTimeout(resolve, 0));

    const repo = getUserFoodRelationRepository();
    const rel = await repo.getByFoodRef('test-user-abc-123', 'recipe:abc-123');
    expect(rel?.foodRefType).toBe('recipe');
  });
});

// ---------------------------------------------------------------------------
// GET /api/diary — specialActivity fields
// ---------------------------------------------------------------------------

describe('GET /api/diary — specialActivity response fields', () => {
  const GET_DATE = '2026-07-21';

  // Helper to build a fake GET request with query params
  async function makeGetRequest(date: string) {
    const token = await (async () => {
      // Re-use makeAuthRequest pattern with query support
      const { signTestToken } = await import('../test-utils/http');
      return signTestToken();
    })();
    // Build a fake request manually with query support
    const { makeRequest } = await import('../test-utils/http');
    return makeRequest({
      query: { date },
      headers: { authorization: `Bearer ${token}` },
    });
  }

  beforeEach(() => {
    __resetDayMetaRepositoryForTests();
  });

  it('returns specialActivity: null and activityBonus: 0 when no activity is set', async () => {
    const req = await makeGetRequest(GET_DATE);
    const res = await getDiaryHandler(req, makeContext());

    expect(res.status).toBe(200);
    const body = res.jsonBody as { specialActivity: null; activityBonus: number; previousDayHasActivity: boolean };
    expect(body.specialActivity).toBeNull();
    expect(body.activityBonus).toBe(0);
    expect(body.previousDayHasActivity).toBe(false);
  });

  it('returns correct activityBonus when specialActivity is set for the requested day', async () => {
    const mockActivity: SpecialActivity = {
      type: 'hiking',
      movementTimeMinutes: 240,
      distanceKm: 16,
      elevationGainM: 800,
      hasBackpack: false,
      bodyWeightKg: 70,
      dailyCalorieTarget: 2000,
      calculatedAt: '2026-07-21T08:00:00Z',
      estimatedMet: 4.5,
      activityCalories: 1260,
      alreadyAccountedCalories: 333.33,
      activityBonus: 926.67,
    };
    await getDayMetaRepository().setSpecialActivity('test-user-abc-123', GET_DATE, mockActivity);

    const req = await makeGetRequest(GET_DATE);
    const res = await getDiaryHandler(req, makeContext());

    expect(res.status).toBe(200);
    const body = res.jsonBody as { specialActivity: SpecialActivity; activityBonus: number };
    expect(body.activityBonus).toBeCloseTo(926.67, 1);
    expect(body.specialActivity?.type).toBe('hiking');
  });

  it('returns previousDayHasActivity: true when yesterday has a special activity', async () => {
    // Yesterday = 2026-07-20
    const mockActivity: SpecialActivity = {
      type: 'hiking',
      movementTimeMinutes: 120,
      distanceKm: 8,
      elevationGainM: 400,
      hasBackpack: false,
      bodyWeightKg: 70,
      dailyCalorieTarget: 2000,
      calculatedAt: '2026-07-20T10:00:00Z',
      estimatedMet: 4.5,
      activityCalories: 630,
      alreadyAccountedCalories: 166.67,
      activityBonus: 463.33,
    };
    await getDayMetaRepository().setSpecialActivity('test-user-abc-123', '2026-07-20', mockActivity);

    const req = await makeGetRequest(GET_DATE);
    const res = await getDiaryHandler(req, makeContext());

    expect(res.status).toBe(200);
    const body = res.jsonBody as { previousDayHasActivity: boolean };
    expect(body.previousDayHasActivity).toBe(true);
  });
});