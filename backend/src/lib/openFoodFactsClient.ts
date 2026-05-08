// Open Food Facts API client.
//
// Uses the public OFF search API (no API key required).
// Results are cached in memory (TTL 10 minutes) to avoid hammering the
// external API on every keystroke and to handle cold-start latency.
//
// Only successful, non-empty results are cached — empty/error responses
// are not stored, so retries are possible without waiting for TTL.

import { randomUUID } from 'node:crypto';
import type { FoodSearchResult, NutritionValues, PortionInfo } from '@fittrack/shared';

// ---------- Internal DTO from OFF API ----------

interface OFFProduct {
  id?: string;
  code?: string;
  product_name?: string;
  product_name_de?: string; // German-language name, preferred when present
  brands?: string;
  nutriments?: {
    'energy-kcal_100g'?: number;
    'proteins_100g'?: number;
    'carbohydrates_100g'?: number;
    'fat_100g'?: number;
    'fiber_100g'?: number;
  };
  serving_size?: string;
  serving_quantity?: number; // grams per serving
  'energy-kcal_serving'?: number;
  'proteins_serving'?: number;
  'carbohydrates_serving'?: number;
  'fat_serving'?: number;
  'fiber_serving'?: number;
}

interface OFFSearchResponse {
  products?: OFFProduct[];
  count?: number;
}

// ---------- Public interface ----------

export interface OpenFoodFactsClient {
  searchProducts(query: string): Promise<FoodSearchResult[]>;
}

// ---------- Normalization helpers ----------

// search.pl — the CGI endpoint the OFF website itself uses; v2/search ignores search_terms.
const OFF_SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const REQUEST_TIMEOUT_MS = 8000;
const MAX_RESULTS = 20;
// Language + country code sent to OFF to rank German products higher.
// Override via OFF_LANG / OFF_CC env vars for other locales.
const OFF_LANG = process.env['OFF_LANG'] ?? 'de';
const OFF_CC = process.env['OFF_CC'] ?? 'de';

interface CacheEntry {
  results: FoodSearchResult[];
  expiresAt: number;
}

function normalizeNutritionPer100g(p: OFFProduct): NutritionValues | undefined {
  const n = p.nutriments;
  if (!n) return undefined;
  const calories = n['energy-kcal_100g'];
  const protein = n['proteins_100g'];
  const carbs = n['carbohydrates_100g'];
  const fat = n['fat_100g'];
  if (calories == null || protein == null || carbs == null || fat == null) return undefined;
  return {
    calories,
    protein,
    carbs,
    fat,
    fiber: n['fiber_100g'],
  };
}

function normalizePortionInfo(p: OFFProduct): PortionInfo | undefined {
  if (!p.serving_size && !p.serving_quantity) return undefined;
  const label = p.serving_size ?? '1 serving';
  const weightGrams = p.serving_quantity ?? undefined;

  // Serving nutrition is sometimes embedded in nutriments with _serving suffix
  const n = p.nutriments as Record<string, number | undefined> | undefined;
  if (!n) return { label, weightGrams };

  const cal = n['energy-kcal_serving'];
  const pro = n['proteins_serving'];
  const carb = n['carbohydrates_serving'];
  const fat = n['fat_serving'];
  if (cal != null && pro != null && carb != null && fat != null) {
    return {
      label,
      weightGrams,
      nutrition: { calories: cal, protein: pro, carbs: carb, fat, fiber: n['fiber_serving'] },
    };
  }
  return { label, weightGrams };
}

function buildDisplayLabel(per100g: NutritionValues | undefined, portion: PortionInfo | undefined): string {
  if (portion?.nutrition) {
    return `${portion.label} · ${Math.round(portion.nutrition.calories)} kcal`;
  }
  if (per100g) {
    return `100g · ${Math.round(per100g.calories)} kcal`;
  }
  return 'No nutrition data';
}

function normalizeProduct(p: OFFProduct): FoodSearchResult | null {
  // Prefer German-specific name when available, fall back to generic product_name.
  const name = (p.product_name_de?.trim() || p.product_name?.trim());
  if (!name) return null;

  const per100g = normalizeNutritionPer100g(p);
  const portion = normalizePortionInfo(p);

  let nutritionBasis: FoodSearchResult['nutritionBasis'];
  if (per100g && portion?.nutrition) nutritionBasis = 'both';
  else if (per100g) nutritionBasis = 'per100g';
  else if (portion?.nutrition) nutritionBasis = 'perPortion';
  else nutritionBasis = 'per100g'; // fallback even if incomplete

  const isComplete = per100g != null || portion?.nutrition != null;

  return {
    id: p.code ?? p.id ?? randomUUID(),
    source: 'openFoodFacts',
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    displayLabel: buildDisplayLabel(per100g, portion),
    nutritionBasis,
    nutritionPer100g: per100g,
    portion,
    isComplete,
    sourceRef: {
      provider: 'openFoodFacts',
      barcode: p.code,
      productId: p.id,
    },
  };
}

// ---------- HTTP implementation ----------

export class HttpOpenFoodFactsClient implements OpenFoodFactsClient {
  private readonly cache = new Map<string, CacheEntry>();

  async searchProducts(query: string): Promise<FoodSearchResult[]> {
    const cacheKey = query.toLowerCase().trim();

    // Return cached result if still fresh
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.results;
    }

    const url = new URL(OFF_SEARCH_URL);
    url.searchParams.set('search_terms', query);
    url.searchParams.set('action', 'process');
    url.searchParams.set('json', '1');
    url.searchParams.set('page_size', String(MAX_RESULTS));
    url.searchParams.set('lc', OFF_LANG);
    url.searchParams.set('cc', OFF_CC);
    url.searchParams.set(
      'fields',
      'code,product_name,product_name_de,brands,nutriments,serving_size,serving_quantity',
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let data: OFFSearchResponse;
    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { 'User-Agent': 'FitTrack/1.0 (https://github.com/MMueller86/fittrack-app)' },
      });
      if (!response.ok) {
        throw new Error(`OFF responded with status ${response.status}`);
      }
      data = (await response.json()) as OFFSearchResponse;
    } finally {
      clearTimeout(timeoutId);
    }

    const results = (data.products ?? [])
      .map(normalizeProduct)
      .filter((r): r is FoodSearchResult => r !== null)
      .slice(0, MAX_RESULTS);

    // Only cache non-empty results to allow retries on no-result queries
    if (results.length > 0) {
      this.cache.set(cacheKey, { results, expiresAt: Date.now() + CACHE_TTL_MS });
    }

    return results;
  }
}

// ---------- Mock implementation (for tests) ----------

export class MockOpenFoodFactsClient implements OpenFoodFactsClient {
  private readonly fixtures: FoodSearchResult[];

  constructor(fixtures: FoodSearchResult[] = []) {
    this.fixtures = fixtures;
  }

  async searchProducts(query: string): Promise<FoodSearchResult[]> {
    const q = query.toLowerCase();
    return this.fixtures.filter((f) => f.name.toLowerCase().includes(q));
  }
}

// ---------- Singleton ----------

let instance: OpenFoodFactsClient | undefined;

export function getOpenFoodFactsClient(): OpenFoodFactsClient {
  if (!instance) {
    instance = new HttpOpenFoodFactsClient();
  }
  return instance;
}

/** For testing only — replace the singleton with a mock. */
export function __setOpenFoodFactsClientForTests(client: OpenFoodFactsClient): void {
  instance = client;
}

export function __resetOpenFoodFactsClientForTests(): void {
  instance = undefined;
}
