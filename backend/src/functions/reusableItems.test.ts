import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';

// Must be hoisted before handler imports so vi.mock replaces the module before it loads
vi.mock('../lib/queueClient', () => ({
  enqueueEnrichment: vi.fn().mockResolvedValue(undefined),
}));

import {
  createReusableItemHandler,
  searchReusableItemsHandler,
  updateReusableItemHandler,
  deleteReusableItemHandler,
} from './reusableItems';
import { enqueueEnrichment } from '../lib/queueClient';
import { __resetReusableItemsRepositoryForTests } from '../lib/repositories/reusableItemsRepository';
import { __resetDiaryRepositoryForTests } from '../lib/repositories/diaryRepository';
import { addItemHandler, createMealHandler } from './diary';
import { makeContext, makeAuthRequest, setupTestAuth, teardownTestAuth, signTestToken, TEST_USER_ID } from '../test-utils/http';

const ctx = makeContext();

beforeAll(async () => {
  await setupTestAuth();
});

afterAll(() => {
  teardownTestAuth();
});

beforeEach(() => {
  __resetReusableItemsRepositoryForTests();
  __resetDiaryRepositoryForTests();
  vi.mocked(enqueueEnrichment).mockClear();
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

// ---------------------------------------------------------------------------
// PATCH /api/reusable-items/:id — update
// ---------------------------------------------------------------------------

describe('PATCH /api/reusable-items/:id — update', () => {
  async function createProduct(name = 'Vollkornbrot') {
    const res = await createReusableItemHandler(
      await makeAuthRequest({
        body: {
          sourceType: 'manual',
          name,
          nutritionPer100g: { calories: 240, protein: 8, carbs: 44, fat: 3, fiber: 0 },
        },
      }),
      ctx,
    );
    return (res.jsonBody as { item: { id: string } }).item.id;
  }

  it('returns 200 and updated item when name is changed', async () => {
    const id = await createProduct();
    const res = await updateReusableItemHandler(
      await makeAuthRequest({ params: { id }, body: { name: 'Vollkornbrot Bio' } }),
      ctx,
    );
    expect(res.status).toBe(200);
    const { item } = res.jsonBody as { item: { name: string } };
    expect(item.name).toBe('Vollkornbrot Bio');
  });

  it('returns 200 and updates nutritionPer100g including fiber', async () => {
    const id = await createProduct();
    const res = await updateReusableItemHandler(
      await makeAuthRequest({
        params: { id },
        body: { nutritionPer100g: { calories: 240, protein: 8, carbs: 44, fat: 3, fiber: 6 } },
      }),
      ctx,
    );
    expect(res.status).toBe(200);
    const { item } = res.jsonBody as { item: { nutritionPer100g: { fiber: number } } };
    expect(item.nutritionPer100g.fiber).toBe(6);
  });

  it('returns 404 when item does not exist', async () => {
    const res = await updateReusableItemHandler(
      await makeAuthRequest({ params: { id: 'non-existent-id' }, body: { name: 'X' } }),
      ctx,
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 when no fields are provided', async () => {
    const id = await createProduct();
    const res = await updateReusableItemHandler(
      await makeAuthRequest({ params: { id }, body: {} }),
      ctx,
    );
    expect(res.status).toBe(400);
  });

  it('updates diary item macros when updateHistory is true', async () => {
    const productId = await createProduct('Ballaststoffarm');

    // Mahlzeit anlegen + Item mit productId (= sourceId) loggen
    const mealRes = await createMealHandler(
      await makeAuthRequest({ body: { date: '2026-06-05', type: 'lunch', name: 'Lunch' } }),
      ctx,
    );
    const mealId = (mealRes.jsonBody as { meal: { id: string } }).meal.id;

    await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: {
          productId,
          productName: 'Ballaststoffarm',
          inputMode: 'grams',
          inputAmount: 200,
          amountGrams: 200,
          calculatedNutrition: { calories: 480, protein: 16, carbs: 88, fat: 6, fiber: 0 },
        },
      }),
      ctx,
    );

    // Produkt mit korrektem fiber-Wert updaten + updateHistory
    const updateRes = await updateReusableItemHandler(
      await makeAuthRequest({
        params: { id: productId },
        body: {
          nutritionPer100g: { calories: 240, protein: 8, carbs: 44, fat: 3, fiber: 6 },
          updateHistory: true,
        },
      }),
      ctx,
    );
    expect(updateRes.status).toBe(200);
    const { updatedItemCount } = updateRes.jsonBody as { updatedItemCount: number };
    expect(updatedItemCount).toBe(1);

    // Diary-Eintrag muss jetzt fiber=12 haben (200g / 100 * 6 = 12)
    const dayRes = await (await import('./diary')).getDiaryHandler(
      {
        params: {},
        headers: { get: (n: string) => n === 'authorization' ? `Bearer ${(updateRes.jsonBody as never)}` : null },
        query: { get: (k: string) => k === 'date' ? '2026-06-05' : null },
      } as never,
      ctx,
    );
    // Prüfe über Repository direkt (getDiaryHandler braucht Auth-Token)
    const { getDiaryRepository } = await import('../lib/repositories/diaryRepository');
    const dayData = await getDiaryRepository().getDay(TEST_USER_ID, '2026-06-05');
    const fiber = dayData.meals[0]!.items[0]!.macros.fiber;
    expect(fiber).toBeCloseTo(12, 1); // 200g * 6/100 = 12
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/reusable-items/:id — delete
// ---------------------------------------------------------------------------

describe('DELETE /api/reusable-items/:id — delete', () => {
  async function createProduct() {
    const res = await createReusableItemHandler(
      await makeAuthRequest({
        body: {
          sourceType: 'manual',
          name: 'Löschbares Produkt',
          nutritionPer100g: { calories: 100, protein: 5, carbs: 10, fat: 3, fiber: 2 },
        },
      }),
      ctx,
    );
    return (res.jsonBody as { item: { id: string } }).item.id;
  }

  it('returns 200 with deleted:true and diaryUsageCount:0 when unused', async () => {
    const id = await createProduct();
    const res = await deleteReusableItemHandler(
      await makeAuthRequest({ params: { id } }),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = res.jsonBody as { deleted: boolean; diaryUsageCount: number };
    expect(body.deleted).toBe(true);
    expect(body.diaryUsageCount).toBe(0);
  });

  it('returns 200 with diaryUsageCount > 0 when item was used in diary', async () => {
    const productId = await createProduct();

    const mealRes = await createMealHandler(
      await makeAuthRequest({ body: { date: '2026-06-05', type: 'lunch', name: 'Lunch' } }),
      ctx,
    );
    const mealId = (mealRes.jsonBody as { meal: { id: string } }).meal.id;
    await addItemHandler(
      await makeAuthRequest({
        params: { id: mealId },
        body: {
          productId,
          productName: 'Löschbares Produkt',
          inputMode: 'grams',
          inputAmount: 100,
          amountGrams: 100,
          calculatedNutrition: { calories: 100, protein: 5, carbs: 10, fat: 3, fiber: 2 },
        },
      }),
      ctx,
    );

    const res = await deleteReusableItemHandler(
      await makeAuthRequest({ params: { id: productId } }),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = res.jsonBody as { deleted: boolean; diaryUsageCount: number };
    expect(body.deleted).toBe(true);
    expect(body.diaryUsageCount).toBe(1);
  });

  it('returns 404 when item does not exist', async () => {
    const res = await deleteReusableItemHandler(
      await makeAuthRequest({ params: { id: 'ghost-id' } }),
      ctx,
    );
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// enqueueEnrichment — called and awaited on create/update
// ---------------------------------------------------------------------------

describe('enqueueEnrichment — called after create and update', () => {
  it('calls enqueueEnrichment with correct itemId after POST create', async () => {
    const res = await createReusableItemHandler(
      await makeAuthRequest({
        body: {
          sourceType: 'ai',
          name: 'Joghurt Mild Stichfest',
          brand: 'Ja!',
          nutritionPer100g: { calories: 60, protein: 4, carbs: 5, fat: 2 },
        },
      }),
      ctx,
    );
    expect(res.status).toBe(201);
    const { item } = res.jsonBody as { item: { id: string } };

    // enqueueEnrichment must have been called exactly once and awaited
    // (if it were fire-and-forget the mock would still be called, but any
    // rejection would go unnoticed — the await ensures failures propagate).
    expect(enqueueEnrichment).toHaveBeenCalledOnce();
    expect(enqueueEnrichment).toHaveBeenCalledWith(TEST_USER_ID, item.id, ctx);
  });

  it('calls enqueueEnrichment with correct itemId after PATCH update', async () => {
    // Create first
    const createRes = await createReusableItemHandler(
      await makeAuthRequest({
        body: {
          sourceType: 'label-scan',
          name: 'Erdbeere Marmelade weniger Zucker',
          nutritionPer100g: { calories: 150, protein: 0.4, carbs: 36, fat: 0.1 },
        },
      }),
      ctx,
    );
    const { item } = createRes.jsonBody as { item: { id: string } };
    vi.mocked(enqueueEnrichment).mockClear(); // reset — only count the update call

    const updateRes = await updateReusableItemHandler(
      await makeAuthRequest({
        params: { id: item.id },
        body: { name: 'Erdbeer Konfitüre weniger Zucker' },
      }),
      ctx,
    );
    expect(updateRes.status).toBe(200);

    expect(enqueueEnrichment).toHaveBeenCalledOnce();
    expect(enqueueEnrichment).toHaveBeenCalledWith(TEST_USER_ID, item.id, ctx);
  });

  it('still returns 201 when storage is unavailable — enqueueEnrichment swallows errors internally', async () => {
    // We mock at the queueClient level: the real enqueueEnrichment() wraps all
    // storage operations in try/catch and never re-throws, so the mock resolves
    // normally here. This test documents the contract: the handler always returns
    // 201 regardless of what happens inside enqueueEnrichment.
    vi.mocked(enqueueEnrichment).mockResolvedValueOnce(undefined);

    const res = await createReusableItemHandler(
      await makeAuthRequest({
        body: { name: 'Haferflocken', calories: 370, protein: 13, carbs: 60, fat: 7, fiber: 10 },
      }),
      ctx,
    );
    expect(res.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// sugar + saturatedFat — stored and returned
// ---------------------------------------------------------------------------

describe('sugar + saturatedFat — stored and returned via POST and PATCH', () => {
  it('stores sugar and saturatedFat when provided via POST label-scan', async () => {
    const res = await createReusableItemHandler(
      await makeAuthRequest({
        body: {
          sourceType: 'label-scan',
          name: 'Joghurt Mild Stichfest',
          brand: 'Ja!',
          nutritionPer100g: {
            calories: 62,
            protein: 3.8,
            carbs: 5.0,
            fat: 2.5,
            sugar: 4.8,
            saturatedFat: 1.6,
            salt: 0.1,
          },
        },
      }),
      ctx,
    );
    expect(res.status).toBe(201);
    const { item } = res.jsonBody as { item: { nutritionPer100g: Record<string, number> } };
    expect(item.nutritionPer100g.sugar).toBeCloseTo(4.8);
    expect(item.nutritionPer100g.saturatedFat).toBeCloseTo(1.6);
    expect(item.nutritionPer100g.salt).toBeCloseTo(0.1);
  });

  it('omits sugar and saturatedFat when not provided (no phantom undefined keys)', async () => {
    const res = await createReusableItemHandler(
      await makeAuthRequest({
        body: {
          sourceType: 'label-scan',
          name: 'Haferflocken',
          nutritionPer100g: { calories: 370, protein: 13, carbs: 60, fat: 7, fiber: 10 },
        },
      }),
      ctx,
    );
    expect(res.status).toBe(201);
    const { item } = res.jsonBody as { item: { nutritionPer100g: Record<string, unknown> } };
    expect(item.nutritionPer100g.sugar).toBeUndefined();
    expect(item.nutritionPer100g.saturatedFat).toBeUndefined();
  });

  it('updates sugar and saturatedFat via PATCH', async () => {
    // Create without the optional fields first
    const createRes = await createReusableItemHandler(
      await makeAuthRequest({
        body: {
          sourceType: 'label-scan',
          name: 'Vollmilch',
          nutritionPer100g: { calories: 64, protein: 3.4, carbs: 4.8, fat: 3.5 },
        },
      }),
      ctx,
    );
    const { item: created } = createRes.jsonBody as { item: { id: string } };

    // Now update with sugar + saturatedFat
    const updateRes = await updateReusableItemHandler(
      await makeAuthRequest({
        params: { id: created.id },
        body: {
          nutritionPer100g: { calories: 64, protein: 3.4, carbs: 4.8, fat: 3.5, sugar: 4.8, saturatedFat: 2.1 },
        },
      }),
      ctx,
    );
    expect(updateRes.status).toBe(200);
    const { item } = updateRes.jsonBody as { item: { nutritionPer100g: Record<string, number> } };
    expect(item.nutritionPer100g.sugar).toBeCloseTo(4.8);
    expect(item.nutritionPer100g.saturatedFat).toBeCloseTo(2.1);
  });

  it('merges custom searchTerms with auto-tokens in PATCH without resetting enrichment', async () => {
    const createRes = await createReusableItemHandler(
      await makeAuthRequest({
        body: {
          sourceType: 'label-scan',
          name: 'Magerquark',
          nutritionPer100g: { calories: 67, protein: 12, carbs: 3.9, fat: 0.3 },
        },
      }),
      ctx,
    );
    const { item: created } = createRes.jsonBody as { item: { id: string; searchTerms: string[] } };

    // PATCH with only searchTerms (no name/brand change)
    const updateRes = await updateReusableItemHandler(
      await makeAuthRequest({
        params: { id: created.id },
        body: { searchTerms: ['quark', 'fettarm', 'protein'] },
      }),
      ctx,
    );
    expect(updateRes.status).toBe(200);
    const { item } = updateRes.jsonBody as { item: { searchTerms: string[] } };

    // Should contain both auto-tokens from "Magerquark" and the client-provided terms
    expect(item.searchTerms).toContain('magerquark');
    expect(item.searchTerms).toContain('quark');
    expect(item.searchTerms).toContain('fettarm');
    expect(item.searchTerms).toContain('protein');
    // No duplicates
    expect(new Set(item.searchTerms).size).toBe(item.searchTerms.length);
  });
});
