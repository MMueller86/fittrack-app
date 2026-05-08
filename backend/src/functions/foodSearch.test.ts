import { describe, it, expect, beforeEach, vi } from 'vitest';

// Set up mocks before imports so vi.mock hoisting works
vi.mock('../lib/repositories/reusableItemsRepository');
vi.mock('../lib/repositories/foodProductRepository');
vi.mock('../lib/auth', () => ({
  requireUser: () => ({ userId: 'test-user' }),
}));

import { foodSearchHandler } from './foodSearch';
import type { FoodSearchResult, ReusableItem } from '@fittrack/shared';
import { getReusableItemsRepository } from '../lib/repositories/reusableItemsRepository';
import { getFoodProductRepository } from '../lib/repositories/foodProductRepository';

// Helper: build a minimal InvocationContext mock
function makeCtx() {
  return { log: () => {} } as never;
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
    mockCatalogRepo.search.mockResolvedValue([CATALOG_APPLE]);

    const res = await foodSearchHandler(makeRequest('oa'), makeCtx());
    expect(res.status).toBe(200);
    const body = res.jsonBody as { results: FoodSearchResult[] };
    expect(body.results).toHaveLength(2);
  });

  it('puts library items before catalog results', async () => {
    mockLibRepo.search.mockResolvedValue([LIBRARY_ITEM]);
    mockCatalogRepo.search.mockResolvedValue([CATALOG_APPLE]);

    const res = await foodSearchHandler(makeRequest('oa'), makeCtx());
    const body = res.jsonBody as { results: FoodSearchResult[] };
    expect(body.results[0]!.source).toBe('library');
    expect(body.results[1]!.source).toBe('openFoodFacts');
  });

  it('deduplicates catalog results whose name matches a library item (case-insensitive)', async () => {
    mockLibRepo.search.mockResolvedValue([LIBRARY_ITEM]);
    mockCatalogRepo.search.mockResolvedValue([CATALOG_OATS_DUPLICATE, CATALOG_APPLE]);

    const res = await foodSearchHandler(makeRequest('oa'), makeCtx());
    const body = res.jsonBody as { results: FoodSearchResult[] };
    // CATALOG_OATS_DUPLICATE (name='Oats') should be removed; only lib + CATALOG_APPLE remain
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

    const res = await foodSearchHandler(makeRequest('ap'), makeCtx());
    expect(res.status).toBe(200);
    const body = res.jsonBody as { results: FoodSearchResult[] };
    expect(body.results).toHaveLength(1);
    expect(body.results[0]!.id).toBe('openFoodFacts:001');
  });
});
