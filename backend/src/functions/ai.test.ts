import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import type { AiRecipeRaw, AiRecipeScaleRaw } from '../lib/openai';

vi.mock('../lib/quota', () => ({
  enforceQuota: vi.fn().mockResolvedValue(null),
  trackUsage: vi.fn().mockResolvedValue(undefined),
}));

import {
  classifyItem,
  resolveAmountGrams,
  mealParserPreviewHandler,
  mealEstimatePreviewHandler,
  recipeAnalyzeHandler,
  recipeScalePreviewHandler,
} from './ai';
import type { AiParsedItem } from '../lib/openai';
import { analyzeRecipeText, __setOpenAiClientForTests } from '../lib/openai';
import { enforceQuota, trackUsage } from '../lib/quota';
import { _setFoodProductRepository, _resetFoodProductRepository } from '../lib/repositories/foodProductRepository';
import { _setReusableItemsRepository, __resetReusableItemsRepositoryForTests } from '../lib/repositories/reusableItemsRepository';
import type { FoodProductRepository } from '../lib/repositories/foodProductRepository';
import type { ReusableItemsRepository } from '../lib/repositories/reusableItemsRepository';
import type { FoodSearchResult, ReusableItem } from '@fittrack/shared';
import {
  makeContext,
  makeAuthRequest,
  setupTestAuth,
  teardownTestAuth,
  TEST_USER_ID,
} from '../test-utils/http';
import { getRecipesRepository, __resetRecipesRepositoryForTests } from '../lib/repositories/recipesRepository';

beforeAll(async () => {
  await setupTestAuth();
});

afterAll(() => {
  teardownTestAuth();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCandidate(id: string, name: string): FoodSearchResult {
  return {
    id,
    source: 'openFoodFacts',
    name,
    brand: undefined,
    displayLabel: '100g · 100 kcal',
    nutritionBasis: 'per100g',
    nutritionPer100g: { calories: 100, protein: 5, carbs: 10, fat: 3, fiber: 1 },
    portion: undefined,
    isComplete: true,
    sourceRef: { provider: 'openFoodFacts', barcode: '0000000' },
  };
}

function makeParsed(overrides: Partial<AiParsedItem> = {}): AiParsedItem {
  return {
    rawText: '200g Hähnchenbrust',
    displayName: 'Hähnchenbrust',
    inputMode: 'grams',
    inputAmount: 200,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// classifyItem — unit tests (pure function, no I/O)
// ---------------------------------------------------------------------------

describe('classifyItem', () => {
  it('returns unmatched when no candidates', () => {
    const result = classifyItem(makeParsed(), []);
    expect(result.status).toBe('unmatched');
    expect(result.selectedProductId).toBeNull();
    expect(result.needsReview).toBe(true);
  });

  it('returns matched when exactly one candidate with strong name match', () => {
    const result = classifyItem(
      makeParsed({ displayName: 'Hähnchenbrust' }),
      [makeCandidate('abc', 'Hähnchenbrust')],
    );
    expect(result.status).toBe('matched');
    expect(result.selectedProductId).toBe('abc');
    expect(result.selectedProductName).toBe('Hähnchenbrust');
    expect(result.needsReview).toBe(false);
  });

  it('returns needsSelection when one candidate but weak name match', () => {
    const result = classifyItem(
      makeParsed({ displayName: 'Hähnchen' }),
      [makeCandidate('abc', 'Rindfleisch Gulasch')],
    );
    expect(result.status).toBe('needsSelection');
    expect(result.selectedProductId).toBeNull();
    expect(result.needsReview).toBe(true);
  });

  it('returns needsSelection when multiple candidates', () => {
    const result = classifyItem(makeParsed({ displayName: 'Milch' }), [
      makeCandidate('a', 'Vollmilch'),
      makeCandidate('b', 'Halbfettmilch'),
    ]);
    expect(result.status).toBe('needsSelection');
    expect(result.selectedProductId).toBeNull();
  });

  it('matches when product name starts with display name', () => {
    const result = classifyItem(
      makeParsed({ displayName: 'Vollmilch' }),
      [makeCandidate('x', 'Vollmilch 3,5% Fett')],
    );
    expect(result.status).toBe('matched');
    expect(result.selectedProductId).toBe('x');
  });

  it('matches when display name starts with product name', () => {
    const result = classifyItem(
      makeParsed({ displayName: 'Vollmilch 3,5%' }),
      [makeCandidate('x', 'Vollmilch')],
    );
    expect(result.status).toBe('matched');
  });
});

// ---------------------------------------------------------------------------
// resolveAmountGrams — unit tests
// ---------------------------------------------------------------------------

describe('resolveAmountGrams', () => {
  it('returns inputAmount when inputMode is grams', () => {
    expect(resolveAmountGrams(makeParsed({ inputMode: 'grams', inputAmount: 150 }))).toBe(150);
  });

  it('returns null when inputMode is portion', () => {
    expect(resolveAmountGrams(makeParsed({ inputMode: 'portion', inputAmount: 2 }))).toBeNull();
  });

  it('returns null when inputMode is unknown', () => {
    expect(resolveAmountGrams(makeParsed({ inputMode: 'unknown', inputAmount: null }))).toBeNull();
  });

  it('returns null when inputAmount is null even with grams mode', () => {
    expect(resolveAmountGrams(makeParsed({ inputMode: 'grams', inputAmount: null }))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Preview endpoint — integration-style unit tests
// (no real OpenAI, no Cosmos — both mocked)
// ---------------------------------------------------------------------------

let originalEnv: Record<string, string | undefined>;

beforeEach(() => {
  vi.clearAllMocks();
  if (!originalEnv) originalEnv = { ...process.env };
  delete process.env.COSMOS_ENDPOINT;
  delete process.env.COSMOS_KEY;
  _resetFoodProductRepository();
  __resetReusableItemsRepositoryForTests();
  __resetRecipesRepositoryForTests();
});

afterEach(() => {
  const authIssuer = process.env['AUTH_ISSUER'];
  const authAudience = process.env['AUTH_AUDIENCE'];
  const authJwks = process.env['AUTH_JWKS_URI'];
  process.env = { ...originalEnv };
  process.env['AUTH_ISSUER'] = authIssuer;
  process.env['AUTH_AUDIENCE'] = authAudience;
  process.env['AUTH_JWKS_URI'] = authJwks;
  __setOpenAiClientForTests(null);
  _resetFoodProductRepository();
  __resetReusableItemsRepositoryForTests();
  __resetRecipesRepositoryForTests();
});

/** Build a fake AzureOpenAI client that returns a preset list of parsed items. */
function mockOpenAiClient(items: AiParsedItem[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fakeClient: any = {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify({ items }) } }],
        }),
      },
    },
  };
  __setOpenAiClientForTests(fakeClient);
}

/** Build a fake food product repository that always returns the given results for any query. */
function mockFoodRepo(results: FoodSearchResult[], searchSpy?: ReturnType<typeof vi.fn>) {
  const searchFn = searchSpy ?? vi.fn().mockResolvedValue(results);
  if (!searchSpy) searchFn.mockResolvedValue(results);
  const repo: FoodProductRepository = {
    search: searchFn,
    getById: vi.fn().mockResolvedValue(null),
  };
  _setFoodProductRepository(repo);
  return repo;
}

describe('POST /api/ai/meal-parser/preview', () => {
  it('returns 400 when text is missing', async () => {
    mockOpenAiClient([]);
    mockFoodRepo([]);
    const res = await mealParserPreviewHandler(
      await makeAuthRequest({ body: {} }),
      makeContext(),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when text is empty string', async () => {
    mockOpenAiClient([]);
    mockFoodRepo([]);
    const res = await mealParserPreviewHandler(
      await makeAuthRequest({ body: { text: '' } }),
      makeContext(),
    );
    expect(res.status).toBe(400);
  });

  it('returns 200 with matched item when AI returns one item and DB has strong match', async () => {
    mockOpenAiClient([makeParsed({ rawText: '200g Hähnchenbrust', displayName: 'Hähnchenbrust', inputMode: 'grams', inputAmount: 200 })]);
    mockFoodRepo([makeCandidate('prod:1', 'Hähnchenbrust')]);

    const res = await mealParserPreviewHandler(
      await makeAuthRequest({ body: { text: '200g Hähnchenbrust' } }),
      makeContext(),
    );
    expect(res.status).toBe(200);
    const body = res.jsonBody as { items: { status: string; selectedProductId: string; amountGrams: number }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]!.status).toBe('matched');
    expect(body.items[0]!.selectedProductId).toBe('prod:1');
    expect(body.items[0]!.amountGrams).toBe(200);
  });

  it('returns unmatched item with warning when DB has no results', async () => {
    mockOpenAiClient([makeParsed({ displayName: 'Exotische Frucht', inputMode: 'unknown', inputAmount: null })]);
    mockFoodRepo([]);

    const res = await mealParserPreviewHandler(
      await makeAuthRequest({ body: { text: 'Exotische Frucht' } }),
      makeContext(),
    );
    const body = res.jsonBody as { items: { status: string }[]; warnings: string[] };
    expect(body.items[0]!.status).toBe('unmatched');
    expect(body.warnings.length).toBeGreaterThan(0);
  });

  it('returns needsSelection when multiple DB candidates exist', async () => {
    mockOpenAiClient([makeParsed({ displayName: 'Milch', inputMode: 'unknown', inputAmount: null })]);
    mockFoodRepo([makeCandidate('a', 'Vollmilch'), makeCandidate('b', 'Halbfettmilch')]);

    const res = await mealParserPreviewHandler(
      await makeAuthRequest({ body: { text: 'Milch' } }),
      makeContext(),
    );
    const body = res.jsonBody as { items: { status: string }[] };
    expect(body.items[0]!.status).toBe('needsSelection');
  });

  it('does not write diary entries (preview only)', async () => {
    // The preview handler must return 200 without any side effect.
    // We verify by checking there is no "meal" key in the response.
    mockOpenAiClient([makeParsed()]);
    mockFoodRepo([makeCandidate('p', 'Hähnchenbrust')]);

    const res = await mealParserPreviewHandler(
      await makeAuthRequest({ body: { text: '200g Hähnchenbrust' } }),
      makeContext(),
    );
    const body = res.jsonBody as Record<string, unknown>;
    expect(body).not.toHaveProperty('meal');
    expect(body).toHaveProperty('items');
  });
});

// ---------------------------------------------------------------------------
// Library search — regression tests
// These tests guard against the bug where the user library was NOT searched
// during meal parsing, causing previously-saved AI products to be ignored.
// ---------------------------------------------------------------------------

function makeLibItem(overrides: Partial<ReusableItem> & { id: string; name: string }): ReusableItem {
  return {
    userId: 'test-user',
    nutritionBasis: 'per100g',
    nutritionPer100g: { calories: 250, protein: 10, carbs: 40, fat: 5 },
    isComplete: true,
    sourceType: 'ai',
    usageCount: 1,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function mockLibRepo(items: ReusableItem[]) {
  const repo: ReusableItemsRepository = {
    search: vi.fn().mockResolvedValue(items),
    create: vi.fn(),
  };
  _setReusableItemsRepository(repo);
  return repo;
}

describe('mealParserPreviewHandler — user library integration (regression)', () => {
  it('REGRESSION: user library is searched with individual words of the displayName', async () => {
    // Before fix #1: only foodProductRepository was searched — library never queried.
    // Before fix #2: library was searched with full displayName "Sandwich Vollkorntoast"
    //   but STARTSWITH("vollkorntoast", "sandwich vollkorntoast") is false → no results.
    // After fix: each word ("sandwich", "vollkorntoast") is searched separately.
    mockOpenAiClient([makeParsed({ displayName: 'Sandwich Vollkorntoast' })]);
    const lib = mockLibRepo([]);
    mockFoodRepo([]);

    await mealParserPreviewHandler(
      await makeAuthRequest({ body: { text: '2 Scheiben Sandwich Vollkorntoast' } }),
      makeContext(),
    );

    const searchMock = lib.search as ReturnType<typeof vi.fn>;
    // Must have been called with each individual word (3+ chars), not the full phrase
    const calledArgs = searchMock.mock.calls.map((c: unknown[]) => c[1]);
    expect(calledArgs).toContain('sandwich');
    expect(calledArgs).toContain('vollkorntoast');
    expect(calledArgs).not.toContain('sandwich vollkorntoast'); // full phrase must NOT be used
  });

  it('returns matched when library item matches via searchTerms, not just name', async () => {
    // Stored name "Golden Toast Vollkorn" (reference product).
    // AI displayName "Vollkorntoast". Matched via searchTerms["vollkorntoast"].
    const libItem = makeLibItem({
      id: 'lib-1',
      name: 'Golden Toast Vollkorn',
      searchTerms: ['vollkorntoast', 'toast', 'vollkorn', 'brot'],
    });
    mockOpenAiClient([makeParsed({ displayName: 'Vollkorntoast' })]);
    mockLibRepo([libItem]);
    mockFoodRepo([]);

    const res = await mealParserPreviewHandler(
      await makeAuthRequest({ body: { text: 'Vollkorntoast' } }),
      makeContext(),
    );
    const body = res.jsonBody as { items: { status: string; selectedProductId: string }[] };
    expect(body.items[0]!.status).toBe('matched');
    expect(body.items[0]!.selectedProductId).toBe('lib-1');
  });

  it('places library candidates before catalog candidates', async () => {
    const libItem = makeLibItem({ id: 'lib-1', name: 'Mein Vollkorntoast' });
    mockOpenAiClient([makeParsed({ displayName: 'Vollkorntoast' })]);
    mockLibRepo([libItem]);
    mockFoodRepo([makeCandidate('cat-1', 'Vollkornbrot')]);

    const res = await mealParserPreviewHandler(
      await makeAuthRequest({ body: { text: 'Vollkorntoast' } }),
      makeContext(),
    );
    const body = res.jsonBody as { items: { candidates: FoodSearchResult[] }[] };
    expect(body.items[0]!.candidates[0]!.id).toBe('lib-1');
    expect(body.items[0]!.candidates[1]!.id).toBe('cat-1');
  });

  it('deduplicates catalog entries already present in library by name', async () => {
    const libItem = makeLibItem({ id: 'lib-1', name: 'Vollkorntoast' });
    mockOpenAiClient([makeParsed({ displayName: 'Vollkorntoast' })]);
    mockLibRepo([libItem]);
    mockFoodRepo([makeCandidate('cat-1', 'Vollkorntoast')]); // same name as library item

    const res = await mealParserPreviewHandler(
      await makeAuthRequest({ body: { text: 'Vollkorntoast' } }),
      makeContext(),
    );
    const body = res.jsonBody as { items: { candidates: FoodSearchResult[] }[] };
    expect(body.items[0]!.candidates).toHaveLength(1);
    expect(body.items[0]!.candidates[0]!.id).toBe('lib-1');
  });

  it('searches BOTH the user library AND the product catalog for each item', async () => {
    // This test explicitly verifies that neither source is skipped.
    // Regression guard: before the fix only the catalog was searched.
    mockOpenAiClient([makeParsed({ displayName: 'Hähnchenbrust' })]);
    const lib = mockLibRepo([]);
    const catalogSearchSpy = vi.fn().mockResolvedValue([]);
    mockFoodRepo([], catalogSearchSpy);

    await mealParserPreviewHandler(
      await makeAuthRequest({ body: { text: '150g Hähnchenbrust' } }),
      makeContext(),
    );

    // Library must have been called
    expect((lib.search as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
    // Catalog must have been called
    expect(catalogSearchSpy.mock.calls.length).toBeGreaterThan(0);
  });

  it('returns results from both sources when names differ', async () => {
    // Library has one item, catalog has a different item — both should appear in candidates
    const libItem = makeLibItem({ id: 'lib-1', name: 'Grillhähnchen' });
    mockOpenAiClient([makeParsed({ displayName: 'Hähnchen' })]);
    mockLibRepo([libItem]);
    mockFoodRepo([makeCandidate('cat-1', 'Hähnchenbrust')]);

    const res = await mealParserPreviewHandler(
      await makeAuthRequest({ body: { text: 'Hähnchen' } }),
      makeContext(),
    );
    const body = res.jsonBody as { items: { candidates: FoodSearchResult[] }[] };
    const ids = body.items[0]!.candidates.map((c) => c.id);
    expect(ids).toContain('lib-1');   // from library
    expect(ids).toContain('cat-1');   // from catalog
  });
});

// ---------------------------------------------------------------------------
// classifyItem — searchTerms matching (regression)
// ---------------------------------------------------------------------------

describe('classifyItem — searchTerms matching', () => {
  function makeLibCandidate(id: string, name: string): FoodSearchResult {
    return { id, source: 'library', name, displayLabel: '100g · 250 kcal', nutritionBasis: 'per100g', nutritionPer100g: { calories: 250, protein: 10, carbs: 40, fat: 5 }, isComplete: true, isAiEstimate: true };
  }

  it('matches via searchTerms when name differs', () => {
    const libItem = makeLibItem({ id: 'lib-1', name: 'Golden Toast Vollkorn', searchTerms: ['vollkorntoast', 'toast', 'vollkorn'] });
    const result = classifyItem(makeParsed({ displayName: 'Vollkorntoast' }), [makeLibCandidate('lib-1', 'Golden Toast Vollkorn')], [libItem]);
    expect(result.status).toBe('matched');
    expect(result.selectedProductId).toBe('lib-1');
  });

  it('does not match via searchTerms when libraryItems list is empty', () => {
    // Candidate exists but no library metadata → no searchTerms → falls back to name match only
    const result = classifyItem(makeParsed({ displayName: 'Vollkorntoast' }), [makeLibCandidate('lib-1', 'Golden Toast Vollkorn')], []);
    expect(result.status).toBe('needsSelection');
  });

  it('auto-selects matching library item from mixed candidate list', () => {
    const libItem = makeLibItem({ id: 'lib-1', name: 'Golden Toast Vollkorn', searchTerms: ['vollkorntoast', 'toast'] });
    const candidates = [
      makeLibCandidate('lib-1', 'Golden Toast Vollkorn'),
      makeCandidate('cat-1', 'Toastbrot hell'),
    ];
    const result = classifyItem(makeParsed({ displayName: 'Vollkorntoast' }), candidates, [libItem]);
    expect(result.status).toBe('matched');
    expect(result.selectedProductId).toBe('lib-1');
  });

  it('does not auto-select when only one token of a multi-word name matches', () => {
    const libItem = makeLibItem({
      id: 'lib-1',
      name: 'Maggi Mexicana Salsa Tomaten Chilli Sauce',
      searchTerms: ['tomaten'],
    });
    const result = classifyItem(
      makeParsed({ displayName: 'passierte Tomaten' }),
      [makeLibCandidate('lib-1', libItem.name)],
      [libItem],
    );
    expect(result.status).toBe('needsSelection');
    expect(result.selectedProductId).toBeNull();
    expect(result.needsReview).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// mealEstimatePreviewHandler — unit tests for the Fast Path endpoint
// ---------------------------------------------------------------------------

/** Build a fake OpenAI client that returns a preset meal estimate. */
function mockMealEstimateClient(estimate: {
  mealName: string;
  mealEstimate: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
  components: string[];
  contextDetected: string | null;
  portionConfidence: 'high' | 'medium' | 'low';
  assumptions: string[];
  warnings: string[];
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fakeClient: any = {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify(estimate) } }],
        }),
      },
    },
  };
  __setOpenAiClientForTests(fakeClient);
}

const VALID_ESTIMATE = {
  mealName: 'Schnitzel mit Pommes und Mayo',
  mealEstimate: { calories: 1150, protein: 42, carbs: 105, fat: 58, fiber: 8 },
  components: ['Schnitzel', 'Pommes', 'Mayo'],
  contextDetected: null,
  portionConfidence: 'medium' as const,
  assumptions: ['Standardportion angenommen'],
  warnings: [],
};

describe('POST /api/ai/meal-estimate/preview', () => {
  it('returns 400 when text is missing', async () => {
    mockMealEstimateClient(VALID_ESTIMATE);
    const res = await mealEstimatePreviewHandler(
      await makeAuthRequest({ body: {} }),
      makeContext(),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when text is empty string', async () => {
    mockMealEstimateClient(VALID_ESTIMATE);
    const res = await mealEstimatePreviewHandler(
      await makeAuthRequest({ body: { text: '' } }),
      makeContext(),
    );
    expect(res.status).toBe(400);
  });

  it('returns 200 with correct structure for a valid text request', async () => {
    mockMealEstimateClient(VALID_ESTIMATE);
    const res = await mealEstimatePreviewHandler(
      await makeAuthRequest({ body: { text: 'Schnitzel mit Pommes und Mayo' } }),
      makeContext(),
    );
    expect(res.status).toBe(200);
    const body = res.jsonBody as typeof VALID_ESTIMATE & { photoUsed: boolean };
    expect(body.mealName).toBe('Schnitzel mit Pommes und Mayo');
    expect(body.mealEstimate.calories).toBe(1150);
    expect(body.components).toEqual(['Schnitzel', 'Pommes', 'Mayo']);
    expect(body.contextDetected).toBeNull();
    expect(body.portionConfidence).toBe('medium');
    expect(body.photoUsed).toBe(false);
    expect(body.assumptions).toEqual(['Standardportion angenommen']);
  });

  it('returns contextDetected when context is found in text', async () => {
    mockMealEstimateClient({
      ...VALID_ESTIMATE,
      contextDetected: 'Imbiss',
      mealEstimate: { calories: 1150, protein: 42, carbs: 105, fat: 58, fiber: 8 },
      assumptions: ['Große Imbiss-Portion angenommen'],
    });
    const res = await mealEstimatePreviewHandler(
      await makeAuthRequest({ body: { text: 'Schnitzel mit Pommes vom Imbiss' } }),
      makeContext(),
    );
    expect(res.status).toBe(200);
    const body = res.jsonBody as { contextDetected: string };
    expect(body.contextDetected).toBe('Imbiss');
  });

  it('returns 422 when AI returns calories over 3000', async () => {
    mockMealEstimateClient({
      ...VALID_ESTIMATE,
      mealEstimate: { calories: 9999, protein: 100, carbs: 200, fat: 100, fiber: 10 },
    });
    const res = await mealEstimatePreviewHandler(
      await makeAuthRequest({ body: { text: 'Riesiges Mahl' } }),
      makeContext(),
    );
    expect(res.status).toBe(422);
  });

  it('does not persist any data (preview only)', async () => {
    mockMealEstimateClient(VALID_ESTIMATE);
    const res = await mealEstimatePreviewHandler(
      await makeAuthRequest({ body: { text: 'Schnitzel mit Pommes' } }),
      makeContext(),
    );
    const body = res.jsonBody as Record<string, unknown>;
    expect(body).not.toHaveProperty('meal');
    expect(body).not.toHaveProperty('item');
    expect(body).toHaveProperty('mealEstimate');
  });
});

// ---------------------------------------------------------------------------
// recipeAnalyzeHandler — unit tests
// ---------------------------------------------------------------------------

function mockRecipeAnalyzeClient(recipe: AiRecipeRaw) {
  // recipeAnalyzeHandler makes one OpenAI call: analyzeRecipeText returns the
  // recipe structure and the already converted food ingredient amounts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fakeClient: any = {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValueOnce({
          choices: [{ message: { content: JSON.stringify(recipe) } }],
        }),
      },
    },
  };
  __setOpenAiClientForTests(fakeClient);
}

const VALID_RECIPE_RAW: AiRecipeRaw = {
  suggestedName: 'Hähnchenpfanne',
  description: 'Eine einfache Hähnchenpfanne mit Gemüse.',
  suggestedPortions: 4,
  tags: ['Schnell', 'Familienrezept'],
  ingredients: [
    { line: '300g Hähnchenbrust', displayName: 'Hähnchenbrust', category: 'food', amountGrams: 300, kitchenAmountText: null },
    { line: '1 Zwiebel', displayName: 'Zwiebel', category: 'food', amountGrams: 100, kitchenAmountText: null },
  ],
  steps: [
    { order: 1, title: 'Vorbereitung', description: 'Hähnchenbrust in Würfel schneiden.' },
    { order: 2, title: null, description: 'Zwiebel anbraten.' },
  ],
};

describe('analyzeRecipeText normalization', () => {
  it('clears kitchenAmountText when Azure returns it for a food ingredient', async () => {
    mockRecipeAnalyzeClient({
      ...VALID_RECIPE_RAW,
      ingredients: [
        { ...VALID_RECIPE_RAW.ingredients[0]!, kitchenAmountText: '2 EL' },
        { line: '1 TL Salz', displayName: 'Salz', category: 'seasoning', amountGrams: 5, kitchenAmountText: '1 TL' },
      ],
    });

    const result = await analyzeRecipeText('2 EL Olivenöl und 1 TL Salz');

    expect(result.ingredients[0]!.kitchenAmountText).toBeNull();
    expect(result.ingredients[1]!.kitchenAmountText).toBe('1 TL');
  });
});

describe('POST /api/ai/recipe-analyze', () => {
  it('returns 400 when text is missing', async () => {
    mockRecipeAnalyzeClient(VALID_RECIPE_RAW);
    mockFoodRepo([]);
    const res = await recipeAnalyzeHandler(
      await makeAuthRequest({ body: {} }),
      makeContext(),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when text is too short (< 10 chars)', async () => {
    mockRecipeAnalyzeClient(VALID_RECIPE_RAW);
    mockFoodRepo([]);
    const res = await recipeAnalyzeHandler(
      await makeAuthRequest({ body: { text: 'Kurz' } }),
      makeContext(),
    );
    expect(res.status).toBe(400);
  });

  it('returns 200 with correct structure for a valid request', async () => {
    mockRecipeAnalyzeClient(VALID_RECIPE_RAW);
    mockFoodRepo([makeCandidate('prod:1', 'Hähnchenbrust')]);

    const res = await recipeAnalyzeHandler(
      await makeAuthRequest({ body: { text: 'Hähnchenpfanne mit 300g Hähnchenbrust und einer Zwiebel' } }),
      makeContext(),
    );
    expect(res.status).toBe(200);
    const body = res.jsonBody as typeof VALID_RECIPE_RAW & { ingredients: unknown[] };
    expect(body.suggestedName).toBe('Hähnchenpfanne');
    expect(body.description).toBe('Eine einfache Hähnchenpfanne mit Gemüse.');
    expect(body.suggestedPortions).toBe(4);
    expect(body.tags).toEqual(['Schnell', 'Familienrezept']);
    expect(body.steps).toHaveLength(2);
    expect(body.ingredients).toHaveLength(2);
  });

  it('returns matched ingredient when catalog has a strong match', async () => {
    mockRecipeAnalyzeClient(VALID_RECIPE_RAW);
    mockFoodRepo([makeCandidate('prod:1', 'Hähnchenbrust')]);

    const res = await recipeAnalyzeHandler(
      await makeAuthRequest({ body: { text: 'Hähnchenpfanne mit 300g Hähnchenbrust und einer Zwiebel' } }),
      makeContext(),
    );
    const body = res.jsonBody as { ingredients: { status: string; selectedProductId: string }[] };
    const chicken = body.ingredients.find((i) => i.selectedProductId === 'prod:1');
    expect(chicken).toBeDefined();
    expect(chicken!.status).toBe('matched');
  });

  it('returns unmatched ingredient when catalog has no results', async () => {
    mockRecipeAnalyzeClient(VALID_RECIPE_RAW);
    mockFoodRepo([]);

    const res = await recipeAnalyzeHandler(
      await makeAuthRequest({ body: { text: 'Hähnchenpfanne mit 300g Hähnchenbrust' } }),
      makeContext(),
    );
    const body = res.jsonBody as { ingredients: { status: string }[] };
    expect(body.ingredients.every((i) => i.status === 'unmatched')).toBe(true);
  });

  it('returns empty ingredients array when AI extracts no ingredient lines', async () => {
    // When ingredients is empty, parseMeal is not called → only one OpenAI call needed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fakeClient: any = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValueOnce({
            choices: [{ message: { content: JSON.stringify({ ...VALID_RECIPE_RAW, ingredients: [] }) } }],
          }),
        },
      },
    };
    __setOpenAiClientForTests(fakeClient);
    mockFoodRepo([]);

    const res = await recipeAnalyzeHandler(
      await makeAuthRequest({ body: { text: 'Ein Rezept ohne Zutaten' } }),
      makeContext(),
    );
    const body = res.jsonBody as { ingredients: unknown[] };
    expect(body.ingredients).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// recipeAnalyzeHandler — food/seasoning routing (AC-2, AC-3)
// ---------------------------------------------------------------------------

describe('POST /api/ai/recipe-analyze — food/seasoning routing', () => {
  it('preserves recipe analyzer grams when the meal parser loses a kitchen-unit amount', async () => {
    // The recipe analyzer has already converted 2 EL to 30g. Recipe food
    // ingredients must use that value directly instead of a second parse.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fakeClient: any = {
      chat: {
        completions: {
          create: vi.fn()
            .mockResolvedValueOnce({
              choices: [{ message: { content: JSON.stringify({
                ...VALID_RECIPE_RAW,
                ingredients: [{
                  line: '2 EL Frischkäse',
                  displayName: 'Frischkäse',
                  category: 'food',
                  amountGrams: 30,
                  kitchenAmountText: null,
                }],
              }) } }],
            })
        },
      },
    };
    __setOpenAiClientForTests(fakeClient);
    mockFoodRepo([makeCandidate('prod:frischkaese', 'Frischkäse')]);

    const res = await recipeAnalyzeHandler(
      await makeAuthRequest({ body: { text: '2 EL Frischkäse in die Sauce rühren' } }),
      makeContext(),
    );

    expect(res.status).toBe(200);
  expect(fakeClient.chat.completions.create).toHaveBeenCalledTimes(1);
    const body = res.jsonBody as { ingredients: { amountGrams: number | null; inputMode: string; inputAmount: number | null }[] };
    expect(body.ingredients[0]!.amountGrams).toBe(30);
    expect(body.ingredients[0]!.inputMode).toBe('grams');
    expect(body.ingredients[0]!.inputAmount).toBe(30);
  });

  it('rejects a food ingredient without a positive gram amount', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fakeClient: any = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValueOnce({
            choices: [{ message: { content: JSON.stringify({
              ...VALID_RECIPE_RAW,
              ingredients: [{
                line: 'Frischkäse',
                displayName: 'Frischkäse',
                category: 'food',
                amountGrams: null,
                kitchenAmountText: null,
              }],
            }) } }],
          }),
        },
      },
    };
    __setOpenAiClientForTests(fakeClient);

    const res = await recipeAnalyzeHandler(
      await makeAuthRequest({ body: { text: 'Frischkäse in die Sauce rühren' } }),
      makeContext(),
    );

    expect(res.status).toBe(502);
    expect((res.jsonBody as { error: string }).error).toContain('invalid food amount');
  });

  it('routes food items through catalog and constructs seasoning items directly', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fakeClient: any = {
      chat: {
        completions: {
          create: vi.fn()
            .mockResolvedValueOnce({
              choices: [{ message: { content: JSON.stringify({
                ...VALID_RECIPE_RAW,
                ingredients: [
                  { line: '300g Hähnchenbrust', displayName: 'Hähnchenbrust', category: 'food', amountGrams: 300 },
                  { line: '1 Prise Salz', displayName: 'Salz', category: 'seasoning', amountGrams: 2 },
                ],
              }) } }],
            })
            .mockResolvedValueOnce({
              choices: [{ message: { content: JSON.stringify({ items: [
                makeParsed({ rawText: '300g Hähnchenbrust', displayName: 'Hähnchenbrust', inputMode: 'grams', inputAmount: 300 }),
              ] }) } }],
            }),
        },
      },
    };
    __setOpenAiClientForTests(fakeClient);
    mockFoodRepo([makeCandidate('prod:1', 'Hähnchenbrust')]);

    const res = await recipeAnalyzeHandler(
      await makeAuthRequest({ body: { text: 'Hähnchenpfanne mit Salz' } }),
      makeContext(),
    );
    expect(res.status).toBe(200);
    const body = res.jsonBody as { ingredients: { displayName: string; status: string; category: string; candidates: unknown[]; needsReview: boolean }[] };

    const chicken = body.ingredients.find((i) => i.displayName === 'Hähnchenbrust');
    expect(chicken).toBeDefined();
    expect(chicken!.status).toBe('matched');
    expect(chicken!.category).toBe('food');

    const salt = body.ingredients.find((i) => i.displayName === 'Salz');
    expect(salt).toBeDefined();
    expect(salt!.status).toBe('seasoning');
    expect(salt!.candidates).toHaveLength(0);
    expect(salt!.needsReview).toBe(false);
    expect(salt!.category).toBe('seasoning');
  });

  it('does not call parseMeal when all ingredients are seasonings', async () => {
    const createSpy = vi.fn().mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({
        ...VALID_RECIPE_RAW,
        ingredients: [
          { line: '1 Prise Salz', displayName: 'Salz', category: 'seasoning', amountGrams: 1 },
          { line: '1 TL Pfeffer', displayName: 'Pfeffer', category: 'seasoning', amountGrams: 3 },
        ],
      }) } }],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    __setOpenAiClientForTests({ chat: { completions: { create: createSpy } } } as any);
    mockFoodRepo([]);

    const res = await recipeAnalyzeHandler(
      await makeAuthRequest({ body: { text: 'Salz und Pfeffer mischen' } }),
      makeContext(),
    );
    expect(res.status).toBe(200);
    // Only one AI call (analyzeRecipeText), parseMeal must not have been invoked
    expect(createSpy).toHaveBeenCalledTimes(1);
    const body = res.jsonBody as { ingredients: { status: string }[] };
    expect(body.ingredients).toHaveLength(2);
    expect(body.ingredients.every((i) => i.status === 'seasoning')).toBe(true);
  });

  it('treats an item with unrecognised category as food (safe-guard)', async () => {
    // The AI schema constrains to 'food'|'seasoning' but runtime JSON can carry anything.
    // We inject via raw JSON to bypass TypeScript's type guard.
    const recipeWithBadCategory = {
      ...VALID_RECIPE_RAW,
      ingredients: [
        { line: '100g Mystery', displayName: 'Mystery', category: 'unknown', amountGrams: 100 },
      ],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fakeClient: any = {
      chat: {
        completions: {
          create: vi.fn()
            .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(recipeWithBadCategory) } }] })
            .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ items: [
              makeParsed({ rawText: '100g Mystery', displayName: 'Mystery', inputMode: 'grams', inputAmount: 100 }),
            ] }) } }] }),
        },
      },
    };
    __setOpenAiClientForTests(fakeClient);
    mockFoodRepo([makeCandidate('prod:x', 'Mystery')]);

    const res = await recipeAnalyzeHandler(
      await makeAuthRequest({ body: { text: 'Mystery item test recipe' } }),
      makeContext(),
    );
    expect(res.status).toBe(200);
    const body = res.jsonBody as { ingredients: { status: string; category: string }[] };
    expect(body.ingredients).toHaveLength(1);
    // Must NOT be seasoning — unknown category falls through to the food path
    expect(body.ingredients[0]!.status).not.toBe('seasoning');
    expect(body.ingredients[0]!.category).toBe('food');
  });

  it('preserves amountGrams from AI on seasoning items', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fakeClient: any = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValueOnce({
            choices: [{ message: { content: JSON.stringify({
              ...VALID_RECIPE_RAW,
              ingredients: [{ line: '5g Salz', displayName: 'Salz', category: 'seasoning', amountGrams: 5, kitchenAmountText: '1 TL' }],
            }) } }],
          }),
        },
      },
    };
    __setOpenAiClientForTests(fakeClient);
    mockFoodRepo([]);

    const res = await recipeAnalyzeHandler(
      await makeAuthRequest({ body: { text: 'Salz zum Abschmecken geben' } }),
      makeContext(),
    );
    expect(res.status).toBe(200);
    const body = res.jsonBody as { ingredients: { amountGrams: number; inputAmount: number }[] };
    expect(body.ingredients[0]!.amountGrams).toBe(5);
    expect(body.ingredients[0]!.inputAmount).toBe(5);
  });

  it('passes kitchenAmountText from AI response to seasoning item', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fakeClient: any = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValueOnce({
            choices: [{ message: { content: JSON.stringify({
              ...VALID_RECIPE_RAW,
              ingredients: [{ line: '1 TL Oregano', displayName: 'Oregano', category: 'seasoning', amountGrams: 5, kitchenAmountText: '1 TL' }],
            }) } }],
          }),
        },
      },
    };
    __setOpenAiClientForTests(fakeClient);
    mockFoodRepo([]);

    const res = await recipeAnalyzeHandler(
      await makeAuthRequest({ body: { text: 'Oregano hinzufügen' } }),
      makeContext(),
    );
    expect(res.status).toBe(200);
    const body = res.jsonBody as { ingredients: { kitchenAmountText: string | null }[] };
    expect(body.ingredients[0]!.kitchenAmountText).toBe('1 TL');
  });

  it('sets kitchenAmountText to null when AI returns null', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fakeClient: any = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValueOnce({
            choices: [{ message: { content: JSON.stringify({
              ...VALID_RECIPE_RAW,
              ingredients: [{ line: 'Salz', displayName: 'Salz', category: 'seasoning', amountGrams: null, kitchenAmountText: null }],
            }) } }],
          }),
        },
      },
    };
    __setOpenAiClientForTests(fakeClient);
    mockFoodRepo([]);

    const res = await recipeAnalyzeHandler(
      await makeAuthRequest({ body: { text: 'Salz nach Geschmack' } }),
      makeContext(),
    );
    expect(res.status).toBe(200);
    const body = res.jsonBody as { ingredients: { kitchenAmountText: string | null }[] };
    expect(body.ingredients[0]!.kitchenAmountText).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// recipeScalePreviewHandler — authenticated, server-projected text preview
// ---------------------------------------------------------------------------

const VALID_RECIPE_SCALE_RAW: AiRecipeScaleRaw = {
  description: 'Eine angepasste Beschreibung.',
  steps: [
    { order: 1, title: 'Vorbereiten', description: 'Bereite die Zutaten vor.' },
    { order: 2, title: null, description: 'Mische alles gründlich.' },
  ],
};

function mockRecipeScaleClient(response: AiRecipeScaleRaw | string) {
  const create = vi.fn().mockResolvedValue({
    choices: [{ message: { content: typeof response === 'string' ? response : JSON.stringify(response) } }],
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  __setOpenAiClientForTests({ chat: { completions: { create } } } as any);
  return create;
}

function mockRecipeScaleFailure(error = new Error('provider unavailable')) {
  const create = vi.fn().mockRejectedValue(error);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  __setOpenAiClientForTests({ chat: { completions: { create } } } as any);
  return create;
}

async function createRecipeForScale(userId = TEST_USER_ID) {
  return getRecipesRepository().create(userId, {
    name: 'Tomatensauce',
    description: 'Eine einfache Sauce.',
    portions: 4,
    ingredients: [
      {
        id: '00000000-0000-0000-0000-000000000011',
        displayName: 'Tomaten',
        inputMode: 'grams',
        inputAmount: 200,
        amountGrams: 200,
        unit: 'g',
        linkedProductId: null,
        linkedReusableItemId: null,
        isAiEstimate: false,
        category: 'food',
        nutritionPer100g: { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2 },
        nutritionContribution: { calories: 36, protein: 1.8, carbs: 7.8, fat: 0.4, fiber: 2.4 },
      },
      {
        id: '00000000-0000-0000-0000-000000000012',
        displayName: 'Salz',
        inputMode: 'grams',
        inputAmount: null,
        amountGrams: null,
        unit: 'nach Geschmack',
        amountLabel: '1 TL',
        linkedProductId: null,
        linkedReusableItemId: null,
        isAiEstimate: false,
        category: 'seasoning',
        nutritionPer100g: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
        nutritionContribution: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      },
    ],
    steps: [
      { order: 1, title: 'Vorbereiten', description: 'Bereite die Zutaten vor.' },
      { order: 2, description: 'Mische alles gründlich.' },
    ],
    tags: ['Schnell'],
    nutritionTotal: { calories: 36, protein: 1.8, carbs: 7.8, fat: 0.4, fiber: 2.4 },
    nutritionPerPortion: { calories: 9, protein: 0.45, carbs: 1.95, fat: 0.1, fiber: 0.6 },
  });
}

describe('POST /api/ai/recipe-scale/preview', () => {
  beforeEach(() => {
    vi.mocked(enforceQuota).mockResolvedValue(null);
    vi.mocked(trackUsage).mockResolvedValue(undefined);
  });

  it.each([
    ['a non-integer targetPortions', 2.5],
    ['a targetPortions below the lower bound', 0],
    ['a targetPortions above the upper bound', 51],
  ])('returns 400 for %s', async (_caseName, targetPortions) => {
    const create = mockRecipeScaleClient(VALID_RECIPE_SCALE_RAW);
    const res = await recipeScalePreviewHandler(
      await makeAuthRequest({
        body: {
          recipeId: '00000000-0000-0000-0000-000000000001',
          targetPortions,
        },
      }),
      makeContext(),
    );

    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
    expect(enforceQuota).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid recipeId', async () => {
    const create = mockRecipeScaleClient(VALID_RECIPE_SCALE_RAW);
    const res = await recipeScalePreviewHandler(
      await makeAuthRequest({ body: { recipeId: 'not-a-uuid', targetPortions: 2 } }),
      makeContext(),
    );

    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
    expect(enforceQuota).not.toHaveBeenCalled();
  });

  it('returns 404 for a recipe not owned by the authenticated user', async () => {
    const recipe = await createRecipeForScale('another-user');
    const create = mockRecipeScaleClient(VALID_RECIPE_SCALE_RAW);

    const res = await recipeScalePreviewHandler(
      await makeAuthRequest({ body: { recipeId: recipe.id, targetPortions: 2 } }),
      makeContext(),
    );

    expect(res.status).toBe(404);
    expect(create).not.toHaveBeenCalled();
    expect(enforceQuota).not.toHaveBeenCalled();
  });

  it('projects stored ingredients on the server and does not persist the preview', async () => {
    const recipe = await createRecipeForScale();
    const originalSnapshot = JSON.parse(JSON.stringify(recipe));
    const create = mockRecipeScaleClient(VALID_RECIPE_SCALE_RAW);

    const res = await recipeScalePreviewHandler(
      await makeAuthRequest({
        body: {
          recipeId: recipe.id,
          targetPortions: 2,
          originalPortions: 999,
          originalIngredients: [{ displayName: 'Manipulierte Zutat', amountGrams: 99999 }],
        },
      }),
      makeContext(),
    );

    expect(res.status).toBe(200);
    expect(res.jsonBody).toEqual({
      targetPortions: 2,
      description: VALID_RECIPE_SCALE_RAW.description,
      steps: [
        { order: 1, title: 'Vorbereiten', description: 'Bereite die Zutaten vor.' },
        { order: 2, description: 'Mische alles gründlich.' },
      ],
    });

    const request = create.mock.calls[0]?.[0] as {
      messages: Array<{ role: string; content: string }>;
      response_format: {
        type: string;
        json_schema: {
          name: string;
          strict: boolean;
          schema: {
            additionalProperties: boolean;
            properties: {
              steps: { items: { additionalProperties: boolean } };
            };
          };
        };
      };
    };
    expect(request.response_format).toMatchObject({
      type: 'json_schema',
      json_schema: {
        name: 'recipe_scale_preview',
        strict: true,
      },
    });
    expect(request.response_format.json_schema.schema.additionalProperties).toBe(false);
    expect(request.response_format.json_schema.schema.properties.steps.items.additionalProperties).toBe(false);
    const aiInput = JSON.parse(request.messages[1]!.content) as {
      originalPortions: number;
      originalIngredients: Array<{ displayName: string; inputAmount: number | null; amountGrams: number | null; amountLabel: string | null }>;
      targetIngredients: Array<{ displayName: string; inputAmount: number | null; amountGrams: number | null; amountLabel: string | null }>;
    };
    expect(aiInput.originalPortions).toBe(4);
    expect(aiInput.originalIngredients[0]).toMatchObject({ displayName: 'Tomaten', inputAmount: 200, amountGrams: 200 });
    expect(aiInput.targetIngredients[0]).toMatchObject({ displayName: 'Tomaten', inputAmount: 100, amountGrams: 100 });
    expect(aiInput.targetIngredients[1]).toMatchObject({ displayName: 'Salz', amountLabel: '0.5 TL' });
    expect(aiInput.originalIngredients[0]?.displayName).not.toBe('Manipulierte Zutat');

    const storedAfter = await getRecipesRepository().get(TEST_USER_ID, recipe.id);
    expect(storedAfter).toEqual(originalSnapshot);
    expect(res.jsonBody).not.toHaveProperty('nutritionTotal');
    expect(res.jsonBody).not.toHaveProperty('meal');
  });

  it('enforces quota before AI and tracks only after a valid response', async () => {
    const recipe = await createRecipeForScale();
    const order: string[] = [];
    const create = mockRecipeScaleClient(VALID_RECIPE_SCALE_RAW);
    create.mockImplementation(async () => {
      order.push('ai');
      return { choices: [{ message: { content: JSON.stringify(VALID_RECIPE_SCALE_RAW) } }] };
    });
    vi.mocked(enforceQuota).mockImplementation(async () => {
      order.push('quota');
      return null;
    });
    vi.mocked(trackUsage).mockImplementation(async () => {
      order.push('track');
    });

    const res = await recipeScalePreviewHandler(
      await makeAuthRequest({ body: { recipeId: recipe.id, targetPortions: 2 } }),
      makeContext(),
    );

    expect(res.status).toBe(200);
    expect(order).toEqual(['quota', 'ai', 'track']);
    expect(enforceQuota).toHaveBeenCalledWith(
      { userId: TEST_USER_ID, tier: 'free', isAdmin: false },
      'recipe-scale',
    );
    expect(trackUsage).toHaveBeenCalledWith(
      { userId: TEST_USER_ID, tier: 'free', isAdmin: false },
      'recipe-scale',
    );
  });

  it('returns 429 without calling AI or tracking usage when quota is exceeded', async () => {
    const recipe = await createRecipeForScale();
    const create = mockRecipeScaleClient(VALID_RECIPE_SCALE_RAW);
    vi.mocked(enforceQuota).mockResolvedValue({
      status: 429,
      jsonBody: {
        error: 'quota_exceeded',
        feature: 'recipe-scale',
        used: 30,
        limit: 30,
        resetsAt: '2026-09-01T00:00:00.000Z',
      },
    });

    const res = await recipeScalePreviewHandler(
      await makeAuthRequest({ body: { recipeId: recipe.id, targetPortions: 2 } }),
      makeContext(),
    );

    expect(res.status).toBe(429);
    expect((res.jsonBody as Record<string, unknown>).feature).toBe('recipe-scale');
    expect(create).not.toHaveBeenCalled();
    expect(trackUsage).not.toHaveBeenCalled();
  });

  it('returns 502 for an AI failure without consuming quota', async () => {
    const recipe = await createRecipeForScale();
    mockRecipeScaleFailure();

    const res = await recipeScalePreviewHandler(
      await makeAuthRequest({ body: { recipeId: recipe.id, targetPortions: 2 } }),
      makeContext(),
    );

    expect(res.status).toBe(502);
    expect(trackUsage).not.toHaveBeenCalled();
  });

  it('returns 502 for an empty or non-parseable AI response without consuming quota', async () => {
    const recipe = await createRecipeForScale();
    mockRecipeScaleClient('');

    const emptyRes = await recipeScalePreviewHandler(
      await makeAuthRequest({ body: { recipeId: recipe.id, targetPortions: 2 } }),
      makeContext(),
    );
    expect(emptyRes.status).toBe(502);
    expect(trackUsage).not.toHaveBeenCalled();

    mockRecipeScaleClient('{not-json');
    const malformedRes = await recipeScalePreviewHandler(
      await makeAuthRequest({ body: { recipeId: recipe.id, targetPortions: 2 } }),
      makeContext(),
    );
    expect(malformedRes.status).toBe(502);
    expect(trackUsage).not.toHaveBeenCalled();
  });

  it('returns 422 for a parseable response with the wrong step order', async () => {
    const recipe = await createRecipeForScale();
    mockRecipeScaleClient({
      ...VALID_RECIPE_SCALE_RAW,
      steps: [
        VALID_RECIPE_SCALE_RAW.steps[0]!,
        { ...VALID_RECIPE_SCALE_RAW.steps[1]!, order: 1 },
      ],
    });

    const res = await recipeScalePreviewHandler(
      await makeAuthRequest({ body: { recipeId: recipe.id, targetPortions: 2 } }),
      makeContext(),
    );

    expect(res.status).toBe(422);
    expect(trackUsage).not.toHaveBeenCalled();
  });

  it('returns 422 for a parseable response with the wrong step count', async () => {
    const recipe = await createRecipeForScale();
    mockRecipeScaleClient({
      ...VALID_RECIPE_SCALE_RAW,
      steps: [VALID_RECIPE_SCALE_RAW.steps[0]!],
    });

    const res = await recipeScalePreviewHandler(
      await makeAuthRequest({ body: { recipeId: recipe.id, targetPortions: 2 } }),
      makeContext(),
    );

    expect(res.status).toBe(422);
    expect(trackUsage).not.toHaveBeenCalled();
  });

  it('returns 422 for a parseable response with an unexpected field', async () => {
    const recipe = await createRecipeForScale();
    mockRecipeScaleClient({
      ...VALID_RECIPE_SCALE_RAW,
      extra: 'must be rejected',
    } as AiRecipeScaleRaw & { extra: string });

    const res = await recipeScalePreviewHandler(
      await makeAuthRequest({ body: { recipeId: recipe.id, targetPortions: 2 } }),
      makeContext(),
    );

    expect(res.status).toBe(422);
    expect(trackUsage).not.toHaveBeenCalled();
  });

  it('preserves a missing recipe description as null', async () => {
    const recipe = await createRecipeForScale();
    await getRecipesRepository().update(TEST_USER_ID, recipe.id, { description: undefined });
    mockRecipeScaleClient({
      description: null,
      steps: VALID_RECIPE_SCALE_RAW.steps,
    });

    const res = await recipeScalePreviewHandler(
      await makeAuthRequest({ body: { recipeId: recipe.id, targetPortions: 2 } }),
      makeContext(),
    );

    expect(res.status).toBe(200);
    expect(res.jsonBody).toMatchObject({ targetPortions: 2, description: null });
  });

  it('returns 401 without authentication', async () => {
    const { makeRequest } = await import('../test-utils/http');
    const res = await recipeScalePreviewHandler(
      makeRequest({ body: { recipeId: '00000000-0000-0000-0000-000000000001', targetPortions: 2 } }),
      makeContext(),
    );

    expect(res.status).toBe(401);
  });
});
