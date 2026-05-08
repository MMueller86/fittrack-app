// FoodProduct — canonical type for the internal food product catalog.
//
// Sourced from the Open Food Facts export pipeline (tools/off-import/).
// Stored in Cosmos DB container: foodProducts (partition key: /id).
//
// Design decisions:
//   - id = "openFoodFacts:<barcode>" — stable, human-readable, collision-free across providers
//   - nutritionPer100g.per = '100g' — explicit basis marker so consumers never need to guess
//   - searchKeywords = deduped union of autoKeywords — flat array for ARRAY_CONTAINS queries
//   - manualKeywords / negativeKeywords preserved across re-imports (must not be overwritten)
//   - qualityFlags — informational only; never blocks export or search

export interface FoodProductNutritionPer100g {
  per: '100g';
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  salt?: number;
}

export type FoodProductType = 'food' | 'beverage' | 'supplement' | 'unknown';

export interface FoodProduct {
  /** "openFoodFacts:<barcode>" — Cosmos document id and partition key */
  id: string;
  source: 'openFoodFacts';
  barcode: string;
  name: string;
  brand?: string;
  /** Raw quantity string from OFF, e.g. "400g" or "6x100ml" */
  quantity?: string;

  productType: FoodProductType;
  isEdible: boolean;

  nutritionBasis: 'per100g' | 'both';
  nutritionPer100g: FoodProductNutritionPer100g;
  portion?: {
    /** Display-only label — NEVER parse at runtime */
    label: string;
    /** Always in grams (ml treated as g for liquids) */
    weightGrams: number;
  };

  // --- Search fields (flat arrays for Cosmos ARRAY_CONTAINS queries) ---
  normalizedName: string;
  tokens: string[];
  /** Generated at import time; re-generated on re-import */
  autoKeywords: string[];
  /** Set manually; MUST be preserved across re-imports */
  manualKeywords: string[];
  /** Set manually; MUST be preserved across re-imports */
  negativeKeywords: string[];
  /** autoKeywords ∪ manualKeywords — used for ARRAY_CONTAINS search */
  searchKeywords: string[];

  /** Structured search block — mirrors searchKeywords; synonyms reserved for future use */
  search: {
    language: 'de';
    keywords: string[];
    synonyms: string[];
  };

  /** Optional quality flags — informational, never blocks export or import */
  qualityFlags?: string[];

  /** 60–100 based on data completeness; reduced by qualityFlags penalties */
  sourceQualityScore: number;

  sourceRef: {
    provider: 'openFoodFacts';
    barcode: string;
  };

  meta: {
    source: 'openFoodFacts';
    /** sourceQualityScore / 100 */
    confidence: number;
    /** ISO timestamp of last import run */
    lastUpdated: string;
    tokens: string[];
    autoKeywords: string[];
  };

  /** ISO timestamp of last import run */
  lastImportedAt: string;
}
