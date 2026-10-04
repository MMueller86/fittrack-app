import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { downloadRecipeImageMock } = vi.hoisted(() => ({
  downloadRecipeImageMock: vi.fn(),
}));

vi.mock('../lib/storage', async () => {
  const actual = await vi.importActual<typeof import('../lib/storage')>('../lib/storage');
  return { ...actual, downloadRecipeImageWithContentType: downloadRecipeImageMock };
});

import { getCommunityRecipeHandler, getCommunityRecipeImageHandler, listCommunityRecipesHandler } from './communityRecipes';
import { __resetRecipesRepositoryForTests, getRecipesRepository } from '../lib/repositories/recipesRepository';
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
    for (const limit of ['0', '51', '1.5', 'abc']) {
      const response = await listCommunityRecipesHandler(await requestAs('reader', { query: { limit } }), ctx);
      expect(response.status).toBe(400);
      expect(response.jsonBody).toEqual({ error: 'invalid_community_limit' });
    }
    const invalidToken = await listCommunityRecipesHandler(
      await requestAs('reader', { query: { continuationToken: 'not-a-token' } }),
      ctx,
    );
    expect(invalidToken.status).toBe(400);
    expect(invalidToken.jsonBody).toEqual({ error: 'invalid_community_continuation_token' });
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
    expect(privateResponse.jsonBody).toEqual({ error: 'Recipe not found' });
    expect(missingResponse.status).toBe(404);
    expect(missingResponse.jsonBody).toEqual(privateResponse.jsonBody);
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.jsonBody).toMatchObject({ id: publicId, name: 'Published recipe', authorDisplayName: 'Anonymous' });
    expect(JSON.stringify(publicResponse.jsonBody)).not.toContain('publisher');
    expect(JSON.stringify(publicResponse.jsonBody)).not.toContain('/image.jpg');
    expect(JSON.stringify(publicResponse.jsonBody)).not.toContain('sig=');
    expect((publicResponse.jsonBody as { images: Array<{ url: string }> }).images[0]!.url)
      .toBe(`/api/community-recipes/${publicId}/images/image-1`);
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
    expect(response.jsonBody).toEqual({ error: 'Recipe image not found' });
    expect(downloadRecipeImageMock).not.toHaveBeenCalled();
  });

  it('rejects missing images, oversized blobs and unsupported stored content types', async () => {
    const publicId = await createRecipe('publisher', true);
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
    expect(tooLarge.jsonBody).toEqual({ error: 'IMAGE_TOO_LARGE' });

    downloadRecipeImageMock.mockRejectedValueOnce(new RecipeImageUnsupportedContentTypeError());
    const unsupported = await getCommunityRecipeImageHandler(
      await requestAs('reader', { params: { id: publicId, imageId: 'image-1' } }),
      ctx,
    );
    expect(unsupported.status).toBe(415);
    expect(unsupported.jsonBody).toEqual({ error: 'unsupported_recipe_image_type' });
  });
});