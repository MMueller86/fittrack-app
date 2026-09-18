import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_RECIPE_IMAGE_HERO_CROP } from '@fittrack/shared';
import type { RecipeImage } from '@fittrack/shared';
import {
  persistRecipeWizardImageHeroCrop,
  persistRecipeWizardImages,
} from './recipeWizardImageMutations';
import type { ExistingWizardImageDraft, WizardImageDraft } from './recipeWizardTypes';

function image(id: string, order: number): RecipeImage {
  return { id, blobName: `user/recipe/${id}.jpg`, order, url: `https://example.test/${id}.jpg` };
}

describe('persistRecipeWizardImages', () => {
  it('does nothing when unchanged existing images keep their order', async () => {
    const api = {
      deleteImage: vi.fn(async () => undefined),
      uploadImage: vi.fn(async () => image('image-new', 3)),
      reorderImages: vi.fn(async (_recipeId: string, imageIds: string[]) => ({
        images: imageIds.map((id, index) => image(id, index + 1)),
      })),
    };
    const drafts: WizardImageDraft[] = [
      {
        draftId: 'existing:image-1',
        source: 'existing',
        imageId: 'image-1',
        uri: 'https://example.test/image-1.jpg',
        order: 1,
        heroCrop: DEFAULT_RECIPE_IMAGE_HERO_CROP,
      },
      {
        draftId: 'existing:image-2',
        source: 'existing',
        imageId: 'image-2',
        uri: 'https://example.test/image-2.jpg',
        order: 2,
        heroCrop: DEFAULT_RECIPE_IMAGE_HERO_CROP,
      },
    ];

    const result = await persistRecipeWizardImages('recipe-1', ['image-1', 'image-2'], drafts, api);

    expect(result).toEqual({ failedDeleteImageIds: [], failedUploadPositions: [], reorderFailed: false });
    expect(api.deleteImage).not.toHaveBeenCalled();
    expect(api.uploadImage).not.toHaveBeenCalled();
    expect(api.reorderImages).not.toHaveBeenCalled();
  });

  it('deletes removed existing images, uploads local drafts, then reorders the complete image permutation', async () => {
    const calls: string[] = [];
    const api = {
      deleteImage: vi.fn(async (_recipeId: string, imageId: string) => {
        calls.push(`delete:${imageId}`);
        return undefined;
      }),
      uploadImage: vi.fn(async (_recipeId: string, imageUri: string) => {
        calls.push(`upload:${imageUri}`);
        if (imageUri === 'file://new-a.jpg') {
          return image('image-new-a', 2);
        }
        return image('image-new-b', 3);
      }),
      reorderImages: vi.fn(async (_recipeId: string, imageIds: string[]) => {
        calls.push(`reorder:${imageIds.join(',')}`);
        return { images: imageIds.map((id, index) => image(id, index + 1)) };
      }),
    };
    const drafts: WizardImageDraft[] = [
      {
        draftId: 'local-a',
        source: 'local',
        uri: 'file://new-a.jpg',
        mime: 'image/jpeg',
        heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusX: 0.2 },
      },
      {
        draftId: 'existing:image-2',
        source: 'existing',
        imageId: 'image-2',
        uri: 'https://example.test/image-2.jpg',
        order: 2,
        heroCrop: DEFAULT_RECIPE_IMAGE_HERO_CROP,
      },
      {
        draftId: 'local-b',
        source: 'local',
        uri: 'file://new-b.jpg',
        mime: 'image/png',
        heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusY: 0.7 },
      },
    ];

    const result = await persistRecipeWizardImages('recipe-1', ['image-1', 'image-2'], drafts, api);

    expect(result).toEqual({ failedDeleteImageIds: [], failedUploadPositions: [], reorderFailed: false });
    expect(calls).toEqual([
      'delete:image-1',
      'upload:file://new-a.jpg',
      'upload:file://new-b.jpg',
      'reorder:image-new-a,image-2,image-new-b',
    ]);
    expect(api.uploadImage).toHaveBeenNthCalledWith(
      1,
      'recipe-1',
      'file://new-a.jpg',
      'image/jpeg',
      { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusX: 0.2 },
    );
    expect(api.uploadImage).toHaveBeenNthCalledWith(
      2,
      'recipe-1',
      'file://new-b.jpg',
      'image/png',
      { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusY: 0.7 },
    );
  });

  it('reorders existing images without uploading when only the draft order changed', async () => {
    const api = {
      deleteImage: vi.fn(async () => undefined),
      uploadImage: vi.fn(async () => image('image-new', 3)),
      reorderImages: vi.fn(async (_recipeId: string, imageIds: string[]) => ({
        images: imageIds.map((id, index) => image(id, index + 1)),
      })),
    };
    const drafts: WizardImageDraft[] = [
      {
        draftId: 'existing:image-2',
        source: 'existing',
        imageId: 'image-2',
        uri: 'https://example.test/image-2.jpg',
        order: 2,
        heroCrop: DEFAULT_RECIPE_IMAGE_HERO_CROP,
      },
      {
        draftId: 'existing:image-1',
        source: 'existing',
        imageId: 'image-1',
        uri: 'https://example.test/image-1.jpg',
        order: 1,
        heroCrop: DEFAULT_RECIPE_IMAGE_HERO_CROP,
      },
    ];

    await persistRecipeWizardImages('recipe-1', ['image-1', 'image-2'], drafts, api);

    expect(api.deleteImage).not.toHaveBeenCalled();
    expect(api.uploadImage).not.toHaveBeenCalled();
    expect(api.reorderImages).toHaveBeenCalledWith('recipe-1', ['image-2', 'image-1']);
  });
});

describe('persistRecipeWizardImageHeroCrop', () => {
  const draft: ExistingWizardImageDraft = {
    draftId: 'existing:image-1',
    source: 'existing',
    imageId: 'image-1',
    uri: 'https://example.test/old.jpg',
    order: 1,
    heroCrop: DEFAULT_RECIPE_IMAGE_HERO_CROP,
  };

  it('returns the server-confirmed crop and refreshed URL', async () => {
    const heroCrop = { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusX: 0.2, zoom: 1.4 };
    const api = {
      updateImageHeroCrop: vi.fn(async () => ({
        ...image('image-1', 1),
        url: 'https://example.test/refreshed.jpg',
        heroCrop,
      })),
    };

    const result = await persistRecipeWizardImageHeroCrop('recipe-1', draft, heroCrop, api);

    expect(api.updateImageHeroCrop).toHaveBeenCalledWith('recipe-1', 'image-1', heroCrop);
    expect(result).toMatchObject({
      ...draft,
      uri: 'https://example.test/refreshed.jpg',
      heroCrop,
    });
    expect(draft.heroCrop).toEqual(DEFAULT_RECIPE_IMAGE_HERO_CROP);
  });

  it('leaves the last confirmed draft crop untouched when the update fails', async () => {
    const api = {
      updateImageHeroCrop: vi.fn(async () => {
        throw new Error('network');
      }),
    };

    await expect(
      persistRecipeWizardImageHeroCrop(
        'recipe-1',
        draft,
        { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusY: 0.7 },
        api,
      ),
    ).rejects.toThrow('network');
    expect(draft.heroCrop).toEqual(DEFAULT_RECIPE_IMAGE_HERO_CROP);
    expect(draft.uri).toBe('https://example.test/old.jpg');
  });
});