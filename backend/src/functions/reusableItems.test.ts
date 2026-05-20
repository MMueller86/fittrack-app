import { describe, it, expect, beforeEach } from 'vitest';

import { createReusableItemHandler, searchReusableItemsHandler } from './reusableItems';
import { __resetReusableItemsRepositoryForTests } from '../lib/repositories/reusableItemsRepository';
import { makeRequest, makeContext } from '../test-utils/http';

const AUTH = { authorization: 'Bearer test' };
const ctx = makeContext();

beforeEach(() => {
  __resetReusableItemsRepositoryForTests();
});

// ---------------------------------------------------------------------------
// POST /api/reusable-items — validation
// ---------------------------------------------------------------------------

describe('POST /api/reusable-items — validation', () => {
  it('returns 400 when body is missing entirely', async () => {
    const req = makeRequest({ headers: AUTH });
    const res = await createReusableItemHandler(req, ctx);
    expect(res.status).toBe(400);
  });

  it('returns 400 when name is missing (manual)', async () => {
    const req = makeRequest({
      body: { calories: 100, protein: 10, carbs: 10, fat: 5, fiber: 2 },
      headers: AUTH,
    });
    const res = await createReusableItemHandler(req, ctx);
    expect(res.status).toBe(400);
  });

  it('returns 400 when calories is missing (manual)', async () => {
    const req = makeRequest({
      body: { name: 'Apple', protein: 10, carbs: 10, fat: 5, fiber: 2 },
      headers: AUTH,
    });
    const res = await createReusableItemHandler(req, ctx);
    expect(res.status).toBe(400);
  });

  it('returns 400 when name is missing (AI path)', async () => {
    const req = makeRequest({
      body: {
        sourceType: 'ai',
        nutritionPer100g: { calories: 100, protein: 10, carbs: 10, fat: 5 },
      },
      headers: AUTH,
    });
    const res = await createReusableItemHandler(req, ctx);
    expect(res.status).toBe(400);
  });

  it('returns 400 when nutritionPer100g is missing (AI path)', async () => {
    const req = makeRequest({
      body: { sourceType: 'ai', name: 'Apple' },
      headers: AUTH,
    });
    const res = await createReusableItemHandler(req, ctx);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/reusable-items — manual (flat macros) path
// ---------------------------------------------------------------------------

describe('POST /api/reusable-items — manual create', () => {
  it('returns 201 and the created item', async () => {
    const req = makeRequest({
      body: { name: 'Banana', calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6 },
      headers: AUTH,
    });
    const res = await createReusableItemHandler(req, ctx);
    expect(res.status).toBe(201);
    const body = res.jsonBody as { item: { name: string; sourceType: string } };
    expect(body.item.name).toBe('Banana');
    expect(body.item.sourceType).toBe('manual');
  });

  it('stores nutrition as perPortion basis', async () => {
    const req = makeRequest({
      body: { name: 'Oat', calories: 370, protein: 13, carbs: 60, fat: 6.5, fiber: 10 },
      headers: AUTH,
    });
    const res = await createReusableItemHandler(req, ctx);
    expect(res.status).toBe(201);
    const { item } = res.jsonBody as { item: Record<string, unknown> };
    expect(item['nutritionBasis']).toBe('perPortion');
    const portion = item['portion'] as { nutrition: { calories: number } };
    expect(portion.nutrition.calories).toBe(370);
  });

  it('creates item without sourceType field (defaults to manual)', async () => {
    // Existing clients that don't send sourceType must still work
    const req = makeRequest({
      body: { name: 'Egg', calories: 155, protein: 13, carbs: 1.1, fat: 11, fiber: 0 },
      headers: AUTH,
    });
    const res = await createReusableItemHandler(req, ctx);
    expect(res.status).toBe(201);
    const { item } = res.jsonBody as { item: { sourceType: string } };
    expect(item.sourceType).toBe('manual');
  });
});

// ---------------------------------------------------------------------------
// POST /api/reusable-items — AI path
// ---------------------------------------------------------------------------

describe('POST /api/reusable-items — AI create', () => {
  it('returns 201 with AI source type', async () => {
    const req = makeRequest({
      body: {
        sourceType: 'ai',
        name: 'Hähnchenbrust',
        nutritionPer100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
        aiConfidence: 0.85,
      },
      headers: AUTH,
    });
    const res = await createReusableItemHandler(req, ctx);
    expect(res.status).toBe(201);
    const { item } = res.jsonBody as { item: { sourceType: string; aiConfidence: number } };
    expect(item.sourceType).toBe('ai');
    expect(item.aiConfidence).toBe(0.85);
  });

  it('stores nutritionPer100g and basis per100g when no portion given', async () => {
    const req = makeRequest({
      body: {
        sourceType: 'ai',
        name: 'Tofu',
        nutritionPer100g: { calories: 76, protein: 8, carbs: 1.9, fat: 4.8 },
      },
      headers: AUTH,
    });
    const res = await createReusableItemHandler(req, ctx);
    expect(res.status).toBe(201);
    const { item } = res.jsonBody as { item: Record<string, unknown> };
    expect(item['nutritionBasis']).toBe('per100g');
    const n100 = item['nutritionPer100g'] as { calories: number };
    expect(n100.calories).toBe(76);
  });

  it('stores both basis when portion is provided', async () => {
    const req = makeRequest({
      body: {
        sourceType: 'ai',
        name: 'Avocado',
        nutritionPer100g: { calories: 160, protein: 2, carbs: 9, fat: 15 },
        portion: { label: '1 Avocado', weightGrams: 200 },
        aiConfidence: 0.7,
        aiWarnings: ['Schätzung basiert auf mittlerer Größe'],
      },
      headers: AUTH,
    });
    const res = await createReusableItemHandler(req, ctx);
    expect(res.status).toBe(201);
    const { item } = res.jsonBody as { item: Record<string, unknown> };
    expect(item['nutritionBasis']).toBe('both');
    expect((item['aiWarnings'] as string[]).length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// GET /api/reusable-items?query= — search
// ---------------------------------------------------------------------------

describe('GET /api/reusable-items — search', () => {
  async function createItem(name: string) {
    const req = makeRequest({
      body: { name, calories: 100, protein: 5, carbs: 10, fat: 3, fiber: 1 },
      headers: AUTH,
    });
    await createReusableItemHandler(req, ctx);
  }

  it('returns empty list for fresh user', async () => {
    const req = { params: {}, headers: { get: () => 'Bearer test' }, query: { get: () => '' } } as unknown as Parameters<typeof searchReusableItemsHandler>[0];
    const res = await searchReusableItemsHandler(req, ctx);
    expect(res.status).toBe(200);
    const { items } = res.jsonBody as { items: unknown[] };
    expect(items).toHaveLength(0);
  });

  it('returns created items matching query', async () => {
    await createItem('Apfel');
    await createItem('Aprikose');
    await createItem('Banane');

    const req = { params: {}, headers: { get: () => 'Bearer test' }, query: { get: () => 'Ap' } } as unknown as Parameters<typeof searchReusableItemsHandler>[0];
    const res = await searchReusableItemsHandler(req, ctx);
    expect(res.status).toBe(200);
    const { items } = res.jsonBody as { items: { name: string }[] };
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.every((i) => i.name.startsWith('Ap') || i.name.startsWith('ap'))).toBe(true);
  });
});
