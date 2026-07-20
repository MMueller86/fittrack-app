// FoodProduct repository abstraction.
//
// Provides a storage-agnostic interface for the internal food product catalog.
// Follows the same factory pattern as diaryRepository / reusableItemsRepository.
//
// Selection rule:
//   - If COSMOS_ENDPOINT and COSMOS_KEY are set → CosmosFoodProductRepository
//   - Otherwise → InMemoryFoodProductRepository (useful for local dev + unit tests)

import type { FoodProduct, FoodSearchResult } from '@fittrack/shared';
import { isCosmosConfigured } from '../cosmos';
import { CosmosFoodProductRepository } from './cosmosFoodProductRepository';
import { rankByQuery } from '../searchRanking';
export { rankByQuery } from '../searchRanking';

// ---------------------------------------------------------------------------
// Repository interface
// ---------------------------------------------------------------------------

export interface FoodProductRepository {
  /**
   * Full-text search across normalizedName + searchKeywords.
   * Returns up to `limit` results ranked by relevance, then sourceQualityScore.
   * Query is normalized (lowercase, trimmed) before matching.
   */
  search(q: string, limit?: number): Promise<FoodSearchResult[]>;

  /**
   * Point read by product id (e.g. "openFoodFacts:0011110674258").
   * Returns null if not found.
   */
  getById(id: string): Promise<FoodProduct | null>;
}

// ---------------------------------------------------------------------------
// Result mapper — converts a FoodProduct document to the unified FoodSearchResult shape
// ---------------------------------------------------------------------------

export function foodProductToSearchResult(p: FoodProduct): FoodSearchResult {
  let displayLabel: string;
  if (p.nutritionBasis === 'both' && p.portion) {
    displayLabel = `${p.portion.label} · ${Math.round(p.nutritionPer100g.calories)} kcal/100g`;
  } else {
    displayLabel = `100g · ${Math.round(p.nutritionPer100g.calories)} kcal`;
  }
  return {
    id: p.id,
    source: 'openFoodFacts',
    name: p.name,
    brand: p.brand,
    displayLabel,
    nutritionBasis: p.nutritionBasis,
    nutritionPer100g: {
      calories: p.nutritionPer100g.calories,
      protein: p.nutritionPer100g.protein,
      carbs: p.nutritionPer100g.carbs,
      fat: p.nutritionPer100g.fat,
      fiber: p.nutritionPer100g.fiber,
    },
    portion: p.portion
      ? {
          label: p.portion.label,
          weightGrams: p.portion.weightGrams,
          nutrition: {
            calories: Math.round((p.nutritionPer100g.calories * p.portion.weightGrams) / 100 * 10) / 10,
            protein:  Math.round((p.nutritionPer100g.protein  * p.portion.weightGrams) / 100 * 10) / 10,
            carbs:    Math.round((p.nutritionPer100g.carbs    * p.portion.weightGrams) / 100 * 10) / 10,
            fat:      Math.round((p.nutritionPer100g.fat      * p.portion.weightGrams) / 100 * 10) / 10,
            fiber:    Math.round(((p.nutritionPer100g.fiber ?? 0) * p.portion.weightGrams) / 100 * 10) / 10,
          },
        }
      : undefined,
    isComplete: true,
    sourceRef: { provider: 'openFoodFacts', barcode: p.barcode },
    ...(p.category ? { category: p.category } : {}),
    ...(p.imageUrl ? { imageUrl: p.imageUrl } : {}),
  };
}

// ---------------------------------------------------------------------------
// Search ranking — applied in JS after Cosmos/in-memory retrieval
// ---------------------------------------------------------------------------

/**
 * Generic ranking function — re-exported from searchRanking for backward compatibility.
 * See searchRanking.ts for the full implementation.
 */
export type RankScore = number;

/**
 * Returns a rank score for a FoodProduct against a query.
 * Delegates to rankByQuery using normalizedName + searchKeywords.
 */
export function rankProduct(p: FoodProduct, normalizedQuery: string): RankScore {
  return rankByQuery(p.normalizedName, p.searchKeywords, normalizedQuery, p.brand);
}

/**
 * Sorts products by rank (desc) then sourceQualityScore (desc).
 * Products with rank 0 that don't contain the query at all are excluded.
 */
export function rankAndSort(
  products: FoodProduct[],
  normalizedQuery: string,
  limit: number,
): FoodProduct[] {
  return products
    .map((p) => ({ p, rank: rankProduct(p, normalizedQuery) }))
    .sort((a, b) =>
      b.rank !== a.rank
        ? b.rank - a.rank
        : b.p.sourceQualityScore - a.p.sourceQualityScore,
    )
    .slice(0, limit)
    .map(({ p }) => p);
}

// ---------------------------------------------------------------------------
// In-memory implementation (used when Cosmos is not configured)
// ---------------------------------------------------------------------------

/** Seed this for local dev or unit tests */
export const IN_MEMORY_SEED: FoodProduct[] = [];

class InMemoryFoodProductRepository implements FoodProductRepository {
  private readonly products: FoodProduct[];

  constructor(seed: FoodProduct[] = IN_MEMORY_SEED) {
    this.products = seed;
  }

  async search(q: string, limit = 20): Promise<FoodSearchResult[]> {
    const nq = q.toLowerCase().trim();
    if (nq.length < 2) return [];

    const candidates = this.products.filter(
      (p) =>
        p.normalizedName.includes(nq) ||
        p.searchKeywords.some((k) => k.includes(nq)),
    );

    return rankAndSort(candidates, nq, limit).map(foodProductToSearchResult);
  }

  async getById(id: string): Promise<FoodProduct | null> {
    return this.products.find((p) => p.id === id) ?? null;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let _instance: FoodProductRepository | undefined;

export function getFoodProductRepository(): FoodProductRepository {
  if (!_instance) {
    _instance = isCosmosConfigured()
      ? new CosmosFoodProductRepository()
      : new InMemoryFoodProductRepository();
  }
  return _instance;
}

/** Test-only: reset the singleton so tests can inject a fresh instance. */
export function _resetFoodProductRepository(): void {
  _instance = undefined;
}

/** Test-only: inject a specific implementation. */
export function _setFoodProductRepository(repo: FoodProductRepository): void {
  _instance = repo;
}
