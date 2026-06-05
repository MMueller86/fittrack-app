import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';

import { createReusableItemHandler, searchReusableItemsHandler } from './reusableItems';
import { __resetReusableItemsRepositoryForTests } from '../lib/repositories/reusableItemsRepository';
import { makeContext, makeAuthRequest, setupTestAuth, teardownTestAuth, signTestToken } from '../test-utils/http';

const ctx = makeContext();

beforeAll(async () => {
  await setupTestAuth();
});

afterAll(() => {
  teardownTestAuth();
});

beforeEach(() => {
  __resetReusableItemsRepositoryForTests();
});

// ---------------------------------------------------------------------------
// POST /api/reusable-items — validation
// ---------------------------------------------------------------------------

describe('POST /api/reusable-items — validation', () => {
  it('returns 400 when body is missing entirely', async () => {
    const req = await makeAuthRequest({});
    const res = await createReusableItemHandler(req, ctx);
    expect(res.status).toBe(400);
  });

  it('returns 400 when name is missing (manual)', async () => {
    const req = await makeAuthRequest({
      body: { calories: 100, protein: 10, carbs: 10, fat: 5, fiber: 2 },
    });
    const res = await createReusableItemHandler(req, ctx);
    expect(res.status).toBe(400);
  });

  it('returns 400 when calories is missing (manual)', async () => {
    const req = await makeAuthRequest({
      body: { name: 'Apple', protein: 10, carbs: 10, fat: 5, fiber: 2 },
    });
    const res = await createReusableItemHandler(req, ctx);
    expect(res.status).toBe(400);
  });

  it('returns 400 when name is missing (AI path)', async () => {
    const req = await makeAuthRequest({
      body: {
        sourceType: 'ai',
        nutritionPer100g: { calories: 100, protein: 10, carbs: 10, fat: 5 },
      },
    });
    const res = await createReusableItemHandler(req, ctx);
    expect(res.status).toBe(400);
  });

  it('returns 400 when nutritionPer100g is missing (AI path)', async () => {
    const req = await makeAuthRequest({
      body: { sourceType: 'ai', name: 'Apple' },
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
    const req = await makeAuthRequest({
      body: { name: 'Banana', calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6 },
    });
    const res = await createReusableItemHandler(req, ctx);
    expect(res.status).toBe(201);
    const body = res.jsonBody as { item: { name: string; sourceType: string } };
    expect(body.item.name).toBe('Banana');
    expect(body.item.sourceType).toBe('manual');
  });

  it('stores nutrition as perPortion basis', async () => {
    const req = await makeAuthRequest({
      body: { name: 'Oat', calories: 370, protein: 13, carbs: 60, fat: 6.5, fiber: 10 },
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
    const req = await makeAuthRequest({
      body: { name: 'Egg', calories: 155, protein: 13, carbs: 1.1, fat: 11, fiber: 0 },
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
    const req = await makeAuthRequest({
      body: {
        sourceType: 'ai',
        name: 'Hähnchenbrust',
        nutritionPer100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
        aiConfidence: 0.85,
      },
    });
    const res = await createReusableItemHandler(req, ctx);
    expect(res.status).toBe(201);
    const { item } = res.jsonBody as { item: { sourceType: string; aiConfidence: number } };
    expect(item.sourceType).toBe('ai');
    expect(item.aiConfidence).toBe(0.85);
  });

  it('stores nutritionPer100g and basis per100g when no portion given', async () => {
    const req = await makeAuthRequest({
      body: {
        sourceType: 'ai',
        name: 'Tofu',
        nutritionPer100g: { calories: 76, protein: 8, carbs: 1.9, fat: 4.8 },
      },
    });
    const res = await createReusableItemHandler(req, ctx);
    expect(res.status).toBe(201);
    const { item } = res.jsonBody as { item: Record<string, unknown> };
    expect(item['nutritionBasis']).toBe('per100g');
    const n100 = item['nutritionPer100g'] as { calories: number };
    expect(n100.calories).toBe(76);
  });

  it('stores both basis when portion is provided', async () => {
    const req = await makeAuthRequest({
      body: {
        sourceType: 'ai',
        name: 'Avocado',
        nutritionPer100g: { calories: 160, protein: 2, carbs: 9, fat: 15 },
        portion: { label: '1 Avocado', weightGrams: 200 },
        aiConfidence: 0.7,
        aiWarnings: ['Schätzung basiert auf mittlerer Größe'],
      },
    });
    const res = await createReusableItemHandler(req, ctx);
    expect(res.status).toBe(201);
    const { item } = res.jsonBody as { item: Record<string, unknown> };
    expect(item['nutritionBasis']).toBe('both');
    expect((item['aiWarnings'] as string[]).length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// POST /api/reusable-items — label-scan path
// ---------------------------------------------------------------------------

describe('POST /api/reusable-items — label-scan create', () => {
  it('returns 201 with label-scan source type and per100g basis', async () => {
    const req = await makeAuthRequest({
      body: {
        sourceType: 'label-scan',
        name: 'Vollmilch 3,5%',
        nutritionPer100g: { calories: 64, protein: 3.4, carbs: 4.8, fat: 3.5 },
      },
    });
    const res = await createReusableItemHandler(req, ctx);
    expect(res.status).toBe(201);
    const { item } = res.jsonBody as { item: Record<string, unknown> };
    expect(item['sourceType']).toBe('label-scan');
    expect(item['nutritionBasis']).toBe('per100g');
  });

  it('returns 201 with label-scan and portion — basis becomes both', async () => {
    const req = await makeAuthRequest({
      body: {
        sourceType: 'label-scan',
        name: 'Schokoriegel',
        nutritionPer100g: { calories: 480, protein: 5, carbs: 65, fat: 22, fiber: 3, salt: 0.3 },
        portion: { label: '1 Riegel', weightGrams: 45 },
      },
    });
    const res = await createReusableItemHandler(req, ctx);
    expect(res.status).toBe(201);
    const { item } = res.jsonBody as { item: Record<string, unknown> };
    expect(item['sourceType']).toBe('label-scan');
    expect(item['nutritionBasis']).toBe('both');
    const portion = item['portion'] as { label: string; weightGrams: number };
    expect(portion.label).toBe('1 Riegel');
    expect(portion.weightGrams).toBe(45);
  });

  it('returns 400 when sourceType is label-scan but nutritionPer100g is missing', async () => {
    const req = await makeAuthRequest({
      body: { sourceType: 'label-scan', name: 'Schokoriegel' },
    });
    const res = await createReusableItemHandler(req, ctx);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/reusable-items — manual per-100g path (sourceType: 'manual')
// ---------------------------------------------------------------------------

describe('POST /api/reusable-items — manual per-100g create', () => {
  it('returns 201 with manual sourceType and nutritionPer100g', async () => {
    const req = await makeAuthRequest({
      body: {
        sourceType: 'manual',
        name: 'Selbst eingegebenes Produkt',
        nutritionPer100g: { calories: 250, protein: 12, carbs: 30, fat: 8 },
      },
    });
    const res = await createReusableItemHandler(req, ctx);
    expect(res.status).toBe(201);
    const { item } = res.jsonBody as { item: Record<string, unknown> };
    expect(item['sourceType']).toBe('manual');
    expect(item['nutritionBasis']).toBe('per100g');
  });

  it('returns 201 with manual + portion — basis becomes both', async () => {
    const req = await makeAuthRequest({
      body: {
        sourceType: 'manual',
        name: 'Hausgemachtes Granola',
        nutritionPer100g: { calories: 420, protein: 10, carbs: 55, fat: 18, fiber: 6 },
        portion: { label: '1 Portion', weightGrams: 60 },
      },
    });
    const res = await createReusableItemHandler(req, ctx);
    expect(res.status).toBe(201);
    const { item } = res.jsonBody as { item: Record<string, unknown> };
    expect(item['sourceType']).toBe('manual');
    expect(item['nutritionBasis']).toBe('both');
    const n100 = item['nutritionPer100g'] as { calories: number; fiber: number };
    expect(n100.calories).toBe(420);
    expect(n100.fiber).toBe(6);
  });

  it('returns 400 when sourceType is manual but nutritionPer100g is missing', async () => {
    const req = await makeAuthRequest({
      body: { sourceType: 'manual', name: 'Produkt ohne Nährwerte' },
    });
    const res = await createReusableItemHandler(req, ctx);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/reusable-items?query= — search
// ---------------------------------------------------------------------------

describe('GET /api/reusable-items — search', () => {
  async function createItem(name: string) {
    const req = await makeAuthRequest({
      body: { name, calories: 100, protein: 5, carbs: 10, fat: 3, fiber: 1 },
    });
    await createReusableItemHandler(req, ctx);
  }

  async function makeSearchRequest(query: string) {
    const token = await signTestToken();
    return {
      params: {},
      headers: { get: (name: string) => (name.toLowerCase() === 'authorization' ? `Bearer ${token}` : null) },
      query: { get: () => query },
    } as unknown as Parameters<typeof searchReusableItemsHandler>[0];
  }

  it('returns empty list for fresh user', async () => {
    const req = await makeSearchRequest('');
    const res = await searchReusableItemsHandler(req, ctx);
    expect(res.status).toBe(200);
    const { items } = res.jsonBody as { items: unknown[] };
    expect(items).toHaveLength(0);
  });

  it('returns created items matching query', async () => {
    await createItem('Apfel');
    await createItem('Aprikose');
    await createItem('Banane');

    const req = await makeSearchRequest('Ap');
    const res = await searchReusableItemsHandler(req, ctx);
    expect(res.status).toBe(200);
    const { items } = res.jsonBody as { items: { name: string }[] };
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.every((i) => i.name.startsWith('Ap') || i.name.startsWith('ap'))).toBe(true);
  });
});
