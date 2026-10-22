import { describe, expect, it, vi } from 'vitest';
import type { Recipe } from '@fittrack/shared';
import type { CommunityRecipeRecord } from './repositories/recipesRepository';
import {
  deleteUserProfileData,
  ProfileDeletionFailedError,
  type ProfileDeletionDependencies,
} from './profileDeletion';

const recipe = {
  id: 'recipe-1',
  ownerUserId: 'user-1',
  visibility: 'community',
  images: [{ id: 'image-1', blobName: 'user-1/recipe-1/image-1.jpg', order: 1 }],
} as Recipe;

function makeDependencies(overrides: Partial<ProfileDeletionDependencies> = {}) {
  const calls: string[] = [];
  const dependencies: ProfileDeletionDependencies = {
    deletionRepository: {
      acquireLock: vi.fn(async (userId) => ({ userId, lockToken: 'lease-token' })),
      renewLock: vi.fn(async () => {}),
      releaseLock: vi.fn(async () => { calls.push('release'); }),
      deleteUserData: vi.fn(async () => { calls.push('delete-user-data'); }),
    },
    recipesRepository: {
      list: vi.fn(async () => [recipe]),
      getCommunityById: vi.fn(async () => null),
      deleteOwnerlessCommunityRecipe: vi.fn(async () => { calls.push('delete-ownerless'); }),
    },
    listPersonalRecipeImages: vi.fn(async () => []),
    listPersonalProductImages: vi.fn()
      .mockResolvedValueOnce(['user-1/item-1.jpg'])
      .mockResolvedValue([]),
    preserveCommunityRecipe: vi.fn(async () => { calls.push('preserve-community'); }),
    deleteRecipeImage: vi.fn(async (blobName) => { calls.push(`delete-recipe-image:${blobName}`); }),
    deleteProductImage: vi.fn(async (blobName) => { calls.push(`delete-product-image:${blobName}`); }),
    ...overrides,
  };
  return { dependencies, calls };
}

describe('deleteUserProfileData', () => {
  it('preserves community content before deleting personal files and documents', async () => {
    const { dependencies, calls } = makeDependencies();

    await deleteUserProfileData('user-1', false, dependencies);

    expect(calls).toEqual([
      'preserve-community',
      'delete-product-image:user-1/item-1.jpg',
      'delete-recipe-image:user-1/recipe-1/image-1.jpg',
      'delete-user-data',
      'release',
    ]);
  });

  it('does not start personal deletion when community preservation fails', async () => {
    const { dependencies, calls } = makeDependencies({
      preserveCommunityRecipe: vi.fn().mockRejectedValue(new Error('copy failed')),
    });

    await expect(deleteUserProfileData('user-1', false, dependencies)).rejects.toMatchObject({
      name: 'ProfileDeletionFailedError',
      stage: 'preserve-community-recipes',
      causeType: 'Error',
    });
    expect(calls).toEqual(['release']);
    expect(dependencies.deletionRepository.deleteUserData).not.toHaveBeenCalled();
  });

  it('does not wait for repository work admitted before the lease', async () => {
    let releasePriorRead!: () => void;
    let priorReadResolved = false;
    const priorRead = new Promise<void>((resolve) => { releasePriorRead = resolve; });
    const list = vi.fn()
      .mockImplementationOnce(async () => {
        await priorRead;
        priorReadResolved = true;
        return [];
      })
      .mockResolvedValueOnce([recipe]);
    const { dependencies, calls } = makeDependencies({
      recipesRepository: {
        list,
        getCommunityById: vi.fn(async () => null),
        deleteOwnerlessCommunityRecipe: vi.fn(async () => { calls.push('delete-ownerless'); }),
      },
    });
    const admittedRead = dependencies.recipesRepository.list('user-1');

    await deleteUserProfileData('user-1', false, dependencies);

    expect(list).toHaveBeenCalledTimes(2);
    expect(priorReadResolved).toBe(false);
    expect(calls.indexOf('preserve-community')).toBeLessThan(calls.indexOf('delete-user-data'));
    expect(calls.at(-1)).toBe('release');

    releasePriorRead();
    await admittedRead;
  });

  it('deletes orphan personal blobs found by active user prefixes', async () => {
    const { dependencies, calls } = makeDependencies({
      listPersonalRecipeImages: vi.fn()
        .mockResolvedValueOnce(['user-1/orphan/unknown.jpg'])
        .mockResolvedValue([]),
      listPersonalProductImages: vi.fn()
        .mockResolvedValueOnce(['user-1/orphan-item.png'])
        .mockResolvedValue([]),
    });

    await deleteUserProfileData('user-1', false, dependencies);

    expect(calls).toContain('delete-recipe-image:user-1/orphan/unknown.jpg');
    expect(calls).toContain('delete-product-image:user-1/orphan-item.png');
    expect(calls.indexOf('delete-user-data')).toBeGreaterThan(calls.indexOf('delete-recipe-image:user-1/orphan/unknown.jpg'));
  });

  it('rechecks personal blob prefixes and removes files found during final verification', async () => {
    const listPersonalRecipeImages = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(['user-1/orphan/late.jpg'])
      .mockResolvedValueOnce([]);
    const { dependencies, calls } = makeDependencies({
      listPersonalRecipeImages,
      listPersonalProductImages: vi.fn(async () => []),
    });

    await deleteUserProfileData('user-1', false, dependencies);

    expect(listPersonalRecipeImages).toHaveBeenCalledTimes(3);
    expect(calls).toContain('delete-recipe-image:user-1/orphan/late.jpg');
    expect(calls.indexOf('delete-user-data')).toBeGreaterThan(calls.indexOf('delete-recipe-image:user-1/orphan/late.jpg'));
  });

  it('removes a stale ownerless copy when a previously published recipe is private on retry', async () => {
    const privateRecipe = { ...recipe, visibility: 'private' } as Recipe;
    const ownerless = {
      id: recipe.id,
      visibility: 'community',
      images: [{ id: 'image-1', blobName: 'community/recipe-1/image-1.jpg', order: 1 }],
    } as unknown as CommunityRecipeRecord;
    const { dependencies, calls } = makeDependencies({
      recipesRepository: {
        list: vi.fn(async () => [privateRecipe]),
        getCommunityById: vi.fn(async () => ownerless),
        deleteOwnerlessCommunityRecipe: vi.fn(async () => { calls.push('delete-ownerless'); }),
      },
    });

    await deleteUserProfileData('user-1', false, dependencies);

    expect(dependencies.preserveCommunityRecipe).not.toHaveBeenCalled();
    expect(calls).toContain('delete-recipe-image:community/recipe-1/image-1.jpg');
    expect(calls).toContain('delete-ownerless');
  });

  it('removes ownerless community images and document when the user selected deletion', async () => {
    const { dependencies, calls } = makeDependencies({
      recipesRepository: {
        list: vi.fn(async () => [recipe]),
        getCommunityById: vi.fn(async () => {
          const ownerless = {
            ...recipe,
            images: [{ id: 'image-1', blobName: 'community/recipe-1/image-1.jpg', order: 1 }],
          } as Recipe & { ownerUserId?: string };
          delete ownerless.ownerUserId;
          return ownerless as unknown as CommunityRecipeRecord;
        }),
        deleteOwnerlessCommunityRecipe: vi.fn(async () => { calls.push('delete-ownerless'); }),
      },
    });

    await deleteUserProfileData('user-1', true, dependencies);

    expect(calls).toEqual([
      'delete-recipe-image:community/recipe-1/image-1.jpg',
      'delete-ownerless',
      'delete-product-image:user-1/item-1.jpg',
      'delete-recipe-image:user-1/recipe-1/image-1.jpg',
      'delete-user-data',
      'release',
    ]);
    expect(dependencies.preserveCommunityRecipe).not.toHaveBeenCalled();
  });
});