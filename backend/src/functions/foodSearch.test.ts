import { describe, it, expect, beforeEach, vi } from 'vitest';

// Set up mocks before imports so vi.mock hoisting works
vi.mock('../lib/repositories/reusableItemsRepository');
vi.mock('../lib/repositories/foodProductRepository');
vi.mock('../lib/repositories/userFoodRelationRepository', () => ({
  getUserFoodRelationRepository: () => ({
    listFavorites: async () => [],
  }),
}));
vi.mock('../lib/auth', () => ({
  requireUser: async () => ({ userId: 'test-user', tier: 'free' }),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));

import { foodSearchHandler } from './foodSearch';
import type { FoodSearchResult, ReusableItem } from '@fittrack/shared';
import { getReusableItemsRepository } from '../lib/repositories/reusableItemsRepository';
import { getFoodProductRepository } from '../lib/repositories/foodProductRepository';

// Helper: build a minimal InvocationContext mock
function makeCtx() {
  return { log: () => {}, error: () => {}, warn: () => {}, info: () => {}, debug: () => {}, trace: () => {}, verbose: () => {} } as never;
}

// Helper: build a GET request mock
function makeRequest(query: string) {
  return {
    query: { get: (k: string) => (k === 'query' ? query : null) },
    params: {},
  } as never;
}

// Test data
const LIBRARY_ITEM: ReusableItem = {
  id: 'lib-1',
  userId: 'test-user',
  name: 'Oats',
  nutritionBasis: 'perPortion',
  portion: { label: '1 serving', nutrition: { calories: 300, protein: 10, carbs: 55, fat: 5, fiber: 4 } },
  isComplete: true,
  sourceType: 'manual',
  usageCount: 5,
  createdAt: '2026-01-01T00:00:00Z',
};

const CATALOG_APPLE: FoodSearchResult = {
  id: 'openFoodFacts:001',
  source: 'openFoodFacts',
  name: 'Apple',
  displayLabel: '100g · 52 kcal',
  nutritionBasis: 'per100g',
  nutritionPer100g: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4 },
  isComplete: true,
  sourceRef: { provider: 'openFoodFacts', barcode: '001' },
};

// A catalog item that matches the query 'oa' / 'oats' — used in combined-result tests
const CATALOG_OATMEAL: FoodSearchResult = {
  id: 'openFoodFacts:003',
  source: 'openFoodFacts',
  name: 'Oatmeal',
  displayLabel: '100g · 372 kcal',
  nutritionBasis: 'per100g',
  nutritionPer100g: { calories: 372, protein: 13, carbs: 65, fat: 7, fiber: 10 },
  isComplete: true,
  sourceRef: { provider: 'openFoodFacts', barcode: '003' },
};

const CATALOG_OATS_DUPLICATE: FoodSearchResult = {
  id: 'openFoodFacts:002',
  source: 'openFoodFacts',
  name: 'Oats',        // Same name as library item → should be deduplicated
  displayLabel: '100g · 370 kcal',
  nutritionBasis: 'per100g',
  nutritionPer100g: { calories: 370, protein: 13, carbs: 66, fat: 6.5, fiber: 10 },
  isComplete: true,
  sourceRef: { provider: 'openFoodFacts', barcode: '002' },
};

// Regression test data: user-created item via label scan vs. catalog exact-name match.
// Query "marmelade" → library item name contains "Marmelade" as a word (word-boundary),
// and "marmelade" is in searchTerms. Catalog item name is exactly "Marmelade".
// After fix: library item must rank first (score 3 + LIBRARY_BONUS > catalog score 4).
const LIBRARY_ITEM_MARMELADE: ReusableItem = {
  id: 'lib-marmelade',
  userId: 'test-user',
  name: 'Erdbeer Marmelade Weniger Zucker',
  nutritionBasis: 'per100g',
  nutritionPer100g: { calories: 140, protein: 0.5, carbs: 34, fat: 0.1, fiber: 0.8 },
  searchTerms: ['erdbeer', 'marmelade', 'weniger', 'zucker'],
  isComplete: true,
  sourceType: 'label-scan',
  usageCount: 0,
  createdAt: '2026-07-01T00:00:00Z',
};

const CATALOG_MARMELADE_EXACT: FoodSearchResult = {
  id: 'openFoodFacts:marmelade-001',
  source: 'openFoodFacts',
  name: 'Marmelade',
  displayLabel: '100g · 250 kcal',
  nutritionBasis: 'per100g',
  nutritionPer100g: { calories: 250, protein: 0.4, carbs: 62, fat: 0.1, fiber: 0.5 },
  isComplete: true,
  sourceRef: { provider: 'openFoodFacts', barcode: 'marmelade-001' },
};

let mockLibRepo: { search: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
let mockCatalogRepo: { search: ReturnType<typeof vi.fn>; getById: ReturnType<typeof vi.fn> };

beforeEach(() => {
  mockLibRepo     = { search: vi.fn().mockResolvedValue([]), create: vi.fn() };
  mockCatalogRepo = { search: vi.fn().mockResolvedValue([]), getById: vi.fn().mockResolvedValue(null) };

  vi.mocked(getReusableItemsRepository).mockReturnValue(mockLibRepo);
  vi.mocked(getFoodProductRepository).mockReturnValue(mockCatalogRepo);
});

describe('foodSearchHandler', () => {
  it('returns 200 with combined results', async () => {
    mockLibRepo.search.mockResolvedValue([LIBRARY_ITEM]);
    mockCatalogRepo.search.mockResolvedValue([CATALOG_OATMEAL]);

    const res = await foodSearchHandler(makeRequest('oa'), makeCtx());
    expect(res.status).toBe(200);
    const body = res.jsonBody as { results: FoodSearchResult[] };
    expect(body.results).toHaveLength(2);
  });

  it('puts library items before catalog results when library ranks higher', async () => {
    mockLibRepo.search.mockResolvedValue([LIBRARY_ITEM]);
    mockCatalogRepo.search.mockResolvedValue([CATALOG_OATMEAL]);

    const res = await foodSearchHandler(makeRequest('oa'), makeCtx());
    const body = res.jsonBody as { results: FoodSearchResult[] };
    expect(body.results[0]!.source).toBe('library');
    expect(body.results[1]!.source).toBe('openFoodFacts');
  });

  it('deduplicates catalog results whose name matches a library item (case-insensitive)', async () => {
    mockLibRepo.search.mockResolvedValue([LIBRARY_ITEM]);
    mockCatalogRepo.search.mockResolvedValue([CATALOG_OATS_DUPLICATE, CATALOG_OATMEAL]);

    const res = await foodSearchHandler(makeRequest('oa'), makeCtx());
    const body = res.jsonBody as { results: FoodSearchResult[] };
    // CATALOG_OATS_DUPLICATE (name='Oats') should be removed; only lib + CATALOG_OATMEAL remain
    expect(body.results).toHaveLength(2);
    expect(body.results.find((r) => r.id === 'openFoodFacts:002')).toBeUndefined();
  });

  it('returns empty results for empty query without calling catalog', async () => {
    mockLibRepo.search.mockResolvedValue([]);

    const res = await foodSearchHandler(makeRequest(''), makeCtx());
    expect(res.status).toBe(200);
    const body = res.jsonBody as { results: FoodSearchResult[] };
    expect(body.results).toHaveLength(0);
    expect(mockCatalogRepo.search).not.toHaveBeenCalled();
  });

  it('does not call catalog for single-character query', async () => {
    mockLibRepo.search.mockResolvedValue([]);

    await foodSearchHandler(makeRequest('a'), makeCtx());
    expect(mockCatalogRepo.search).not.toHaveBeenCalled();
  });

  it('calls catalog for query with 2+ characters', async () => {
    mockLibRepo.search.mockResolvedValue([]);
    mockCatalogRepo.search.mockResolvedValue([]);

    await foodSearchHandler(makeRequest('ap'), makeCtx());
    expect(mockCatalogRepo.search).toHaveBeenCalledWith('ap');
  });

  it('still returns library results if catalog search fails', async () => {
    mockLibRepo.search.mockResolvedValue([LIBRARY_ITEM]);
    mockCatalogRepo.search.mockRejectedValue(new Error('Cosmos error'));

    const res = await foodSearchHandler(makeRequest('oats'), makeCtx());
    expect(res.status).toBe(200);
    const body = res.jsonBody as { results: FoodSearchResult[] };
    expect(body.results).toHaveLength(1);
    expect(body.results[0]!.id).toBe('lib-1');
  });

  it('still returns catalog results if library search fails', async () => {
    mockLibRepo.search.mockRejectedValue(new Error('Cosmos error'));
    mockCatalogRepo.search.mockResolvedValue([CATALOG_APPLE]);

    const res = await foodSearchHandler(makeRequest('apple'), makeCtx());
    expect(res.status).toBe(200);
    const body = res.jsonBody as { results: FoodSearchResult[] };
    expect(body.results).toHaveLength(1);
    expect(body.results[0]!.id).toBe('openFoodFacts:001');
  });

  // ── Regression: user-created item must rank before catalog exact-name match ──
  // Reproduces the bug: searching "marmelade" returned catalog "Marmelade" (exact-name
  // score 4) before the user's own "Erdbeer Marmelade Weniger Zucker" (word-boundary
  // score 2.5 + LIBRARY_BONUS 0.5 = 3.0 < 4.0).
  // After fix: searchTerm-exact match gives score 3, LIBRARY_BONUS raised to 1.5 → 4.5 > 4.0.
  it('ranks user library item above catalog exact-name match for single-word query', async () => {
    mockLibRepo.search.mockResolvedValue([LIBRARY_ITEM_MARMELADE]);
    mockCatalogRepo.search.mockResolvedValue([CATALOG_MARMELADE_EXACT]);

    const res = await foodSearchHandler(makeRequest('marmelade'), makeCtx());
    expect(res.status).toBe(200);
    const body = res.jsonBody as { results: FoodSearchResult[] };
    expect(body.results).toHaveLength(2);
    expect(body.results[0]!.id).toBe('lib-marmelade');    // library item first
    expect(body.results[1]!.id).toBe('openFoodFacts:marmelade-001'); // catalog second
  });
});
