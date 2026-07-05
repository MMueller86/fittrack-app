import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Stub Cosmos so this file runs without a DB connection
vi.mock('./cosmosFoodProductRepository', () => ({
  CosmosFoodProductRepository: class {
    async search() { return []; }
    async getById() { return null; }
  },
}));

import {
  getFoodProductRepository,
  _resetFoodProductRepository,
  _setFoodProductRepository,
  rankProduct,
  rankAndSort,
  foodProductToSearchResult,
  IN_MEMORY_SEED,
} from './foodProductRepository';
import type { FoodProduct } from '@fittrack/shared';

// ---------------------------------------------------------------------------
// Minimal FoodProduct factory for tests
// ---------------------------------------------------------------------------

function makeProduct(overrides: Partial<FoodProduct> & { id: string; name: string }): FoodProduct {
  const normalizedName = overrides.name.toLowerCase();
  const tokens = normalizedName.split(/\s+/).filter((t) => t.length >= 2);
  return {
    id: overrides.id,
    source: 'openFoodFacts',
    barcode: overrides.id.replace('openFoodFacts:', ''),
    name: overrides.name,
    productType: 'food',
    isEdible: true,
    nutritionBasis: 'per100g',
    nutritionPer100g: {
      per: '100g',
      calories: 100,
      protein: 5,
      carbs: 10,
      fat: 3,
    },
    normalizedName,
    tokens,
    autoKeywords: tokens,
    manualKeywords: [],
    negativeKeywords: [],
    searchKeywords: tokens,
    search: { language: 'de', keywords: tokens, synonyms: [] },
    sourceQualityScore: 80,
    sourceRef: { provider: 'openFoodFacts', barcode: overrides.id.replace('openFoodFacts:', '') },
    meta: {
      source: 'openFoodFacts',
      confidence: 0.8,
      lastUpdated: '2026-05-05T00:00:00.000Z',
      tokens,
      autoKeywords: tokens,
    },
    lastImportedAt: '2026-05-05T00:00:00.000Z',
    ...overrides,
  };
}

const OATS = makeProduct({ id: 'openFoodFacts:001', name: 'Haferflocken' });
const CHICKEN = makeProduct({ id: 'openFoodFacts:002', name: 'Hähnchenbrust' });
const WATER = makeProduct({
  id: 'openFoodFacts:003',
  name: 'Mineralwasser',
  productType: 'beverage',
  normalizedName: 'mineralwasser',
  tokens: ['mineralwasser'],
  autoKeywords: ['mineralwasser', 'wasser'],
  searchKeywords: ['mineralwasser', 'wasser'],
  search: { language: 'de', keywords: ['mineralwasser', 'wasser'], synonyms: [] },
  nutritionPer100g: { per: '100g', calories: 0, protein: 0, carbs: 0, fat: 0 },
  sourceQualityScore: 100,
});
const HIGH_QUALITY_OATS = makeProduct({
  id: 'openFoodFacts:004',
  name: 'Haferflocken kernig',
  searchKeywords: ['haferflocken', 'kernig', 'hafer'],
  sourceQualityScore: 100,
});

// ---------------------------------------------------------------------------
// Factory selection
// ---------------------------------------------------------------------------

const originalEnv = { ...process.env };

beforeEach(() => {
  _resetFoodProductRepository();
  delete process.env.COSMOS_ENDPOINT;
  delete process.env.COSMOS_KEY;
  // Clear seed
  IN_MEMORY_SEED.length = 0;
});

afterEach(() => {
  process.env = { ...originalEnv };
  _resetFoodProductRepository();
  IN_MEMORY_SEED.length = 0;
});

describe('getFoodProductRepository (factory)', () => {
  it('returns in-memory repo when Cosmos is not configured', () => {
    expect(getFoodProductRepository().constructor.name).toBe('InMemoryFoodProductRepository');
  });

  it('returns Cosmos repo when both env vars are set', () => {
    process.env.COSMOS_ENDPOINT = 'https://example.documents.azure.com:443/';
    process.env.COSMOS_KEY = 'fake-key';
    expect(getFoodProductRepository().constructor.name).toBe('CosmosFoodProductRepository');
  });

  it('caches the instance', () => {
    const a = getFoodProductRepository();
    const b = getFoodProductRepository();
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// rankProduct
// ---------------------------------------------------------------------------

describe('rankProduct', () => {
  it('gives rank 4 for exact normalizedName match', () => {
    expect(rankProduct(OATS, 'haferflocken')).toBe(4);
  });

  it('gives rank 3 for prefix match on normalizedName', () => {
    expect(rankProduct(HIGH_QUALITY_OATS, 'haferflocken')).toBe(3);
  });

  it('gives rank 3 for word-boundary match when token is also in searchKeywords (auto-generated from name)', () => {
    // makeProduct auto-adds name tokens to searchKeywords, so 'haferflocken' ends up in both
    // the normalizedName ("bio haferflocken fein") AND searchKeywords.
    // searchKeywords.includes(token) now takes precedence over word-boundary, giving score 3.
    // Pure word-boundary (2.5) only applies when the token is in the name but NOT in searchKeywords.
    const product = makeProduct({ id: 'x', name: 'Bio Haferflocken fein', normalizedName: 'bio haferflocken fein' });
    expect(rankProduct(product, 'haferflocken')).toBe(3);
  });

  it('gives rank 3 for exact keyword match (same tier as name-prefix)', () => {
    const product = makeProduct({
      id: 'x',
      name: 'Protein Shake',
      normalizedName: 'protein shake',
      searchKeywords: ['protein', 'shake', 'hafer'],
    });
    expect(rankProduct(product, 'hafer')).toBe(3);
  });

  it('gives rank 2 for keyword substring match via normalizedName', () => {
    // 'mineralwasser' starts with 'mineral' → rank 3 (prefix), not rank 2
    // Use a mid-word query to exercise substring (rank 2): 'wasser' → 'mineralwasser' contains but does not start with 'asser'
    expect(rankProduct(WATER, 'asser')).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// rankAndSort
// ---------------------------------------------------------------------------

describe('rankAndSort', () => {
  it('returns exact match first', () => {
    const products = [HIGH_QUALITY_OATS, OATS];
    const sorted = rankAndSort(products, 'haferflocken', 10);
    expect(sorted[0]!.id).toBe(OATS.id);         // rank 4 (exact)
    expect(sorted[1]!.id).toBe(HIGH_QUALITY_OATS.id); // rank 3 (prefix)
  });

  it('uses sourceQualityScore as tiebreaker for same rank', () => {
    const low  = makeProduct({ id: 'low',  name: 'haferflocken', sourceQualityScore: 60 });
    const high = makeProduct({ id: 'high', name: 'haferflocken', sourceQualityScore: 100 });
    const sorted = rankAndSort([low, high], 'haferflocken', 10);
    expect(sorted[0]!.id).toBe('high');
  });

  it('respects the limit', () => {
    const products = [OATS, HIGH_QUALITY_OATS, WATER, CHICKEN];
    const sorted = rankAndSort(products, 'hafer', 2);
    expect(sorted.length).toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// InMemoryFoodProductRepository — search
// ---------------------------------------------------------------------------

describe('InMemoryFoodProductRepository.search', () => {
  beforeEach(() => {
    IN_MEMORY_SEED.push(OATS, HIGH_QUALITY_OATS, WATER, CHICKEN);
  });

  it('returns empty array for query shorter than 2 chars', async () => {
    const repo = getFoodProductRepository();
    expect(await repo.search('a')).toEqual([]);
  });

  it('finds products by normalizedName substring', async () => {
    const repo = getFoodProductRepository();
    const results = await repo.search('hafer');
    expect(results.length).toBe(2);
    expect(results.every((r) => r.name.toLowerCase().includes('hafer'))).toBe(true);
  });

  it('finds products by searchKeyword', async () => {
    const repo = getFoodProductRepository();
    const results = await repo.search('wasser');
    expect(results.length).toBe(1);
    expect(results[0]!.id).toBe(WATER.id);
  });

  it('returns exact match first', async () => {
    const repo = getFoodProductRepository();
    const results = await repo.search('haferflocken');
    // OATS has exact normalizedName match (rank 4); HIGH_QUALITY_OATS has prefix (rank 3)
    expect(results[0]!.id).toBe(OATS.id);
  });

  it('returns empty array when nothing matches', async () => {
    const repo = getFoodProductRepository();
    const results = await repo.search('xyznonexistent');
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// InMemoryFoodProductRepository — getById
// ---------------------------------------------------------------------------

describe('InMemoryFoodProductRepository.getById', () => {
  beforeEach(() => {
    IN_MEMORY_SEED.push(OATS, WATER);
  });

  it('returns the product when found', async () => {
    const repo = getFoodProductRepository();
    const product = await repo.getById(OATS.id);
    expect(product?.name).toBe('Haferflocken');
  });

  it('returns null when not found', async () => {
    const repo = getFoodProductRepository();
    const product = await repo.getById('openFoodFacts:does-not-exist');
    expect(product).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// foodProductToSearchResult — mapping
// ---------------------------------------------------------------------------

describe('foodProductToSearchResult', () => {
  it('maps basic product to FoodSearchResult correctly', () => {
    const result = foodProductToSearchResult(OATS);
    expect(result.id).toBe(OATS.id);
    expect(result.source).toBe('openFoodFacts');
    expect(result.name).toBe('Haferflocken');
    expect(result.displayLabel).toBe('100g · 100 kcal');
    expect(result.nutritionBasis).toBe('per100g');
    expect(result.isComplete).toBe(true);
    expect(result.sourceRef?.provider).toBe('openFoodFacts');
  });

  it('includes portion info when product has both', () => {
    const productWithPortion = makeProduct({
      id: 'openFoodFacts:005',
      name: 'Müsli',
      nutritionBasis: 'both',
      portion: { label: '1 Portion (50g)', weightGrams: 50 },
      nutritionPer100g: { per: '100g', calories: 400, protein: 10, carbs: 60, fat: 8 },
    });
    const result = foodProductToSearchResult(productWithPortion);
    expect(result.portion).toBeDefined();
    // weightGrams must be forwarded so the mobile toggle is shown
    expect(result.portion?.weightGrams).toBe(50);
    expect(result.portion?.nutrition?.calories).toBe(200);  // 400 * 50 / 100 = 200
    expect(result.portion?.nutrition?.protein).toBe(5);     // 10 * 50 / 100 = 5
  });

  it('maps product with 0 calories (water)', () => {
    const result = foodProductToSearchResult(WATER);
    expect(result.displayLabel).toBe('100g · 0 kcal');
    expect(result.nutritionPer100g?.calories).toBe(0);
  });
});
