// Contract tests for CosmosFoodProductRepository.
// Runs against the local Azure Cosmos DB Linux Emulator (Docker).
// Never points at real Azure Cosmos DB or the live Open Food Facts API.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FoodProduct } from '@fittrack/shared';

import {
  type EmulatorContext,
  createTestDatabase,
  destroyTestDatabase,
  setupEmulatorEnv,
} from '../../test-utils/cosmosEmulator';
import { __resetCosmosForTests } from '../cosmos';
import { CosmosFoodProductRepository } from './cosmosFoodProductRepository';

let ctx: EmulatorContext | undefined;
let repo: CosmosFoodProductRepository;

beforeAll(async () => {
  const { databaseId } = setupEmulatorEnv();
  ctx = await createTestDatabase(databaseId);
  __resetCosmosForTests();
  repo = new CosmosFoodProductRepository();
});

afterAll(async () => {
  await destroyTestDatabase(ctx);
  __resetCosmosForTests();
});

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function clearFoodProducts(): Promise<void> {
  const container = ctx!.database.container('foodProducts');
  const { resources } = await container.items
    .query<{ id: string }>('SELECT c.id FROM c')
    .fetchAll();
  for (const r of resources) {
    await container.item(r.id, r.id).delete();
  }
}

function makeProduct(overrides: Partial<FoodProduct> & { id: string; name: string }): FoodProduct {
  const normalizedName = overrides.name.toLowerCase();
  const tokens = normalizedName.split(/\s+/).filter((t) => t.length >= 2);
  return {
    source: 'openFoodFacts',
    barcode: overrides.id.replace('openFoodFacts:', ''),
    productType: 'food',
    isEdible: true,
    nutritionBasis: 'per100g',
    nutritionPer100g: { per: '100g', calories: 100, protein: 5, carbs: 10, fat: 3 },
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
    id: overrides.id,
    name: overrides.name,
  };
}

async function seed(products: FoodProduct[]): Promise<void> {
  const container = ctx!.database.container('foodProducts');
  for (const p of products) {
    await container.items.upsert(p);
  }
}

// Test products
const HAFERFLOCKEN = makeProduct({
  id: 'openFoodFacts:test001',
  name: 'Haferflocken',
  normalizedName: 'haferflocken',
  tokens: ['haferflocken'],
  autoKeywords: ['haferflocken', 'hafer', 'oats'],
  searchKeywords: ['haferflocken', 'hafer', 'oats'],
  search: { language: 'de', keywords: ['haferflocken', 'hafer', 'oats'], synonyms: [] },
  sourceQualityScore: 100,
});

const HAFERFLOCKENFEIN = makeProduct({
  id: 'openFoodFacts:test002',
  name: 'Haferflocken fein',
  normalizedName: 'haferflocken fein',
  tokens: ['haferflocken', 'fein'],
  autoKeywords: ['haferflocken', 'fein', 'hafer'],
  searchKeywords: ['haferflocken', 'fein', 'hafer'],
  search: { language: 'de', keywords: ['haferflocken', 'fein', 'hafer'], synonyms: [] },
  sourceQualityScore: 90,
});

const WASSER = makeProduct({
  id: 'openFoodFacts:test003',
  name: 'Mineralwasser',
  normalizedName: 'mineralwasser',
  tokens: ['mineralwasser'],
  autoKeywords: ['mineralwasser', 'wasser'],
  searchKeywords: ['mineralwasser', 'wasser'],
  search: { language: 'de', keywords: ['mineralwasser', 'wasser'], synonyms: [] },
  productType: 'beverage',
  nutritionPer100g: { per: '100g', calories: 0, protein: 0, carbs: 0, fat: 0 },
  sourceQualityScore: 100,
});

const CHICKEN = makeProduct({
  id: 'openFoodFacts:test004',
  name: 'Hähnchenbrust',
  normalizedName: 'hähnchenbrust',
  tokens: ['hähnchenbrust'],
  autoKeywords: ['hähnchenbrust', 'hähnchen', 'chicken'],
  searchKeywords: ['hähnchenbrust', 'hähnchen', 'chicken'],
  search: { language: 'de', keywords: ['hähnchenbrust', 'hähnchen', 'chicken'], synonyms: [] },
  nutritionPer100g: { per: '100g', calories: 120, protein: 24, carbs: 0, fat: 2 },
  sourceQualityScore: 90,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(async () => {
  await clearFoodProducts();
});

describe('CosmosFoodProductRepository (contract)', () => {
  describe('search', () => {
    it('returns empty array for empty catalog', async () => {
      const results = await repo.search('hafer');
      expect(results).toEqual([]);
    });

    it('finds product by normalizedName substring', async () => {
      await seed([HAFERFLOCKEN, CHICKEN]);
      const results = await repo.search('hafer');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((r) => r.id === HAFERFLOCKEN.id)).toBe(true);
    });

    it('finds product by searchKeyword', async () => {
      await seed([HAFERFLOCKEN, WASSER]);
      const results = await repo.search('wasser');
      expect(results.some((r) => r.id === WASSER.id)).toBe(true);
      expect(results.some((r) => r.id === HAFERFLOCKEN.id)).toBe(false);
    });

    it('returns results sorted — exact match comes first (highest rank)', async () => {
      await seed([HAFERFLOCKENFEIN, HAFERFLOCKEN]);
      const results = await repo.search('haferflocken');
      // HAFERFLOCKEN has exact name match (rank 4); HAFERFLOCKENFEIN has prefix (rank 3)
      expect(results[0]!.id).toBe(HAFERFLOCKEN.id);
    });

    it('returns empty array for short query (< 2 chars)', async () => {
      await seed([HAFERFLOCKEN]);
      const results = await repo.search('h');
      expect(results).toEqual([]);
    });

    it('returns empty array when nothing matches', async () => {
      await seed([HAFERFLOCKEN, WASSER]);
      const results = await repo.search('xyznonexistent');
      expect(results).toEqual([]);
    });

    it('maps result to FoodSearchResult shape', async () => {
      await seed([HAFERFLOCKEN]);
      const [result] = await repo.search('haferflocken');
      expect(result).toBeDefined();
      expect(result!.id).toBe(HAFERFLOCKEN.id);
      expect(result!.source).toBe('openFoodFacts');
      expect(result!.isComplete).toBe(true);
      expect(result!.nutritionPer100g).toBeDefined();
      expect(typeof result!.displayLabel).toBe('string');
    });
  });

  describe('getById', () => {
    it('returns null for non-existent id', async () => {
      const result = await repo.getById('openFoodFacts:does-not-exist');
      expect(result).toBeNull();
    });

    it('returns the full FoodProduct document by id', async () => {
      await seed([HAFERFLOCKEN]);
      const product = await repo.getById(HAFERFLOCKEN.id);
      expect(product).not.toBeNull();
      expect(product!.name).toBe('Haferflocken');
      expect(product!.source).toBe('openFoodFacts');
      expect(product!.barcode).toBe('test001');
    });

    it('returns zero-calorie beverage correctly', async () => {
      await seed([WASSER]);
      const product = await repo.getById(WASSER.id);
      expect(product!.nutritionPer100g.calories).toBe(0);
      expect(product!.productType).toBe('beverage');
    });
  });
});
