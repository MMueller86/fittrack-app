import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_RECIPE_IMAGE_HERO_CROP } from '@fittrack/shared';
import { TEMPORARY_RECIPE_RENDER_META } from './recipeApi';
import type { RecipeShareBundleOptions } from './recipeApi';

const postMock = vi.hoisted(() => vi.fn());
const putMock = vi.hoisted(() => vi.fn());
const getMock = vi.hoisted(() => vi.fn());

vi.mock('./client', () => ({
  apiClient: {
    get: getMock,
    post: postMock,
    put: putMock,
  },
}));

import { recipeApi } from './recipeApi';

describe('recipeApi image crop contract', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
    getMock.mockResolvedValue({ data: { id: 'recipe-1' }, headers: {} });
    postMock.mockResolvedValue({ data: { id: 'image-1' } });
    putMock.mockResolvedValue({ data: { id: 'image-1', heroCrop: DEFAULT_RECIPE_IMAGE_HERO_CROP } });
  });

  it('loads a recipe without requiring an ETag response header', async () => {
    const recipe = { id: 'recipe-1' };
    getMock.mockResolvedValueOnce({ data: recipe, headers: {} });

    await expect(recipeApi.get('recipe-1')).resolves.toEqual(recipe);

    expect(getMock).toHaveBeenCalledWith('/recipes/recipe-1');
  });

  it('sends no confirmation fields or If-Match header for an ordinary update', async () => {
    await recipeApi.update('recipe-1', { name: 'Neuer Name' });

    expect(putMock).toHaveBeenCalledWith('/recipes/recipe-1', { name: 'Neuer Name' });
  });

  it('sends the explicit export confirmation pair without an If-Match header', async () => {
    const input = {
      name: 'Tomatensalat',
      exportViewAction: 'confirm' as const,
      exportView: {
        version: 1 as const,
        teaser: 'Frisch und knackig',
        totalTimeMinutes: 15,
        difficulty: 'Einfach',
        steps: [{ order: 1, description: 'Tomaten schneiden.' }],
        includedIngredientIds: ['ingredient-1'],
      },
    };

    await recipeApi.update('recipe-1', input);

    expect(putMock).toHaveBeenCalledWith('/recipes/recipe-1', input);
  });

  it('sends only the strict V2 body and accepts a different source ETag', async () => {
    const response = {
      contractVersion: 2,
      recipeId: 'recipe-1',
      sourceEtag: 'W/"newer-revision"',
      suggestion: {
        version: 1,
        teaser: 'Frischer Salat',
        totalTimeMinutes: null,
        difficulty: null,
        steps: [{ order: 1, description: 'Tomaten schneiden.' }],
      },
    };
    postMock.mockResolvedValueOnce({ data: response });

    await expect(recipeApi.prepareExportView('recipe-1')).resolves.toEqual(response);

    expect(postMock).toHaveBeenCalledWith(
      '/recipes/recipe-1/export-view/prepare',
      { contractVersion: 2 },
      { timeout: 90_000 },
    );
  });

  it('does not require sourceEtag on a V2 preparation response', async () => {
    const response = {
      contractVersion: 2,
      recipeId: 'recipe-1',
      suggestion: {
        version: 1,
        teaser: 'Frischer Salat',
        totalTimeMinutes: null,
        difficulty: null,
        steps: [],
      },
    };
    postMock.mockResolvedValueOnce({ data: response });

    await expect(recipeApi.prepareExportView('recipe-1')).resolves.toEqual(response);
  });

  it('rejects a preparation response that is not V2', async () => {
    postMock.mockResolvedValueOnce({ data: { contractVersion: 1 } });

    await expect(recipeApi.prepareExportView('recipe-1'))
      .rejects.toThrow('Recipe export preparation response must use contract V2.');
  });

  it.each([422, 502])('preserves a preparation request rejected with HTTP %i', async (status) => {
    const error = { response: { status } };
    postMock.mockRejectedValueOnce(error);

    await expect(recipeApi.prepareExportView('recipe-1')).rejects.toBe(error);
  });

  it('serializes heroCrop as optional JSON multipart metadata on upload', async () => {
    const heroCrop = { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusX: 0.2, zoom: 1.4 };

    await recipeApi.uploadImage('recipe-1', 'file://recipe.jpg', 'image/jpeg', heroCrop);

    const [, formData, config] = postMock.mock.calls[0] as [string, FormData, { headers: Record<string, string> }];
    expect(formData.get('heroCrop')).toBe(JSON.stringify(heroCrop));
    expect(config).toMatchObject({
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000,
    });
  });

  it('sends the metadata-only hero-crop update to the typed route', async () => {
    const heroCrop = { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusY: 0.7 };

    await recipeApi.updateImageHeroCrop('recipe-1', 'image-1', heroCrop);

    expect(putMock).toHaveBeenCalledWith(
      '/recipes/recipe-1/images/image-1/hero-crop',
      { heroCrop },
    );
  });

  it('renders the transient PNG with the initial server-owned request contract', async () => {
    const png = new ArrayBuffer(8);
    postMock.mockResolvedValueOnce({ data: png });

    const result = await recipeApi.renderInstagramRecipe('recipe-1', {
      selectedTags: ['Schnell', 'Salat'],
      nutritionHighlight: 'high-protein',
      recipeMeta: TEMPORARY_RECIPE_RENDER_META,
    });

    expect(result).toBe(png);
    expect(postMock).toHaveBeenCalledWith(
      '/recipes/recipe-1/instagram-render',
      {
        selectedTags: ['Schnell', 'Salat'],
        nutritionHighlight: 'high-protein',
        recipeMeta: TEMPORARY_RECIPE_RENDER_META,
      },
      { responseType: 'arraybuffer', timeout: 60_000 },
    );
  });

  it('sends a complete normalized presentation only for the final render', async () => {
    const presentation = { focusX: 0.18, focusY: 0.73, zoom: 1.4 };
    postMock.mockResolvedValueOnce({ data: new ArrayBuffer(8) });

    await recipeApi.renderInstagramRecipe('recipe-1', {
      selectedTags: [],
      nutritionHighlight: null,
      recipeMeta: TEMPORARY_RECIPE_RENDER_META,
      presentation,
    });

    expect(postMock).toHaveBeenCalledWith(
      '/recipes/recipe-1/instagram-render',
      {
        selectedTags: [],
        nutritionHighlight: null,
        recipeMeta: TEMPORARY_RECIPE_RENDER_META,
        presentation,
      },
      { responseType: 'arraybuffer', timeout: 60_000 },
    );
  });

  it('passes an AbortSignal through to the transient render request', async () => {
    const controller = new AbortController();
    postMock.mockResolvedValueOnce({ data: new ArrayBuffer(8) });

    await recipeApi.renderInstagramRecipe('recipe-1', {
      selectedTags: [],
      nutritionHighlight: null,
      recipeMeta: TEMPORARY_RECIPE_RENDER_META,
    }, controller.signal);

    expect(postMock.mock.calls[0]?.[2]).toEqual({
      responseType: 'arraybuffer',
      timeout: 60_000,
      signal: controller.signal,
    });
  });

  it('requests the atomic Instagram/detail bundle with the strict request fields', async () => {
    const bundle = {
      recipeId: 'recipe-1',
      instagram: { mimeType: 'image/png' as const, size: 8, data: 'aW5zdGFncmFt' },
      detail: { mimeType: 'image/png' as const, size: 6, data: 'ZGV0YWls' },
    };
    const options = {
      imageId: 'image-1',
      selectedTags: ['Schnell'],
      nutritionHighlight: null,
      presentation: { focusX: 0.18, focusY: 0.73, zoom: 1.4 },
    };
    postMock.mockResolvedValueOnce({ data: bundle });

    await expect(recipeApi.renderShareBundle('recipe-1', options)).resolves.toEqual(bundle);

    expect(postMock).toHaveBeenCalledWith(
      '/recipes/recipe-1/share-bundle',
      options,
      { timeout: 60_000 },
    );
    expect(options).not.toHaveProperty('recipeMeta');
  });

  it('sends nullable transient export metadata using only exportViewDraft', async () => {
    const options: RecipeShareBundleOptions = {
      selectedTags: ['Schnell'],
      nutritionHighlight: null,
      exportViewDraft: {
        version: 1,
        teaser: 'Frisch und schnell',
        totalTimeMinutes: null,
        difficulty: null,
        steps: [{ order: 1, description: 'Tomaten schneiden.' }],
        includedIngredientIds: [],
      },
    };
    postMock.mockResolvedValueOnce({ data: { recipeId: 'recipe-1' } });

    await recipeApi.renderShareBundle('recipe-1', options);

    expect(postMock).toHaveBeenCalledWith(
      '/recipes/recipe-1/share-bundle',
      options,
      { timeout: 60_000 },
    );
    expect(options).not.toHaveProperty('exportDraft');
    expect(options).not.toHaveProperty('recipeMeta');
  });
});