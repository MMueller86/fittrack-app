/**
 * export-food-products.ts
 *
 * Exports clean German food products from the local OFF MongoDB dump.
 * Applies MongoDB-side pre-filters, JS-side plausibility checks,
 * name normalization, tokenization, and keyword enrichment.
 *
 * Output: tools/off-import/output/food-products.sample.json
 *
 * Usage:
 *   npm run export:off                    # export all matching products
 *   npm run export:off -- --limit=1000    # sample of 1000
 */

import { MongoClient, type Document } from 'mongodb';
import { createWriteStream, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MONGO_URI = process.env['MONGO_URI'] ?? 'mongodb://localhost:27017';
const KJ_TO_KCAL = 1 / 4.184;

const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]!, 10) : Infinity;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUTPUT_DIR = resolve(__dirname, 'output');
const OUTPUT_FILE = resolve(OUTPUT_DIR, 'food-products.sample.json');

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

interface NutritionPer100g {
  per: '100g';                       // explicit basis marker — never confuse with per-portion
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  salt?: number;
}

type ProductType = 'food' | 'beverage' | 'supplement' | 'unknown';

interface FoodProduct {
  id: string;                        // "openFoodFacts:<barcode>"
  source: 'openFoodFacts';
  barcode: string;
  name: string;
  brand?: string;
  quantity?: string;                 // e.g. "400g", "6x100ml"

  productType: ProductType;
  isEdible: boolean;

  nutritionBasis: 'per100g' | 'both';
  nutritionPer100g: NutritionPer100g;
  portion?: {
    label: string;                   // display-only, NEVER parse at runtime
    weightGrams: number;             // always numeric grams; ml treated as g for liquids
  };

  // Search fields (flat — for Cosmos DB ARRAY_CONTAINS queries)
  normalizedName: string;
  tokens: string[];
  autoKeywords: string[];
  manualKeywords: string[];
  negativeKeywords: string[];
  searchKeywords: string[];

  // Structured search metadata
  search: {
    language: 'de';
    keywords: string[];              // mirrors searchKeywords
    synonyms: string[];              // reserved for future use
  };

  qualityFlags?: string[];           // e.g. ["suspiciousNutrition", "lowSearchQuality"]

  sourceQualityScore: number;        // 60–100

  /** PNNS pnns_groups_2 category from OFF, if available */
  category?: string;

  sourceRef: {
    provider: 'openFoodFacts';
    barcode: string;
  };

  /** Front image URL from Open Food Facts (image_front_url), if available */
  imageUrl?: string;

  // Debug / pipeline metadata
  meta: {
    source: 'openFoodFacts';
    confidence: number;              // sourceQualityScore / 100
    lastUpdated: string;             // ISO timestamp
    tokens: string[];                // mirrors tokens
    autoKeywords: string[];          // mirrors autoKeywords
  };

  lastImportedAt: string;            // ISO timestamp
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

interface Stats {
  scanned: number;
  exported: number;
  rejected: Record<string, number>;
  productTypeCounts: Record<ProductType, number>;
  flaggedCount: number;
  removedNoisyKeywords: Map<string, number>;
  examples: {
    food: FoodProduct[];
    beverage: FoodProduct[];
    supplement: FoodProduct[];
    flagged: FoodProduct[];
  };
}

function addRejection(stats: Stats, reason: string): null {
  stats.rejected[reason] = (stats.rejected[reason] ?? 0) + 1;
  return null;
}

// ---------------------------------------------------------------------------
// Nutrition helpers
// ---------------------------------------------------------------------------

function getNum(obj: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === 'number' && Number.isFinite(val)) return val;
    if (typeof val === 'string') {
      const n = parseFloat(val);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

function extractNutrition(doc: Document): NutritionPer100g | null {
  // --- Old schema: flat nutriments object ---
  const n = doc['nutriments'] as Record<string, unknown> | undefined;

  // --- New schema: doc.nutrition.aggregated_set.nutrients (schema_version >= 1003) ---
  const newNutrition = doc['nutrition'] as Record<string, unknown> | undefined;
  const aggregatedSet = newNutrition?.['aggregated_set'] as Record<string, unknown> | undefined;
  const aggregatedNutrients = aggregatedSet?.['nutrients'] as Record<string, { value?: unknown }> | undefined;

  // Also try doc.nutrition.input_sets[0].nutrients as second fallback
  const inputSets = newNutrition?.['input_sets'] as Array<Record<string, unknown>> | undefined;
  const inputSetNutrients = inputSets?.[0]?.['nutrients'] as Record<string, { value?: unknown }> | undefined;

  // Helper to read a value from the new nested structure
  function getNewNum(nutrients: Record<string, { value?: unknown }>, key: string): number | null {
    const entry = nutrients[key];
    if (entry == null) return null;
    const v = entry['value'];
    if (typeof v === 'number' && isFinite(v)) return v;
    if (typeof v === 'string') { const p = parseFloat(v); return isFinite(p) ? p : null; }
    return null;
  }

  // Choose which nutrient source to use
  let calories: number | null = null;
  let protein: number | null = null;
  let carbs: number | null = null;
  let fat: number | null = null;
  let fiber: number | null = null;
  let salt: number | null = null;

  // Priority: new schema (aggregated_set = best merged values) → old flat nutriments → input_sets[0]
  if (aggregatedNutrients) {
    calories = getNewNum(aggregatedNutrients, 'energy-kcal');
    if (calories == null) {
      const kj = getNewNum(aggregatedNutrients, 'energy-kj') ?? getNewNum(aggregatedNutrients, 'energy');
      if (kj != null) calories = kj * KJ_TO_KCAL;
    }
    protein = getNewNum(aggregatedNutrients, 'proteins');
    carbs   = getNewNum(aggregatedNutrients, 'carbohydrates');
    fat     = getNewNum(aggregatedNutrients, 'fat');
    fiber   = getNewNum(aggregatedNutrients, 'fiber');
    salt    = getNewNum(aggregatedNutrients, 'salt');
  }

  // If new schema didn't yield calories, try old flat nutriments
  if (calories == null && n) {
    calories = getNum(n, 'energy-kcal_100g', 'energy-kcal') ?? null;
    if (calories == null) {
      const kj = getNum(n, 'energy_100g', 'energy');
      if (kj != null) calories = kj * KJ_TO_KCAL;
    }
    protein = getNum(n, 'proteins_100g', 'proteins') ?? null;
    carbs   = getNum(n, 'carbohydrates_100g', 'carbohydrates') ?? null;
    fat     = getNum(n, 'fat_100g', 'fat') ?? null;
    fiber   = getNum(n, 'fiber_100g', 'fiber') ?? null;
    salt    = getNum(n, 'salt_100g', 'salt') ?? null;
  }

  // Last resort: input_sets[0]
  if (calories == null && inputSetNutrients) {
    calories = getNewNum(inputSetNutrients, 'energy-kcal');
    if (calories == null) {
      const kj = getNewNum(inputSetNutrients, 'energy-kj') ?? getNewNum(inputSetNutrients, 'energy');
      if (kj != null) calories = kj * KJ_TO_KCAL;
    }
    protein = getNewNum(inputSetNutrients, 'proteins');
    carbs   = getNewNum(inputSetNutrients, 'carbohydrates');
    fat     = getNewNum(inputSetNutrients, 'fat');
    fiber   = getNewNum(inputSetNutrients, 'fiber');
    salt    = getNewNum(inputSetNutrients, 'salt');
  }

  if (calories == null) return null;

  const result: NutritionPer100g = {
    per: '100g',
    calories: Math.round(calories * 100) / 100,
    protein: Math.round((protein ?? 0) * 100) / 100,
    carbs:   Math.round((carbs ?? 0)   * 100) / 100,
    fat:     Math.round((fat ?? 0)     * 100) / 100,
  };
  if (fiber != null) result.fiber = Math.round(fiber * 100) / 100;
  if (salt  != null) result.salt  = Math.round(salt  * 100) / 100;

  return result;
}

// ---------------------------------------------------------------------------
// Non-food detection
// ---------------------------------------------------------------------------

/**
 * Tokens that are ALWAYS non-food, regardless of context.
 * Does NOT include "cream"/"creme"/"lotion" — those are handled contextually.
 */
const DEFINITIVE_NON_FOOD_TOKENS = new Set([
  // Dental / oral
  'toothpaste', 'zahncreme', 'zahnpasta', 'toothbrush', 'zahnbürste',
  'mouthwash', 'mundspülung',
  // Cosmetics / personal care
  'cosmetic', 'cosmetics', 'beauty',
  'shampoo', 'conditioner',
  'soap', 'seife',
  'moisturizer', 'deodorant', 'antiperspirant',
  'perfume', 'parfum', 'parfüm',
  'lipstick', 'lippenstift', 'mascara', 'foundation', 'concealer',
  'sunscreen', 'sonnenschutz',
  'aftershave', 'rasierschaum',
  'bodylotion', 'körperlotion', 'haarspray', 'hairspray', 'haargel',
  // Specific compound cosmetic words (unambiguous)
  'handcreme', 'körpercreme', 'gesichtscreme', 'hautcreme', 'nachtcreme', 'tagescreme',
  'lippenpflege', 'lippenbalsam',
  // Cleaning
  'detergent', 'waschmittel', 'spülmittel', 'cleanser', 'bleach',
  // Pet food
  'hundefutter', 'katzenfutter', 'petfood',
]);

/**
 * Multi-word phrases in the normalized name that are always non-food.
 */
const NON_FOOD_PHRASES = [
  'non food', 'non-food', 'pet food',
  'oral care', 'dental care', 'body care', 'skin care', 'hair care',
];

/**
 * OFF category substrings that mark the product as non-food.
 */
const NON_FOOD_CATEGORY_SUBSTRINGS = [
  'beauty-products', 'hygiene-products', 'oral-hygiene',
  'non-food-products', 'cosmetics', 'body-care',
  'hair-care', 'skin-care', 'dental-care', 'oral-care',
  'cleaning-products',
];

/**
 * Ambiguous tokens that are non-food ONLY when combined with cosmetic context.
 * e.g. "cream" → non-food for "skin cream" but food for "ice cream"
 */
const AMBIGUOUS_NON_FOOD_TOKENS = new Set(['cream', 'lotion', 'creme']);

/**
 * If an ambiguous term is present AND the name contains one of these,
 * the product is non-food.
 */
const COSMETIC_CONTEXT_MARKERS = [
  'skin', 'haut', 'body', 'körper', 'face', 'gesicht',
  'hand', 'oral', 'dental', 'anti-aging', 'anti aging',
  'beauty', 'cosmetic', 'moisture', 'hydrat',
  'nacht', 'night', 'tag ', // "tag " with space to avoid matching "tagliatelle"
];

function isNonFoodProduct(
  normalizedName: string,
  tokens: string[],
  autoKeywords: string[],
  categoriesTags: unknown,
): boolean {
  // 1. Check OFF categories for non-food markers
  if (Array.isArray(categoriesTags)) {
    for (const cat of categoriesTags as string[]) {
      const lower = cat.toLowerCase();
      if (NON_FOOD_CATEGORY_SUBSTRINGS.some((s) => lower.includes(s))) return true;
    }
  }

  // 2. Definitive non-food tokens
  for (const t of [...tokens, ...autoKeywords]) {
    if (DEFINITIVE_NON_FOOD_TOKENS.has(t)) return true;
  }

  // 3. Multi-word non-food phrases in the full name
  for (const phrase of NON_FOOD_PHRASES) {
    if (normalizedName.includes(phrase)) return true;
  }

  // 4. Context-based: "cream"/"creme"/"lotion" only non-food with cosmetic context
  const hasAmbiguous = [...AMBIGUOUS_NON_FOOD_TOKENS].some(
    (a) => tokens.includes(a),
  );
  if (hasAmbiguous) {
    const hasCosmeticContext = COSMETIC_CONTEXT_MARKERS.some((ctx) =>
      normalizedName.includes(ctx),
    );
    if (hasCosmeticContext) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Portion extraction
// ---------------------------------------------------------------------------

/**
 * Extracts a numeric weight in grams from a serving_size string.
 * ml is treated as g (density ≈ 1 for most liquids).
 * Returns undefined if no reliable number can be extracted.
 *
 * Examples:
 *   "1 Scheibe (25 g)"  → 25
 *   "250 ml"            → 250
 *   "1 Portion"         → undefined
 *   "30g"               → 30
 */
function extractWeightGrams(servingSize: string): number | undefined {
  // Prefer number in parentheses: "1 Scheibe (25 g)" → 25
  const inParens = servingSize.match(/\(\s*([\d,.]+)\s*(?:g|ml|gr|gram)\s*\)/i);
  if (inParens) {
    const n = parseFloat(inParens[1]!.replace(',', '.'));
    if (Number.isFinite(n) && n > 0) return n;
  }

  // Plain "250 ml" or "30g" or "30 g"
  const plain = servingSize.match(/^\s*([\d,.]+)\s*(?:g|ml|gr|gram)\s*$/i);
  if (plain) {
    const n = parseFloat(plain[1]!.replace(',', '.'));
    if (Number.isFinite(n) && n > 0) return n;
  }

  // "30g" anywhere in string (last resort)
  const anywhere = servingSize.match(/([\d,.]+)\s*(?:g|ml)(?:\b|$)/i);
  if (anywhere) {
    const n = parseFloat(anywhere[1]!.replace(',', '.'));
    if (Number.isFinite(n) && n > 0) return n;
  }

  return undefined;
}

/**
 * Builds a portion object from OFF serving fields.
 * Returns undefined if no valid portion can be determined.
 */
function extractPortion(
  servingSizeRaw: unknown,
  servingQuantityRaw: unknown,
): FoodProduct['portion'] {
  // serving_quantity is the most reliable numeric source
  const servingQty =
    typeof servingQuantityRaw === 'number'
      ? servingQuantityRaw
      : typeof servingQuantityRaw === 'string'
        ? parseFloat(servingQuantityRaw)
        : NaN;

  const sizeStr =
    typeof servingSizeRaw === 'string' && servingSizeRaw.trim()
      ? servingSizeRaw.trim()
      : undefined;

  // Determine weightGrams: prefer serving_quantity, fall back to parsing serving_size
  let weightGrams: number | undefined;
  if (Number.isFinite(servingQty) && servingQty > 0) {
    weightGrams = servingQty;
  } else if (sizeStr) {
    weightGrams = extractWeightGrams(sizeStr);
  }

  // Only emit a portion if we have a reliable weight
  if (weightGrams == null) return undefined;

  return {
    label: sizeStr ?? `${weightGrams} g`,
    weightGrams: Math.round(weightGrams * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// String / search helpers
// ---------------------------------------------------------------------------

function getStr(doc: Document, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const val = doc[key];
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  return undefined;
}

/**
 * Derives the 400px front image URL from the OFF images field.
 * Priority: front_de → front_en → front_* → first uploaded image.
 * Returns undefined if no usable image data is present.
 *
 * URL schema: https://images.openfoodfacts.org/images/products/<barcode_path>/<imgid>.<rev>.400.jpg
 * For EAN-13 (>9 digits) the barcode_path is split into 3+3+3+rest groups.
 */
function getImageUrl(barcode: string, images: Record<string, unknown> | undefined): string | undefined {
  if (!images) return undefined;

  // Build the barcode path segment
  const barcodePath = barcode.length > 9
    ? `${barcode.slice(0, 3)}/${barcode.slice(3, 6)}/${barcode.slice(6, 9)}/${barcode.slice(9)}`
    : barcode;

  // Try front_de, front_en, then any front_* key
  const candidates = ['front_de', 'front_en', ...Object.keys(images).filter(k => k.startsWith('front_'))];
  for (const key of candidates) {
    const entry = images[key] as Record<string, unknown> | undefined;
    if (!entry) continue;
    const rev = entry['rev'];
    if (typeof rev === 'string' && rev) {
      // OFF URL: /images/products/{barcodePath}/{label}.{rev}.400.jpg
      return `https://images.openfoodfacts.org/images/products/${barcodePath}/${key}.${rev}.400.jpg`;
    }
  }
  return undefined;
}

/**
 * Normalizes a product name for search:
 * - lowercase
 * - collapse whitespace
 * Does NOT replace umlauts — keeps ä/ö/ü/ß so "Käse" stays searchable as "käse".
 * Umlaut folding (ä→ae) can be added later in a tuning pass.
 */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Splits a normalized string into tokens.
 * Splits on whitespace and common separators. Filters tokens < 2 chars.
 */
function tokenize(normalized: string): string[] {
  return [
    ...new Set(
      normalized
        .split(/[\s\-,().[\]{}/|&+%*@#!?;:'"]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2),
    ),
  ];
}

/**
 * DE↔EN synonym pairs for common food terms that OFF stores in English.
 * Ensures German search terms find English-named products and vice versa.
 */
const SYNONYMS: Record<string, string[]> = {
  chicken:    ['hähnchen', 'hühnchen', 'huhn'],
  turkey:     ['pute', 'truthahn'],
  beef:       ['rind', 'rindfleisch'],
  pork:       ['schwein', 'schweinefleisch'],
  salmon:     ['lachs'],
  tuna:       ['thunfisch'],
  egg:        ['ei', 'eier'],
  eggs:       ['ei', 'eier'],
  milk:       ['milch'],
  cheese:     ['käse'],
  bread:      ['brot'],
  butter:     ['butter'],
  yogurt:     ['joghurt'],
  yoghurt:    ['joghurt'],
  oat:        ['hafer'],
  oats:       ['hafer', 'haferflocken'],
  rice:       ['reis'],
  pasta:      ['nudeln', 'teigwaren'],
  potato:     ['kartoffel', 'kartoffeln'],
  tomato:     ['tomate', 'tomaten'],
  apple:      ['apfel', 'äpfel'],
  banana:     ['banane', 'bananen'],
  strawberry: ['erdbeere', 'erdbeeren'],
  spinach:    ['spinat'],
  carrot:     ['karotte', 'karotten', 'möhre'],
  // reverse: German → English
  hähnchen:   ['chicken'],
  hühnchen:   ['chicken'],
  pute:       ['turkey'],
  rind:       ['beef'],
  lachs:      ['salmon'],
  thunfisch:  ['tuna'],
  joghurt:    ['yogurt', 'yoghurt'],
  nudeln:     ['pasta'],
  kartoffel:  ['potato'],
};

/**
 * Builds autoKeywords from:
 * 1. Name tokens
 * 2. Brand tokens
 * 3. OFF _keywords (already normalized by OFF)
 * 4. categories_tags (strip language prefix, e.g. "en:eggs" → "eggs")
 * 5. German/English synonyms for common food terms
 */
function buildAutoKeywords(
  doc: Document,
  nameTokens: string[],
  brand: string | undefined,
): string[] {
  const kws = new Set<string>(nameTokens);

  // Brand
  if (brand) {
    for (const t of tokenize(normalizeName(brand))) kws.add(t);
  }

  // OFF _keywords (pre-normalized by OFF pipeline)
  const offKw = doc['_keywords'];
  if (Array.isArray(offKw)) {
    for (const k of offKw) {
      if (typeof k === 'string') {
        const cleaned = k.toLowerCase().trim();
        if (cleaned.length >= 2) kws.add(cleaned);
      }
    }
  }

  // categories_tags: "en:eggs" → "eggs", "de:eier" → "eier"
  const cats = doc['categories_tags'];
  if (Array.isArray(cats)) {
    for (const c of cats) {
      if (typeof c !== 'string') continue;
      const stripped = c.replace(/^[a-z]{2}:/, '').toLowerCase().replace(/-/g, ' ');
      for (const t of tokenize(stripped)) {
        if (t.length >= 2) kws.add(t);
      }
    }
  }

  // Synonym expansion: für jeden vorhandenen Begriff die Synonyme hinzufügen
  for (const kw of [...kws]) {
    const synonyms = SYNONYMS[kw];
    if (synonyms) {
      for (const s of synonyms) kws.add(s);
    }
  }

  return [...kws].filter((k) => k.length >= 2);
}

/**
 * Cleans a keyword array: removes empty strings, "undefined", deduplicates.
 */
function cleanKeywords(kws: string[]): string[] {
  return [
    ...new Set(
      kws.filter((k) => k.length >= 2 && k !== 'undefined'),
    ),
  ];
}

// ---------------------------------------------------------------------------
// Noisy keyword filtering
// ---------------------------------------------------------------------------

/**
 * OFF metadata terms that pollute search keywords and must be removed.
 * These appear in _keywords and categories_tags but are not useful for search.
 */
const NOISY_KEYWORDS = new Set([
  // Generic OFF metadata
  'open', 'fact', 'facts', 'product', 'products', 'food', 'foods',
  'beverage', 'beverages', 'drinks', 'getränke',
  'and', 'with', 'from', 'made', 'non',
  'their', 'its', 'based', 'plant', 'green', 'dot', 'footprint',
  'carbon', 'nutriscore', 'germany', 'deutschland', 'european',
  'union', 'certified', 'sustainable', 'project', 'action',
  'inc', 'llc', 'company', 'limited', 'gmbh', 'ag', 'kg',
  'nutriscore-grade-a', 'nutriscore-grade-b', 'nutriscore-grade-c',
  'nutriscore-grade-d', 'nutriscore-grade-e',
  // Stopwords (3+ chars that the short-token filter doesn't catch)
  'und', 'mit', 'the', 'for',
]);

/**
 * Short tokens (< 3 chars) that are meaningful food terms — kept despite length.
 */
const SHORT_FOOD_ALLOWLIST = new Set(['ei', 'öl', 'ol', 'rum', 'gin', 'bbq', 'bio']);

/**
 * Filters noisy OFF metadata and very short non-food tokens from a keyword list.
 * Tracks what was removed into removedTracker for the quality report.
 */
function filterNoisyKeywords(
  kws: string[],
  removedTracker: Map<string, number>,
): string[] {
  return kws.filter((k) => {
    if (NOISY_KEYWORDS.has(k)) {
      removedTracker.set(k, (removedTracker.get(k) ?? 0) + 1);
      return false;
    }
    if (k.length < 3 && !SHORT_FOOD_ALLOWLIST.has(k)) {
      removedTracker.set(k, (removedTracker.get(k) ?? 0) + 1);
      return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// ProductType detection
// ---------------------------------------------------------------------------

/**
 * Specific beverage-only OFF category patterns.
 * Deliberately excludes broad categories like "plant-based-foods-and-beverages"
 * which cause false positives for solid foods.
 */
const BEVERAGE_CATEGORY_PATTERNS: RegExp[] = [
  /^en:beverages$/,
  /^en:drinks$/,
  /^en:non-alcoholic-beverages$/,
  /^en:alcoholic-beverages$/,
  /^en:waters/,               // en:waters, en:mineral-waters, en:spring-waters
  /^en:sodas/,
  /^en:fruit-juices/,
  /^en:nectars/,
  /^en:beers/,
  /^en:wines/,
  /^en:coffees/,
  /^en:teas$/,                // exact "en:teas" only — not "teas-and-infusions-based-foods"
  /^en:smoothies/,
  /^en:lemonades/,
  /^en:soft-drinks/,
  /^en:energy-drinks/,
  /^de:getr[aä]nke/,
];

/** Tokens in the product NAME that unambiguously indicate a beverage. */
const BEVERAGE_NAME_TOKENS = new Set([
  'wasser', 'water', 'cola', 'soda', 'limonade', 'lemonade',
  // 'saft' and 'juice' handled separately — can appear as preservation medium ("in pineapple juice")
  'nektar', 'nectar', 'bier', 'beer',
  'wein', 'wine', 'smoothie', 'getränk',
  'tee', 'kaffee', 'fruchtsaft', 'fruchtsaftgetränk',
  'mineralwasser', 'quellwasser', 'brunnenwasser',
  'energydrink', 'eistee',
]);

/**
 * Returns true if 'juice' or 'saft' appears in the name as the PRIMARY product,
 * not as a preservation medium ("sliced X in X juice").
 * Pattern: name contains "juice"/"saft" but NOT as a "in ... juice" phrase.
 */
function isJuiceAsPrimaryProduct(normalizedName: string, nameTokens: string[]): boolean {
  const hasJuice = nameTokens.includes('juice') || nameTokens.includes('saft');
  if (!hasJuice) return false;
  // If the name contains " in " before the juice/saft word, it's a preservation medium
  // e.g. "sliced pineapple in pineapple juice" → NOT a juice product
  if (/ in .+(?:juice|saft)/.test(normalizedName)) return false;
  return true;
}

/**
 * Classifies a product as food / beverage / supplement / unknown.
 *
 * Strategy:
 *   1. Check product NAME tokens — most reliable signal, directly from the product name.
 *   2. Check NAME for multi-word drink phrases.
 *   3. Check OFF categories — but only very specific beverage-only tags,
 *      NOT broad "plant-based-foods-and-beverages" type categories.
 *   4. Check NAME for supplement signals.
 *   5. Default: food.
 */
function detectProductType(
  categoriesTags: unknown,
  nameTokens: string[],
  normalizedName: string,
): ProductType {
  // 1. Name tokens — unambiguous beverage words
  for (const t of nameTokens) {
    if (BEVERAGE_NAME_TOKENS.has(t)) return 'beverage';
  }

  // 2. juice / saft: beverage only when it is the PRIMARY product, not a preservation medium
  if (isJuiceAsPrimaryProduct(normalizedName, nameTokens)) return 'beverage';

  // 3. Multi-word beverage phrases in name
  const BEVERAGE_NAME_PHRASES = [
    'soft drink', 'energy drink', 'fruit juice', 'iced tea', 'ice tea',
  ];
  for (const phrase of BEVERAGE_NAME_PHRASES) {
    if (normalizedName.includes(phrase)) return 'beverage';
  }

  // 4. Specific beverage-only OFF category tags
  const cats = Array.isArray(categoriesTags)
    ? (categoriesTags as string[]).map((c) => c.toLowerCase())
    : [];
  for (const cat of cats) {
    for (const pattern of BEVERAGE_CATEGORY_PATTERNS) {
      if (pattern.test(cat)) return 'beverage';
    }
  }

  // 5. Supplement signals — name tokens only (more reliable than category metadata)
  const SUPPLEMENT_NAME_TOKENS = new Set([
    'whey', 'bcaa', 'kreatin', 'creatine', 'proteinpulver',
  ]);
  const SUPPLEMENT_NAME_PHRASES = [
    'protein powder', 'mass gainer', 'pre workout', 'pre-workout',
    'nahrungsergänzungsmittel', 'nahrungsergänzung',
  ];
  for (const t of nameTokens) {
    if (SUPPLEMENT_NAME_TOKENS.has(t)) return 'supplement';
  }
  for (const phrase of SUPPLEMENT_NAME_PHRASES) {
    if (normalizedName.includes(phrase)) return 'supplement';
  }

  return 'food';
}

/**
 * Computes a data quality score (60–100) based on completeness.
 * Higher = more reliable data.
 */
function computeQualityScore(
  doc: Document,
  nut: NutritionPer100g,
  hasGermanName: boolean,
): number {
  let score = 60;
  if (hasGermanName) score += 10;                                     // DE name present
  if (nut.fiber != null) score += 10;                                 // Fiber data
  if (doc['brands']) score += 10;                                     // Brand present
  if (doc['serving_size'] || doc['serving_quantity']) score += 10;    // Serving info
  return score;
}

/**
 * Computes quality flags and a score penalty for suspicious nutrition data.
 * Does NOT reject the product — allows export with degraded score.
 */
function computeQualityFlags(
  nutrition: NutritionPer100g,
  normalizedName: string,
  productType: ProductType,
  searchKeywords: string[],
): { flags: string[]; scorePenalty: number } {
  const flagSet = new Set<string>();
  let penalty = 0;

  // Suspicious macro values (> 100g per 100g is physically impossible)
  if (nutrition.fat > 100)     { flagSet.add('suspiciousNutrition'); penalty += 10; }
  if (nutrition.carbs > 100)   { flagSet.add('suspiciousNutrition'); penalty += 10; }
  if (nutrition.protein > 100) { flagSet.add('suspiciousNutrition'); penalty += 10; }
  if (nutrition.salt != null && nutrition.salt > 10) {
    flagSet.add('suspiciousNutrition'); penalty += 10;
  }

  // Calories > 900 kcal/100g (extremely high — only pure fats reach ~900)
  if (nutrition.calories > 900) { flagSet.add('suspiciousNutrition'); penalty += 20; }

  // Water/mineral water with non-trivial calories
  const waterTerms = ['wasser', 'water', 'mineral', 'quell', 'brunn'];
  if (waterTerms.some((t) => normalizedName.includes(t)) && nutrition.calories > 5) {
    flagSet.add('suspiciousNutrition'); penalty += 10;
  }

  // Vegetable/fruit product with unexpectedly high calories
  const vegFruitTerms = [
    'gurke', 'cucumber', 'tomate', 'tomato', 'salat', 'lettuce',
    'apfel', 'apple', 'karotte', 'carrot', 'gemüse', 'vegetable', 'obst', 'fruit',
  ];
  if (
    vegFruitTerms.some((t) => normalizedName.includes(t)) &&
    nutrition.calories > 250 &&
    nutrition.carbs > 50
  ) {
    flagSet.add('suspiciousNutrition'); penalty += 10;
  }

  // Low search quality
  if (searchKeywords.length < 3) { flagSet.add('lowSearchQuality'); penalty += 10; }

  // Unknown product type
  if (productType === 'unknown') flagSet.add('uncertainProductType');

  return { flags: [...flagSet], scorePenalty: Math.min(penalty, 30) };
}

// ---------------------------------------------------------------------------
// Map a single OFF document to FoodProduct
// Returns null if the document fails a hard filter.
// ---------------------------------------------------------------------------

function mapProduct(
  doc: Document,
  stats: Stats,
  now: string,
): FoodProduct | null {
  // Barcode is the identity key
  const barcode = getStr(doc, 'code');
  if (!barcode) return addRejection(stats, 'no_barcode');

  // Skip products with upstream data quality errors
  const qualityErrors = doc['data_quality_errors_tags'];
  if (Array.isArray(qualityErrors) && qualityErrors.length > 0)
    return addRejection(stats, 'data_quality_errors');

  // Product name — prefer German, fall back to English
  const hasGermanName =
    typeof doc['product_name_de'] === 'string' &&
    (doc['product_name_de'] as string).trim().length > 0;
  const name = getStr(doc, 'product_name_de', 'product_name_en', 'product_name');
  if (!name) return addRejection(stats, 'no_name');

  // Filter: Latin script only — no Cyrillic, Arabic, CJK, Hangul, etc.
  if (/[\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/.test(name))
    return addRejection(stats, 'non_latin_script');

  // Nutrition extraction — calories required, macros default to 0 (valid for water)
  const nutrition = extractNutrition(doc);
  if (!nutrition) return addRejection(stats, 'no_nutrition_values');

  // Hard reject only clearly invalid (negative) values
  if (nutrition.calories < 0) return addRejection(stats, 'plausibility_calories');
  if (nutrition.protein < 0)  return addRejection(stats, 'plausibility_protein');
  if (nutrition.carbs < 0)    return addRejection(stats, 'plausibility_carbs');
  if (nutrition.fat < 0)      return addRejection(stats, 'plausibility_fat');

  // Portion extraction
  const portion = extractPortion(doc['serving_size'], doc['serving_quantity']);

  // Name normalization + tokenization
  const brand = getStr(doc, 'brands')?.split(',')[0]?.trim();
  const normalizedName = normalizeName(name);
  const tokens = tokenize(normalizedName);
  const rawAutoKeywords = buildAutoKeywords(doc, tokens, brand);

  // Non-food detection — also checks categories_tags from MongoDB doc
  if (isNonFoodProduct(normalizedName, tokens, rawAutoKeywords, doc['categories_tags']))
    return addRejection(stats, 'non_food_product');

  // Clean + de-noise keywords: remove metadata noise, short tokens, duplicates
  const autoKeywords = filterNoisyKeywords(
    cleanKeywords(rawAutoKeywords),
    stats.removedNoisyKeywords,
  );
  const searchKeywords = autoKeywords; // manualKeywords = [] at initial import

  // ProductType: based on name tokens + specific OFF category tags only
  const productType = detectProductType(doc['categories_tags'], tokens, normalizedName);

  // Quality score + flags
  const baseScore = computeQualityScore(doc, nutrition, hasGermanName);
  const { flags, scorePenalty } = computeQualityFlags(
    nutrition,
    normalizedName,
    productType,
    searchKeywords,
  );
  const qualityScore = Math.max(60, baseScore - scorePenalty);

  const product: FoodProduct = {
    id: `openFoodFacts:${barcode}`,
    source: 'openFoodFacts',
    barcode,
    name,
    ...(brand && { brand }),
    ...(getStr(doc, 'quantity') && { quantity: getStr(doc, 'quantity') }),
    productType,
    isEdible: true,
    nutritionBasis: portion ? 'both' : 'per100g',
    nutritionPer100g: nutrition,
    ...(portion && { portion }),
    normalizedName,
    tokens,
    autoKeywords,
    manualKeywords: [],
    negativeKeywords: [],
    searchKeywords,
    search: {
      language: 'de',
      keywords: searchKeywords,
      synonyms: [],
    },
    ...(flags.length > 0 && { qualityFlags: flags }),
    sourceQualityScore: qualityScore,
    ...((() => {
      // PNNS category: use pnns_groups_2 directly, fall back to undefined
      const pnns2 = getStr(doc, 'pnns_groups_2');
      return pnns2 && pnns2 !== 'unknown' ? { category: pnns2 } : {};
    })()),
    sourceRef: { provider: 'openFoodFacts', barcode },
    ...(getImageUrl(barcode, doc['images'] as Record<string, unknown> | undefined) && {
      imageUrl: getImageUrl(barcode, doc['images'] as Record<string, unknown> | undefined),
    }),
    meta: {
      source: 'openFoodFacts',
      confidence: Math.round((qualityScore / 100) * 100) / 100,
      lastUpdated: now,
      tokens,
      autoKeywords,
    },
    lastImportedAt: now,
  };

  return product;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('\nOpen Food Facts Export Pipeline');
  console.log('================================');
  console.log(`MongoDB: ${MONGO_URI}`);
  if (Number.isFinite(LIMIT)) console.log(`Limit:   ${LIMIT.toLocaleString()} products`);
  console.log();

  const client = new MongoClient(MONGO_URI);
  const stats: Stats = {
    scanned: 0,
    exported: 0,
    rejected: {},
    productTypeCounts: { food: 0, beverage: 0, supplement: 0, unknown: 0 },
    flaggedCount: 0,
    removedNoisyKeywords: new Map(),
    examples: { food: [], beverage: [], supplement: [], flagged: [] },
  };

  let progressTimer: ReturnType<typeof setInterval> | undefined;

  try {
    await client.connect();
    const col = client.db('off').collection('products');

    // MongoDB pre-filter: products with a German name
    const mongoFilter: Document = {
      product_type: 'food',
      product_name_de: { $exists: true, $gt: '' },
    };

    // Fetch only the fields we need (reduces memory and network overhead)
    const projection = {
      _id: 0,
      code: 1,
      product_name: 1,
      product_name_de: 1,
      product_name_en: 1,
      brands: 1,
      quantity: 1,
      serving_size: 1,
      serving_quantity: 1,
      nutriments: 1,
      nutrition: 1,
      pnns_groups_1: 1,
      pnns_groups_2: 1,
      _keywords: 1,
      categories_tags: 1,
      data_quality_errors_tags: 1,   // required for quality error filter
      images: 1,                         // front_de / front_en image metadata
    };

    const cursor = col.find(mongoFilter, { projection });
    const now = new Date().toISOString();

    mkdirSync(OUTPUT_DIR, { recursive: true });
    const fileStream = createWriteStream(OUTPUT_FILE, { encoding: 'utf-8' });
    fileStream.write('[\n');
    let firstWritten = true;

    console.log('Streaming through MongoDB cursor …\n');

    const startTime = Date.now();
    progressTimer = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');
      console.log(`  [${m}:${s}]  Scanned: ${stats.scanned.toLocaleString().padStart(8)}  |  Exported: ${stats.exported.toLocaleString().padStart(7)}`);
    }, 30_000);

    for await (const doc of cursor) {
      if (stats.exported >= LIMIT) break;

      stats.scanned++;
      const mapped = mapProduct(doc, stats, now);
      if (mapped) {
        if (!firstWritten) fileStream.write(',\n');
        fileStream.write(JSON.stringify(mapped));
        firstWritten = false;
        stats.exported++;

        // Track productType distribution
        stats.productTypeCounts[mapped.productType]++;

        // Track flagged products
        if (mapped.qualityFlags && mapped.qualityFlags.length > 0) {
          stats.flaggedCount++;
          if (stats.examples.flagged.length < 10) stats.examples.flagged.push(mapped);
        }

        // Collect examples per type (up to 10 each)
        if (mapped.productType === 'food' && stats.examples.food.length < 10) {
          stats.examples.food.push(mapped);
        } else if (mapped.productType === 'beverage' && stats.examples.beverage.length < 10) {
          stats.examples.beverage.push(mapped);
        } else if (mapped.productType === 'supplement' && stats.examples.supplement.length < 10) {
          stats.examples.supplement.push(mapped);
        }
      }
    }

    clearInterval(progressTimer);
    progressTimer = undefined;
    fileStream.write('\n]\n');
    await new Promise<void>((resolve, reject) => {
      fileStream.end((err?: Error | null) => (err ? reject(err) : resolve()));
    });

    if (stats.scanned >= 5_000) console.log(`  [done]  Scanned: ${stats.scanned.toLocaleString()}  |  Exported: ${stats.exported.toLocaleString()}\n`);

    // ------------------------------------------------------------------
    // Quality Report
    // ------------------------------------------------------------------
    const totalRejected = Object.values(stats.rejected).reduce((a, b) => a + b, 0);

    console.log('\n════════════════════════════════════════════════════');
    console.log('  Export Summary');
    console.log('════════════════════════════════════════════════════');
    console.log(`  Scanned (passed MongoDB filter):   ${stats.scanned.toLocaleString()}`);
    console.log(`  Exported to file:                  ${stats.exported.toLocaleString()}`);
    console.log(`  Rejected by JS filter:             ${totalRejected.toLocaleString()}`);

    if (Object.keys(stats.rejected).length > 0) {
      console.log('\n  Rejection breakdown:');
      for (const [reason, count] of Object.entries(stats.rejected).sort(([, a], [, b]) => b - a)) {
        console.log(`    ${reason.padEnd(34)} ${count.toLocaleString()}`);
      }
    }

    console.log('\n  ProductType distribution:');
    for (const [type, count] of Object.entries(stats.productTypeCounts)) {
      const pct = stats.exported > 0 ? ((count / stats.exported) * 100).toFixed(1) : '0';
      console.log(`    ${type.padEnd(12)} ${count.toLocaleString().padStart(6)}  (${pct}%)`);
    }

    console.log(`\n  Products with qualityFlags:        ${stats.flaggedCount.toLocaleString()}`);

    // Top 30 removed noisy keywords
    const sortedNoisy = [...stats.removedNoisyKeywords.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 30);
    if (sortedNoisy.length > 0) {
      console.log('\n  Top removed noisy keywords:');
      for (const [kw, count] of sortedNoisy) {
        console.log(`    "${kw}"`.padEnd(30) + `removed ${count.toLocaleString().padStart(6)} times`);
      }
    }

    // Examples: food
    if (stats.examples.food.length > 0) {
      console.log('\n  Examples — productType: food');
      for (const p of stats.examples.food) {
        console.log(`    [${p.sourceQualityScore}] ${p.name}  (${p.nutritionPer100g.calories.toFixed(0)} kcal/100g)`);
      }
    }

    // Examples: beverage
    if (stats.examples.beverage.length > 0) {
      console.log('\n  Examples — productType: beverage');
      for (const p of stats.examples.beverage) {
        console.log(`    [${p.sourceQualityScore}] ${p.name}  (${p.nutritionPer100g.calories.toFixed(0)} kcal/100g)`);
      }
    }

    // Examples: supplement
    if (stats.examples.supplement.length > 0) {
      console.log('\n  Examples — productType: supplement');
      for (const p of stats.examples.supplement) {
        console.log(`    [${p.sourceQualityScore}] ${p.name}  (${p.nutritionPer100g.calories.toFixed(0)} kcal/100g)`);
      }
    }

    // Examples: flagged
    if (stats.examples.flagged.length > 0) {
      console.log('\n  Examples — qualityFlags');
      for (const p of stats.examples.flagged) {
        console.log(`    [${p.sourceQualityScore}] ${p.name}  flags=${p.qualityFlags?.join(',')}`);
      }
    }

    // Sanity checks
    const hasUndefinedKw = [...stats.removedNoisyKeywords.keys()].includes('undefined');
    console.log(`\n  "undefined" in keywords: ${hasUndefinedKw ? 'YES (check needed)' : 'none ✓'}`);

    console.log('────────────────────────────────────────────────────');
    console.log(`  Output: ${OUTPUT_FILE}`);
    console.log('════════════════════════════════════════════════════\n');

  } finally {
    if (typeof progressTimer !== 'undefined') clearInterval(progressTimer);
    await client.close();
  }
}

main().catch((err: unknown) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
