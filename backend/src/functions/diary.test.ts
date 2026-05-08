import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { addItemHandler, createMealHandler } from './diary';
import { __resetDiaryRepositoryForTests } from '../lib/repositories/diaryRepository';
import { makeContext, makeRequest } from '../test-utils/http';

// Unit tests for POST /api/diary/meals/:id/items
//
// Uses the real in-memory diary repository (no Cosmos env vars set).
// Each test creates a fresh meal first, then exercises addItemHandler.

const originalEnv = { ...process.env };

beforeEach(() => {
  delete process.env.COSMOS_ENDPOINT;
  delete process.env.COSMOS_KEY;
  __resetDiaryRepositoryForTests();
});

afterEach(() => {
  process.env = { ...originalEnv };
  __resetDiaryRepositoryForTests();
});

/** Create a meal and return its id. */
async function createMeal(): Promise<string> {
  const res = await createMealHandler(
    makeRequest({ body: { date: '2026-05-08', type: 'breakfast' } }),
    makeContext(),
  );
  const body = res.jsonBody as { meal: { id: string } };
  return body.meal.id;
}

// ---------------------------------------------------------------------------
// Product input (productId + productName + pre-calculated nutrition)
// ---------------------------------------------------------------------------

describe('POST /api/diary/meals/:id/items — product input', () => {
  it('accepts productName + productId + calculatedNutrition and returns 201', async () => {
    const mealId = await createMeal();
    const res = await addItemHandler(
      makeRequest({
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
      makeRequest({
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
      makeRequest({
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
      makeRequest({
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
});

// ---------------------------------------------------------------------------
// Flat macros input (manual mode — existing behaviour)
// ---------------------------------------------------------------------------

describe('POST /api/diary/meals/:id/items — flat macros input', () => {
  it('accepts flat macros and returns 201', async () => {
    const mealId = await createMeal();
    const res = await addItemHandler(
      makeRequest({
        params: { id: mealId },
        body: { name: 'Rührei', calories: 180, protein: 14, carbs: 2, fat: 12, fiber: 0 },
      }),
      makeContext(),
    );
    expect(res.status).toBe(201);
    const body = res.jsonBody as { meal: { items: { name: string }[] } };
    expect(body.meal.items[0]!.name).toBe('Rührei');
  });

  it('returns 400 when calories is missing', async () => {
    const mealId = await createMeal();
    const res = await addItemHandler(
      makeRequest({
        params: { id: mealId },
        body: { name: 'Rührei', protein: 14, carbs: 2, fat: 12 },
      }),
      makeContext(),
    );
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Calculated input (quantityMode — existing behaviour)
// ---------------------------------------------------------------------------

describe('POST /api/diary/meals/:id/items — quantityMode input', () => {
  it('accepts quantityMode=grams + nutritionPer100g and returns 201', async () => {
    const mealId = await createMeal();
    const res = await addItemHandler(
      makeRequest({
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
      makeRequest({
        params: {},
        body: { name: 'x', calories: 100, protein: 5, carbs: 10, fat: 3, fiber: 0 },
      }),
      makeContext(),
    );
    expect(res.status).toBe(400);
  });
});
