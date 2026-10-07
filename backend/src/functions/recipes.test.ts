import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

// Mock storage — no real Azure Blob calls in unit tests
vi.mock('../lib/storage', () => ({
  uploadRecipeImage: () => Promise.resolve({ blobName: 'u1/r1/img1.jpg', imageId: 'img1' }),
  deleteRecipeImage: () => Promise.resolve(undefined),
  generateRecipeImageSasUrl: () => Promise.resolve('https://blob.example.com/img?sas=token'),
}));

vi.mock('../lib/openai', () => ({
  analyzeRecipeText: vi.fn(),
}));

vi.mock('../lib/quota', () => ({
  enforceQuota: vi.fn(),
  trackUsage: vi.fn(),
}));

vi.mock('../lib/recipeAnalyzeValidation', () => ({
  validateRecipeExportPreparationOutput: vi.fn(),
}));

import {
  listRecipesHandler,
  createRecipeHandler,
  getRecipeHandler,
  updateRecipeHandler,
  deleteRecipeHandler,
  uploadImageHandler,
  deleteImageHandler,
  reorderImagesHandler,
  updateImageHeroCropHandler,
  logRecipeHandler,
  setRecipeVisibilityHandler,
  prepareRecipeExportViewHandler,
} from './recipes';
import { analyzeRecipeText } from '../lib/openai';
import { enforceQuota, trackUsage } from '../lib/quota';
import { validateRecipeExportPreparationOutput } from '../lib/recipeAnalyzeValidation';
import { __resetRecipesRepositoryForTests, getRecipesRepository } from '../lib/repositories/recipesRepository';
import { __resetDiaryRepositoryForTests } from '../lib/repositories/diaryRepository';
import { __resetUserFoodRelationRepositoryForTests, getUserFoodRelationRepository } from '../lib/repositories/userFoodRelationRepository';
import {
  makeContext,
  makeAuthRequest,
  makeRequest,
  setupTestAuth,
  signTestToken,
  teardownTestAuth,
  TEST_USER_ID,
} from '../test-utils/http';
import { DEFAULT_RECIPE_IMAGE_HERO_CROP } from '../../../shared/types/recipeImageHeroCrop';

beforeAll(async () => {
  await setupTestAuth();
});

afterAll(() => {
  teardownTestAuth();
});

beforeEach(() => {
  __resetRecipesRepositoryForTests();
  __resetDiaryRepositoryForTests();
  __resetUserFoodRelationRepositoryForTests();
  vi.mocked(analyzeRecipeText).mockReset();
  vi.mocked(enforceQuota).mockReset().mockResolvedValue(null);
  vi.mocked(trackUsage).mockReset().mockResolvedValue(undefined);
  vi.mocked(validateRecipeExportPreparationOutput).mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ctx = makeContext();

async function makeAuthRequestAs(userId: string, init: Parameters<typeof makeRequest>[0] = {}) {
  const token = await signTestToken(userId);
  return makeRequest({
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${token}` },
  });
}

const baseIngredient = {
  id: '00000000-0000-0000-0000-000000000001',
  displayName: 'Mehl',
  inputMode: 'grams',
  inputAmount: 550,
  amountGrams: 550,
  unit: 'g',
  linkedProductId: null,
  linkedReusableItemId: null,
  isAiEstimate: false,
  nutritionPer100g: { calories: 340, protein: 10, carbs: 72, fat: 1, fiber: 3 },
  nutritionContribution: { calories: 1870, protein: 55, carbs: 396, fat: 5.5, fiber: 16.5 },
};

const seasoningIngredient = {
  id: '00000000-0000-0000-0000-000000000002',
  displayName: 'Salz',
  inputMode: 'grams',
  inputAmount: null,
  amountGrams: null,
  unit: 'nach Geschmack',
  amountLabel: 'nach Geschmack',
  linkedProductId: null,
  linkedReusableItemId: null,
  isAiEstimate: false,
  category: 'seasoning',
  nutritionPer100g: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  nutritionContribution: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
};

const baseStep = {
  order: 1,
  description: 'Zutaten mischen.',
};

const baseExportView = {
  version: 1,
  teaser: 'Einfaches Sauerteigbrot',
  totalTimeMinutes: 90,
  difficulty: 'Einfach',
  steps: [{ order: 1, description: 'Zutaten mischen.' }],
  includedIngredientIds: [baseIngredient.id],
};

function responseEtag(response: { headers?: unknown }): string {
  const headers = response.headers as Record<string, string> | undefined;
  return headers?.['ETag'] ?? headers?.['etag'] ?? '';
}

async function createTestRecipe(ingredients = [baseIngredient], description?: string) {
  const req = await makeAuthRequest({
    body: {
      name: 'Sauerteigbrot',
      ...(description !== undefined ? { description } : {}),
      portions: 4,
      ingredients,
      steps: [baseStep],
      tags: ['Brot'],
    },
  });
  const res = await createRecipeHandler(req, ctx);
  expect(res.status).toBe(201);
  expect(responseEtag(res)).toMatch(/^".+"$/);
  return res.jsonBody as Record<string, unknown>;
}

async function createTestRecipeWithExportView(description?: string) {
  const req = await makeAuthRequest({
    body: {
      name: 'Sauerteigbrot',
      ...(description !== undefined ? { description } : {}),
      portions: 4,
      ingredients: [baseIngredient],
      steps: [baseStep],
      tags: ['Brot'],
      exportView: baseExportView,
      exportViewAction: 'confirm',
    },
  });
  const res = await createRecipeHandler(req, ctx);
  expect(res.status).toBe(201);
  expect(responseEtag(res)).toMatch(/^".+"$/);
  return res.jsonBody as Record<string, unknown>;
}

function setValidPreparationAnalysis(
  ingredients: Array<{ analysisKey: string; displayName: string; category?: 'food' | 'seasoning' }>,
  includedKeys: string[],
) {
  const analysis = {
    suggestedName: 'Sauerteigbrot',
    description: 'Einfaches Brot',
    suggestedPortions: 4,
    tags: ['Brot'],
    ingredients: ingredients.map((ingredient) => ({
      ...ingredient,
      line: ingredient.displayName,
      category: ingredient.category ?? 'food',
      amountGrams: ingredient.category === 'seasoning' ? null : 500,
      kitchenAmountText: ingredient.category === 'seasoning' ? 'nach Geschmack' : null,
    })),
    steps: [{ order: 1, title: null, description: 'Mischen.' }],
    exportSuggestion: {
      version: 1,
      teaser: 'Goldbraunes Brot',
      totalTimeMinutes: 90,
      difficulty: 'Einfach',
      steps: [{
        order: 1,
        description: 'Mischen.',
        sourceStepOrders: [1],
        ingredientKeys: includedKeys,
      }],
      includedIngredientKeys: includedKeys,
    },
  };
  vi.mocked(analyzeRecipeText).mockResolvedValue(analysis as any);
  vi.mocked(validateRecipeExportPreparationOutput).mockReturnValue({ ok: true, data: analysis as any });
  return analysis;
}

async function getRecipeEtag(recipeId: string): Promise<string> {
  const response = await getRecipeHandler(
    await makeAuthRequest({ params: { id: recipeId } }),
    ctx,
  );
  expect(response.status).toBe(200);
  return responseEtag(response);
}

async function requestV2Preparation(recipeId: string, ifMatch?: string) {
  return prepareRecipeExportViewHandler(
    await makeAuthRequest({
      params: { id: recipeId },
      ...(ifMatch !== undefined ? { headers: { 'if-match': ifMatch } } : {}),
      body: { contractVersion: 2 },
    }),
    ctx,
  );
}

function expectTextOnlyPreparation(
  response: { status?: number; jsonBody?: unknown },
  recipeId: string,
  sourceEtag: string,
) {
  expect(response.status).toBe(200);
  expect(response.jsonBody).toMatchObject({
    contractVersion: 2,
    recipeId,
    sourceEtag,
    suggestion: {
      version: 1,
      teaser: 'Goldbraunes Brot',
      totalTimeMinutes: 90,
      difficulty: 'Einfach',
      steps: [{ order: 1, description: 'Mischen.' }],
    },
  });
  const suggestion = (response.jsonBody as { suggestion: Record<string, unknown> }).suggestion;
  expect(suggestion).not.toHaveProperty('ingredientResolutions');
  expect(suggestion).not.toHaveProperty('includedIngredientIds');
  expect(suggestion).not.toHaveProperty('includedIngredientKeys');
}

// ---------------------------------------------------------------------------
// POST /recipes — createRecipe
// ---------------------------------------------------------------------------

describe('POST /recipes/{id}/export-view/prepare', () => {
  it('returns a transient, server-generated export suggestion without persisting it', async () => {
    const recipe = await createTestRecipe([baseIngredient], 'Canonical recipe description');
    const createText = vi.mocked(analyzeRecipeText);
    const createAnalysis = vi.mocked(validateRecipeExportPreparationOutput);
    const calls: string[] = [];
    const recipeAnalysis = {
      suggestedName: 'Sauerteigbrot',
      description: 'Einfaches Brot',
      suggestedPortions: 4,
      tags: ['Brot'],
      ingredients: [
        {
          analysisKey: 'ingredient-1',
          line: '500g Mehl',
          displayName: 'Mehl',
          category: 'food',
          amountGrams: 500,
          kitchenAmountText: null,
        },
      ],
      steps: [{ order: 1, title: null, description: 'Mischen.' }],
      exportSuggestion: {
        version: 1,
        teaser: 'Goldbraunes Brot',
        totalTimeMinutes: 90,
        difficulty: 'Einfach',
        steps: [{ order: 1, description: 'Mischen.', sourceStepOrders: [1], ingredientKeys: ['ingredient-1'] }],
        includedIngredientKeys: ['ingredient-1'],
      },
    } as const;

    vi.mocked(enforceQuota).mockImplementation(async () => {
      calls.push('quota');
      return null;
    });
    createText.mockImplementation(async () => {
      calls.push('provider');
      return recipeAnalysis as any;
    });
    createAnalysis.mockImplementation((raw) => {
      calls.push('validation');
      return { ok: true, data: raw as any };
    });
    vi.mocked(trackUsage).mockImplementation(async () => {
      calls.push('tracking');
    });

    const etag = await getRecipeEtag(String(recipe['id']));
    const recipeId = String(recipe['id']);
    const response = await requestV2Preparation(recipeId);

    expectTextOnlyPreparation(response, recipeId, etag);
    expect(calls).toEqual(['quota', 'provider', 'validation', 'tracking']);
    expect(enforceQuota).toHaveBeenCalledTimes(1);
    expect(enforceQuota).toHaveBeenCalledWith(expect.objectContaining({ userId: TEST_USER_ID }), 'recipe-analyze');
    expect(trackUsage).toHaveBeenCalledTimes(1);
    expect(trackUsage).toHaveBeenCalledWith(expect.objectContaining({ userId: TEST_USER_ID }), 'recipe-analyze');

    const storedRecipe = await getRecipeHandler(
      await makeAuthRequest({ params: { id: recipeId } }),
      ctx,
    );
    expect(responseEtag(storedRecipe)).toBe(etag);
    expect(storedRecipe.jsonBody).toMatchObject({
      description: 'Canonical recipe description',
      steps: recipe['steps'],
      ingredients: recipe['ingredients'],
    });
    expect(storedRecipe.jsonBody).not.toHaveProperty('exportView');
    expect(storedRecipe.jsonBody).not.toHaveProperty('exportViewStatus');
  });

  it('rejects the legacy V1 request body before quota or AI work', async () => {
    const recipe = await createTestRecipe();
    const response = await prepareRecipeExportViewHandler(
      await makeAuthRequest({ params: { id: String(recipe['id']) }, body: {} }),
      ctx,
    );

    expect(response.status).toBe(400);
    expect(response.jsonBody).toEqual({ error: 'invalid_export_preparation_request' });
    expect(enforceQuota).not.toHaveBeenCalled();
    expect(analyzeRecipeText).not.toHaveBeenCalled();
    expect(trackUsage).not.toHaveBeenCalled();
  });

  it('does not return a resolution for duplicate exact ingredient names', async () => {
    const duplicateIngredient = {
      ...baseIngredient,
      id: '00000000-0000-0000-0000-000000000003',
    };
    const recipe = await createTestRecipe([baseIngredient, duplicateIngredient]);
    const validAnalysis = {
      suggestedName: 'Sauerteigbrot',
      description: 'Einfaches Brot',
      suggestedPortions: 4,
      tags: ['Brot'],
      ingredients: [{
        analysisKey: 'ingredient-1',
        line: '500g Mehl',
        displayName: 'Mehl',
        category: 'food',
        amountGrams: 500,
        kitchenAmountText: null,
      }],
      steps: [{ order: 1, title: null, description: 'Mischen.' }],
      exportSuggestion: {
        version: 1,
        teaser: 'Goldbraunes Brot',
        totalTimeMinutes: 90,
        difficulty: 'Einfach',
        steps: [{
          order: 1,
          description: 'Mischen.',
          sourceStepOrders: [1],
          ingredientKeys: ['ingredient-1'],
        }],
        includedIngredientKeys: ['ingredient-1'],
      },
    };
    vi.mocked(analyzeRecipeText).mockResolvedValue(validAnalysis as any);
    vi.mocked(validateRecipeExportPreparationOutput).mockReturnValue({ ok: true, data: validAnalysis as any });

    const recipeId = String(recipe['id']);
    const etag = await getRecipeEtag(recipeId);
    const response = await requestV2Preparation(recipeId, etag);

    expectTextOnlyPreparation(response, recipeId, etag);
    expect(trackUsage).toHaveBeenCalledTimes(1);
  });

  it('does not return a resolution for unmatched AI ingredient names', async () => {
    const recipe = await createTestRecipe();
    setValidPreparationAnalysis([{ analysisKey: 'ingredient-unknown', displayName: 'Kichererbsen' }], [
      'ingredient-unknown',
    ]);

    const recipeId = String(recipe['id']);
    const etag = await getRecipeEtag(recipeId);
    const response = await requestV2Preparation(recipeId, etag);

    expectTextOnlyPreparation(response, recipeId, etag);
    expect(trackUsage).toHaveBeenCalledTimes(1);
  });

  it('does not resolve separate AI ingredient keys to the same saved ingredient', async () => {
    const recipe = await createTestRecipe();
    setValidPreparationAnalysis([
      { analysisKey: 'flour-a', displayName: 'Mehl' },
      { analysisKey: 'flour-b', displayName: 'Mehl' },
    ], ['flour-a', 'flour-b']);

    const recipeId = String(recipe['id']);
    const etag = await getRecipeEtag(recipeId);
    const response = await requestV2Preparation(recipeId, etag);

    expectTextOnlyPreparation(response, recipeId, etag);
    expect(trackUsage).toHaveBeenCalledTimes(1);
  });

  it('rejects missing or non-empty request bodies', async () => {
    const recipe = await createTestRecipe();
    const params = { id: String(recipe['id']) };

    const missingBody = await prepareRecipeExportViewHandler(
      await makeAuthRequest({ params }),
      ctx,
    );
    const legacyBody = await prepareRecipeExportViewHandler(
      await makeAuthRequest({ params, body: {} }),
      ctx,
    );
    const extraField = await prepareRecipeExportViewHandler(
      await makeAuthRequest({ params, body: { totalTimeMinutes: 45 } }),
      ctx,
    );
    const invalidVersion = await prepareRecipeExportViewHandler(
      await makeAuthRequest({ params, body: { contractVersion: 1 } }),
      ctx,
    );
    const extraV2Field = await prepareRecipeExportViewHandler(
      await makeAuthRequest({ params, body: { contractVersion: 2, extra: true } }),
      ctx,
    );

    expect(missingBody.status).toBe(400);
    expect(legacyBody.status).toBe(400);
    expect(extraField.status).toBe(400);
    expect(invalidVersion.status).toBe(400);
    expect(extraV2Field.status).toBe(400);
    expect(missingBody.jsonBody).toEqual({ error: 'invalid_export_preparation_request' });
    expect(legacyBody.jsonBody).toEqual({ error: 'invalid_export_preparation_request' });
    expect(extraField.jsonBody).toEqual({ error: 'invalid_export_preparation_request' });
    expect(invalidVersion.jsonBody).toEqual({ error: 'invalid_export_preparation_request' });
    expect(extraV2Field.jsonBody).toEqual({ error: 'invalid_export_preparation_request' });
    expect(analyzeRecipeText).not.toHaveBeenCalled();
    expect(enforceQuota).not.toHaveBeenCalled();
    expect(trackUsage).not.toHaveBeenCalled();
  });

  it('logs a safe field diagnostic for an invalid preparation request', async () => {
    const warningLogs = vi.spyOn(ctx, 'warn').mockImplementation(() => {});

    try {
      const response = await prepareRecipeExportViewHandler(
        await makeAuthRequest({
          params: { id: 'recipe-1' },
          body: { contractVersion: 2, privateField: 'private request value' },
        }),
        ctx,
      );

      expect(response.status).toBe(400);
      const serializedWarningLogs = warningLogs.mock.calls.map(([line]) => String(line)).join('\n');
      expect(serializedWarningLogs).toContain('"failure_stage":"request_validation"');
      expect(serializedWarningLogs).toContain('"validation_diagnostics":"unrecognized_keys@body[privateField]"');
      expect(serializedWarningLogs).not.toContain('private request value');
    } finally {
      warningLogs.mockRestore();
    }
  });

  it('rejects a stale V2 If-Match before quota and provider work', async () => {
    const recipe = await createTestRecipe();
    const response = await prepareRecipeExportViewHandler(
      await makeAuthRequest({
        params: { id: String(recipe['id']) },
        headers: { 'if-match': '"stale-revision"' },
        body: { contractVersion: 2 },
      }),
      ctx,
    );

    expect(response.status).toBe(412);
    expect(response.jsonBody).toEqual({ error: 'recipe_revision_conflict' });
    expect(enforceQuota).not.toHaveBeenCalled();
    expect(analyzeRecipeText).not.toHaveBeenCalled();
    expect(trackUsage).not.toHaveBeenCalled();
  });

  it('returns only text when an AI ingredient exactly matches a saved ingredient', async () => {
    const fuzzyIngredient = {
      ...baseIngredient,
      id: '00000000-0000-0000-0000-000000000004',
      displayName: 'Dinkelmehl',
    };
    const recipe = await createTestRecipe([baseIngredient, fuzzyIngredient]);
    const recipeId = String(recipe['id']);
    const etag = await getRecipeEtag(recipeId);
    setValidPreparationAnalysis([{ analysisKey: 'flour', displayName: 'Mehl' }], ['flour']);

    const response = await requestV2Preparation(recipeId, etag);

    expectTextOnlyPreparation(response, recipeId, etag);
    expect(trackUsage).toHaveBeenCalledTimes(1);
    expect(analyzeRecipeText).toHaveBeenCalledTimes(1);

    const storedRecipe = await getRecipeHandler(await makeAuthRequest({ params: { id: recipeId } }), ctx);
    expect(responseEtag(storedRecipe)).toBe(etag);
    expect(storedRecipe.jsonBody).not.toHaveProperty('exportView');
  });

  it('does not return ingredient resolutions for a fuzzy saved ingredient name', async () => {
    const fuzzyIngredient = {
      ...baseIngredient,
      id: '00000000-0000-0000-0000-000000000006',
      displayName: 'Dinkelmehl',
    };
    const recipe = await createTestRecipe([fuzzyIngredient]);
    const recipeId = String(recipe['id']);
    const etag = await getRecipeEtag(recipeId);
    setValidPreparationAnalysis([{ analysisKey: 'flour', displayName: 'Mehl' }], ['flour']);

    const response = await requestV2Preparation(recipeId, etag);

    expectTextOnlyPreparation(response, recipeId, etag);
  });

  it('does not return ambiguity candidates for duplicate exact ingredient names', async () => {
    const duplicateIngredient = {
      ...baseIngredient,
      id: '00000000-0000-0000-0000-000000000004',
    };
    const recipe = await createTestRecipe([baseIngredient, duplicateIngredient]);
    const recipeId = String(recipe['id']);
    const etag = await getRecipeEtag(recipeId);
    setValidPreparationAnalysis([{ analysisKey: 'flour', displayName: 'Mehl' }], ['flour']);

    const response = await requestV2Preparation(recipeId, etag);

    expectTextOnlyPreparation(response, recipeId, etag);
  });

  it('does not return candidates for overlapping fuzzy ingredient names', async () => {
    const dinkelmehl = {
      ...baseIngredient,
      id: '00000000-0000-0000-0000-000000000004',
      displayName: 'Dinkelmehl',
    };
    const weizenmehl = {
      ...baseIngredient,
      id: '00000000-0000-0000-0000-000000000005',
      displayName: 'Weizenmehl',
    };
    const recipe = await createTestRecipe([dinkelmehl, weizenmehl]);
    const recipeId = String(recipe['id']);
    const etag = await getRecipeEtag(recipeId);
    setValidPreparationAnalysis([{ analysisKey: 'flour', displayName: 'Mehl' }], ['flour']);

    const response = await requestV2Preparation(recipeId, etag);

    expectTextOnlyPreparation(response, recipeId, etag);
  });

  it('does not expose unmatched AI ingredient names', async () => {
    const recipe = await createTestRecipe();
    const recipeId = String(recipe['id']);
    const etag = await getRecipeEtag(recipeId);
    setValidPreparationAnalysis([
      { analysisKey: 'flour', displayName: 'Mehl' },
      { analysisKey: 'chickpeas', displayName: 'Kichererbsen' },
    ], ['flour', 'chickpeas']);

    const response = await requestV2Preparation(recipeId, etag);

    expectTextOnlyPreparation(response, recipeId, etag);
  });

  it('does not return AI ingredient mappings for seasonings', async () => {
    const recipe = await createTestRecipe([seasoningIngredient]);
    const recipeId = String(recipe['id']);
    const etag = await getRecipeEtag(recipeId);
    setValidPreparationAnalysis([{ analysisKey: 'salt', displayName: 'Salz' }], ['salt']);

    const response = await requestV2Preparation(recipeId, etag);

    expectTextOnlyPreparation(response, recipeId, etag);
  });

  it('does not search for matching ingredients in another recipe', async () => {
    await createTestRecipe([baseIngredient]);
    const currentRecipe = await createTestRecipe([{
      ...baseIngredient,
      id: '00000000-0000-0000-0000-000000000004',
      displayName: 'Tomaten',
    }]);
    const recipeId = String(currentRecipe['id']);
    const etag = await getRecipeEtag(recipeId);
    setValidPreparationAnalysis([{ analysisKey: 'flour', displayName: 'Mehl' }], ['flour']);

    const response = await requestV2Preparation(recipeId, etag);

    expectTextOnlyPreparation(response, recipeId, etag);
  });

  it('enforces recipe-analyze quota for V2 before provider work', async () => {
    const recipe = await createTestRecipe();
    const recipeId = String(recipe['id']);
    const etag = await getRecipeEtag(recipeId);
    const quotaResponse = {
      status: 429,
      jsonBody: { error: 'quota_exceeded', feature: 'recipe-analyze' },
    };
    vi.mocked(enforceQuota).mockResolvedValue(quotaResponse);

    const response = await requestV2Preparation(recipeId, etag);

    expect(response).toEqual(quotaResponse);
    expect(enforceQuota).toHaveBeenCalledWith(expect.objectContaining({ userId: TEST_USER_ID }), 'recipe-analyze');
    expect(analyzeRecipeText).not.toHaveBeenCalled();
    expect(trackUsage).not.toHaveBeenCalled();
  });

  it('does not track usage for a V2 provider failure', async () => {
    const recipe = await createTestRecipe();
    const etag = await getRecipeEtag(String(recipe['id']));
    const providerError = Object.assign(new Error('private prompt content'), {
      code: 'rate_limit_exceeded',
      status: 429,
      type: 'requests',
      request_id: 'req-12345678',
    });
    vi.mocked(analyzeRecipeText).mockRejectedValue(providerError);
    const errorSpy = vi.spyOn(ctx, 'error').mockImplementation(() => {});

    try {
      const response = await requestV2Preparation(String(recipe['id']), etag);

      expect(response.status).toBe(502);
      expect(trackUsage).not.toHaveBeenCalled();
      expect(validateRecipeExportPreparationOutput).not.toHaveBeenCalled();
      const lines = errorSpy.mock.calls.map(([line]) => String(line));
      const analysisFailure = lines.find((line) => line.includes('"event":"recipes.prepareExportView.analysisFailed"'));
      expect(analysisFailure).toContain('"failure_stage":"azure_openai_analysis"');
      expect(analysisFailure).toContain('"provider_error_code":"rate_limit_exceeded"');
      expect(analysisFailure).toContain('"provider_status_code":429');
      expect(analysisFailure).toContain('"provider_request_id":"req-12345678"');
      expect(analysisFailure).not.toContain('private prompt content');
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('does not track usage for an invalid V2 AI result', async () => {
    const recipe = await createTestRecipe();
    const etag = await getRecipeEtag(String(recipe['id']));
    vi.mocked(analyzeRecipeText).mockResolvedValue({} as any);
    vi.mocked(validateRecipeExportPreparationOutput).mockReturnValue({
      ok: false,
      errors: ['private generated text was invalid'],
      diagnostics: [{ phase: 'semantic', code: 'source_step_coverage_mismatch', path: 'exportSuggestion.steps' }],
    });
    const warningSpy = vi.spyOn(ctx, 'warn').mockImplementation(() => {});

    try {
      const response = await requestV2Preparation(String(recipe['id']), etag);

      expect(response.status).toBe(422);
      expect(trackUsage).not.toHaveBeenCalled();
      const lines = warningSpy.mock.calls.map(([line]) => String(line));
      const validationFailure = lines.find((line) => line.includes('"event":"recipes.prepareExportView.validationFailed"'));
      expect(validationFailure).toContain('"failure_stage":"analysis_output_validation"');
      expect(validationFailure).toContain('semantic:source_step_coverage_mismatch@exportSuggestion.steps');
      expect(validationFailure).not.toContain('private generated text was invalid');
    } finally {
      warningSpy.mockRestore();
    }
  });

  it('returns the recipe-analyze quota response without calling the provider or tracking usage', async () => {
    const recipe = await createTestRecipe();
    const quotaResponse = {
      status: 429,
      jsonBody: {
        error: 'quota_exceeded',
        feature: 'recipe-analyze',
        used: 10,
        limit: 10,
        resetsAt: '2026-10-01T00:00:00.000Z',
      },
    };
    vi.mocked(enforceQuota).mockResolvedValue(quotaResponse);

    const etag = await getRecipeEtag(String(recipe['id']));
    const response = await requestV2Preparation(String(recipe['id']), etag);

    expect(response).toEqual(quotaResponse);
    expect(enforceQuota).toHaveBeenCalledTimes(1);
    expect(analyzeRecipeText).not.toHaveBeenCalled();
    expect(trackUsage).not.toHaveBeenCalled();
  });

  it('does not track usage when the provider fails', async () => {
    const recipe = await createTestRecipe();
    vi.mocked(analyzeRecipeText).mockRejectedValue(new Error('provider failed'));

    const etag = await getRecipeEtag(String(recipe['id']));
    const response = await requestV2Preparation(String(recipe['id']), etag);

    expect(response.status).toBe(502);
    expect(trackUsage).not.toHaveBeenCalled();
    expect(validateRecipeExportPreparationOutput).not.toHaveBeenCalled();
  });

  it('does not track usage when server validation rejects the provider result', async () => {
    const recipe = await createTestRecipe();
    vi.mocked(analyzeRecipeText).mockResolvedValue({} as any);
    vi.mocked(validateRecipeExportPreparationOutput).mockReturnValue({
      ok: false,
      errors: ['invalid output'],
      diagnostics: [{ phase: 'schema', code: 'invalid_type', path: 'exportSuggestion.teaser' }],
    });

    const etag = await getRecipeEtag(String(recipe['id']));
    const response = await requestV2Preparation(String(recipe['id']), etag);

    expect(response.status).toBe(422);
    expect(trackUsage).not.toHaveBeenCalled();
  });

  it('prepares valid export texts even when unused AI ingredient references are invalid', async () => {
    const recipe = await createTestRecipe();
    const analysis = setValidPreparationAnalysis([{ analysisKey: 'flour', displayName: 'Mehl' }], ['unknown']);
    const actualValidation = await vi.importActual<typeof import('../lib/recipeAnalyzeValidation')>(
      '../lib/recipeAnalyzeValidation',
    );
    expect(actualValidation.validateRecipeAnalyzeOutput(analysis).ok).toBe(false);
    vi.mocked(validateRecipeExportPreparationOutput).mockImplementation(actualValidation.validateRecipeExportPreparationOutput);

    const recipeId = String(recipe['id']);
    const etag = await getRecipeEtag(recipeId);
    const response = await requestV2Preparation(recipeId, etag);

    expect(response.status).toBe(200);
    expectTextOnlyPreparation(response, recipeId, etag);
    expect(trackUsage).toHaveBeenCalledTimes(1);
    const storedRecipe = await getRecipeHandler(await makeAuthRequest({ params: { id: recipeId } }), ctx);
    expect(responseEtag(storedRecipe)).toBe(etag);
    expect(storedRecipe.jsonBody).not.toHaveProperty('exportView');
  });

  it.each([
    ['teaser length', (analysis: ReturnType<typeof setValidPreparationAnalysis>) => {
      analysis.exportSuggestion.teaser = 'x'.repeat(97);
    }],
    ['step length', (analysis: ReturnType<typeof setValidPreparationAnalysis>) => {
      analysis.exportSuggestion.steps[0]!.description = 'x'.repeat(91);
    }],
    ['time', (analysis: ReturnType<typeof setValidPreparationAnalysis>) => {
      analysis.exportSuggestion.totalTimeMinutes = 0;
    }],
    ['difficulty', (analysis: ReturnType<typeof setValidPreparationAnalysis>) => {
      analysis.exportSuggestion.difficulty = 'Einfach\nSchwer';
    }],
    ['unknown source step', (analysis: ReturnType<typeof setValidPreparationAnalysis>) => {
      analysis.exportSuggestion.steps[0]!.sourceStepOrders = [2];
    }],
    ['duplicate source step', (analysis: ReturnType<typeof setValidPreparationAnalysis>) => {
      analysis.exportSuggestion.steps[0]!.sourceStepOrders = [1, 1];
    }],
    ['missing source step', (analysis: ReturnType<typeof setValidPreparationAnalysis>) => {
      analysis.exportSuggestion.steps = [];
    }],
    ['export order', (analysis: ReturnType<typeof setValidPreparationAnalysis>) => {
      analysis.exportSuggestion.steps[0]!.order = 2;
    }],
  ] as const)('still rejects invalid %s without consuming quota', async (_case, invalidate) => {
    const recipe = await createTestRecipe();
    const analysis = setValidPreparationAnalysis([{ analysisKey: 'flour', displayName: 'Mehl' }], ['flour']);
    invalidate(analysis);
    const actualValidation = await vi.importActual<typeof import('../lib/recipeAnalyzeValidation')>(
      '../lib/recipeAnalyzeValidation',
    );
    vi.mocked(validateRecipeExportPreparationOutput).mockImplementation(actualValidation.validateRecipeExportPreparationOutput);

    const response = await requestV2Preparation(String(recipe['id']));

    expect(response.status).toBe(422);
    expect(response.jsonBody).toMatchObject({ details: expect.any(Array) });
    expect(trackUsage).not.toHaveBeenCalled();
  });

  it('requires authentication before quota enforcement or AI work', async () => {
    const recipe = await createTestRecipe();
    const response = await prepareRecipeExportViewHandler(
      makeRequest({
        params: { id: String(recipe['id']) },
        headers: { 'if-match': '"revision"' },
        body: { contractVersion: 2 },
      }),
      ctx,
    );
    const v2Response = await prepareRecipeExportViewHandler(
      makeRequest({
        params: { id: String(recipe['id']) },
        headers: { 'if-match': '"revision"' },
        body: { contractVersion: 2 },
      }),
      ctx,
    );

    expect(response.status).toBe(401);
    expect(v2Response.status).toBe(401);
    expect(enforceQuota).not.toHaveBeenCalled();
    expect(analyzeRecipeText).not.toHaveBeenCalled();
    expect(trackUsage).not.toHaveBeenCalled();
  });

  it('does not expose another user\'s recipe to a V2 preparation request', async () => {
    const recipe = await createTestRecipe();
    const recipeId = String(recipe['id']);
    const ownerVersion = await getRecipesRepository().getVersioned(TEST_USER_ID, recipeId);
    await getRecipesRepository().setVisibility(TEST_USER_ID, recipeId, ownerVersion!.etag, {
      visibility: 'community',
      contentConfirmed: true,
      displayNameConsent: false,
    });
    const etag = await getRecipeEtag(recipeId);
    const token = await signTestToken('other-user');
    const response = await prepareRecipeExportViewHandler(
      makeRequest({
        params: { id: recipeId },
        headers: { authorization: `Bearer ${token}`, 'if-match': etag },
        body: { contractVersion: 2 },
      }),
      ctx,
    );

    expect(response.status).toBe(404);
    expect(enforceQuota).not.toHaveBeenCalled();
    expect(analyzeRecipeText).not.toHaveBeenCalled();
    expect(trackUsage).not.toHaveBeenCalled();
  });
});

describe('PUT /recipes/:id/visibility', () => {
  it('requires strict sharing confirmation and uses an optional ETag precondition', async () => {
    const recipe = await createTestRecipe();
    const recipeId = String(recipe['id']);
    const initialEtag = await getRecipeEtag(recipeId);

    const missingConfirmation = await setRecipeVisibilityHandler(
      await makeAuthRequest({
        params: { id: recipeId },
        body: { visibility: 'community', displayNameConsent: false },
      }),
      ctx,
    );
    const extraField = await setRecipeVisibilityHandler(
      await makeAuthRequest({
        params: { id: recipeId },
        body: { visibility: 'community', confirmContentSharing: true, displayNameConsent: false, ownerUserId: 'forged' },
      }),
      ctx,
    );
    expect(missingConfirmation.status).toBe(400);
    expect(extraField.status).toBe(400);
    expect((await getRecipesRepository().get(TEST_USER_ID, recipeId))?.visibility).toBe('private');

    const published = await setRecipeVisibilityHandler(
      await makeAuthRequest({
        params: { id: recipeId },
        headers: { 'if-match': initialEtag },
        body: { visibility: 'community', confirmContentSharing: true, displayNameConsent: false },
      }),
      ctx,
    );
    expect(published.status).toBe(200);
    expect(responseEtag(published)).not.toBe(initialEtag);
    expect(published.jsonBody).toMatchObject({
      visibility: 'community',
      communityPublication: { displayNameConsent: false, contentConfirmedAt: expect.any(String) },
    });

    const staleWrite = await setRecipeVisibilityHandler(
      await makeAuthRequest({
        params: { id: recipeId },
        headers: { 'if-match': initialEtag },
        body: { visibility: 'private' },
      }),
      ctx,
    );
    expect(staleWrite.status).toBe(412);
    expect(staleWrite.jsonBody).toEqual({ error: 'recipe_revision_conflict' });

    const unpublished = await setRecipeVisibilityHandler(
      await makeAuthRequest({ params: { id: recipeId }, body: { visibility: 'private' } }),
      ctx,
    );
    expect(unpublished.status).toBe(200);
    expect(unpublished.jsonBody).toMatchObject({ visibility: 'private' });
    expect(unpublished.jsonBody).not.toHaveProperty('communityPublication');
  });

  it('requires authentication, keeps visibility owner-only and rejects publication fields on ordinary mutations', async () => {
    const recipe = await createTestRecipe();
    const recipeId = String(recipe['id']);
    const unauthenticated = await setRecipeVisibilityHandler(
      makeRequest({ params: { id: recipeId }, body: { visibility: 'private' } }),
      ctx,
    );
    const foreignWrite = await setRecipeVisibilityHandler(
      await makeAuthRequestAs('other-user', {
        params: { id: recipeId },
        body: { visibility: 'community', confirmContentSharing: true, displayNameConsent: true },
      }),
      ctx,
    );
    const injectedCreate = await createRecipeHandler(await makeAuthRequest({
      body: {
        name: 'Injected', portions: 1, ingredients: [], steps: [], tags: [],
        visibility: 'community',
        communityPublication: { contentConfirmedAt: new Date().toISOString(), displayNameConsent: true },
      },
    }), ctx);
    const injectedUpdate = await updateRecipeHandler(await makeAuthRequest({
      params: { id: recipeId },
      body: { communityPublication: { contentConfirmedAt: new Date().toISOString(), displayNameConsent: true } },
    }), ctx);

    expect(unauthenticated.status).toBe(401);
    expect(foreignWrite.status).toBe(404);
    expect(injectedCreate.status).toBe(400);
    expect(injectedCreate.jsonBody).toEqual({ error: 'recipe_visibility_requires_dedicated_endpoint' });
    expect(injectedUpdate.status).toBe(400);
    expect((await getRecipesRepository().get(TEST_USER_ID, recipeId))?.visibility).toBe('private');
  });
});

describe('POST /recipes — createRecipe', () => {
  it('returns 201 with calculated nutrition', async () => {
    const recipe = await createTestRecipe();
    expect(recipe['name']).toBe('Sauerteigbrot');
    expect(recipe['portions']).toBe(4);
    expect((recipe['nutritionTotal'] as Record<string, number>)['calories']).toBeGreaterThan(0);
    expect((recipe['nutritionPerPortion'] as Record<string, number>)['calories']).toBeGreaterThan(0);
    expect(recipe['images']).toEqual([]);
    expect(recipe['ownerUserId']).toBe(TEST_USER_ID);
  });

  it('returns 400 for missing name', async () => {
    const req = await makeAuthRequest({ body: { portions: 2, ingredients: [], steps: [], tags: [] } });
    const res = await createRecipeHandler(req, ctx);
    expect(res.status).toBe(400);
  });

  it('returns 400 for zero portions', async () => {
    const req = await makeAuthRequest({
      body: { name: 'Test', portions: 0, ingredients: [], steps: [], tags: [] },
    });
    const res = await createRecipeHandler(req, ctx);
    // portions: 0 fails coerce.number().positive()
    expect(res.status).toBe(400);
  });

  it('returns 401 without token', async () => {
    const { makeRequest } = await import('../test-utils/http');
    const req = makeRequest({ body: { name: 'X', portions: 1, ingredients: [], steps: [], tags: [] } });
    const res = await createRecipeHandler(req, ctx);
    expect(res.status).toBe(401);
  });

  it('accepts a legacy ingredient payload without extension fields', async () => {
    const recipe = await createTestRecipe();
    const ingredients = recipe['ingredients'] as Array<Record<string, unknown>>;

    expect(ingredients[0]?.['category']).toBeUndefined();
    expect(ingredients[0]?.['amountLabel']).toBeUndefined();
    expect(ingredients[0]?.['kitchenAmountText']).toBeUndefined();
  });

  it('persists a server-fingerprinted exportView and returns current status', async () => {
    const recipe = await createTestRecipeWithExportView();
    const exportView = recipe['exportView'] as Record<string, unknown>;

    expect(exportView).toMatchObject(baseExportView);
    expect(exportView['sourceFingerprint']).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(recipe['exportViewStatus']).toBe('current');
    expect(recipe).not.toHaveProperty('exportViewAction');

    const getRes = await getRecipeHandler(
      await makeAuthRequest({ params: { id: String(recipe['id']) } }),
      ctx,
    );
    expect(getRes.status).toBe(200);
    expect(responseEtag(getRes)).toMatch(/^".+"$/);
    expect((getRes.jsonBody as Record<string, unknown>)['exportViewStatus']).toBe('current');

    const listRes = await listRecipesHandler(await makeAuthRequest(), ctx);
    expect((listRes.jsonBody as { recipes: Array<Record<string, unknown>> }).recipes[0]?.['exportViewStatus'])
      .toBe('current');
  });

  it('rejects a client-owned sourceFingerprint and invalid ingredient references', async () => {
    const withFingerprint = await createRecipeHandler(await makeAuthRequest({
      body: {
        name: 'Ungültiger Export',
        portions: 1,
        ingredients: [baseIngredient],
        steps: [baseStep],
        tags: [],
        exportViewAction: 'confirm',
        exportView: { ...baseExportView, sourceFingerprint: 'sha256:client' },
      },
    }), ctx);
    expect(withFingerprint.status).toBe(400);

    const withUnknownIngredient = await createRecipeHandler(await makeAuthRequest({
      body: {
        name: 'Ungültige Zutat',
        portions: 1,
        ingredients: [baseIngredient],
        steps: [baseStep],
        tags: [],
        exportViewAction: 'confirm',
        exportView: { ...baseExportView, includedIngredientIds: ['missing-ingredient'] },
      },
    }), ctx);
    expect(withUnknownIngredient.status).toBe(400);
    expect(withUnknownIngredient.jsonBody).toEqual({ error: 'invalid_export_view_ingredient' });

    const withDuplicateSourceId = await createRecipeHandler(await makeAuthRequest({
      body: {
        name: 'Doppelte Zutat',
        portions: 1,
        ingredients: [baseIngredient, { ...baseIngredient, displayName: 'Mehl doppelt' }],
        steps: [baseStep],
        tags: [],
        exportViewAction: 'confirm',
        exportView: baseExportView,
      },
    }), ctx);
    expect(withDuplicateSourceId.status).toBe(400);
    expect(withDuplicateSourceId.jsonBody).toEqual({ error: 'invalid_export_view_ingredient' });

    const withDuplicateSelection = await createRecipeHandler(await makeAuthRequest({
      body: {
        name: 'Doppelte Auswahl',
        portions: 1,
        ingredients: [baseIngredient],
        steps: [baseStep],
        tags: [],
        exportViewAction: 'confirm',
        exportView: {
          ...baseExportView,
          includedIngredientIds: [baseIngredient.id, baseIngredient.id],
        },
      },
    }), ctx);
    expect(withDuplicateSelection.status).toBe(400);
    expect(withDuplicateSelection.jsonBody).toEqual({ error: 'invalid_export_view_ingredient' });
  });

  it('requires the export view and confirmation action as a pair', async () => {
    const recipeFields = {
      name: 'Sauerteigbrot',
      portions: 4,
      ingredients: [baseIngredient],
      steps: [baseStep],
      tags: ['Brot'],
    };
    const missingAction = await createRecipeHandler(await makeAuthRequest({
      body: { ...recipeFields, exportView: baseExportView },
    }), ctx);
    const missingView = await createRecipeHandler(await makeAuthRequest({
      body: { ...recipeFields, exportViewAction: 'confirm' },
    }), ctx);

    expect(missingAction.status).toBe(400);
    expect(missingAction.jsonBody).toMatchObject({ error: 'invalid_export_view_confirmation' });
    expect(missingView.status).toBe(400);
    expect(missingView.jsonBody).toMatchObject({ error: 'invalid_export_view_confirmation' });
  });

  it('does not expose a missing export status as a persisted field', async () => {
    const recipe = await createTestRecipe();
    expect(recipe['exportView']).toBeUndefined();
    expect(recipe['exportViewStatus']).toBeUndefined();
  });

  it('strips step notes and ignores a root-level notes field', async () => {
    const req = await makeAuthRequest({
      body: {
        name: 'Notizen-Rezept',
        portions: 2,
        ingredients: [baseIngredient],
        steps: [{ ...baseStep, notes: 'Bei niedriger Hitze arbeiten.' }],
        tags: [],
        notes: 'Kein persistentes Rezeptfeld',
      },
    });
    const res = await createRecipeHandler(req, ctx);
    expect(res.status).toBe(201);

    const recipe = res.jsonBody as Record<string, unknown>;
    expect(recipe['notes']).toBeUndefined();
    expect((recipe['steps'] as Array<Record<string, unknown>>)[0]).not.toHaveProperty('notes');
  });

  it('accepts an indeterminate seasoning and preserves its display metadata', async () => {
    const req = await makeAuthRequest({
      body: {
        name: 'Kartoffelsalat',
        portions: 2,
        ingredients: [seasoningIngredient],
        steps: [baseStep],
        tags: [],
      },
    });
    const res = await createRecipeHandler(req, ctx);
    expect(res.status).toBe(201);

    const recipe = res.jsonBody as Record<string, unknown>;
    const ingredient = (recipe['ingredients'] as Array<Record<string, unknown>>)[0]!;
    expect(ingredient).toMatchObject({
      category: 'seasoning',
      inputAmount: null,
      amountGrams: null,
      amountLabel: 'nach Geschmack',
    });
    expect(ingredient['kitchenAmountText']).toBeUndefined();
    expect(recipe['nutritionTotal']).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

    const getRes = await getRecipeHandler(
      await makeAuthRequest({ params: { id: String(recipe['id']) } }),
      ctx,
    );
    expect(getRes.status).toBe(200);
    const roundTrippedIngredient = (
      (getRes.jsonBody as Record<string, unknown>)['ingredients'] as Array<Record<string, unknown>>
    )[0]!;
    expect(roundTrippedIngredient['amountLabel']).toBe('nach Geschmack');
    expect(roundTrippedIngredient['kitchenAmountText']).toBeUndefined();
  });

  it('preserves optional portion metadata on a food ingredient', async () => {
    const req = await makeAuthRequest({
      body: {
        name: 'Toast',
        portions: 1,
        ingredients: [{
          ...baseIngredient,
          inputMode: 'portion',
          inputAmount: 2,
          amountGrams: 100,
          unit: 'Scheibe',
          category: 'food',
          portionWeightGrams: 50,
          portionLabel: 'Scheibe',
        }],
        steps: [],
        tags: [],
      },
    });
    const res = await createRecipeHandler(req, ctx);
    expect(res.status).toBe(201);

    const ingredient = ((res.jsonBody as Record<string, unknown>)['ingredients'] as Array<Record<string, unknown>>)[0]!;
    expect(ingredient).toMatchObject({ portionWeightGrams: 50, portionLabel: 'Scheibe' });
  });

  it.each([
    ['null', null],
    ['zero', 0],
    ['negative', -1],
  ])('rejects a food ingredient with %s amountGrams', async (_label, amountGrams) => {
    const req = await makeAuthRequest({
      body: {
        name: 'Ungültiges Rezept',
        portions: 1,
        ingredients: [{ ...baseIngredient, category: 'food', amountGrams }],
        steps: [],
        tags: [],
      },
    });
    const res = await createRecipeHandler(req, ctx);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /recipes — listRecipes
// ---------------------------------------------------------------------------

describe('GET /recipes — listRecipes', () => {
  it('returns empty list initially', async () => {
    const req = await makeAuthRequest();
    const res = await listRecipesHandler(req, ctx);
    expect(res.status).toBe(200);
    expect((res.jsonBody as { recipes: unknown[] })['recipes']).toHaveLength(0);
  });

  it('returns created recipe', async () => {
    await createTestRecipe();
    const req = await makeAuthRequest();
    const res = await listRecipesHandler(req, ctx);
    expect(res.status).toBe(200);
    expect((res.jsonBody as { recipes: unknown[] })['recipes']).toHaveLength(1);
  });

  it('returns 401 without token', async () => {
    const { makeRequest } = await import('../test-utils/http');
    const req = makeRequest();
    const res = await listRecipesHandler(req, ctx);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /recipes/:id — getRecipe
// ---------------------------------------------------------------------------

describe('GET /recipes/:id — getRecipe', () => {
  it('returns recipe with SAS URLs for images', async () => {
    const created = await createTestRecipe();
    const req = await makeAuthRequest({ params: { id: String(created['id']) } });
    const res = await getRecipeHandler(req, ctx);
    expect(res.status).toBe(200);
    expect(responseEtag(res)).toMatch(/^".+"$/);
    expect((res.jsonBody as Record<string, unknown>)['id']).toBe(created['id']);
  });

  it('returns 404 for unknown id', async () => {
    const req = await makeAuthRequest({ params: { id: 'nonexistent' } });
    const res = await getRecipeHandler(req, ctx);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PUT /recipes/:id — updateRecipe
// ---------------------------------------------------------------------------

describe('PUT /recipes/:id — updateRecipe', () => {
  it('updates name and recalculates nutrition', async () => {
    const created = await createTestRecipe();
    const req = await makeAuthRequest({
      params: { id: String(created['id']) },
      body: { name: 'Roggenbrot', portions: 2 },
    });
    const res = await updateRecipeHandler(req, ctx);
    expect(res.status).toBe(200);
    expect((res.jsonBody as Record<string, unknown>)['name']).toBe('Roggenbrot');
    expect((res.jsonBody as Record<string, unknown>)['portions']).toBe(2);
    expect(responseEtag(res)).toMatch(/^".+"$/);
  });

  it('marks an unchanged exportView stale after a source update and preserves it when omitted', async () => {
    const created = await createTestRecipeWithExportView('Canonical recipe description');
    const originalExportView = created['exportView'] as Record<string, unknown>;
    const req = await makeAuthRequest({
      params: { id: String(created['id']) },
      body: { name: 'Roggenbrot' },
    });

    const res = await updateRecipeHandler(req, ctx);
    expect(res.status).toBe(200);
    const updated = res.jsonBody as Record<string, unknown>;
    expect(updated['exportView']).toEqual(originalExportView);
    expect(updated['exportViewStatus']).toBe('stale');
  });

  it('re-fingerprints an explicitly replaced exportView against the effective update', async () => {
    const created = await createTestRecipeWithExportView('Canonical recipe description');
    const originalFingerprint = (created['exportView'] as Record<string, unknown>)['sourceFingerprint'];
    const getRes = await getRecipeHandler(
      await makeAuthRequest({ params: { id: String(created['id']) } }),
      ctx,
    );
    const etag = responseEtag(getRes);
    const res = await updateRecipeHandler(await makeAuthRequest({
      params: { id: String(created['id']) },
      body: {
        name: 'Roggenbrot',
        exportViewAction: 'confirm',
        exportView: {
          ...baseExportView,
          teaser: 'Roggenbrot aus dem Ofen',
          steps: [{ order: 1, description: 'Export-only step.' }],
        },
      },
    }), ctx);

    expect(res.status).toBe(200);
    const updated = res.jsonBody as Record<string, unknown>;
    expect(updated['exportViewStatus']).toBe('current');
    expect(updated['description']).toBe('Canonical recipe description');
    expect(updated['steps']).toEqual(created['steps']);
    expect(updated['ingredients']).toEqual(created['ingredients']);
    expect((updated['exportView'] as Record<string, unknown>)['steps'])
      .toEqual([{ order: 1, description: 'Export-only step.' }]);
    expect((updated['exportView'] as Record<string, unknown>)['sourceFingerprint'])
      .not.toBe(originalFingerprint);
    expect(responseEtag(res)).not.toBe(etag);
  });

  it('rejects missing and duplicate ingredient IDs with a stable confirmation error', async () => {
    const created = await createTestRecipe();
    const recipeId = String(created['id']);
    const currentRecipe = await getRecipeHandler(
      await makeAuthRequest({ params: { id: recipeId } }),
      ctx,
    );
    const etag = responseEtag(currentRecipe);

    const missingId = await updateRecipeHandler(await makeAuthRequest({
      params: { id: recipeId },
      headers: { 'if-match': etag },
      body: {
        exportViewAction: 'confirm',
        exportView: { ...baseExportView, includedIngredientIds: ['missing-ingredient'] },
      },
    }), ctx);
    const duplicateId = await updateRecipeHandler(await makeAuthRequest({
      params: { id: recipeId },
      headers: { 'if-match': etag },
      body: {
        ingredients: [baseIngredient, { ...baseIngredient, displayName: 'Doppelte Zutat' }],
        exportViewAction: 'confirm',
        exportView: baseExportView,
      },
    }), ctx);

    expect(missingId.status).toBe(400);
    expect(missingId.jsonBody).toEqual({ error: 'invalid_export_view_ingredient' });
    expect(duplicateId.status).toBe(400);
    expect(duplicateId.jsonBody).toEqual({ error: 'invalid_export_view_ingredient' });

    const unchangedRecipe = await getRecipeHandler(
      await makeAuthRequest({ params: { id: recipeId } }),
      ctx,
    );
    expect(responseEtag(unchangedRecipe)).toBe(etag);
    expect(unchangedRecipe.jsonBody).not.toHaveProperty('exportView');
  });

  it('returns an internal revision conflict without persisting when compare-and-replace loses a race', async () => {
    const created = await createTestRecipe([baseIngredient], 'Canonical recipe description');
    const recipeId = String(created['id']);
    const initialEtag = await getRecipeEtag(recipeId);
    const repository = getRecipesRepository();
    const compareAndReplace = vi.spyOn(repository, 'compareAndReplace').mockResolvedValue(null);
    const res = await updateRecipeHandler(await makeAuthRequest({
      params: { id: recipeId },
      body: {
        exportViewAction: 'confirm',
        exportView: { ...baseExportView, teaser: 'Candidate export' },
      },
    }), ctx);

    expect(res.status).toBe(412);
    expect(res.jsonBody).toEqual({ error: 'recipe_revision_conflict' });
    expect(compareAndReplace).toHaveBeenCalledWith(
      TEST_USER_ID,
      recipeId,
      initialEtag,
      expect.objectContaining({ exportView: expect.objectContaining({ teaser: 'Candidate export' }) }),
    );
    const fetched = await getRecipeHandler(
      await makeAuthRequest({ params: { id: recipeId } }),
      ctx,
    );
    expect(responseEtag(fetched)).toBe(initialEtag);
    expect(fetched.jsonBody).toMatchObject({
      name: 'Sauerteigbrot',
      description: 'Canonical recipe description',
      steps: created['steps'],
      ingredients: created['ingredients'],
    });
    expect(fetched.jsonBody).not.toHaveProperty('exportView');
  });

  it('returns 412 without partial persistence for a stale confirmation revision', async () => {
    const created = await createTestRecipeWithExportView();
    const originalExportView = created['exportView'];
    const initialGet = await getRecipeHandler(
      await makeAuthRequest({ params: { id: String(created['id']) } }),
      ctx,
    );
    const staleEtag = responseEtag(initialGet);
    const ordinaryUpdate = await updateRecipeHandler(await makeAuthRequest({
      params: { id: String(created['id']) },
      body: { name: 'Ordinary update' },
    }), ctx);
    const currentEtag = responseEtag(ordinaryUpdate);

    const staleConfirmation = await updateRecipeHandler(await makeAuthRequest({
      params: { id: String(created['id']) },
      headers: { 'if-match': staleEtag },
      body: {
        name: 'Must not persist',
        exportViewAction: 'confirm',
        exportView: { ...baseExportView, teaser: 'Stale confirmation' },
      },
    }), ctx);

    expect(ordinaryUpdate.status).toBe(200);
    expect(currentEtag).not.toBe(staleEtag);
    expect(staleConfirmation.status).toBe(412);
    expect(staleConfirmation.jsonBody).toMatchObject({ error: 'recipe_revision_conflict' });

    const fetched = await getRecipeHandler(
      await makeAuthRequest({ params: { id: String(created['id']) } }),
      ctx,
    );
    const current = fetched.jsonBody as Record<string, unknown>;
    expect(current['name']).toBe('Ordinary update');
    expect(current['exportView']).toEqual(originalExportView);
    expect(current['exportViewStatus']).toBe('stale');
    expect(responseEtag(fetched)).toBe(currentEtag);
  });

  it('rejects an incomplete export confirmation pair on update', async () => {
    const created = await createTestRecipe();
    const missingAction = await updateRecipeHandler(await makeAuthRequest({
      params: { id: String(created['id']) },
      body: { exportView: baseExportView },
    }), ctx);
    const missingView = await updateRecipeHandler(await makeAuthRequest({
      params: { id: String(created['id']) },
      body: { exportViewAction: 'confirm' },
    }), ctx);

    expect(missingAction.status).toBe(400);
    expect(missingAction.jsonBody).toMatchObject({ error: 'invalid_export_view_confirmation' });
    expect(missingView.status).toBe(400);
    expect(missingView.jsonBody).toMatchObject({ error: 'invalid_export_view_confirmation' });
  });

  it('returns 404 for unknown id', async () => {
    const req = await makeAuthRequest({
      params: { id: 'none' },
      body: { name: 'X' },
    });
    const res = await updateRecipeHandler(req, ctx);
    expect(res.status).toBe(404);
  });

  it('accepts an indeterminate seasoning on update', async () => {
    const created = await createTestRecipe();
    const req = await makeAuthRequest({
      params: { id: String(created['id']) },
      body: { ingredients: [seasoningIngredient] },
    });
    const res = await updateRecipeHandler(req, ctx);
    expect(res.status).toBe(200);

    const ingredient = ((res.jsonBody as Record<string, unknown>)['ingredients'] as Array<Record<string, unknown>>)[0]!;
    expect(ingredient).toMatchObject({ category: 'seasoning', amountGrams: null, amountLabel: 'nach Geschmack' });
    expect(ingredient['kitchenAmountText']).toBeUndefined();
  });

  it('strips step notes and ignores a root-level notes field', async () => {
    const created = await createTestRecipe();
    const req = await makeAuthRequest({
      params: { id: String(created['id']) },
      body: {
        steps: [{ ...baseStep, notes: 'Mit Ruhe backen.' }],
        notes: 'Kein persistentes Rezeptfeld',
      },
    });
    const res = await updateRecipeHandler(req, ctx);
    expect(res.status).toBe(200);

    const recipe = res.jsonBody as Record<string, unknown>;
    expect(recipe['notes']).toBeUndefined();
    expect((recipe['steps'] as Array<Record<string, unknown>>)[0]).not.toHaveProperty('notes');
  });

  it('rejects an invalid food amount on update', async () => {
    const created = await createTestRecipe();
    const req = await makeAuthRequest({
      params: { id: String(created['id']) },
      body: { ingredients: [{ ...baseIngredient, category: 'food', amountGrams: null }] },
    });
    const res = await updateRecipeHandler(req, ctx);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// DELETE /recipes/:id — deleteRecipe
// ---------------------------------------------------------------------------

describe('DELETE /recipes/:id — deleteRecipe', () => {
  it('deletes recipe and returns 204', async () => {
    const created = await createTestRecipe();
    const req = await makeAuthRequest({ params: { id: String(created['id']) } });
    const res = await deleteRecipeHandler(req, ctx);
    expect(res.status).toBe(204);

    // Verify gone
    const getReq = await makeAuthRequest({ params: { id: String(created['id']) } });
    const getRes = await getRecipeHandler(getReq, ctx);
    expect(getRes.status).toBe(404);
  });

  it('returns 404 for unknown id', async () => {
    const req = await makeAuthRequest({ params: { id: 'none' } });
    const res = await deleteRecipeHandler(req, ctx);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /recipes/:id/log — logRecipe
// ---------------------------------------------------------------------------

describe('POST /recipes/:id/log — logRecipe', () => {
  it.each([0.5, 1, 2])('creates an authoritative snapshot for %s portions with existing rounding', async (portions) => {
    const created = await createTestRecipe();

    // Create a diary meal first
    const { getDiaryRepository } = await import('../lib/repositories/diaryRepository');
    const diaryRepo = getDiaryRepository();
    const meal = await diaryRepo.createMeal({
      userId: TEST_USER_ID,
      date: '2026-06-02',
      type: 'dinner',
      name: 'Abendessen',
    });

    const req = await makeAuthRequest({
      params: { id: String(created['id']) },
      body: { portions, mealId: meal.id },
    });
    const res = await logRecipeHandler(req, ctx);
    expect(res.status).toBe(200);

    const updatedMeal = res.jsonBody as { items: Array<Record<string, unknown>> };
    expect(updatedMeal.items).toHaveLength(1);
    const item = updatedMeal.items[0]!;
    expect(item['sourceType']).toBe('recipe');
    expect(item['recipeId']).toBe(created['id']);
    expect(item['recipePortions']).toBe(portions);
    expect(item['quantity']).toBe(portions);
    expect(item['unit']).toBe(portions === 1 ? 'Portion' : 'Portionen');
    const perPortion = created['nutritionPerPortion'] as Record<string, number>;
    const macros = item['macros'] as Record<string, number>;
    for (const nutrient of ['calories', 'protein', 'carbs', 'fat', 'fiber']) {
      expect(macros[nutrient]).toBe(Math.round(perPortion[nutrient]! * portions * 10) / 10);
    }
  });

  it('returns 404 for unknown recipe id', async () => {
    const req = await makeAuthRequest({
      params: { id: 'none' },
      body: { portions: 1, mealId: 'any' },
    });
    const res = await logRecipeHandler(req, ctx);
    expect(res.status).toBe(404);
  });

  it('returns 400 for missing mealId', async () => {
    const created = await createTestRecipe();
    const req = await makeAuthRequest({
      params: { id: String(created['id']) },
      body: { portions: 1 },
    });
    const res = await logRecipeHandler(req, ctx);
    expect(res.status).toBe(400);
  });

  it('returns 400 for zero portions', async () => {
    const created = await createTestRecipe();
    const req = await makeAuthRequest({
      params: { id: String(created['id']) },
      body: { portions: 0, mealId: 'meal-1' },
    });
    const res = await logRecipeHandler(req, ctx);
    expect(res.status).toBe(400);
  });

  it('allows another user to log a published recipe from the current owner snapshot', async () => {
    const created = await createTestRecipe();
    const recipeId = String(created['id']);
    const versioned = await getRecipesRepository().getVersioned(TEST_USER_ID, recipeId);
    await getRecipesRepository().setVisibility(TEST_USER_ID, recipeId, versioned!.etag, {
      visibility: 'community',
      contentConfirmed: true,
      displayNameConsent: false,
    });
    const { getDiaryRepository } = await import('../lib/repositories/diaryRepository');
    const diary = getDiaryRepository();
    const meal = await diary.createMeal({
      userId: 'reader-user',
      date: '2026-10-02',
      type: 'dinner',
      name: 'Abendessen',
    });

    const response = await logRecipeHandler(
      await makeAuthRequestAs('reader-user', {
        params: { id: recipeId },
        body: { portions: 2, mealId: meal.id },
      }),
      ctx,
    );
    expect(response.status).toBe(200);
    const loggedItem = (response.jsonBody as { items: Array<Record<string, unknown>> }).items[0]!;
    expect(loggedItem).toMatchObject({ name: 'Sauerteigbrot', sourceType: 'recipe', recipeId, recipePortions: 2 });
    const expectedCalories = (created['nutritionPerPortion'] as Record<string, number>).calories * 2;
    expect((loggedItem['macros'] as Record<string, number>).calories).toBeCloseTo(expectedCalories, 0);

    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect((await getRecipesRepository().get(TEST_USER_ID, recipeId))?.usageCount).toBe(1);
    expect(await getUserFoodRelationRepository().getByFoodRef('reader-user', recipeId)).toMatchObject({
      foodRefType: 'recipe',
      usageDates: [{ date: '2026-10-02', mealType: 'dinner' }],
    });

    const itemSnapshot = structuredClone(loggedItem);
    await getRecipesRepository().update(TEST_USER_ID, recipeId, {
      name: 'Edited recipe',
      nutritionPerPortion: { calories: 1, protein: 1, carbs: 1, fat: 1, fiber: 1 },
    });
    const updated = await getRecipesRepository().getVersioned(TEST_USER_ID, recipeId);
    await getRecipesRepository().setVisibility(TEST_USER_ID, recipeId, updated!.etag, { visibility: 'private' });
    expect((await diary.getMealById('reader-user', meal.id))?.items[0]).toEqual(itemSnapshot);

    const afterRevocation = await logRecipeHandler(
      await makeAuthRequestAs('reader-user', {
        params: { id: recipeId },
        body: { portions: 1, mealId: meal.id },
      }),
      ctx,
    );
    expect(afterRevocation.status).toBe(404);
    expect((await diary.getMealById('reader-user', meal.id))?.items).toEqual([itemSnapshot]);
    expect((await getRecipesRepository().get(TEST_USER_ID, recipeId))?.usageCount).toBe(1);
    expect(await getUserFoodRelationRepository().getByFoodRef('reader-user', recipeId)).toMatchObject({
      usageCount: 1,
      usageDates: [{ date: '2026-10-02', mealType: 'dinner' }],
    });

    const deleted = await deleteRecipeHandler(
      await makeAuthRequest({ params: { id: recipeId } }),
      ctx,
    );
    expect(deleted.status).toBe(204);
    expect((await diary.getMealById('reader-user', meal.id))?.items).toEqual([itemSnapshot]);
  });

  it('rejects a foreign meal ID and a private recipe owned by another user', async () => {
    const created = await createTestRecipe();
    const recipeId = String(created['id']);
    const { getDiaryRepository } = await import('../lib/repositories/diaryRepository');
    const diary = getDiaryRepository();
    const foreignMeal = await diary.createMeal({
      userId: 'other-user', date: '2026-10-02', type: 'dinner', name: 'Foreign meal',
    });
    const readerMeal = await diary.createMeal({
      userId: 'reader-user', date: '2026-10-02', type: 'dinner', name: 'Reader meal',
    });

    const foreignMealResponse = await logRecipeHandler(
      await makeAuthRequest({ params: { id: recipeId }, body: { portions: 1, mealId: foreignMeal.id } }),
      ctx,
    );
    const privateRecipeResponse = await logRecipeHandler(
      await makeAuthRequestAs('reader-user', {
        params: { id: recipeId },
        body: { portions: 1, mealId: readerMeal.id },
      }),
      ctx,
    );

    expect(foreignMealResponse.status).toBe(404);
    expect(foreignMealResponse.jsonBody).toEqual({ error: 'Meal not found' });
    expect(privateRecipeResponse.status).toBe(404);
    expect(privateRecipeResponse.jsonBody).toEqual({ error: 'Recipe not found' });
    expect((await diary.getMealById('reader-user', readerMeal.id))?.items).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// POST /recipes/:id/images — uploadImage
// ---------------------------------------------------------------------------

function makeImageFormData(
  mimeType = 'image/jpeg',
  sizeBytes = 1024,
  heroCrop?: string | Record<string, unknown>,
): FormData {
  const fd = new FormData();
  const buf = Buffer.alloc(sizeBytes, 0);
  const file = new File([buf], 'photo.jpg', { type: mimeType });
  fd.append('image', file);
  if (heroCrop !== undefined) {
    fd.append('heroCrop', typeof heroCrop === 'string' ? heroCrop : JSON.stringify(heroCrop));
  }
  return fd;
}

describe('owner-only mutations for published recipes', () => {
  it('rejects foreign content, delete, upload and reorder requests', async () => {
    const created = await createTestRecipe();
    const recipeId = String(created['id']);
    await uploadImageHandler(
      await makeAuthRequest({ params: { id: recipeId }, formData: makeImageFormData() }),
      ctx,
    );
    const repo = getRecipesRepository();
    const current = await repo.getVersioned(TEST_USER_ID, recipeId);
    await repo.setVisibility(TEST_USER_ID, recipeId, current!.etag, {
      visibility: 'community',
      contentConfirmed: true,
      displayNameConsent: false,
    });

    const update = await updateRecipeHandler(
      await makeAuthRequestAs('other-user', { params: { id: recipeId }, body: { name: 'Forged update' } }),
      ctx,
    );
    const remove = await deleteRecipeHandler(
      await makeAuthRequestAs('other-user', { params: { id: recipeId } }),
      ctx,
    );
    const upload = await uploadImageHandler(
      await makeAuthRequestAs('other-user', { params: { id: recipeId }, formData: makeImageFormData() }),
      ctx,
    );
    const reorder = await reorderImagesHandler(
      await makeAuthRequestAs('other-user', { params: { id: recipeId }, body: { imageIds: ['img1'] } }),
      ctx,
    );

    expect([update.status, remove.status, upload.status, reorder.status]).toEqual([404, 404, 404, 404]);
    expect(await repo.get(TEST_USER_ID, recipeId)).toMatchObject({
      name: 'Sauerteigbrot',
      visibility: 'community',
      images: [{ id: 'img1' }],
    });
  });
});

describe('POST /recipes/:id/images — uploadImage', () => {
  it('returns 201 and appends image to recipe', async () => {
    const created = await createTestRecipe();
    const id = String(created['id']);
    const req = await makeAuthRequest({ params: { id }, formData: makeImageFormData() });
    const res = await uploadImageHandler(req, ctx);
    expect(res.status).toBe(201);
    const body = res.jsonBody as Record<string, unknown>;
    expect(body['id']).toBe('img1');
    expect(body['order']).toBe(1);
    expect(body['heroCrop']).toEqual(DEFAULT_RECIPE_IMAGE_HERO_CROP);
    expect(typeof body['url']).toBe('string');

    // Recipe should now have 1 image
    const getReq = await makeAuthRequest({ params: { id } });
    const getRes = await getRecipeHandler(getReq, ctx);
    expect((getRes.jsonBody as Record<string, unknown[]>)['images']).toHaveLength(1);
  });

  it('stores a validated heroCrop supplied in multipart form data', async () => {
    const created = await createTestRecipe();
    const id = String(created['id']);
    const heroCrop = {
      version: 1,
      frame: 'instagram-recipe-v1',
      focusX: 0.21,
      focusY: 0.74,
      zoom: 1.35,
    };

    const res = await uploadImageHandler(
      await makeAuthRequest({ params: { id }, formData: makeImageFormData('image/jpeg', 1024, heroCrop) }),
      ctx,
    );

    expect(res.status).toBe(201);
    expect(res.jsonBody).toMatchObject({ heroCrop });

    const getRes = await getRecipeHandler(await makeAuthRequest({ params: { id } }), ctx);
    expect((getRes.jsonBody as { images: Array<Record<string, unknown>> }).images[0]?.['heroCrop']).toEqual(heroCrop);
  });

  it('rejects invalid heroCrop metadata before uploading the image', async () => {
    const created = await createTestRecipe();
    const id = String(created['id']);
    const res = await uploadImageHandler(
      await makeAuthRequest({
        params: { id },
        formData: makeImageFormData('image/jpeg', 1024, { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, zoom: 0.5 }),
      }),
      ctx,
    );

    expect(res.status).toBe(400);
  });

  it('keeps the legacy heroCrop default when an image is read without metadata', async () => {
    const created = await createTestRecipe();
    const id = String(created['id']);
    const repo = (await import('../lib/repositories/recipesRepository')).getRecipesRepository();
    await repo.update(TEST_USER_ID, id, {
      images: [{ id: 'legacy-image', blobName: 'u1/r1/legacy.jpg', order: 1 }],
    });

    const fetched = await repo.get(TEST_USER_ID, id);
    expect(fetched?.images[0]?.heroCrop).toEqual(DEFAULT_RECIPE_IMAGE_HERO_CROP);
  });

  it('returns 201 for multiple sequential uploads (multi-image)', async () => {
    const created = await createTestRecipe();
    const id = String(created['id']);

    await uploadImageHandler(await makeAuthRequest({ params: { id }, formData: makeImageFormData() }), ctx);
    await uploadImageHandler(await makeAuthRequest({ params: { id }, formData: makeImageFormData() }), ctx);
    const res = await uploadImageHandler(
      await makeAuthRequest({ params: { id }, formData: makeImageFormData() }),
      ctx,
    );
    expect(res.status).toBe(201);

    const getRes = await getRecipeHandler(await makeAuthRequest({ params: { id } }), ctx);
    expect((getRes.jsonBody as Record<string, unknown[]>)['images']).toMatchObject([
      { order: 1 },
      { order: 2 },
      { order: 3 },
    ]);
  });

  it('appends after the highest persisted image order', async () => {
    const created = await createTestRecipe();
    const id = String(created['id']);
    const repo = (await import('../lib/repositories/recipesRepository')).getRecipesRepository();
    await repo.update(TEST_USER_ID, id, {
      images: [
        { id: 'img1', blobName: 'u1/r1/img1.jpg', order: 2 },
        { id: 'img2', blobName: 'u1/r1/img2.jpg', order: 5 },
      ],
    });

    const res = await uploadImageHandler(
      await makeAuthRequest({ params: { id }, formData: makeImageFormData() }),
      ctx,
    );
    expect(res.status).toBe(201);
    expect((res.jsonBody as Record<string, unknown>)['order']).toBe(6);
  });

  it('returns 400 when no image field in form data', async () => {
    const created = await createTestRecipe();
    const emptyFd = new FormData();
    const req = await makeAuthRequest({ params: { id: String(created['id']) }, formData: emptyFd });
    const res = await uploadImageHandler(req, ctx);
    expect(res.status).toBe(400);
  });

  it('returns 400 for unsupported MIME type', async () => {
    const created = await createTestRecipe();
    const req = await makeAuthRequest({
      params: { id: String(created['id']) },
      formData: makeImageFormData('image/gif'),
    });
    const res = await uploadImageHandler(req, ctx);
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown recipe id', async () => {
    const req = await makeAuthRequest({ params: { id: 'nonexistent' }, formData: makeImageFormData() });
    const res = await uploadImageHandler(req, ctx);
    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    const { makeRequest } = await import('../test-utils/http');
    const req = makeRequest({ params: { id: 'any' }, formData: makeImageFormData() });
    const res = await uploadImageHandler(req, ctx);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// DELETE /recipes/:id/images/:imageId — deleteImage
// ---------------------------------------------------------------------------

describe('DELETE /recipes/:id/images/:imageId — deleteImage', () => {
  async function createRecipeWithImage() {
    const created = await createTestRecipe();
    const id = String(created['id']);
    const uploadReq = await makeAuthRequest({ params: { id }, formData: makeImageFormData() });
    const uploadRes = await uploadImageHandler(uploadReq, ctx);
    const imageId = (uploadRes.jsonBody as Record<string, unknown>)['id'] as string;
    return { recipeId: id, imageId };
  }

  it('removes image and re-orders remaining images', async () => {
    const { recipeId } = await createRecipeWithImage();
    const repo = (await import('../lib/repositories/recipesRepository')).getRecipesRepository();
    await repo.update(TEST_USER_ID, recipeId, {
      images: [
        {
          id: 'img1',
          blobName: 'u1/r1/img1.jpg',
          order: 1,
          heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusX: 0.2 },
        },
        {
          id: 'img2',
          blobName: 'u1/r1/img2.jpg',
          order: 2,
          heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusY: 0.7 },
        },
        {
          id: 'img3',
          blobName: 'u1/r1/img3.jpg',
          order: 3,
          heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, zoom: 1.4 },
        },
      ],
    });

    const req = await makeAuthRequest({ params: { id: recipeId, imageId: 'img2' } });
    const res = await deleteImageHandler(req, ctx);
    expect(res.status).toBe(204);

    const getRes = await getRecipeHandler(await makeAuthRequest({ params: { id: recipeId } }), ctx);
    expect((getRes.jsonBody as Record<string, unknown[]>)['images']).toMatchObject([
      { id: 'img1', order: 1, heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusX: 0.2 } },
      { id: 'img3', order: 2 },
    ]);
  });

  it('returns 404 for unknown imageId', async () => {
    const { recipeId } = await createRecipeWithImage();
    const req = await makeAuthRequest({ params: { id: recipeId, imageId: 'no-such-image' } });
    const res = await deleteImageHandler(req, ctx);
    expect(res.status).toBe(404);
  });

  it('returns 404 for unknown recipe id', async () => {
    const req = await makeAuthRequest({ params: { id: 'nonexistent', imageId: 'img1' } });
    const res = await deleteImageHandler(req, ctx);
    expect(res.status).toBe(404);
  });

  it('does not allow another user to delete an image from a published recipe', async () => {
    const { recipeId, imageId } = await createRecipeWithImage();
    const repo = getRecipesRepository();
    const current = await repo.getVersioned(TEST_USER_ID, recipeId);
    await repo.setVisibility(TEST_USER_ID, recipeId, current!.etag, {
      visibility: 'community',
      contentConfirmed: true,
      displayNameConsent: false,
    });

    const response = await deleteImageHandler(
      await makeAuthRequestAs('other-user', { params: { id: recipeId, imageId } }),
      ctx,
    );

    expect(response.status).toBe(404);
    expect((await repo.get(TEST_USER_ID, recipeId))?.images.map((image) => image.id)).toContain(imageId);
  });

  it('returns 401 without token', async () => {
    const { makeRequest } = await import('../test-utils/http');
    const req = makeRequest({ params: { id: 'any', imageId: 'img1' } });
    const res = await deleteImageHandler(req, ctx);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PUT /recipes/:id/images/order — reorderImages
// ---------------------------------------------------------------------------

describe('PUT /recipes/:id/images/order — reorderImages', () => {
  async function createRecipeWithImages() {
    const created = await createTestRecipe();
    const recipeId = String(created['id']);
    const repo = (await import('../lib/repositories/recipesRepository')).getRecipesRepository();
    await repo.update(TEST_USER_ID, recipeId, {
      images: [
        {
          id: 'img1',
          blobName: 'u1/r1/img1.jpg',
          order: 1,
          heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusX: 0.2 },
        },
        {
          id: 'img2',
          blobName: 'u1/r1/img2.jpg',
          order: 2,
          heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusY: 0.7 },
        },
        {
          id: 'img3',
          blobName: 'u1/r1/img3.jpg',
          order: 3,
          heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, zoom: 1.4 },
        },
      ],
    });
    return recipeId;
  }

  it('reorders images when imageIds are a complete permutation', async () => {
    const recipeId = await createRecipeWithImages();
    const req = await makeAuthRequest({
      params: { id: recipeId },
      body: { imageIds: ['img3', 'img1', 'img2'] },
    });

    const res = await reorderImagesHandler(req, ctx);

    expect(res.status).toBe(200);
    expect((res.jsonBody as { images: Array<Record<string, unknown>> }).images).toMatchObject([
      { id: 'img3', order: 1, heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, zoom: 1.4 } },
      { id: 'img1', order: 2, heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusX: 0.2 } },
      { id: 'img2', order: 3, heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusY: 0.7 } },
    ]);

    const getRes = await getRecipeHandler(await makeAuthRequest({ params: { id: recipeId } }), ctx);
    expect((getRes.jsonBody as Record<string, unknown[]>)['images']).toMatchObject([
      { id: 'img3', order: 1, heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, zoom: 1.4 } },
      { id: 'img1', order: 2, heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusX: 0.2 } },
      { id: 'img2', order: 3, heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusY: 0.7 } },
    ]);
  });

  it('returns 400 when imageIds omit an existing image', async () => {
    const recipeId = await createRecipeWithImages();
    const res = await reorderImagesHandler(
      await makeAuthRequest({ params: { id: recipeId }, body: { imageIds: ['img3', 'img1'] } }),
      ctx,
    );

    expect(res.status).toBe(400);
  });

  it('returns 400 when imageIds contain duplicates or unknown images', async () => {
    const recipeId = await createRecipeWithImages();

    const duplicateRes = await reorderImagesHandler(
      await makeAuthRequest({ params: { id: recipeId }, body: { imageIds: ['img1', 'img1', 'img3'] } }),
      ctx,
    );
    const unknownRes = await reorderImagesHandler(
      await makeAuthRequest({ params: { id: recipeId }, body: { imageIds: ['img1', 'img2', 'missing'] } }),
      ctx,
    );

    expect(duplicateRes.status).toBe(400);
    expect(unknownRes.status).toBe(400);
  });

  it('returns 404 for an unknown recipe id', async () => {
    const res = await reorderImagesHandler(
      await makeAuthRequest({ params: { id: 'nonexistent' }, body: { imageIds: [] } }),
      ctx,
    );

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PUT /recipes/:id/images/:imageId/hero-crop — updateImageHeroCrop
// ---------------------------------------------------------------------------

describe('PUT /recipes/:id/images/:imageId/hero-crop — updateImageHeroCrop', () => {
  async function createRecipeWithImage() {
    const created = await createTestRecipe();
    const recipeId = String(created['id']);
    await uploadImageHandler(
      await makeAuthRequest({ params: { id: recipeId }, formData: makeImageFormData() }),
      ctx,
    );
    return recipeId;
  }

  it('updates the crop for an image owned by the authenticated user', async () => {
    const recipeId = await createRecipeWithImage();
    const heroCrop = {
      version: 1,
      frame: 'instagram-recipe-v1',
      focusX: 0.12,
      focusY: 0.88,
      zoom: 1.8,
    };

    const res = await updateImageHeroCropHandler(
      await makeAuthRequest({ params: { id: recipeId, imageId: 'img1' }, body: { heroCrop } }),
      ctx,
    );

    expect(res.status).toBe(200);
    expect(res.jsonBody).toMatchObject({ id: 'img1', heroCrop });
    const fetched = await getRecipeHandler(await makeAuthRequest({ params: { id: recipeId } }), ctx);
    expect((fetched.jsonBody as { images: Array<Record<string, unknown>> }).images[0]?.['heroCrop']).toEqual(heroCrop);
  });

  it('rejects invalid crop payloads', async () => {
    const recipeId = await createRecipeWithImage();
    const res = await updateImageHeroCropHandler(
      await makeAuthRequest({
        params: { id: recipeId, imageId: 'img1' },
        body: { heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusX: 2 } },
      }),
      ctx,
    );

    expect(res.status).toBe(400);
  });

  it('does not allow another user to update published image metadata', async () => {
    const recipeId = await createRecipeWithImage();
    const repo = getRecipesRepository();
    const current = await repo.getVersioned(TEST_USER_ID, recipeId);
    await repo.setVisibility(TEST_USER_ID, recipeId, current!.etag, {
      visibility: 'community',
      contentConfirmed: true,
      displayNameConsent: false,
    });
    const token = await signTestToken('different-user');
    const res = await updateImageHeroCropHandler(
      makeRequest({
        params: { id: recipeId, imageId: 'img1' },
        headers: { authorization: `Bearer ${token}` },
        body: { heroCrop: DEFAULT_RECIPE_IMAGE_HERO_CROP },
      }),
      ctx,
    );

    expect(res.status).toBe(404);
  });
});
