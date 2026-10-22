import type { Recipe } from '@fittrack/shared';
import {
  deleteProductImage,
  deleteRecipeImage,
  listPersonalProductImageBlobNames,
  listPersonalRecipeImageBlobNames,
} from './storage';
import { preservePublishedCommunityRecipe } from './communityRecipeTransfer';
import {
  getProfileDeletionRepository,
  ProfileDeletionStorageUnavailableError,
  type CosmosProfileDeletionRepository,
} from './repositories/profileDeletionRepository';
import {
  getRecipesRepository,
  type RecipesRepository,
} from './repositories/recipesRepository';

export interface ProfileDeletionDependencies {
  deletionRepository: Pick<CosmosProfileDeletionRepository,
    'acquireLock' | 'renewLock' | 'releaseLock' | 'deleteUserData'>;
  recipesRepository: Pick<RecipesRepository,
    'list' | 'getCommunityById' | 'deleteOwnerlessCommunityRecipe'>;
  listPersonalRecipeImages(userId: string): Promise<string[]>;
  listPersonalProductImages(userId: string): Promise<string[]>;
  preserveCommunityRecipe(recipe: Recipe): Promise<unknown>;
  deleteRecipeImage(blobName: string): Promise<void>;
  deleteProductImage(blobName: string): Promise<void>;
}

export class ProfileDeletionFailedError extends Error {
  constructor(
    readonly stage: string,
    readonly causeType: string,
  ) {
    super('Profile deletion failed');
    this.name = 'ProfileDeletionFailedError';
  }
}

function defaultDependencies(): ProfileDeletionDependencies {
  const deletionRepository = getProfileDeletionRepository();
  if (!process.env.STORAGE_CONNECTION_STRING) throw new ProfileDeletionStorageUnavailableError();
  return {
    deletionRepository,
    recipesRepository: getRecipesRepository(),
    listPersonalRecipeImages: listPersonalRecipeImageBlobNames,
    listPersonalProductImages: listPersonalProductImageBlobNames,
    preserveCommunityRecipe: preservePublishedCommunityRecipe,
    deleteRecipeImage,
    deleteProductImage,
  };
}

function causeType(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

export async function deleteUserProfileData(
  userId: string,
  deleteCommunityRecipes: boolean,
  dependencies = defaultDependencies(),
): Promise<void> {
  const lease = await dependencies.deletionRepository.acquireLock(userId);
  let stage = 'load-user-data';
  let failure: ProfileDeletionFailedError | undefined;
  let heartbeatFailure: unknown;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let renewal: Promise<void> = Promise.resolve();

  const renewLease = (): Promise<void> => {
    const next = renewal.then(async () => {
      if (heartbeatFailure) throw heartbeatFailure;
      await dependencies.deletionRepository.renewLock(lease);
    });
    renewal = next.catch((error: unknown) => {
      heartbeatFailure = error;
    });
    return next;
  };

  try {
    heartbeat = setInterval(() => {
      void renewLease().catch(() => {});
    }, 60_000);
    heartbeat.unref?.();

    stage = 'load-user-data';
    const recipes = await dependencies.recipesRepository.list(userId);
    if (deleteCommunityRecipes) {
      stage = 'delete-community-recipes';
      for (const recipe of recipes) {
        await renewLease();
        const community = await dependencies.recipesRepository.getCommunityById(recipe.id);
        if (!community || 'ownerUserId' in community) continue;
        for (const image of community.images) {
          await renewLease();
          await dependencies.deleteRecipeImage(image.blobName);
        }
        await dependencies.recipesRepository.deleteOwnerlessCommunityRecipe(recipe.id);
      }
    } else {
      stage = 'preserve-community-recipes';
      for (const recipe of recipes) {
        await renewLease();
        if (recipe.visibility === 'community') {
          await dependencies.preserveCommunityRecipe(recipe);
          continue;
        }

        const community = await dependencies.recipesRepository.getCommunityById(recipe.id);
        if (!community || 'ownerUserId' in community) continue;
        for (const image of community.images) {
          await renewLease();
          await dependencies.deleteRecipeImage(image.blobName);
        }
        await dependencies.recipesRepository.deleteOwnerlessCommunityRecipe(recipe.id);
      }
    }

    stage = 'delete-personal-files';
    const [recipeBlobNames, productBlobNames] = await Promise.all([
      dependencies.listPersonalRecipeImages(userId),
      dependencies.listPersonalProductImages(userId),
    ]);
    const personalProductBlobs = new Set(productBlobNames);
    const personalRecipeBlobs = new Set(recipeBlobNames);
    for (const item of recipes) {
      for (const image of item.images) personalRecipeBlobs.add(image.blobName);
    }
    for (const blobName of personalProductBlobs) {
      await renewLease();
      await dependencies.deleteProductImage(blobName);
    }
    for (const blobName of personalRecipeBlobs) {
      await renewLease();
      await dependencies.deleteRecipeImage(blobName);
    }
    while (true) {
      await renewLease();
      const [remainingRecipeBlobs, remainingProductBlobs] = await Promise.all([
        dependencies.listPersonalRecipeImages(userId),
        dependencies.listPersonalProductImages(userId),
      ]);
      if (remainingRecipeBlobs.length === 0 && remainingProductBlobs.length === 0) break;

      for (const blobName of remainingProductBlobs) {
        await renewLease();
        await dependencies.deleteProductImage(blobName);
      }
      for (const blobName of remainingRecipeBlobs) {
        await renewLease();
        await dependencies.deleteRecipeImage(blobName);
      }
    }

    stage = 'delete-user-documents';
    await renewLease();
    await dependencies.deletionRepository.deleteUserData(userId);
    await renewLease();
  } catch (error) {
    failure = new ProfileDeletionFailedError(stage, causeType(error));
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    await renewal;
    if (heartbeatFailure && !failure) {
      failure = new ProfileDeletionFailedError('renew-lock', causeType(heartbeatFailure));
    }
    try {
      await dependencies.deletionRepository.releaseLock(lease);
    } catch (error) {
      if (!failure) failure = new ProfileDeletionFailedError('release-lock', causeType(error));
    }
  }

  if (failure) throw failure;
}