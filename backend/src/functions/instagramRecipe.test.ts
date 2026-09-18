import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';

const { downloadRecipeImageMock, renderInstagramRecipeMock } = vi.hoisted(() => ({
  downloadRecipeImageMock: vi.fn(),
  renderInstagramRecipeMock: vi.fn(),
}));

vi.mock('../lib/storage', async () => {
  const actual = await vi.importActual<typeof import('../lib/storage')>('../lib/storage');
  return { ...actual, downloadRecipeImage: downloadRecipeImageMock };
});

vi.mock('../lib/instagramRenderer', () => ({
  renderInstagramRecipe: renderInstagramRecipeMock,
}));

import { getRecipesRepository, __resetRecipesRepositoryForTests } from '../lib/repositories/recipesRepository';
import { RecipeImageTooLargeError } from '../lib/storage';
import { DEFAULT_RECIPE_IMAGE_HERO_CROP } from '../../../shared/types/recipeImageHeroCrop';
import type { RecipeImageHeroCrop } from '../../../shared/types/recipeImageHeroCrop';
import {
  makeAuthRequest,
  makeContext,
  makeRequest,
  setupTestAuth,
  teardownTestAuth,
  TEST_USER_ID,
} from '../test-utils/http';
import { instagramRecipeHandler } from './instagramRecipe';

const ctx = makeContext();
const renderedBuffer = Buffer.from('rendered-png');

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
  downloadRecipeImageMock.mockResolvedValue(Buffer.from('source-image'));
  renderInstagramRecipeMock.mockResolvedValue({
    ok: true,
    width: 1080,
    height: 1350,
    format: 'png',
    buffer: renderedBuffer,
  });
});

async function createRecipe(
  images: Array<{
    id: string;
    blobName: string;
    order: number;
    heroCrop?: RecipeImageHeroCrop;
  }> = [],
) {
  const repo = getRecipesRepository();
  const recipe = await repo.create(TEST_USER_ID, {
    name: 'Stored recipe',
    portions: 4,
    ingredients: [],
    steps: [],
    tags: ['Schnell', 'Salat'],
    nutritionTotal: { calories: 800, protein: 100, carbs: 80, fat: 20, fiber: 10 },
    nutritionPerPortion: { calories: 200, protein: 25, carbs: 20, fat: 5, fiber: 2 },
  });
  return (await repo.update(TEST_USER_ID, recipe.id, { images }))!;
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
    const recipe = await createRecipe([{ id: 'image-1', blobName: 'server/blob.png', order: 1 }]);

    const response = await instagramRecipeHandler(
      await renderRequest(recipe.id, {
        presentation: { focusY: 0.25 },
        nutritionHighlight: 'low-fat',
        recipeMeta: { totalTimeMinutes: 25, difficulty: ' Einfach ' },
      }),
      ctx,
    );

    expect(response.status).toBe(200);
    const input = renderInstagramRecipeMock.mock.calls[0][0] as Record<string, any>;
    expect(input.presentation).toEqual({ focusX: 0.5, focusY: 0.25, zoom: 1 });
    expect(input.nutritionHighlight).toBe('low-fat');
    expect(input.recipeMeta).toEqual({ totalTimeMinutes: 25, difficulty: 'Einfach', portions: 4 });
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
    expect(noImage.jsonBody).toEqual({ error: 'Recipe has no renderable image', code: 'NO_RECIPE_IMAGE' });

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
});