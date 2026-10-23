import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { downloadRecipeImageMock, copyRecipeImageToOwnerSnapshotMock, deleteRecipeImageMock, deletionLockMock } = vi.hoisted(() => ({
  downloadRecipeImageMock: vi.fn(),
  copyRecipeImageToOwnerSnapshotMock: vi.fn(),
  deleteRecipeImageMock: vi.fn(),
  deletionLockMock: vi.fn(),
}));

vi.mock('../lib/storage', async () => {
  const actual = await vi.importActual<typeof import('../lib/storage')>('../lib/storage');
  return {
    ...actual,
    downloadRecipeImageWithContentType: downloadRecipeImageMock,
    copyRecipeImageToOwnerSnapshot: copyRecipeImageToOwnerSnapshotMock,
    deleteRecipeImage: deleteRecipeImageMock,
  };
});

vi.mock('../lib/repositories/profileDeletionRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/repositories/profileDeletionRepository')>();
  return { ...actual, assertProfileDeletionNotActive: deletionLockMock };
});

import { copyCommunityRecipeHandler, getCommunityRecipeHandler, getCommunityRecipeImageHandler, listCommunityRecipesHandler } from './communityRecipes';
import { deleteRecipeHandler } from './recipes';
import { __resetRecipesRepositoryForTests, getRecipesRepository } from '../lib/repositories/recipesRepository';
import { createRecipeExportView } from '../lib/repositories/recipeExport';
import { deriveCommunityRecipeCopyId } from '../lib/communityRecipeTransfer';
import { ProfileDeletionInProgressError } from '../lib/repositories/profileDeletionRepository';
import { RecipeImageTooLargeError, RecipeImageUnsupportedContentTypeError } from '../lib/storage';
import { makeAuthRequest, makeContext, makeRequest, setupTestAuth, signTestToken, teardownTestAuth } from '../test-utils/http';

const ctx = makeContext();
const nutrition = { calories: 100, protein: 10, carbs: 20, fat: 2, fiber: 5 };

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
  downloadRecipeImageMock.mockReset().mockResolvedValue({
    buffer: Buffer.from('community-image'),
    contentType: 'image/jpeg',
  });
  copyRecipeImageToOwnerSnapshotMock.mockReset().mockImplementation(async (_source: string, userId: string, recipeId: string, imageId: string) =>
    `${userId}/${recipeId}/${imageId}.jpg`);
  deleteRecipeImageMock.mockReset().mockResolvedValue(undefined);
  deletionLockMock.mockReset().mockResolvedValue(undefined);
});

async function requestAs(userId: string, init: Parameters<typeof makeRequest>[0] = {}) {
  const token = await signTestToken(userId);
  return makeRequest({ ...init, headers: { ...init.headers, authorization: `Bearer ${token}` } });
}

async function createRecipe(ownerUserId: string, image = false) {
  const repo = getRecipesRepository();
  const versioned = await repo.createVersioned(ownerUserId, {
    name: 'Published recipe',
    portions: 4,
    ingredients: [],
    steps: [{ order: 1, description: 'Mix the ingredients.' }],
    tags: ['Quick'],
    nutritionTotal: { calories: 400, protein: 40, carbs: 80, fat: 8, fiber: 20 },
    nutritionPerPortion: nutrition,
  });
  if (image) {
    await repo.update(ownerUserId, versioned.recipe.id, {
      images: [{ id: 'image-1', blobName: `${ownerUserId}/${versioned.recipe.id}/image.jpg`, order: 1 }],
    });
  }
  const current = await repo.getVersioned(ownerUserId, versioned.recipe.id);
  const published = await repo.setVisibility(ownerUserId, versioned.recipe.id, current!.etag, {
    visibility: 'community',
    contentConfirmed: true,
    displayNameConsent: false,
  });
  return published!.recipe.id;
}

describe('GET /api/community-recipes', () => {
  it('requires authentication and returns only safe, paginated published projections', async () => {
    const privateId = (await getRecipesRepository().create('owner-private', {
      name: 'Private', portions: 1, ingredients: [], steps: [], tags: [],
      nutritionTotal: nutrition, nutritionPerPortion: nutrition,
    })).id;
    const firstId = await createRecipe('owner-one');
    const secondId = await createRecipe('owner-two');

    const unauthenticated = await listCommunityRecipesHandler(makeRequest(), ctx);
    expect(unauthenticated.status).toBe(401);

    const firstPage = await listCommunityRecipesHandler(
      await requestAs('reader', { query: { limit: '1' } }),
      ctx,
    );
    expect(firstPage.status).toBe(200);
    const firstBody = firstPage.jsonBody as { recipes: Array<Record<string, unknown>>; continuationToken?: string };
    expect(firstBody.recipes).toHaveLength(1);
    expect(firstBody.continuationToken).toBeDefined();
    for (const field of ['ownerUserId', 'userId', 'sharedWithUserIds', 'communityPublication', 'usageCount']) {
      expect(firstBody.recipes[0]).not.toHaveProperty(field);
    }
    expect(JSON.stringify(firstBody)).not.toContain(privateId);

    const secondPage = await listCommunityRecipesHandler(
      await requestAs('reader', { query: { limit: '1', continuationToken: firstBody.continuationToken! } }),
      ctx,
    );
    expect(secondPage.status).toBe(200);
    const secondBody = secondPage.jsonBody as { recipes: Array<{ id: string }>; continuationToken?: string };
    expect(secondBody.recipes).toHaveLength(1);
    expect(secondBody.recipes[0]!.id).not.toBe(firstBody.recipes[0]!['id']);
    expect([firstId, secondId]).toContain(secondBody.recipes[0]!.id);
  });

  it('rejects invalid limits and continuation tokens', async () => {
    const warningLogs = vi.spyOn(ctx, 'warn').mockImplementation(() => {});
    try {
      for (const limit of ['0', '51', '1.5', 'abc']) {
        const response = await listCommunityRecipesHandler(await requestAs('reader', { query: { limit } }), ctx);
        expect(response.status).toBe(400);
        expect(response.jsonBody).toMatchObject({ code: 'INVALID_COMMUNITY_LIMIT', category: 'validation' });
      }
      const invalidToken = await listCommunityRecipesHandler(
        await requestAs('reader', { query: { continuationToken: 'not-a-token' } }),
        ctx,
      );
      expect(invalidToken.status).toBe(400);
      expect(invalidToken.jsonBody).toMatchObject({ code: 'INVALID_COMMUNITY_CONTINUATION_TOKEN', category: 'validation' });
      const emptyToken = await listCommunityRecipesHandler(
        await requestAs('reader', { query: { continuationToken: '' } }),
        ctx,
      );
      expect(emptyToken.status).toBe(400);

      const logs = warningLogs.mock.calls.map(([line]) => String(line)).join('\n');
      expect(logs).toContain('communityRecipes.requestValidationFailed');
      expect(logs).toContain('communityRecipes.invalidContinuationToken');
      expect(logs).toContain('"failure_stage":"community_list"');
      expect(logs).toContain('"rejection_source":"repository"');
      expect(logs).not.toContain('not-a-token');
    } finally {
      warningLogs.mockRestore();
    }
  });
});

describe('GET /api/community-recipes/{id}', () => {
  it('returns the allowlisted DTO for a published recipe and the same 404 for private or missing IDs', async () => {
    const privateRecipe = await getRecipesRepository().create('owner', {
      name: 'Private', portions: 1, ingredients: [], steps: [], tags: [],
      nutritionTotal: nutrition, nutritionPerPortion: nutrition,
    });
    const publicId = await createRecipe('publisher', true);

    const privateResponse = await getCommunityRecipeHandler(
      await requestAs('reader', { params: { id: privateRecipe.id } }),
      ctx,
    );
    const missingResponse = await getCommunityRecipeHandler(
      await requestAs('reader', { params: { id: 'missing' } }),
      ctx,
    );
    const unauthenticated = await getCommunityRecipeHandler(
      makeRequest({ params: { id: publicId } }),
      ctx,
    );
    const publicResponse = await getCommunityRecipeHandler(
      await requestAs('reader', { params: { id: publicId } }),
      ctx,
    );

    expect(unauthenticated.status).toBe(401);
    expect(privateResponse.status).toBe(404);
    expect(privateResponse.jsonBody).toMatchObject({ code: 'RECIPE_NOT_FOUND', category: 'not_found' });
    expect(missingResponse.status).toBe(404);
    expect(missingResponse.jsonBody).toEqual(privateResponse.jsonBody);
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.jsonBody).toMatchObject({ id: publicId, name: 'Published recipe', authorDisplayName: 'Anonymous' });
    expect(publicResponse.jsonBody).toMatchObject({ totalTimeMinutes: null });
    expect(JSON.stringify(publicResponse.jsonBody)).not.toContain('publisher');
    expect(JSON.stringify(publicResponse.jsonBody)).not.toContain('/image.jpg');
    expect(JSON.stringify(publicResponse.jsonBody)).not.toContain('sig=');
    expect((publicResponse.jsonBody as { images: Array<{ url: string }> }).images[0]!.url)
      .toBe(`/api/community-recipes/${publicId}/images/image-1`);
  });

  it('projects only a current, server-fingerprinted recipe time', async () => {
    const input = {
      name: 'Timed recipe',
      portions: 2,
      ingredients: [],
      steps: [{ order: 1, description: 'Cook.' }],
      tags: [],
      nutritionTotal: nutrition,
      nutritionPerPortion: nutrition,
    };
    const exportView = createRecipeExportView({
      version: 1,
      teaser: 'A recipe',
      totalTimeMinutes: 35,
      difficulty: 'Easy',
      steps: [{ order: 1, description: 'Cook.' }],
      includedIngredientIds: [],
    }, input);
    const repository = getRecipesRepository();
    const created = await repository.createVersioned('publisher', { ...input, exportView });
    await repository.setVisibility('publisher', created.recipe.id, created.etag, {
      visibility: 'community',
      contentConfirmed: true,
      displayNameConsent: false,
    });

    const current = await getCommunityRecipeHandler(
      await requestAs('reader', { params: { id: created.recipe.id } }),
      ctx,
    );
    await repository.update('publisher', created.recipe.id, { name: 'Changed recipe' });
    const stale = await getCommunityRecipeHandler(
      await requestAs('reader', { params: { id: created.recipe.id } }),
      ctx,
    );

    expect(current.jsonBody).toMatchObject({ totalTimeMinutes: 35 });
    expect(stale.jsonBody).toMatchObject({ totalTimeMinutes: null });
    expect(JSON.stringify(current.jsonBody)).not.toContain('A recipe');
    expect(JSON.stringify(current.jsonBody)).not.toContain('difficulty');
  });
});

describe('GET /api/community-recipes/{id}/images/{imageId}', () => {
  it('returns authenticated image bytes without SAS or redirect and checks access before storage', async () => {
    const privateRecipe = await getRecipesRepository().create('private-owner', {
      name: 'Private', portions: 1, ingredients: [], steps: [], tags: [],
      nutritionTotal: nutrition, nutritionPerPortion: nutrition,
    });
    const publicId = await createRecipe('publisher', true);

    const noAuth = await getCommunityRecipeImageHandler(
      makeRequest({ params: { id: publicId, imageId: 'image-1' } }),
      ctx,
    );
    const privateImage = await getCommunityRecipeImageHandler(
      await requestAs('reader', { params: { id: privateRecipe.id, imageId: 'image-1' } }),
      ctx,
    );
    expect(noAuth.status).toBe(401);
    expect(privateImage.status).toBe(404);
    expect(downloadRecipeImageMock).not.toHaveBeenCalled();

    const response = await getCommunityRecipeImageHandler(
      await requestAs('reader', { params: { id: publicId, imageId: 'image-1' } }),
      ctx,
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual(Buffer.from('community-image'));
    expect(response.headers).toMatchObject({
      'Content-Type': 'image/jpeg',
      'Content-Length': String(Buffer.from('community-image').byteLength),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    expect(response.headers).not.toHaveProperty('Location');
    expect(downloadRecipeImageMock).toHaveBeenCalledWith(`publisher/${publicId}/image.jpg`);
  });

  it('rechecks publication on every image request after revocation', async () => {
    const publicId = await createRecipe('publisher', true);
    const repository = getRecipesRepository();
    const current = await repository.getVersioned('publisher', publicId);
    await repository.setVisibility('publisher', publicId, current!.etag, { visibility: 'private' });

    const response = await getCommunityRecipeImageHandler(
      await requestAs('reader', { params: { id: publicId, imageId: 'image-1' } }),
      ctx,
    );

    expect(response.status).toBe(404);
    expect(response.jsonBody).toMatchObject({ code: 'RECIPE_IMAGE_NOT_FOUND', category: 'not_found' });
    expect(downloadRecipeImageMock).not.toHaveBeenCalled();
  });

  it('rejects missing images, oversized blobs and unsupported stored content types', async () => {
    const publicId = await createRecipe('publisher', true);
    const warningLogs = vi.spyOn(ctx, 'warn').mockImplementation(() => {});
    try {
      const missing = await getCommunityRecipeImageHandler(
        await requestAs('reader', { params: { id: publicId, imageId: 'missing' } }),
        ctx,
      );
      expect(missing.status).toBe(404);

      downloadRecipeImageMock.mockRejectedValueOnce(new RecipeImageTooLargeError());
      const tooLarge = await getCommunityRecipeImageHandler(
        await requestAs('reader', { params: { id: publicId, imageId: 'image-1' } }),
        ctx,
      );
      expect(tooLarge.status).toBe(422);
      expect(tooLarge.jsonBody).toMatchObject({ code: 'IMAGE_TOO_LARGE', category: 'validation' });

      downloadRecipeImageMock.mockRejectedValueOnce(new RecipeImageUnsupportedContentTypeError());
      const unsupported = await getCommunityRecipeImageHandler(
        await requestAs('reader', { params: { id: publicId, imageId: 'image-1' } }),
        ctx,
      );
      expect(unsupported.status).toBe(415);
      expect(unsupported.jsonBody).toMatchObject({ code: 'UNSUPPORTED_MEDIA_TYPE', category: 'validation' });

      const logs = warningLogs.mock.calls.map(([line]) => String(line)).join('\n');
      expect(logs).toContain('communityRecipes.imageDownloadRejected');
      expect(logs).toContain(`"recipe_id":"${publicId}"`);
      expect(logs).toContain('"image_id":"image-1"');
      expect(logs).toContain('"max_bytes":8388608');
      expect(logs).toContain('"allowed_content_types":"image/jpeg,image/png"');
      expect(logs).not.toContain('community-image');
    } finally {
      warningLogs.mockRestore();
    }
  });

  it('logs safe storage metadata with recipe and image IDs on unexpected download failure', async () => {
    const publicId = await createRecipe('publisher', true);
    const errorLogs = vi.spyOn(ctx, 'error').mockImplementation(() => {});
    downloadRecipeImageMock.mockRejectedValueOnce(Object.assign(
      new Error('secret storage payload'),
      { code: 'ServiceUnavailable', statusCode: 503, requestId: 'blob-request-123' },
    ));

    try {
      const response = await getCommunityRecipeImageHandler(
        await requestAs('reader', { params: { id: publicId, imageId: 'image-1' } }),
        ctx,
      );

      expect(response.status).toBe(500);
      expect(response.jsonBody).toMatchObject({ code: 'INTERNAL_ERROR', category: 'internal' });
      const logs = errorLogs.mock.calls.map(([line]) => String(line)).join('\n');
      expect(logs).toContain('communityRecipes.imageDownloadFailed');
      expect(logs).toContain(`"recipe_id":"${publicId}"`);
      expect(logs).toContain('"image_id":"image-1"');
      expect(logs).toContain('"failure_stage":"image_download"');
      expect(logs).toContain('"storage_error_code":"ServiceUnavailable"');
      expect(logs).toContain('"storage_status_code":503');
      expect(logs).toContain('"storage_request_id":"blob-request-123"');
      expect(logs).not.toContain('secret storage payload');
    } finally {
      errorLogs.mockRestore();
    }
  });
});

describe('POST /api/community-recipes/{id}/copy', () => {
  it('requires authentication before reading recipes or copying images', async () => {
    const repository = getRecipesRepository();
    const ownerRead = vi.spyOn(repository, 'get');
    const sourceRead = vi.spyOn(repository, 'getCommunityById');

    const response = await copyCommunityRecipeHandler(
      makeRequest({ params: { id: 'published-id' } }),
      ctx,
    );

    expect(response.status).toBe(401);
    expect(ownerRead).not.toHaveBeenCalled();
    expect(sourceRead).not.toHaveBeenCalled();
    expect(copyRecipeImageToOwnerSnapshotMock).not.toHaveBeenCalled();
  });

  it('creates once, reads the deterministic owner copy before the source, and returns it after unpublish', async () => {
    const sourceId = await createRecipe('publisher', true);
    const repository = getRecipesRepository();
    const order: string[] = [];
    const originalGet = repository.get.bind(repository);
    const originalCommunityGet = repository.getCommunityById.bind(repository);
    vi.spyOn(repository, 'get').mockImplementation(async (userId, id) => {
      order.push(`owner:${userId}:${id}`);
      return originalGet(userId, id);
    });
    vi.spyOn(repository, 'getCommunityById').mockImplementation(async (id) => {
      order.push(`source:${id}`);
      return originalCommunityGet(id);
    });

    const request = () => requestAs('copy-owner', { params: { id: sourceId } });
    const first = await copyCommunityRecipeHandler(await request(), ctx);
    const recipeId = deriveCommunityRecipeCopyId('copy-owner', sourceId);
    expect(first.status).toBe(201);
    expect(first.jsonBody).toEqual({ recipeId });
    expect(order.slice(0, 2)).toEqual([`owner:copy-owner:${recipeId}`, `source:${sourceId}`]);
    expect(await repository.get('copy-owner', recipeId)).toMatchObject({
      id: recipeId,
      ownerUserId: 'copy-owner',
      visibility: 'private',
      images: [{ id: 'image-1', blobName: `copy-owner/${recipeId}/image-1.jpg` }],
    });
    expect(copyRecipeImageToOwnerSnapshotMock).toHaveBeenCalledWith(
      `publisher/${sourceId}/image.jpg`, 'copy-owner', recipeId, 'image-1',
    );

    const published = await originalGet('publisher', sourceId);
    const current = await repository.getVersioned('publisher', sourceId);
    await repository.setVisibility('publisher', sourceId, current!.etag, { visibility: 'private' });
    const second = await copyCommunityRecipeHandler(await request(), ctx);
    expect(second.status).toBe(200);
    expect(second.jsonBody).toEqual(first.jsonBody);
    expect(copyRecipeImageToOwnerSnapshotMock).toHaveBeenCalledTimes(1);
    expect(published?.visibility).toBe('community');
  });

  it('recreates the deterministic copy after completed owner DELETE from the current published snapshot', async () => {
    const sourceId = await createRecipe('publisher', true);
    const repository = getRecipesRepository();
    const initialSource = await repository.get('publisher', sourceId);
    const initialExportView = createRecipeExportView({
      version: 1,
      teaser: 'Original recipe',
      totalTimeMinutes: 25,
      difficulty: 'Einfach',
      steps: [{ order: 1, description: 'Mix the ingredients.' }],
      includedIngredientIds: [],
    }, initialSource!);
    await repository.update('publisher', sourceId, { exportView: initialExportView });

    const recipeId = deriveCommunityRecipeCopyId('copy-owner', sourceId);
    const request = () => requestAs('copy-owner', { params: { id: sourceId } });
    const firstCopy = await copyCommunityRecipeHandler(await request(), ctx);
    expect(firstCopy.status).toBe(201);
    expect(firstCopy.jsonBody).toEqual({ recipeId });
    expect(await repository.get('copy-owner', recipeId)).toMatchObject({
      name: 'Published recipe',
      communityCopyTimeSnapshot: { totalTimeMinutes: 25 },
    });

    const deletion = await deleteRecipeHandler(
      await requestAs('copy-owner', { params: { id: recipeId } }),
      ctx,
    );
    expect(deletion.status).toBe(204);
    expect(deleteRecipeImageMock).toHaveBeenCalledWith(`copy-owner/${recipeId}/image-1.jpg`);
    expect(await repository.get('copy-owner', recipeId)).toBeNull();

    const changedSource = await repository.update('publisher', sourceId, { name: 'Updated published recipe' });
    expect(changedSource?.visibility).toBe('community');
    const currentExportView = createRecipeExportView({
      version: 1,
      teaser: 'Updated recipe',
      totalTimeMinutes: 45,
      difficulty: 'Einfach',
      steps: [{ order: 1, description: 'Mix the ingredients.' }],
      includedIngredientIds: [],
    }, changedSource!);
    await repository.update('publisher', sourceId, { exportView: currentExportView });

    const secondCopy = await copyCommunityRecipeHandler(await request(), ctx);
    expect(secondCopy.status).toBe(201);
    expect(secondCopy.jsonBody).toEqual({ recipeId });
    expect(await repository.get('copy-owner', recipeId)).toMatchObject({
      id: recipeId,
      name: 'Updated published recipe',
      visibility: 'private',
      communityCopyTimeSnapshot: { totalTimeMinutes: 45 },
    });
    expect(copyRecipeImageToOwnerSnapshotMock).toHaveBeenCalledTimes(2);
    expect(await repository.getCommunityById(sourceId)).toMatchObject({
      id: sourceId,
      name: 'Updated published recipe',
      visibility: 'community',
    });
  });

  it('returns the same deterministic result for parallel requests and 404 for an unavailable source', async () => {
    const sourceId = await createRecipe('publisher', true);
    const [first, second] = await Promise.all([
      copyCommunityRecipeHandler(await requestAs('copy-owner', { params: { id: sourceId } }), ctx),
      copyCommunityRecipeHandler(await requestAs('copy-owner', { params: { id: sourceId } }), ctx),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 201]);
    expect(first.jsonBody).toEqual(second.jsonBody);

    const missing = await copyCommunityRecipeHandler(
      await requestAs('copy-owner', { params: { id: 'not-published' } }),
      ctx,
    );
    expect(missing.status).toBe(404);
  });

  it('performs the final owner read when the source is unavailable and returns a concurrent copy', async () => {
    const repository = getRecipesRepository();
    const originalGet = repository.get.bind(repository);
    const seed = await repository.create('seed-owner', {
      name: 'Seed', portions: 1, ingredients: [], steps: [], tags: [],
      nutritionTotal: nutrition, nutritionPerPortion: nutrition,
    });
    const recipeId = deriveCommunityRecipeCopyId('copy-owner', 'now-private');
    let ownerReads = 0;
    const get = vi.spyOn(repository, 'get').mockImplementation(async (userId, id) => {
      if (id === recipeId && ++ownerReads === 2) {
        await repository.createSnapshotCopy('copy-owner', {
          ...seed,
          id: recipeId,
          ownerUserId: 'copy-owner',
          visibility: 'private',
          images: [],
        });
      }
      return originalGet(userId, id);
    });

    const response = await copyCommunityRecipeHandler(
      await requestAs('copy-owner', { params: { id: 'now-private' } }),
      ctx,
    );

    expect(response.status).toBe(200);
    expect(response.jsonBody).toEqual({ recipeId });
    expect(get.mock.calls.filter(([, id]) => id === recipeId)).toHaveLength(2);
  });

  it('does not persist a recipe when a source image cannot be read', async () => {
    const sourceId = await createRecipe('publisher', true);
    copyRecipeImageToOwnerSnapshotMock.mockRejectedValueOnce(new Error('source image unavailable'));
    const recipeId = deriveCommunityRecipeCopyId('copy-owner', sourceId);

    const response = await copyCommunityRecipeHandler(
      await requestAs('copy-owner', { params: { id: sourceId } }),
      ctx,
    );

    expect(response.status).toBe(500);
    expect(await getRecipesRepository().get('copy-owner', recipeId)).toBeNull();
  });

  it('uses the normal auth path and rejects an active account-deletion lock before recipe reads or image writes', async () => {
    const repository = getRecipesRepository();
    const ownerRead = vi.spyOn(repository, 'get');
    deletionLockMock.mockRejectedValueOnce(new ProfileDeletionInProgressError());

    const response = await copyCommunityRecipeHandler(
      await requestAs('locked-user', { params: { id: 'published-id' } }),
      ctx,
    );

    expect(response.status).toBe(409);
    expect(response.jsonBody).toMatchObject({ code: 'PROFILE_DELETION_IN_PROGRESS', retryable: true });
    expect(ownerRead).not.toHaveBeenCalled();
    expect(copyRecipeImageToOwnerSnapshotMock).not.toHaveBeenCalled();
  });
});