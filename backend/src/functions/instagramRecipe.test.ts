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
import { getRecipesRepository, __resetRecipesRepositoryForTests } from '../lib/repositories/recipesRepository';
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

describe('POST /api/recipes/:id/instagram-render', () => {
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

    const invalidPresentation = await instagramRecipeHandler(
      await renderRequest(recipe.id, { presentation: { zoom: 0.5 } }),
      ctx,
    );
    expect(invalidPresentation.status).toBe(400);

    const partialMeta = await instagramRecipeHandler(
      await renderRequest(recipe.id, { recipeMeta: { difficulty: 'Einfach' } }),
      ctx,
    );
    expect(partialMeta.status).toBe(400);

    const unknownTag = await instagramRecipeHandler(
      await renderRequest(recipe.id, { selectedTags: ['Nicht gespeichert'] }),
      ctx,
    );
    expect(unknownTag.status).toBe(400);

    const duplicateTag = await instagramRecipeHandler(
      await renderRequest(recipe.id, { selectedTags: ['Schnell', 'Schnell'] }),
      ctx,
    );
    expect(duplicateTag.status).toBe(400);

    const freeTag = await instagramRecipeHandler(
      await renderRequest(recipe.id, { selectedTags: ['Schnell '] }),
      ctx,
    );
    expect(freeTag.status).toBe(400);

    const tooManyTags = await instagramRecipeHandler(
      await renderRequest(recipe.id, {
        selectedTags: ['Schnell', 'Salat', 'Tag 3', 'Tag 4', 'Tag 5'],
      }),
      ctx,
    );
    expect(tooManyTags.status).toBe(400);

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
    expect(missingImage.jsonBody).toEqual({ error: 'Image not found' });
  });

  it('returns controlled 422 errors for missing, invalid, or oversized images', async () => {
    const noImageRecipe = await createRecipe();
    const noImage = await instagramRecipeHandler(await renderRequest(noImageRecipe.id), ctx);
    expect(noImage.status).toBe(422);
    expect(noImage.jsonBody).toEqual({
      error: 'Bitte lade zuerst ein Rezeptfoto hoch, bevor du das Rezept teilst.',
      code: 'NO_RECIPE_IMAGE',
    });

    const invalidMetadataRecipe = await createRecipe([{ id: 'image-1', blobName: ' ', order: 1 }]);
    const invalidMetadata = await instagramRecipeHandler(
      await renderRequest(invalidMetadataRecipe.id),
      ctx,
    );
    expect(invalidMetadata.status).toBe(422);
    expect(invalidMetadata.jsonBody).toEqual({ error: 'Recipe image cannot be rendered', code: 'IMAGE_BLOB_INVALID' });

    const oversizedRecipe = await createRecipe([{ id: 'image-1', blobName: 'server/large.png', order: 1 }]);
    downloadRecipeImageMock.mockRejectedValueOnce(new RecipeImageTooLargeError());
    const oversized = await instagramRecipeHandler(await renderRequest(oversizedRecipe.id), ctx);
    expect(oversized.status).toBe(422);
    expect(oversized.jsonBody).toEqual({ error: 'Recipe image exceeds the 8 MB limit', code: 'IMAGE_TOO_LARGE' });
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
    expect(response.jsonBody).toEqual({ error: 'Recipe cannot be rendered', code: 'TITLE_OVERFLOW' });
    expect(JSON.stringify(response.jsonBody)).not.toContain('private measured detail');
  });

  it('maps missing assets and storage failures to generic 500 responses', async () => {
    const recipe = await createRecipe([{ id: 'image-1', blobName: 'server/blob.png', order: 1 }]);
    renderInstagramRecipeMock.mockResolvedValueOnce({
      ok: false,
      error: { code: 'MISSING_ASSET', message: 'assets/private-font.ttf', asset: 'private-font.ttf' },
    });

    const missingAsset = await instagramRecipeHandler(await renderRequest(recipe.id), ctx);
    expect(missingAsset.status).toBe(500);
    expect(missingAsset.jsonBody).toEqual({ error: 'Internal server error' });
    expect(JSON.stringify(missingAsset.jsonBody)).not.toContain('private-font.ttf');

    downloadRecipeImageMock.mockRejectedValueOnce(new Error('storage connection secret'));
    const storageFailure = await instagramRecipeHandler(await renderRequest(recipe.id), ctx);
    expect(storageFailure.status).toBe(500);
    expect(storageFailure.jsonBody).toEqual({ error: 'Internal server error' });
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
    expect(response.jsonBody).toEqual({
      error: 'Bitte lade zuerst ein Rezeptfoto hoch, bevor du das Rezept teilst.',
      code: 'NO_RECIPE_IMAGE',
    });
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
    expect(response.jsonBody).toEqual({ error: 'Recipe not found' });
    expect(downloadRecipeImageMock).not.toHaveBeenCalled();
    expect(renderInstagramRecipeMock).not.toHaveBeenCalled();
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
    }

    const obsoleteProperty = await shareBundleHandler(
      await renderRequest('recipe-id', { exportDraft: shareBundleExportDraft }),
      ctx,
    );
    expect(obsoleteProperty.status).toBe(400);
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
      expect(response.jsonBody).toEqual({ error: 'invalid_export_view_ingredient' });
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
    expect(response.jsonBody).toEqual({
      error: 'Recipe export view is required for sharing',
      code: 'MISSING_EXPORT_VIEW',
    });
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
    expect(downloadRecipeImageMock).not.toHaveBeenCalled();
    expect(renderInstagramRecipeMock).not.toHaveBeenCalled();
    expect(renderInstagramRecipeDetailsTemplateMock).not.toHaveBeenCalled();
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
      expect(response.jsonBody).toEqual({ error: 'Internal server error' });
      const serializedErrorLogs = errorLogs.mock.calls.map(([line]) => String(line)).join('\n');
      expect(serializedErrorLogs).toContain('"event":"recipes.shareBundle.instagramRender.failed"');
      expect(serializedErrorLogs).toContain('"error_message":"Instagram recipe rendering failed."');
      expect(serializedErrorLogs).toContain('"error_cause":"Sharp could not decode the source image."');
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
      expect(response.jsonBody).toEqual({ error: 'Internal server error' });
      expect(response.jsonBody).not.toHaveProperty('instagram');
      expect(response.jsonBody).not.toHaveProperty('detail');
      expect((await repo.get(TEST_USER_ID, recipe.id))?.exportView).toEqual(storedExportView);
      const serializedErrorLogs = errorLogs.mock.calls.map(([line]) => String(line)).join('\n');
      expect(serializedErrorLogs).toContain('"error_message":"Instagram recipe details template rendering failed."');
      expect(serializedErrorLogs).toContain('"error_cause":"Satori font parsing failed."');
    } finally {
      errorLogs.mockRestore();
    }
  });

  it('logs the invalid detail item value without returning it', async () => {
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
      expect(response.jsonBody).toEqual({
        error: 'Recipe detail image cannot be rendered',
        code: 'INVALID_TEMPLATE_INPUT',
      });
      const serializedWarningLogs = warningLogs.mock.calls.map(([line]) => String(line)).join('\n');
      expect(serializedWarningLogs).toContain('"item_value":"A very long ingredient name that does not fit"');
      expect(JSON.stringify(response.jsonBody)).not.toContain(invalidValue);
    } finally {
      warningLogs.mockRestore();
    }
  });
});