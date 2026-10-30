import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';

const { downloadRecipeImageMock, renderInstagramRecipeMock, renderInstagramRecipeDetailsTemplateMock } = vi.hoisted(() => ({
  downloadRecipeImageMock: vi.fn(),
  renderInstagramRecipeMock: vi.fn(),
  renderInstagramRecipeDetailsTemplateMock: vi.fn(),
}));

vi.mock('../lib/storage', async () => {
  const actual = await vi.importActual<typeof import('../lib/storage')>('../lib/storage');
  return { ...actual, downloadRecipeImage: downloadRecipeImageMock };
});

vi.mock('../lib/instagramRenderer', async () => {
  const actual = await vi.importActual<typeof import('../lib/instagramRenderer')>('../lib/instagramRenderer');
  return {
    ...actual,
    renderInstagramRecipe: renderInstagramRecipeMock,
    renderInstagramRecipeDetailsTemplate: renderInstagramRecipeDetailsTemplateMock,
  };
});

import { getRecipesRepository, __resetRecipesRepositoryForTests } from '../lib/repositories/recipesRepository';
import { computeRecipeSourceFingerprint, type RecipeFingerprintSource } from '../lib/repositories/recipeExport';
import { RecipeImageTooLargeError } from '../lib/storage';
import { DEFAULT_RECIPE_IMAGE_HERO_CROP } from '../../../shared/types/recipeImageHeroCrop';
import type { RecipeImageHeroCrop } from '../../../shared/types/recipeImageHeroCrop';
import type { RecipeIngredient, RecipeShareBundleExportDraft } from '@fittrack/shared';
import {
  makeAuthRequest,
  makeContext,
  makeRequest,
  signTestToken,
  setupTestAuth,
  teardownTestAuth,
  TEST_USER_ID,
} from '../test-utils/http';
import { instagramRecipeHandler, shareBundleHandler } from './instagramRecipe';

const ctx = makeContext();
const renderedBuffer = Buffer.from('rendered-png');
const shareBundleIngredient: RecipeIngredient = {
  id: '00000000-0000-0000-0000-000000000010',
  displayName: 'Eier',
  inputMode: 'portion',
  inputAmount: 3,
  amountGrams: 150,
  unit: 'Stück',
  linkedProductId: null,
  linkedReusableItemId: null,
  isAiEstimate: false,
  nutritionPer100g: { calories: 140, protein: 12, carbs: 1, fat: 10, fiber: 0 },
  nutritionContribution: { calories: 420, protein: 36, carbs: 3, fat: 30, fiber: 0 },
};
const shareBundleSeasoning: RecipeIngredient = {
  ...shareBundleIngredient,
  id: '00000000-0000-0000-0000-000000000011',
  displayName: 'Salz',
  inputAmount: null,
  amountGrams: null,
  unit: 'nach Geschmack',
  category: 'seasoning',
  amountLabel: 'nach Geschmack',
  nutritionPer100g: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  nutritionContribution: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
};
const shareBundleExportDraft: RecipeShareBundleExportDraft = {
  version: 1,
  teaser: 'Ein request-only Teaser.',
  totalTimeMinutes: null,
  difficulty: null,
  steps: [{ order: 1, description: 'Request-only Schritt.' }],
  includedIngredientIds: [shareBundleIngredient.id],
};

beforeAll(async () => {
  await setupTestAuth();
});

afterAll(() => {
  teardownTestAuth();
});

beforeEach(() => {
  delete process.env.COSMOS_ENDPOINT;
  delete process.env.COSMOS_KEY;
  __resetRecipesRepositoryForTests();
  downloadRecipeImageMock.mockReset();
  renderInstagramRecipeMock.mockReset();
  renderInstagramRecipeDetailsTemplateMock.mockReset();
  downloadRecipeImageMock.mockResolvedValue(Buffer.from('source-image'));
  renderInstagramRecipeMock.mockResolvedValue({
    ok: true,
    width: 1080,
    height: 1350,
    format: 'png',
    buffer: renderedBuffer,
  });
  renderInstagramRecipeDetailsTemplateMock.mockResolvedValue({
    ok: true,
    width: 1080,
    height: 1350,
    format: 'png',
    buffer: Buffer.from('detail-png'),
  });
});

async function createRecipe(
  images: Array<{
    id: string;
    blobName: string;
    order: number;
    heroCrop?: RecipeImageHeroCrop;
  }> = [],
  tags = ['Schnell', 'Salat'],
  ingredients: RecipeIngredient[] = [],
) {
  const repo = getRecipesRepository();
  const recipe = await repo.create(TEST_USER_ID, {
    name: 'Stored recipe',
    portions: 4,
    ingredients,
    steps: [],
    tags,
    nutritionTotal: { calories: 800, protein: 100, carbs: 80, fat: 20, fiber: 10 },
    nutritionPerPortion: { calories: 200, protein: 25, carbs: 20, fat: 5, fiber: 2 },
  });
  return (await repo.update(TEST_USER_ID, recipe.id, { images }))!;
}

async function createCurrentBundleRecipe() {
  const repo = getRecipesRepository();
  const source = {
    name: 'Bundle recipe',
    portions: 4,
    ingredients: [{
      id: '00000000-0000-0000-0000-000000000010',
      displayName: 'Eier',
      inputMode: 'portion',
      inputAmount: 3,
      amountGrams: 150,
      unit: 'Stück',
      linkedProductId: null,
      linkedReusableItemId: null,
      isAiEstimate: false,
      nutritionPer100g: { calories: 140, protein: 12, carbs: 1, fat: 10, fiber: 0 },
      nutritionContribution: { calories: 420, protein: 36, carbs: 3, fat: 30, fiber: 0 },
    }],
    steps: [{ order: 1, description: 'Mischen.' }],
    tags: ['Schnell'],
    nutritionPerPortion: { calories: 130, protein: 10, carbs: 2.5, fat: 8.75, fiber: 0.25 },
  } satisfies RecipeFingerprintSource;
  const recipe = await repo.create(TEST_USER_ID, {
    ...source,
    nutritionTotal: { calories: 520, protein: 40, carbs: 10, fat: 35, fiber: 1 },
    exportView: {
      version: 1,
      teaser: 'Frühstück leicht gemacht.',
      totalTimeMinutes: 20,
      difficulty: 'Einfach',
      steps: [{ order: 1, description: 'Mischen.' }],
      includedIngredientIds: ['00000000-0000-0000-0000-000000000010'],
      sourceFingerprint: computeRecipeSourceFingerprint(source),
    },
  });
  const recipeWithImage = await repo.update(TEST_USER_ID, recipe.id, {
    images: [{ id: 'image-1', blobName: 'server/blob.png', order: 1 }],
  });

  return { repo, recipe: recipeWithImage! };
}

async function createDraftBundleRecipe() {
  const recipe = await createRecipe(
    [{ id: 'image-1', blobName: 'server/blob.png', order: 1 }],
    ['Schnell'],
    [shareBundleIngredient, shareBundleSeasoning],
  );
  return { repo: getRecipesRepository(), recipe };
}

function renderRequest(recipeId: string, body: unknown = {}) {
  return makeAuthRequest({ params: { id: recipeId }, body });
}

function expectRecipeValidationError(
  response: { status?: number; jsonBody?: unknown },
  path: string,
  code = 'INVALID_REQUEST',
) {
  expect(response.status).toBe(400);
  expect(response.jsonBody).toMatchObject({
    code,
    category: 'validation',
    retryable: false,
    fieldErrors: expect.arrayContaining([
      expect.objectContaining({ path, code: expect.any(String) }),
    ]),
  });
}

describe('POST /api/recipes/:id/instagram-render', () => {
  it('characterizes the render request schema at valid bounds and before image work', async () => {
    const imageId = '00000000-0000-4000-8000-000000000001';
    const tags = ['Schnell', 'Salat', 'Vegan', 'Abendessen'];
    const recipe = await createRecipe(
      [{ id: imageId, blobName: 'server/blob.png', order: 1 }],
      tags,
    );

    const minimum = await instagramRecipeHandler(
      await renderRequest(recipe.id, {
        imageId,
        presentation: { focusX: 0, focusY: 0, zoom: 1 },
        selectedTags: [],
        nutritionHighlight: null,
        recipeMeta: { totalTimeMinutes: 1, difficulty: '影' },
      }),
      ctx,
    );
    expect(minimum.status).toBe(200);

    const maximum = await instagramRecipeHandler(
      await renderRequest(recipe.id, {
        imageId,
        presentation: { focusX: 1, focusY: 1, zoom: Number.MAX_SAFE_INTEGER },
        selectedTags: tags,
        nutritionHighlight: 'high-protein',
        recipeMeta: {
          totalTimeMinutes: Number.MAX_SAFE_INTEGER,
          difficulty: '影'.repeat(256),
        },
      }),
      ctx,
    );
    expect(maximum.status).toBe(200);
    const renderedInput = renderInstagramRecipeMock.mock.calls[1]![0] as Record<string, any>;
    expect(renderedInput.presentation).toEqual({
      focusX: 1,
      focusY: 1,
      zoom: Number.MAX_SAFE_INTEGER,
    });
    expect(renderedInput.recipeMeta).toEqual({
      totalTimeMinutes: Number.MAX_SAFE_INTEGER,
      difficulty: '影'.repeat(256),
      portions: 4,
    });

    const invalidCases: Array<{ name: string; body: unknown; path: string }> = [
      { name: 'malformed image UUID', body: { imageId: 'image-1' }, path: 'imageId' },
      { name: 'null image UUID', body: { imageId: null }, path: 'imageId' },
      { name: 'numeric image UUID', body: { imageId: 1 }, path: 'imageId' },
      { name: 'null presentation', body: { presentation: null }, path: 'presentation' },
      { name: 'string focusX', body: { presentation: { focusX: '0.5' } }, path: 'presentation.focusX' },
      { name: 'null focusX', body: { presentation: { focusX: null } }, path: 'presentation.focusX' },
      { name: 'NaN focusX', body: { presentation: { focusX: Number.NaN } }, path: 'presentation.focusX' },
      { name: 'infinite focusX', body: { presentation: { focusX: Number.POSITIVE_INFINITY } }, path: 'presentation.focusX' },
      { name: 'focusX below minimum', body: { presentation: { focusX: -Number.EPSILON } }, path: 'presentation.focusX' },
      { name: 'focusX above maximum', body: { presentation: { focusX: 1 + Number.EPSILON } }, path: 'presentation.focusX' },
      { name: 'string focusY', body: { presentation: { focusY: '0.5' } }, path: 'presentation.focusY' },
      { name: 'null focusY', body: { presentation: { focusY: null } }, path: 'presentation.focusY' },
      { name: 'NaN focusY', body: { presentation: { focusY: Number.NaN } }, path: 'presentation.focusY' },
      { name: 'infinite focusY', body: { presentation: { focusY: Number.POSITIVE_INFINITY } }, path: 'presentation.focusY' },
      { name: 'focusY below minimum', body: { presentation: { focusY: -Number.EPSILON } }, path: 'presentation.focusY' },
      { name: 'focusY above maximum', body: { presentation: { focusY: 1 + Number.EPSILON } }, path: 'presentation.focusY' },
      { name: 'string zoom', body: { presentation: { zoom: '1' } }, path: 'presentation.zoom' },
      { name: 'null zoom', body: { presentation: { zoom: null } }, path: 'presentation.zoom' },
      { name: 'NaN zoom', body: { presentation: { zoom: Number.NaN } }, path: 'presentation.zoom' },
      { name: 'infinite zoom', body: { presentation: { zoom: Number.POSITIVE_INFINITY } }, path: 'presentation.zoom' },
      { name: 'zoom below minimum', body: { presentation: { zoom: 1 - Number.EPSILON } }, path: 'presentation.zoom' },
      { name: 'presentation extra key', body: { presentation: { focusX: 0, unexpected: true } }, path: 'presentation' },
      { name: 'null selectedTags', body: { selectedTags: null }, path: 'selectedTags' },
      { name: 'object selectedTags', body: { selectedTags: {} }, path: 'selectedTags' },
      { name: 'non-string selected tag', body: { selectedTags: ['Schnell', 1] }, path: 'selectedTags[1]' },
      { name: 'empty selected tag', body: { selectedTags: [''] }, path: 'selectedTags[0]' },
      { name: 'whitespace selected tag', body: { selectedTags: ['   '] }, path: 'selectedTags[0]' },
      { name: 'too many selected tags', body: { selectedTags: [...tags, 'Tag 5'] }, path: 'selectedTags' },
      { name: 'invalid highlight enum', body: { nutritionHighlight: 'low-fat' }, path: 'nutritionHighlight' },
      { name: 'numeric highlight', body: { nutritionHighlight: 1 }, path: 'nutritionHighlight' },
      { name: 'object highlight', body: { nutritionHighlight: {} }, path: 'nutritionHighlight' },
      { name: 'null recipeMeta', body: { recipeMeta: null }, path: 'recipeMeta' },
      { name: 'missing totalTimeMinutes', body: { recipeMeta: { difficulty: 'Einfach' } }, path: 'recipeMeta.totalTimeMinutes' },
      { name: 'null totalTimeMinutes', body: { recipeMeta: { totalTimeMinutes: null, difficulty: 'Einfach' } }, path: 'recipeMeta.totalTimeMinutes' },
      { name: 'string totalTimeMinutes', body: { recipeMeta: { totalTimeMinutes: '25', difficulty: 'Einfach' } }, path: 'recipeMeta.totalTimeMinutes' },
      { name: 'NaN totalTimeMinutes', body: { recipeMeta: { totalTimeMinutes: Number.NaN, difficulty: 'Einfach' } }, path: 'recipeMeta.totalTimeMinutes' },
      { name: 'infinite totalTimeMinutes', body: { recipeMeta: { totalTimeMinutes: Number.POSITIVE_INFINITY, difficulty: 'Einfach' } }, path: 'recipeMeta.totalTimeMinutes' },
      { name: 'zero totalTimeMinutes', body: { recipeMeta: { totalTimeMinutes: 0, difficulty: 'Einfach' } }, path: 'recipeMeta.totalTimeMinutes' },
      { name: 'negative totalTimeMinutes', body: { recipeMeta: { totalTimeMinutes: -1, difficulty: 'Einfach' } }, path: 'recipeMeta.totalTimeMinutes' },
      { name: 'fractional totalTimeMinutes', body: { recipeMeta: { totalTimeMinutes: 1.5, difficulty: 'Einfach' } }, path: 'recipeMeta.totalTimeMinutes' },
      { name: 'missing difficulty', body: { recipeMeta: { totalTimeMinutes: 1 } }, path: 'recipeMeta.difficulty' },
      { name: 'null difficulty', body: { recipeMeta: { totalTimeMinutes: 1, difficulty: null } }, path: 'recipeMeta.difficulty' },
      { name: 'numeric difficulty', body: { recipeMeta: { totalTimeMinutes: 1, difficulty: 1 } }, path: 'recipeMeta.difficulty' },
      { name: 'empty difficulty', body: { recipeMeta: { totalTimeMinutes: 1, difficulty: '' } }, path: 'recipeMeta.difficulty' },
      { name: 'whitespace difficulty', body: { recipeMeta: { totalTimeMinutes: 1, difficulty: '   ' } }, path: 'recipeMeta.difficulty' },
      { name: 'line-break difficulty', body: { recipeMeta: { totalTimeMinutes: 1, difficulty: 'Ein\nfach' } }, path: 'recipeMeta.difficulty' },
      { name: 'Unicode line-separator difficulty', body: { recipeMeta: { totalTimeMinutes: 1, difficulty: 'Ein\u2028fach' } }, path: 'recipeMeta.difficulty' },
      { name: 'recipeMeta extra key', body: { recipeMeta: { totalTimeMinutes: 1, difficulty: 'Einfach', unexpected: true } }, path: 'recipeMeta' },
      { name: 'top-level extra key', body: { unexpected: true }, path: 'body' },
      { name: 'null request body', body: null, path: 'body' },
      { name: 'array request body', body: [], path: 'body' },
    ];

    for (const testCase of invalidCases) {
      const response = await instagramRecipeHandler(
        await renderRequest(recipe.id, testCase.body),
        ctx,
      );
      expectRecipeValidationError(response, testCase.path);
    }

    const invalidJson = await instagramRecipeHandler(
      await makeAuthRequest({ params: { id: recipe.id }, rawBody: '{' }),
      ctx,
    );
    expect(invalidJson.status).toBe(400);
    expect(invalidJson.jsonBody).toMatchObject({
      code: 'INVALID_JSON',
      category: 'validation',
      retryable: false,
      fieldErrors: [{ path: 'body', code: 'invalid_json' }],
    });

    const paddedStoredTag = await instagramRecipeHandler(
      await renderRequest(recipe.id, { selectedTags: ['Schnell '] }),
      ctx,
    );
    expect(paddedStoredTag.status).toBe(400);
    expect(paddedStoredTag.jsonBody).toMatchObject({
      code: 'INVALID_SELECTED_TAGS',
      category: 'validation',
      retryable: false,
    });
    expect(paddedStoredTag.jsonBody).not.toHaveProperty('fieldErrors');
    expect(downloadRecipeImageMock).toHaveBeenCalledTimes(2);
    expect(renderInstagramRecipeMock).toHaveBeenCalledTimes(2);
  });

  it('requires authentication', async () => {
    const recipe = await createRecipe([{ id: 'image-1', blobName: 'server/blob.png', order: 1 }]);

    const response = await instagramRecipeHandler(
      makeRequest({ params: { id: recipe.id }, body: {} }),
      ctx,
    );

    expect(response.status).toBe(401);
    expect(downloadRecipeImageMock).not.toHaveBeenCalled();
  });

  it('renders a direct PNG response from server-owned recipe data and defaults', async () => {
    const recipe = await createRecipe([
      { id: 'later', blobName: 'server/later.png', order: 2 },
      { id: 'first', blobName: 'server/first.png', order: 1 },
    ]);

    const response = await instagramRecipeHandler(await renderRequest(recipe.id), ctx);

    expect(response.status).toBe(200);
    expect(response.body).toBe(renderedBuffer);
    expect(response.jsonBody).toBeUndefined();
    expect(response.headers).toEqual({
      'Content-Type': 'image/png',
      'Content-Length': String(renderedBuffer.byteLength),
      'Content-Disposition': 'inline; filename="fittrack-recipe.png"',
      'Cache-Control': 'no-store',
    });
    expect(downloadRecipeImageMock).toHaveBeenCalledWith('server/first.png');

    const input = renderInstagramRecipeMock.mock.calls[0][0] as Record<string, any>;
    expect(input.presentation).toEqual({ focusX: 0.5, focusY: 0.46, zoom: 1 });
    expect(input.title).toBe('Stored recipe');
    expect(input.tags).toEqual([
      { id: 'Schnell', label: 'Schnell' },
      { id: 'Salat', label: 'Salat' },
    ]);
    expect(input.nutrition).toEqual({ calories: 200, protein: 25, carbs: 20, fat: 5 });
    expect(input).not.toHaveProperty('recipeMeta');
  });

  it('defaults only omitted presentation fields and uses request meta with stored portions', async () => {
    const recipe = await createRecipe(
      [{ id: 'image-1', blobName: 'server/blob.png', order: 1 }],
      ['Schnell', 'Salat', 'Vegan', 'Abendessen'],
    );

    const response = await instagramRecipeHandler(
      await renderRequest(recipe.id, {
        presentation: { focusY: 0.25 },
        selectedTags: ['Abendessen', 'Salat', 'Vegan', 'Schnell'],
        nutritionHighlight: 'high-protein',
        recipeMeta: { totalTimeMinutes: 25, difficulty: ' Einfach ' },
      }),
      ctx,
    );

    expect(response.status).toBe(200);
    const input = renderInstagramRecipeMock.mock.calls[0][0] as Record<string, any>;
    expect(input.presentation).toEqual({ focusX: 0.5, focusY: 0.25, zoom: 1 });
    expect(input.tags).toEqual([
      { id: 'Schnell', label: 'Schnell' },
      { id: 'Salat', label: 'Salat' },
      { id: 'Vegan', label: 'Vegan' },
      { id: 'Abendessen', label: 'Abendessen' },
    ]);
    expect(input.nutritionHighlight).toBe('high-protein');
    expect(input.recipeMeta).toEqual({ totalTimeMinutes: 25, difficulty: 'Einfach', portions: 4 });
  });

  it('allows an empty selected tag list and keeps the primary image selection', async () => {
    const recipe = await createRecipe([
      { id: 'later', blobName: 'server/later.png', order: 2 },
      { id: 'first', blobName: 'server/first.png', order: 1 },
    ]);

    const response = await instagramRecipeHandler(
      await renderRequest(recipe.id, { selectedTags: [], nutritionHighlight: null }),
      ctx,
    );

    expect(response.status).toBe(200);
    expect(downloadRecipeImageMock).toHaveBeenCalledWith('server/first.png');
    const input = renderInstagramRecipeMock.mock.calls[0][0] as Record<string, any>;
    expect(input.tags).toEqual([]);
    expect(input.nutritionHighlight).toBeNull();
  });

  it('uses the selected image crop and merges partial presentation overrides', async () => {
    const recipe = await createRecipe([
      {
        id: 'image-1',
        blobName: 'server/blob.png',
        order: 1,
        heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusX: 0.2, focusY: 0.7, zoom: 1.4 },
      },
    ]);

    const response = await instagramRecipeHandler(
      await renderRequest(recipe.id, { presentation: { focusY: 0.25 } }),
      ctx,
    );

    expect(response.status).toBe(200);
    const input = renderInstagramRecipeMock.mock.calls[0][0] as Record<string, any>;
    expect(input.presentation).toEqual({ focusX: 0.2, focusY: 0.25, zoom: 1.4 });
  });

  it('rejects client-owned recipe fields and invalid request options', async () => {
    const recipe = await createRecipe([{ id: 'image-1', blobName: 'server/blob.png', order: 1 }]);

    const unknownField = await instagramRecipeHandler(
      await renderRequest(recipe.id, { title: 'client title' }),
      ctx,
    );
    expect(unknownField.status).toBe(400);
    expect(unknownField.jsonBody).toMatchObject({
      code: 'INVALID_REQUEST', category: 'validation', retryable: false,
      fieldErrors: [{ path: 'body', code: 'unrecognized_keys' }],
    });

    const invalidPresentation = await instagramRecipeHandler(
      await renderRequest(recipe.id, { presentation: { zoom: 0.5 } }),
      ctx,
    );
    expect(invalidPresentation.status).toBe(400);
    expect(invalidPresentation.jsonBody).toMatchObject({
      code: 'INVALID_REQUEST', category: 'validation', retryable: false,
      fieldErrors: [{ path: 'presentation.zoom', code: 'too_small' }],
    });

    const partialMeta = await instagramRecipeHandler(
      await renderRequest(recipe.id, { recipeMeta: { difficulty: 'Einfach' } }),
      ctx,
    );
    expect(partialMeta.status).toBe(400);
    expect(partialMeta.jsonBody).toMatchObject({
      code: 'INVALID_REQUEST', category: 'validation', retryable: false,
      fieldErrors: [{ path: 'recipeMeta.totalTimeMinutes', code: 'invalid_type' }],
    });

    const unknownTag = await instagramRecipeHandler(
      await renderRequest(recipe.id, { selectedTags: ['Nicht gespeichert'] }),
      ctx,
    );
    expect(unknownTag.status).toBe(400);
    expect(unknownTag.jsonBody).toMatchObject({
      code: 'INVALID_SELECTED_TAGS', category: 'validation', retryable: false,
      message: 'Die ausgewählten Tags passen nicht mehr zum Rezept. Lade das Rezept neu.',
    });
    expect(unknownTag.jsonBody).not.toHaveProperty('fieldErrors');

    const duplicateTag = await instagramRecipeHandler(
      await renderRequest(recipe.id, { selectedTags: ['Schnell', 'Schnell'] }),
      ctx,
    );
    expect(duplicateTag.status).toBe(400);
    expect(duplicateTag.jsonBody).toMatchObject({
      code: 'INVALID_SELECTED_TAGS', category: 'validation', retryable: false,
      message: 'Die ausgewählten Tags passen nicht mehr zum Rezept. Lade das Rezept neu.',
    });
    expect(duplicateTag.jsonBody).not.toHaveProperty('fieldErrors');

    const freeTag = await instagramRecipeHandler(
      await renderRequest(recipe.id, { selectedTags: ['Schnell '] }),
      ctx,
    );
    expect(freeTag.status).toBe(400);
    expect(freeTag.jsonBody).toMatchObject({
      code: 'INVALID_SELECTED_TAGS', category: 'validation', retryable: false,
      message: 'Die ausgewählten Tags passen nicht mehr zum Rezept. Lade das Rezept neu.',
    });
    expect(freeTag.jsonBody).not.toHaveProperty('fieldErrors');

    const tooManyTags = await instagramRecipeHandler(
      await renderRequest(recipe.id, {
        selectedTags: ['Schnell', 'Salat', 'Tag 3', 'Tag 4', 'Tag 5'],
      }),
      ctx,
    );
    expect(tooManyTags.status).toBe(400);
    expect(tooManyTags.jsonBody).toMatchObject({
      code: 'INVALID_REQUEST', category: 'validation', retryable: false,
      fieldErrors: [{ path: 'selectedTags', code: 'too_big' }],
    });

    const invalidHighlights: unknown[] = [
      'low-fat',
      'automatic',
      'high-fiber',
      true,
      42,
      {},
      [],
    ];
    for (const nutritionHighlight of invalidHighlights) {
      const invalidHighlight = await instagramRecipeHandler(
        await renderRequest(recipe.id, { nutritionHighlight }),
        ctx,
      );
      expect(invalidHighlight.status).toBe(400);
      expect(invalidHighlight.jsonBody).toMatchObject({
        code: 'INVALID_REQUEST', category: 'validation', retryable: false,
        fieldErrors: [expect.objectContaining({ path: 'nutritionHighlight' })],
      });
    }
    expect(downloadRecipeImageMock).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown recipe or selected image', async () => {
    const missingRecipe = await instagramRecipeHandler(
      await renderRequest('missing-recipe'),
      ctx,
    );
    expect(missingRecipe.status).toBe(404);

    const recipe = await createRecipe([{ id: 'image-1', blobName: 'server/blob.png', order: 1 }]);
    const missingImage = await instagramRecipeHandler(
      await renderRequest(recipe.id, { imageId: '00000000-0000-4000-8000-000000000001' }),
      ctx,
    );
    expect(missingImage.status).toBe(404);
    expect(missingImage.jsonBody).toMatchObject({ code: 'RECIPE_IMAGE_NOT_FOUND', category: 'not_found' });
  });

  it('does not render a published recipe owned by another user', async () => {
    const recipe = await createRecipe([{ id: 'image-1', blobName: 'server/blob.png', order: 1 }]);
    const repo = getRecipesRepository();
    const current = await repo.getVersioned(TEST_USER_ID, recipe.id);
    await repo.setVisibility(TEST_USER_ID, recipe.id, current!.etag, {
      visibility: 'community',
      contentConfirmed: true,
      displayNameConsent: false,
    });
    const token = await signTestToken('different-user');

    const response = await instagramRecipeHandler(
      makeRequest({
        params: { id: recipe.id },
        body: {},
        headers: { authorization: `Bearer ${token}` },
      }),
      ctx,
    );

    expect(response.status).toBe(404);
    expect(response.jsonBody).toMatchObject({ code: 'RECIPE_NOT_FOUND', category: 'not_found' });
    expect(downloadRecipeImageMock).not.toHaveBeenCalled();
    expect(renderInstagramRecipeMock).not.toHaveBeenCalled();
  });

  it('returns controlled 422 errors for missing, invalid, or oversized images', async () => {
    const noImageRecipe = await createRecipe();
    const noImage = await instagramRecipeHandler(await renderRequest(noImageRecipe.id), ctx);
    expect(noImage.status).toBe(422);
    expect(noImage.jsonBody).toMatchObject({ code: 'NO_RECIPE_IMAGE', category: 'validation', retryable: false });

    const invalidMetadataRecipe = await createRecipe([{ id: 'image-1', blobName: ' ', order: 1 }]);
    const invalidMetadata = await instagramRecipeHandler(
      await renderRequest(invalidMetadataRecipe.id),
      ctx,
    );
    expect(invalidMetadata.status).toBe(422);
    expect(invalidMetadata.jsonBody).toMatchObject({ code: 'IMAGE_BLOB_INVALID', category: 'validation' });

    const oversizedRecipe = await createRecipe([{ id: 'image-1', blobName: 'server/large.png', order: 1 }]);
    downloadRecipeImageMock.mockRejectedValueOnce(new RecipeImageTooLargeError());
    const oversized = await instagramRecipeHandler(await renderRequest(oversizedRecipe.id), ctx);
    expect(oversized.status).toBe(422);
    expect(oversized.jsonBody).toMatchObject({ code: 'IMAGE_TOO_LARGE', category: 'validation' });
  });

  it('maps renderer input failures to 422 and hides internal details', async () => {
    const recipe = await createRecipe([{ id: 'image-1', blobName: 'server/blob.png', order: 1 }]);
    renderInstagramRecipeMock.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'TITLE_OVERFLOW',
        message: 'private measured detail',
        measured: { width: 999, max: 1 },
      },
    });

    const response = await instagramRecipeHandler(await renderRequest(recipe.id), ctx);

    expect(response.status).toBe(422);
    expect(response.jsonBody).toMatchObject({ code: 'TITLE_OVERFLOW', retryable: false });
    expect(JSON.stringify(response.jsonBody)).not.toContain('private measured detail');
  });

  it('returns an actionable title overflow message and logs the exact bundle title', async () => {
    const { repo, recipe } = await createCurrentBundleRecipe();
    const title = 'Chicken mit Nudeln und Gemüse';
    await repo.update(TEST_USER_ID, recipe.id, { name: title });
    const warningLogs = vi.spyOn(ctx, 'warn').mockImplementation(() => {});
    renderInstagramRecipeMock.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'TITLE_OVERFLOW',
        message: 'Recipe title exceeds the fixed title width.',
        measured: { width: 935, max: 904 },
      },
    });

    try {
      const response = await shareBundleHandler(await renderRequest(recipe.id), ctx);

      expect(response.status).toBe(422);
      expect(response.jsonBody).toMatchObject({ code: 'TITLE_OVERFLOW', retryable: false });
      const serializedWarningLogs = warningLogs.mock.calls.map(([line]) => String(line)).join('\n');
      expect(serializedWarningLogs).toContain('"event":"recipes.shareBundle.instagramRender.unrenderable"');
      expect(serializedWarningLogs).toContain(`"recipe_title":"${title}"`);
      expect(serializedWarningLogs).toContain('"measured_width":935');
      expect(serializedWarningLogs).toContain('"max_width":904');
    } finally {
      warningLogs.mockRestore();
    }
  });

  it('maps missing assets and storage failures to generic 500 responses', async () => {
    const recipe = await createRecipe([{ id: 'image-1', blobName: 'server/blob.png', order: 1 }]);
    renderInstagramRecipeMock.mockResolvedValueOnce({
      ok: false,
      error: { code: 'MISSING_ASSET', message: 'assets/private-font.ttf', asset: 'private-font.ttf' },
    });

    const missingAsset = await instagramRecipeHandler(await renderRequest(recipe.id), ctx);
    expect(missingAsset.status).toBe(500);
    expect(missingAsset.jsonBody).toMatchObject({ code: 'INTERNAL_ERROR', category: 'internal' });
    expect(JSON.stringify(missingAsset.jsonBody)).not.toContain('private-font.ttf');

    downloadRecipeImageMock.mockRejectedValueOnce(new Error('storage connection secret'));
    const storageFailure = await instagramRecipeHandler(await renderRequest(recipe.id), ctx);
    expect(storageFailure.status).toBe(500);
    expect(storageFailure.jsonBody).toMatchObject({ code: 'INTERNAL_ERROR', category: 'internal' });
  });

  it('characterizes inherited share request fields at valid bounds and before image work', async () => {
    const minimumRecipe = await createDraftBundleRecipe();
    const minimum = await shareBundleHandler(
      await renderRequest(minimumRecipe.recipe.id, {
        presentation: { focusX: 0, focusY: 0, zoom: 1 },
        selectedTags: [],
        nutritionHighlight: null,
        exportViewDraft: {
          version: 1,
          teaser: 'x',
          totalTimeMinutes: null,
          difficulty: null,
          steps: [{ order: 1, description: 'x' }],
          includedIngredientIds: [],
        },
      }),
      ctx,
    );
    expect(minimum.status).toBe(200);

    const imageId = '00000000-0000-4000-8000-000000000001';
    const tags = ['Schnell', 'Salat', 'Vegan', 'Abendessen'];
    const ingredients = Array.from({ length: 20 }, (_, index) => ({
      ...shareBundleIngredient,
      id: `00000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`,
    }));
    const maximumRecipe = await createRecipe(
      [{ id: imageId, blobName: 'server/blob.png', order: 1 }],
      tags,
      ingredients,
    );
    const maximum = await shareBundleHandler(
      await renderRequest(maximumRecipe.id, {
        imageId,
        presentation: { focusX: 1, focusY: 1, zoom: Number.MAX_SAFE_INTEGER },
        selectedTags: tags,
        nutritionHighlight: 'high-protein',
        exportViewDraft: {
          version: 1,
          teaser: 'x'.repeat(96),
          totalTimeMinutes: 10_080,
          difficulty: '影'.repeat(256),
          steps: Array.from({ length: 5 }, (_, index) => ({
            order: Number.MAX_SAFE_INTEGER - 4 + index,
            description: 'x'.repeat(90),
          })),
          includedIngredientIds: ingredients.map((ingredient) => ingredient.id),
        },
      }),
      ctx,
    );
    expect(maximum.status).toBe(200);
    const instagramInput = renderInstagramRecipeMock.mock.calls[1]![0] as Record<string, any>;
    const detailInput = renderInstagramRecipeDetailsTemplateMock.mock.calls[1]![0] as Record<string, any>;
    expect(instagramInput.presentation).toEqual({
      focusX: 1,
      focusY: 1,
      zoom: Number.MAX_SAFE_INTEGER,
    });
    expect(instagramInput.tags).toHaveLength(4);
    expect(instagramInput.nutritionHighlight).toBe('high-protein');
    expect(instagramInput.recipeMeta).toEqual({
      totalTimeMinutes: 10_080,
      difficulty: '影'.repeat(256),
      portions: 4,
    });
    expect(detailInput.steps).toHaveLength(5);
    expect(downloadRecipeImageMock).toHaveBeenCalledTimes(2);

    const invalidCases: Array<{ name: string; body: unknown; path: string }> = [
      { name: 'malformed image UUID', body: { imageId: 'image-1' }, path: 'imageId' },
      { name: 'null image UUID', body: { imageId: null }, path: 'imageId' },
      { name: 'numeric image UUID', body: { imageId: 1 }, path: 'imageId' },
      { name: 'null presentation', body: { presentation: null }, path: 'presentation' },
      { name: 'string focusX', body: { presentation: { focusX: '0.5' } }, path: 'presentation.focusX' },
      { name: 'null focusX', body: { presentation: { focusX: null } }, path: 'presentation.focusX' },
      { name: 'NaN focusX', body: { presentation: { focusX: Number.NaN } }, path: 'presentation.focusX' },
      { name: 'infinite focusX', body: { presentation: { focusX: Number.POSITIVE_INFINITY } }, path: 'presentation.focusX' },
      { name: 'focusX below minimum', body: { presentation: { focusX: -Number.EPSILON } }, path: 'presentation.focusX' },
      { name: 'focusX above maximum', body: { presentation: { focusX: 1 + Number.EPSILON } }, path: 'presentation.focusX' },
      { name: 'string focusY', body: { presentation: { focusY: '0.5' } }, path: 'presentation.focusY' },
      { name: 'null focusY', body: { presentation: { focusY: null } }, path: 'presentation.focusY' },
      { name: 'NaN focusY', body: { presentation: { focusY: Number.NaN } }, path: 'presentation.focusY' },
      { name: 'infinite focusY', body: { presentation: { focusY: Number.POSITIVE_INFINITY } }, path: 'presentation.focusY' },
      { name: 'focusY below minimum', body: { presentation: { focusY: -Number.EPSILON } }, path: 'presentation.focusY' },
      { name: 'focusY above maximum', body: { presentation: { focusY: 1 + Number.EPSILON } }, path: 'presentation.focusY' },
      { name: 'string zoom', body: { presentation: { zoom: '1' } }, path: 'presentation.zoom' },
      { name: 'null zoom', body: { presentation: { zoom: null } }, path: 'presentation.zoom' },
      { name: 'NaN zoom', body: { presentation: { zoom: Number.NaN } }, path: 'presentation.zoom' },
      { name: 'infinite zoom', body: { presentation: { zoom: Number.POSITIVE_INFINITY } }, path: 'presentation.zoom' },
      { name: 'zoom below minimum', body: { presentation: { zoom: 1 - Number.EPSILON } }, path: 'presentation.zoom' },
      { name: 'presentation extra key', body: { presentation: { focusX: 0, unexpected: true } }, path: 'presentation' },
      { name: 'null selectedTags', body: { selectedTags: null }, path: 'selectedTags' },
      { name: 'object selectedTags', body: { selectedTags: {} }, path: 'selectedTags' },
      { name: 'non-string selected tag', body: { selectedTags: ['Schnell', 1] }, path: 'selectedTags[1]' },
      { name: 'empty selected tag', body: { selectedTags: [''] }, path: 'selectedTags[0]' },
      { name: 'whitespace selected tag', body: { selectedTags: ['   '] }, path: 'selectedTags[0]' },
      { name: 'too many selected tags', body: { selectedTags: [...tags, 'Tag 5'] }, path: 'selectedTags' },
      { name: 'invalid highlight enum', body: { nutritionHighlight: 'low-fat' }, path: 'nutritionHighlight' },
      { name: 'numeric highlight', body: { nutritionHighlight: 1 }, path: 'nutritionHighlight' },
      { name: 'object highlight', body: { nutritionHighlight: {} }, path: 'nutritionHighlight' },
      { name: 'top-level extra key', body: { unexpected: true }, path: 'body' },
      { name: 'recipeMeta is not inherited', body: { recipeMeta: { totalTimeMinutes: 1, difficulty: 'Einfach' } }, path: 'body' },
      { name: 'null request body', body: null, path: 'body' },
      { name: 'array request body', body: [], path: 'body' },
    ];

    for (const testCase of invalidCases) {
      const response = await shareBundleHandler(
        await renderRequest(minimumRecipe.recipe.id, testCase.body),
        ctx,
      );
      expectRecipeValidationError(response, testCase.path);
    }

    const invalidJson = await shareBundleHandler(
      await makeAuthRequest({ params: { id: minimumRecipe.recipe.id }, rawBody: '{' }),
      ctx,
    );
    expect(invalidJson.status).toBe(400);
    expect(invalidJson.jsonBody).toMatchObject({
      code: 'INVALID_JSON',
      category: 'validation',
      retryable: false,
      fieldErrors: [{ path: 'body', code: 'invalid_json' }],
    });

    for (const selectedTags of [['Schnell '], ['Not stored']]) {
      const response = await shareBundleHandler(
        await renderRequest(minimumRecipe.recipe.id, {
          selectedTags,
          exportViewDraft: shareBundleExportDraft,
        }),
        ctx,
      );
      expect(response.status).toBe(400);
      expect(response.jsonBody).toMatchObject({
        code: 'INVALID_SELECTED_TAGS',
        category: 'validation',
        retryable: false,
      });
      expect(response.jsonBody).not.toHaveProperty('fieldErrors');
    }

    expect(downloadRecipeImageMock).toHaveBeenCalledTimes(2);
    expect(renderInstagramRecipeMock).toHaveBeenCalledTimes(2);
    expect(renderInstagramRecipeDetailsTemplateMock).toHaveBeenCalledTimes(2);
  });

  it('characterizes required, nullable, bounded, and strict exportViewDraft fields', async () => {
    const withoutField = (field: string) => {
      const draft: Record<string, unknown> = { ...shareBundleExportDraft };
      delete draft[field];
      return draft;
    };
    const invalidCases: Array<{ name: string; body: unknown; path: string; code?: string }> = [
      { name: 'null draft', body: { exportViewDraft: null }, path: 'exportViewDraft' },
      { name: 'string draft', body: { exportViewDraft: 'draft' }, path: 'exportViewDraft' },
      { name: 'missing version', body: { exportViewDraft: withoutField('version') }, path: 'exportViewDraft.version' },
      { name: 'missing teaser', body: { exportViewDraft: withoutField('teaser') }, path: 'exportViewDraft.teaser' },
      { name: 'missing totalTimeMinutes', body: { exportViewDraft: withoutField('totalTimeMinutes') }, path: 'exportViewDraft.totalTimeMinutes' },
      { name: 'missing difficulty', body: { exportViewDraft: withoutField('difficulty') }, path: 'exportViewDraft.difficulty' },
      { name: 'missing steps', body: { exportViewDraft: withoutField('steps') }, path: 'exportViewDraft.steps' },
      { name: 'missing includedIngredientIds', body: { exportViewDraft: withoutField('includedIngredientIds') }, path: 'exportViewDraft.includedIngredientIds' },
      { name: 'null version', body: { exportViewDraft: { ...shareBundleExportDraft, version: null } }, path: 'exportViewDraft.version' },
      { name: 'wrong version literal', body: { exportViewDraft: { ...shareBundleExportDraft, version: 2 } }, path: 'exportViewDraft.version' },
      { name: 'null teaser', body: { exportViewDraft: { ...shareBundleExportDraft, teaser: null } }, path: 'exportViewDraft.teaser' },
      { name: 'numeric teaser', body: { exportViewDraft: { ...shareBundleExportDraft, teaser: 1 } }, path: 'exportViewDraft.teaser' },
      { name: 'empty teaser', body: { exportViewDraft: { ...shareBundleExportDraft, teaser: '' } }, path: 'exportViewDraft.teaser' },
      { name: 'whitespace teaser', body: { exportViewDraft: { ...shareBundleExportDraft, teaser: '   ' } }, path: 'exportViewDraft.teaser' },
      { name: 'teaser too long', body: { exportViewDraft: { ...shareBundleExportDraft, teaser: 'x'.repeat(97) } }, path: 'exportViewDraft.teaser' },
      { name: 'string totalTimeMinutes', body: { exportViewDraft: { ...shareBundleExportDraft, totalTimeMinutes: '20' } }, path: 'exportViewDraft.totalTimeMinutes' },
      { name: 'NaN totalTimeMinutes', body: { exportViewDraft: { ...shareBundleExportDraft, totalTimeMinutes: Number.NaN } }, path: 'exportViewDraft.totalTimeMinutes' },
      { name: 'infinite totalTimeMinutes', body: { exportViewDraft: { ...shareBundleExportDraft, totalTimeMinutes: Number.POSITIVE_INFINITY } }, path: 'exportViewDraft.totalTimeMinutes' },
      { name: 'zero totalTimeMinutes', body: { exportViewDraft: { ...shareBundleExportDraft, totalTimeMinutes: 0 } }, path: 'exportViewDraft.totalTimeMinutes' },
      { name: 'negative totalTimeMinutes', body: { exportViewDraft: { ...shareBundleExportDraft, totalTimeMinutes: -1 } }, path: 'exportViewDraft.totalTimeMinutes' },
      { name: 'fractional totalTimeMinutes', body: { exportViewDraft: { ...shareBundleExportDraft, totalTimeMinutes: 1.5 } }, path: 'exportViewDraft.totalTimeMinutes' },
      { name: 'totalTimeMinutes above maximum', body: { exportViewDraft: { ...shareBundleExportDraft, totalTimeMinutes: 10_081 } }, path: 'exportViewDraft.totalTimeMinutes' },
      { name: 'numeric difficulty', body: { exportViewDraft: { ...shareBundleExportDraft, difficulty: 1 } }, path: 'exportViewDraft.difficulty' },
      { name: 'empty difficulty', body: { exportViewDraft: { ...shareBundleExportDraft, difficulty: '' } }, path: 'exportViewDraft.difficulty' },
      { name: 'whitespace difficulty', body: { exportViewDraft: { ...shareBundleExportDraft, difficulty: '   ' } }, path: 'exportViewDraft.difficulty' },
      { name: 'line-break difficulty', body: { exportViewDraft: { ...shareBundleExportDraft, difficulty: 'Ein\r\nfach' } }, path: 'exportViewDraft.difficulty' },
      { name: 'Unicode line-separator difficulty', body: { exportViewDraft: { ...shareBundleExportDraft, difficulty: 'Ein\u2028fach' } }, path: 'exportViewDraft.difficulty' },
      { name: 'Unicode paragraph-separator difficulty', body: { exportViewDraft: { ...shareBundleExportDraft, difficulty: 'Ein\u2029fach' } }, path: 'exportViewDraft.difficulty' },
      { name: 'null steps', body: { exportViewDraft: { ...shareBundleExportDraft, steps: null } }, path: 'exportViewDraft.steps' },
      { name: 'empty steps', body: { exportViewDraft: { ...shareBundleExportDraft, steps: [] } }, path: 'exportViewDraft.steps' },
      { name: 'too many steps', body: { exportViewDraft: { ...shareBundleExportDraft, steps: Array.from({ length: 6 }, (_, index) => ({ order: index + 1, description: 'x' })) } }, path: 'exportViewDraft.steps' },
      { name: 'missing step order', body: { exportViewDraft: { ...shareBundleExportDraft, steps: [{ description: 'x' }] } }, path: 'exportViewDraft.steps[0].order' },
      { name: 'step order below minimum', body: { exportViewDraft: { ...shareBundleExportDraft, steps: [{ order: 0, description: 'x' }] } }, path: 'exportViewDraft.steps[0].order' },
      { name: 'fractional step order', body: { exportViewDraft: { ...shareBundleExportDraft, steps: [{ order: 1.5, description: 'x' }] } }, path: 'exportViewDraft.steps[0].order' },
      { name: 'missing step description', body: { exportViewDraft: { ...shareBundleExportDraft, steps: [{ order: 1 }] } }, path: 'exportViewDraft.steps[0].description' },
      { name: 'empty step description', body: { exportViewDraft: { ...shareBundleExportDraft, steps: [{ order: 1, description: '' }] } }, path: 'exportViewDraft.steps[0].description' },
      { name: 'whitespace step description', body: { exportViewDraft: { ...shareBundleExportDraft, steps: [{ order: 1, description: '   ' }] } }, path: 'exportViewDraft.steps[0].description' },
      { name: 'step description too long', body: { exportViewDraft: { ...shareBundleExportDraft, steps: [{ order: 1, description: 'x'.repeat(91) }] } }, path: 'exportViewDraft.steps[0].description' },
      { name: 'step extra key', body: { exportViewDraft: { ...shareBundleExportDraft, steps: [{ order: 1, description: 'x', unexpected: true }] } }, path: 'exportViewDraft.steps[0]' },
      { name: 'step orders not ascending', body: { exportViewDraft: { ...shareBundleExportDraft, steps: [{ order: 2, description: 'x' }, { order: 1, description: 'y' }] } }, path: 'exportViewDraft.steps[1].order' },
      { name: 'null includedIngredientIds', body: { exportViewDraft: { ...shareBundleExportDraft, includedIngredientIds: null } }, path: 'exportViewDraft.includedIngredientIds' },
      { name: 'string includedIngredientIds', body: { exportViewDraft: { ...shareBundleExportDraft, includedIngredientIds: 'ingredient-id' } }, path: 'exportViewDraft.includedIngredientIds' },
      { name: 'empty ingredient ID', body: { exportViewDraft: { ...shareBundleExportDraft, includedIngredientIds: [''] } }, path: 'exportViewDraft.includedIngredientIds[0]' },
      { name: 'whitespace ingredient ID', body: { exportViewDraft: { ...shareBundleExportDraft, includedIngredientIds: ['   '] } }, path: 'exportViewDraft.includedIngredientIds[0]' },
      { name: 'too many ingredient IDs', body: { exportViewDraft: { ...shareBundleExportDraft, includedIngredientIds: Array.from({ length: 21 }, (_, index) => `ingredient-${index}`) } }, path: 'exportViewDraft.includedIngredientIds' },
      { name: 'non-string ingredient ID', body: { exportViewDraft: { ...shareBundleExportDraft, includedIngredientIds: [1] } }, path: 'exportViewDraft.includedIngredientIds[0]' },
      { name: 'duplicate ingredient IDs', body: { exportViewDraft: { ...shareBundleExportDraft, includedIngredientIds: ['ingredient-id', 'ingredient-id'] } }, path: 'exportViewDraft.includedIngredientIds', code: 'INVALID_EXPORT_VIEW_INGREDIENT' },
      { name: 'draft extra key', body: { exportViewDraft: { ...shareBundleExportDraft, sourceFingerprint: 'sha256:client' } }, path: 'exportViewDraft' },
    ];

    for (const testCase of invalidCases) {
      const response = await shareBundleHandler(
        await renderRequest('recipe-id', testCase.body),
        ctx,
      );
      expectRecipeValidationError(response, testCase.path, testCase.code);
    }

    expect(downloadRecipeImageMock).not.toHaveBeenCalled();
    expect(renderInstagramRecipeMock).not.toHaveBeenCalled();
    expect(renderInstagramRecipeDetailsTemplateMock).not.toHaveBeenCalled();
  });

  it('requires authentication for the share bundle', async () => {
    const { recipe } = await createCurrentBundleRecipe();
    const response = await shareBundleHandler(
      makeRequest({ params: { id: recipe.id }, body: {} }),
      ctx,
    );

    expect(response.status).toBe(401);
    expect(downloadRecipeImageMock).not.toHaveBeenCalled();
    expect(renderInstagramRecipeMock).not.toHaveBeenCalled();
    expect(renderInstagramRecipeDetailsTemplateMock).not.toHaveBeenCalled();
  });

  it.each(['stored view', 'request draft'])('returns an actionable missing-image error with a %s', async (source) => {
    const { repo, recipe } = await createCurrentBundleRecipe();
    const recipeWithoutImage = await repo.update(TEST_USER_ID, recipe.id, { images: [] });
    const updateSpy = vi.spyOn(repo, 'update');

    const response = await shareBundleHandler(
      await renderRequest(recipe.id, source === 'request draft' ? { exportViewDraft: shareBundleExportDraft } : {}),
      ctx,
    );

    expect(response.status).toBe(422);
    expect(response.jsonBody).toMatchObject({ code: 'NO_RECIPE_IMAGE', retryable: false });
    expect(downloadRecipeImageMock).not.toHaveBeenCalled();
    expect(renderInstagramRecipeMock).not.toHaveBeenCalled();
    expect(renderInstagramRecipeDetailsTemplateMock).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
    expect(await repo.get(TEST_USER_ID, recipe.id)).toEqual(recipeWithoutImage);
    updateSpy.mockRestore();
  });

  it('scopes request-draft rendering to the authenticated user', async () => {
    const { recipe } = await createDraftBundleRecipe();
    const token = await signTestToken('different-user');
    const response = await shareBundleHandler(
      makeRequest({
        params: { id: recipe.id },
        body: { exportViewDraft: shareBundleExportDraft },
        headers: { authorization: `Bearer ${token}` },
      }),
      ctx,
    );

    expect(response.status).toBe(404);
    expect(response.jsonBody).toMatchObject({ code: 'RECIPE_NOT_FOUND' });
    expect(downloadRecipeImageMock).not.toHaveBeenCalled();
    expect(renderInstagramRecipeMock).not.toHaveBeenCalled();
  });

  it('does not share a published recipe owned by another user', async () => {
    const { recipe } = await createDraftBundleRecipe();
    const repo = getRecipesRepository();
    const current = await repo.getVersioned(TEST_USER_ID, recipe.id);
    await repo.setVisibility(TEST_USER_ID, recipe.id, current!.etag, {
      visibility: 'community',
      contentConfirmed: true,
      displayNameConsent: false,
    });
    const token = await signTestToken('different-user');

    const response = await shareBundleHandler(
      makeRequest({
        params: { id: recipe.id },
        body: { exportViewDraft: shareBundleExportDraft },
        headers: { authorization: `Bearer ${token}` },
      }),
      ctx,
    );

    expect(response.status).toBe(404);
    expect(response.jsonBody).toMatchObject({ code: 'RECIPE_NOT_FOUND' });
    expect(downloadRecipeImageMock).not.toHaveBeenCalled();
    expect(renderInstagramRecipeMock).not.toHaveBeenCalled();
    expect(renderInstagramRecipeDetailsTemplateMock).not.toHaveBeenCalled();
  });

  it('renders a request-only draft with nullable metadata and does not persist it', async () => {
    const { repo, recipe } = await createDraftBundleRecipe();
    const updateSpy = vi.spyOn(repo, 'update');
    const response = await shareBundleHandler(
      await makeAuthRequest({
        params: { id: recipe.id },
        body: { exportViewDraft: shareBundleExportDraft },
      }),
      ctx,
    );

    const instagramInput = renderInstagramRecipeMock.mock.calls[0]?.[0] as Record<string, any>;
    const detailInput = renderInstagramRecipeDetailsTemplateMock.mock.calls[0]?.[0] as Record<string, any>;
    expect(response.status).toBe(200);
    expect(response.jsonBody).toMatchObject({
      recipeId: recipe.id,
      instagram: { mimeType: 'image/png', data: renderedBuffer.toString('base64') },
      detail: { mimeType: 'image/png', data: Buffer.from('detail-png').toString('base64') },
    });
    expect(instagramInput.title).toBe(recipe.name);
    expect(instagramInput.recipeMeta).toEqual({
      totalTimeMinutes: null,
      difficulty: null,
      portions: recipe.portions,
    });
    expect(detailInput).toMatchObject({
      title: recipe.name,
      description: shareBundleExportDraft.teaser,
      totalTimeMinutes: null,
      difficulty: null,
      portions: recipe.portions,
      ingredients: [{ amount: '3 Stück', name: 'Eier' }],
      steps: ['Request-only Schritt.'],
    });
    expect(updateSpy).not.toHaveBeenCalled();
    const storedRecipe = await repo.get(TEST_USER_ID, recipe.id);
    expect(storedRecipe?.exportView).toBeUndefined();
    expect(storedRecipe?.exportViewStatus).toBeUndefined();
  });

  it('prefers the request draft over a stored view without changing the stored view', async () => {
    const { repo, recipe } = await createCurrentBundleRecipe();
    const storedExportView = recipe.exportView;
    const response = await shareBundleHandler(
      await makeAuthRequest({
        params: { id: recipe.id },
        body: { exportViewDraft: shareBundleExportDraft },
      }),
      ctx,
    );

    const instagramInput = renderInstagramRecipeMock.mock.calls[0]?.[0] as Record<string, any>;
    const detailInput = renderInstagramRecipeDetailsTemplateMock.mock.calls[0]?.[0] as Record<string, any>;
    expect(response.status).toBe(200);
    expect(instagramInput.recipeMeta).toEqual({ totalTimeMinutes: null, difficulty: null, portions: 4 });
    expect(detailInput.description).toBe(shareBundleExportDraft.teaser);
    expect(detailInput.steps).toEqual(['Request-only Schritt.']);
    const storedRecipe = await repo.get(TEST_USER_ID, recipe.id);
    expect(storedRecipe?.exportView).toEqual(storedExportView);
    expect(storedRecipe?.exportViewStatus).toBe('current');
  });

  it('strictly validates request-only export draft fields and limits', async () => {
    const invalidDrafts: unknown[] = [
      { ...shareBundleExportDraft, sourceFingerprint: 'sha256:client' },
      { ...shareBundleExportDraft, version: 2 },
      { ...shareBundleExportDraft, teaser: 'x'.repeat(97) },
      { ...shareBundleExportDraft, totalTimeMinutes: 10_081 },
      { ...shareBundleExportDraft, totalTimeMinutes: 1.5 },
      { ...shareBundleExportDraft, difficulty: 'Ein\nfach' },
      { ...shareBundleExportDraft, steps: [] },
      {
        ...shareBundleExportDraft,
        steps: Array.from({ length: 6 }, (_, index) => ({ order: index + 1, description: 'Schritt.' })),
      },
      { ...shareBundleExportDraft, steps: [{ order: 1, description: 'x'.repeat(91) }] },
      {
        ...shareBundleExportDraft,
        steps: [{ order: 2, description: 'Später.' }, { order: 1, description: 'Früher.' }],
      },
      {
        ...shareBundleExportDraft,
        includedIngredientIds: Array.from({ length: 21 }, (_, index) => `ingredient-${index}`),
      },
      {
        ...shareBundleExportDraft,
        includedIngredientIds: [shareBundleIngredient.id, shareBundleIngredient.id],
      },
      { ...shareBundleExportDraft, unexpected: true },
    ];

    for (const exportDraft of invalidDrafts) {
      const response = await shareBundleHandler(
        await renderRequest('recipe-id', { exportViewDraft: exportDraft }),
        ctx,
      );
      expect(response.status).toBe(400);
      expect(response.jsonBody).toMatchObject({
        code: expect.any(String), category: 'validation', retryable: false,
        fieldErrors: [expect.objectContaining({ path: expect.any(String), code: expect.any(String) })],
      });
    }

    const obsoleteProperty = await shareBundleHandler(
      await renderRequest('recipe-id', { exportDraft: shareBundleExportDraft }),
      ctx,
    );
    expect(obsoleteProperty.status).toBe(400);
    expect(obsoleteProperty.jsonBody).toMatchObject({
      code: 'INVALID_REQUEST', category: 'validation', retryable: false,
      fieldErrors: [{ path: 'body', code: 'unrecognized_keys' }],
    });
    expect(downloadRecipeImageMock).not.toHaveBeenCalled();
  });

  it('rejects request-draft ingredient IDs that are missing or seasoning-only', async () => {
    const { recipe } = await createDraftBundleRecipe();
    for (const ingredientId of ['missing-ingredient', shareBundleSeasoning.id]) {
      const response = await shareBundleHandler(
        await makeAuthRequest({
          params: { id: recipe.id },
          body: {
            exportViewDraft: { ...shareBundleExportDraft, includedIngredientIds: [ingredientId] },
          },
        }),
        ctx,
      );
      expect(response.status).toBe(400);
      expect(response.jsonBody).toMatchObject({
        code: 'INVALID_EXPORT_VIEW_INGREDIENT', category: 'validation', retryable: false,
        message: 'Die Zutaten der Exportansicht passen nicht mehr zum Rezept.',
      });
      expect(response.jsonBody).not.toHaveProperty('fieldErrors');
    }
    expect(downloadRecipeImageMock).not.toHaveBeenCalled();
  });

  it('creates a bundled share payload from the server-owned export view without a second AI call', async () => {
    const { repo, recipe } = await createCurrentBundleRecipe();
    const getSpy = vi.spyOn(repo, 'get');
    const response = await shareBundleHandler(
      await makeAuthRequest({
        params: { id: recipe.id },
        body: { selectedTags: ['Schnell'], nutritionHighlight: null },
      }),
      ctx,
    );

    const instagramInput = renderInstagramRecipeMock.mock.calls[0]?.[0] as Record<string, any>;
    const detailInput = renderInstagramRecipeDetailsTemplateMock.mock.calls[0]?.[0] as Record<string, any>;
    expect(response.status).toBe(200);
    expect(recipe.exportViewStatus).toBe('current');
    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(response.jsonBody).toMatchObject({
      recipeId: recipe.id,
      instagram: {
        mimeType: 'image/png',
        size: renderedBuffer.byteLength,
        data: renderedBuffer.toString('base64'),
      },
      detail: {
        mimeType: 'image/png',
        size: 10,
        data: Buffer.from('detail-png').toString('base64'),
      },
    });
    expect(renderInstagramRecipeMock).toHaveBeenCalledTimes(1);
    expect(renderInstagramRecipeDetailsTemplateMock).toHaveBeenCalledTimes(1);
    expect(instagramInput.recipeMeta).toEqual({
      totalTimeMinutes: 20,
      difficulty: 'Einfach',
      portions: 4,
    });
    expect(detailInput).toMatchObject({
      totalTimeMinutes: 20,
      difficulty: 'Einfach',
      highlight: undefined,
    });
    expect(downloadRecipeImageMock).toHaveBeenCalledTimes(1);
    expect(instagramInput.image.buffer).toBe(detailInput.image.buffer);
  });

  it('shares a stale export using current recipe fields and export-only content', async () => {
    const { repo, recipe } = await createCurrentBundleRecipe();
    const updatedRecipe = await repo.update(TEST_USER_ID, recipe.id, {
      name: 'Changed after confirmation',
      description: 'Current recipe description',
      portions: 6,
      ingredients: [{
        ...recipe.ingredients[0]!,
        displayName: 'Current eggs',
        inputAmount: 4,
        amountGrams: 200,
        unit: 'Stück',
      }],
      steps: [{ order: 1, description: 'Current recipe step.' }],
      nutritionPerPortion: { calories: 250, protein: 31, carbs: 4, fat: 7, fiber: 1 },
    });
    expect(updatedRecipe?.exportViewStatus).toBe('stale');

    const response = await shareBundleHandler(
      await makeAuthRequest({ params: { id: recipe.id }, body: {} }),
      ctx,
    );

    const instagramInput = renderInstagramRecipeMock.mock.calls[0]?.[0] as Record<string, any>;
    const detailInput = renderInstagramRecipeDetailsTemplateMock.mock.calls[0]?.[0] as Record<string, any>;
    expect(response.status).toBe(200);
    expect(response.jsonBody).toMatchObject({
      recipeId: recipe.id,
      instagram: { mimeType: 'image/png', data: renderedBuffer.toString('base64') },
      detail: { mimeType: 'image/png', data: Buffer.from('detail-png').toString('base64') },
    });
    expect(downloadRecipeImageMock).toHaveBeenCalledTimes(1);
    expect(renderInstagramRecipeMock).toHaveBeenCalledTimes(1);
    expect(renderInstagramRecipeDetailsTemplateMock).toHaveBeenCalledTimes(1);
    expect(instagramInput.title).toBe(updatedRecipe?.name);
    expect(instagramInput.nutrition).toEqual({ calories: 250, protein: 31, carbs: 4, fat: 7 });
    expect(instagramInput.recipeMeta.portions).toBe(6);
    expect(detailInput.title).toBe(updatedRecipe?.name);
    expect(detailInput.portions).toBe(6);
    expect(detailInput.ingredients).toEqual([{ amount: '4 Stück', name: 'Current eggs' }]);
    expect(detailInput.description).toBe(updatedRecipe?.exportView?.teaser);
    expect(detailInput.steps).toEqual(updatedRecipe?.exportView?.steps.map((step) => step.description));
  });

  it('rejects a missing export before download or either render call', async () => {
    const recipe = await createRecipe([{ id: 'image-1', blobName: 'server/blob.png', order: 1 }]);

    const response = await shareBundleHandler(
      await makeAuthRequest({ params: { id: recipe.id }, body: {} }),
      ctx,
    );

    expect(response.status).toBe(422);
    expect(response.jsonBody).toMatchObject({ code: 'MISSING_EXPORT_VIEW', retryable: false });
    expect(downloadRecipeImageMock).not.toHaveBeenCalled();
    expect(renderInstagramRecipeMock).not.toHaveBeenCalled();
    expect(renderInstagramRecipeDetailsTemplateMock).not.toHaveBeenCalled();
  });

  it('rejects client recipeMeta for the bundle request', async () => {
    const { recipe } = await createCurrentBundleRecipe();

    const response = await shareBundleHandler(
      await makeAuthRequest({
        params: { id: recipe.id },
        body: { recipeMeta: { totalTimeMinutes: 1, difficulty: 'Client value' } },
      }),
      ctx,
    );

    expect(response.status).toBe(400);
    expect(response.jsonBody).toMatchObject({
      code: 'INVALID_REQUEST', category: 'validation', retryable: false,
      fieldErrors: [{ path: 'body', code: 'unrecognized_keys' }],
    });
    expect(downloadRecipeImageMock).not.toHaveBeenCalled();
    expect(renderInstagramRecipeMock).not.toHaveBeenCalled();
    expect(renderInstagramRecipeDetailsTemplateMock).not.toHaveBeenCalled();
  });

  it('logs the stage and reason when the export view is missing', async () => {
    const recipe = await createRecipe([{ id: 'image-1', blobName: 'server/blob.png', order: 1 }]);
    const warningLogs = vi.spyOn(ctx, 'warn').mockImplementation(() => {});

    try {
      const response = await shareBundleHandler(
        await makeAuthRequest({ params: { id: recipe.id }, body: {} }),
        ctx,
      );

      expect(response.status).toBe(422);
      const serializedWarningLogs = warningLogs.mock.calls.map(([line]) => String(line)).join('\n');
      expect(serializedWarningLogs).toContain('"failure_stage":"export_view"');
      expect(serializedWarningLogs).toContain('"failure_code":"missing_export_view"');
      expect(serializedWarningLogs).toContain('"api_code":"MISSING_EXPORT_VIEW"');
    } finally {
      warningLogs.mockRestore();
    }
  });

  it('logs value-free request diagnostics for both render endpoints', async () => {
    const warningLogs = vi.spyOn(ctx, 'warn').mockImplementation(() => {});

    try {
      const directResponse = await instagramRecipeHandler(
        await makeAuthRequest({
          params: { id: 'recipe-1' },
          body: { unexpectedField: 'private request value' },
        }),
        ctx,
      );
      const bundleResponse = await shareBundleHandler(
        await makeAuthRequest({
          params: { id: 'recipe-1' },
          body: { unexpectedField: 'private request value' },
        }),
        ctx,
      );

      expect(directResponse.status).toBe(400);
      expect(bundleResponse.status).toBe(400);
      for (const response of [directResponse, bundleResponse]) {
        expect(response.jsonBody).toMatchObject({
          code: 'INVALID_REQUEST', category: 'validation', retryable: false,
          fieldErrors: [{ path: 'body', code: 'unrecognized_keys' }],
        });
      }
      const serializedWarningLogs = warningLogs.mock.calls.map(([line]) => String(line)).join('\n');
      expect(serializedWarningLogs).toContain('"event":"recipes.instagramRender.preconditionFailed"');
      expect(serializedWarningLogs).toContain('"event":"recipes.shareBundle.preconditionFailed"');
      expect(serializedWarningLogs.match(/unrecognized_keys@body\[unexpectedField\]/gu)).toHaveLength(2);
      expect(serializedWarningLogs).not.toContain('private request value');
    } finally {
      warningLogs.mockRestore();
    }
  });

  it('logs detailed diagnostics when the Instagram render in a bundle fails', async () => {
    const { recipe } = await createCurrentBundleRecipe();
    const errorLogs = vi.spyOn(ctx, 'error').mockImplementation(() => {});
    renderInstagramRecipeMock.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'INTERNAL',
        message: 'Instagram recipe rendering failed.',
        cause: 'Sharp could not decode the source image.',
      },
    });

    try {
      const response = await shareBundleHandler(
        await makeAuthRequest({ params: { id: recipe.id }, body: {} }),
        ctx,
      );

      expect(response.status).toBe(500);
      expect(response.jsonBody).toMatchObject({ code: 'INTERNAL_ERROR', category: 'internal' });
      const serializedErrorLogs = errorLogs.mock.calls.map(([line]) => String(line)).join('\n');
      expect(serializedErrorLogs).toContain('"event":"recipes.shareBundle.instagramRender.failed"');
      expect(serializedErrorLogs).toContain('"failure_stage":"instagram_render"');
      expect(serializedErrorLogs).not.toContain('Instagram recipe rendering failed.');
      expect(serializedErrorLogs).not.toContain('Sharp could not decode the source image.');
    } finally {
      errorLogs.mockRestore();
    }
  });

  it('does not return a partial pair when the detail render fails', async () => {
    const { repo, recipe } = await createCurrentBundleRecipe();
    const storedExportView = recipe.exportView;
    const errorLogs = vi.spyOn(ctx, 'error').mockImplementation(() => {});
    renderInstagramRecipeDetailsTemplateMock.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'INTERNAL',
        message: 'Instagram recipe details template rendering failed.',
        cause: 'Satori font parsing failed.',
      },
    });

    try {
      const response = await shareBundleHandler(
        await makeAuthRequest({
          params: { id: recipe.id },
          body: { exportViewDraft: shareBundleExportDraft },
        }),
        ctx,
      );

      expect(response.status).toBe(500);
      expect(response.jsonBody).toMatchObject({ code: 'INTERNAL_ERROR', category: 'internal' });
      expect(response.jsonBody).not.toHaveProperty('instagram');
      expect(response.jsonBody).not.toHaveProperty('detail');
      expect((await repo.get(TEST_USER_ID, recipe.id))?.exportView).toEqual(storedExportView);
      const serializedErrorLogs = errorLogs.mock.calls.map(([line]) => String(line)).join('\n');
      expect(serializedErrorLogs).toContain('"failure_stage":"detail_render"');
      expect(serializedErrorLogs).toContain('"export_view_source":"request_draft"');
      expect(serializedErrorLogs).not.toContain('Instagram recipe details template rendering failed.');
      expect(serializedErrorLogs).not.toContain('Satori font parsing failed.');
    } finally {
      errorLogs.mockRestore();
    }
  });

  it('returns a generic internal error when the detail-template probe fails technically', async () => {
    const { recipe } = await createCurrentBundleRecipe();
    const errorLogs = vi.spyOn(ctx, 'error').mockImplementation(() => {});
    renderInstagramRecipeDetailsTemplateMock.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'TEMPLATE_PROBE_FAILED',
        message: 'private font or geometry failure',
        field: 'steps',
        itemIndex: 0,
        itemField: 'text',
      },
    });

    try {
      const response = await shareBundleHandler(
        await makeAuthRequest({ params: { id: recipe.id }, body: {} }), ctx,
      );

      expect(response.status).toBe(500);
      expect(response.jsonBody).toMatchObject({ code: 'INTERNAL_ERROR', category: 'internal' });
      expect(JSON.stringify(response.jsonBody)).not.toContain('private font');
      const logs = errorLogs.mock.calls.map(([line]) => String(line)).join('\n');
      expect(logs).toContain('recipes.shareBundle.detailFailed');
      expect(logs).not.toContain('private font or geometry failure');
    } finally {
      errorLogs.mockRestore();
    }
  });

  it.each([1, 5])('logs the affected step and layout diagnostics with %i steps', async (stepCount) => {
    const { recipe } = await createCurrentBundleRecipe();
    const warningLogs = vi.spyOn(ctx, 'warn').mockImplementation(() => {});
    renderInstagramRecipeDetailsTemplateMock.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'TEMPLATE_FIELD_OVERFLOW',
        message: 'Step 1 exceeds its measured detail-template row.',
        field: 'steps',
        itemIndex: 0,
        itemField: 'text',
        measured: { width: 300, height: 112, maxWidth: 302, maxHeight: 105 },
      },
    });
    try {
      const body = stepCount === 5 ? {
        exportViewDraft: {
          ...shareBundleExportDraft,
          steps: Array.from({ length: stepCount }, (_, index) => ({
            order: index + 1,
            description: index === 0 ? 'Rühre "gründlich" um.\r\nGare danach fertig.' : 'Serviere das Gericht.',
          })),
        },
      } : {};
      const response = await shareBundleHandler(
        await makeAuthRequest({ params: { id: recipe.id }, body }), ctx,
      );
      expect(response.status).toBe(422);
      const input = renderInstagramRecipeDetailsTemplateMock.mock.calls[0]![0];
      const text = input.steps[0]!;
      const logs = warningLogs.mock.calls.map(([line]) => String(line)).join('\n');
      expect(logs).toContain(`"step_text":${JSON.stringify(text)}`);
      expect(logs).toContain(`"step_count":${input.steps.length}`);
      expect(logs).toContain(`"step_text_length":${text.length}`);
      expect(logs).toContain(`"step_longest_word_length":${Math.max(0, ...text.split(/\s+/u).map((word) => word.length))}`);
      expect(logs).toContain(`"step_explicit_line_breaks":${stepCount === 5 ? 1 : 0}`);
      expect(logs).toContain(`"step_layout":"${stepCount === 5 ? 'compact' : 'large'}"`);
      expect(logs).not.toContain('Serviere das Gericht.');
      expect(JSON.stringify(response.jsonBody)).not.toContain(text);
    } finally {
      warningLogs.mockRestore();
    }
  });

  it('logs the detail field and item index without logging the raw item value', async () => {
    const { recipe } = await createCurrentBundleRecipe();
    const warningLogs = vi.spyOn(ctx, 'warn').mockImplementation(() => {});
    const invalidValue = 'A very long ingredient name that does not fit';
    renderInstagramRecipeDetailsTemplateMock.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'INVALID_TEMPLATE_INPUT',
        message: 'ingredient 1 has an invalid name.',
        field: 'ingredients',
        itemIndex: 0,
        itemField: 'name',
        itemValue: invalidValue,
      },
    });

    try {
      const response = await shareBundleHandler(
        await makeAuthRequest({ params: { id: recipe.id }, body: {} }),
        ctx,
      );

      expect(response.status).toBe(422);
      expect(response.jsonBody).toMatchObject({ code: 'INVALID_TEMPLATE_INPUT', retryable: false });
      const serializedWarningLogs = warningLogs.mock.calls.map(([line]) => String(line)).join('\n');
      expect(serializedWarningLogs).toContain('"failure_stage":"detail_render"');
      expect(serializedWarningLogs).toContain('"item_index":0');
      expect(serializedWarningLogs).toContain('"item_field":"name"');
      expect(serializedWarningLogs).not.toContain(invalidValue);
      expect(JSON.stringify(response.jsonBody)).not.toContain(invalidValue);
    } finally {
      warningLogs.mockRestore();
    }
  });
});