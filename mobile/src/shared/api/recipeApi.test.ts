import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_RECIPE_IMAGE_HERO_CROP } from '@fittrack/shared';

const postMock = vi.hoisted(() => vi.fn());
const putMock = vi.hoisted(() => vi.fn());

vi.mock('./client', () => ({
  apiClient: {
    post: postMock,
    put: putMock,
  },
}));

import { recipeApi } from './recipeApi';

describe('recipeApi image crop contract', () => {
  beforeEach(() => {
    postMock.mockReset();
    putMock.mockReset();
    postMock.mockResolvedValue({ data: { id: 'image-1' } });
    putMock.mockResolvedValue({ data: { id: 'image-1', heroCrop: DEFAULT_RECIPE_IMAGE_HERO_CROP } });
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
});