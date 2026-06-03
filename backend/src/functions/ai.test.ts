import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import type { AiRecipeRaw } from '../lib/openai';

vi.mock('../lib/quota', () => ({
  enforceQuota: vi.fn().mockResolvedValue(null),
  trackUsage: vi.fn().mockResolvedValue(undefined),
}));

import { classifyItem, resolveAmountGrams, mealParserPreviewHandler, mealEstimatePreviewHandler, recipeAnalyzeHandler } from './ai';
import type { AiParsedItem } from '../lib/openai';
import { __setOpenAiClientForTests } from '../lib/openai';
import { _setFoodProductRepository, _resetFoodProductRepository } from '../lib/repositories/foodProductRepository';
import { _setReusableItemsRepository, __resetReusableItemsRepositoryForTests } from '../lib/repositories/reusableItemsRepository';
import type { FoodProductRepository } from '../lib/repositories/foodProductRepository';
import type { ReusableItemsRepository } from '../lib/repositories/reusableItemsRepository';
import type { FoodSearchResult, ReusableItem } from '@fittrack/shared';
import { makeContext, makeAuthRequest, setupTestAuth, teardownTestAuth } from '../test-utils/http';

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
  if (!originalEnv) originalEnv = { ...process.env };
  delete process.env.COSMOS_ENDPOINT;
  delete process.env.COSMOS_KEY;
  _resetFoodProductRepository();
  __resetReusableItemsRepositoryForTests();
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

  it('returns 422 when AI returns implausibly low calories', async () => {
    mockMealEstimateClient({
      ...VALID_ESTIMATE,
      mealEstimate: { calories: 10, protein: 1, carbs: 1, fat: 0, fiber: 0 },
    });
    const res = await mealEstimatePreviewHandler(
      await makeAuthRequest({ body: { text: 'Schnitzel mit Pommes' } }),
      makeContext(),
    );
    expect(res.status).toBe(422);
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

function mockRecipeAnalyzeClient(recipe: AiRecipeRaw, ingredientItems?: AiParsedItem[]) {
  // recipeAnalyzeHandler makes TWO OpenAI calls:
  // 1. analyzeRecipeText → returns AiRecipeRaw
  // 2. parseMeal (for ingredientLines) → returns { items: AiParsedItem[] }
  const parsedIngredients: AiParsedItem[] = ingredientItems ??
    recipe.ingredientLines.map((line) => ({
      rawText: line,
      displayName: line.replace(/^\d+\s*\w*\s+/, '').trim(),
      inputMode: 'grams' as const,
      inputAmount: 100,
    }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fakeClient: any = {
    chat: {
      completions: {
        create: vi.fn()
          .mockResolvedValueOnce({
            choices: [{ message: { content: JSON.stringify(recipe) } }],
          })
          .mockResolvedValueOnce({
            choices: [{ message: { content: JSON.stringify({ items: parsedIngredients }) } }],
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
  ingredientLines: ['300g Hähnchenbrust', '1 Zwiebel'],
  steps: [
    { order: 1, title: 'Vorbereitung', description: 'Hähnchenbrust in Würfel schneiden.' },
    { order: 2, title: null, description: 'Zwiebel anbraten.' },
  ],
};

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
    // When ingredientLines is empty, parseMeal is not called → only one OpenAI call needed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fakeClient: any = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValueOnce({
            choices: [{ message: { content: JSON.stringify({ ...VALID_RECIPE_RAW, ingredientLines: [] }) } }],
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
