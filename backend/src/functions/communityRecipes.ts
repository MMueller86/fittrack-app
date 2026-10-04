import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import type { CommunityRecipesPage } from '@fittrack/shared';

import { projectCommunityRecipe } from '../lib/communityRecipes';
import { withHandler } from '../lib/http';
import { logEvent } from '../lib/log';
import { getRecipesRepository } from '../lib/repositories/recipesRepository';
import { requireUser } from '../lib/auth';
import {
  downloadRecipeImageWithContentType,
  RecipeImageTooLargeError,
  RecipeImageUnsupportedContentTypeError,
} from '../lib/storage';

const DEFAULT_COMMUNITY_PAGE_SIZE = 20;
const MAX_COMMUNITY_PAGE_SIZE = 50;

function parseCommunityLimit(value: string | null): number | null {
  if (value === null) return DEFAULT_COMMUNITY_PAGE_SIZE;
  if (!/^[1-9]\d*$/.test(value)) return null;
  const limit = Number(value);
  return Number.isSafeInteger(limit) && limit <= MAX_COMMUNITY_PAGE_SIZE ? limit : null;
}

function isInvalidContinuationTokenError(error: unknown): boolean {
  if (error instanceof Error && error.message === 'Invalid community continuation token') return true;
  if (typeof error !== 'object' || error === null) return false;
  const details = error as { code?: unknown; statusCode?: unknown };
  return details.statusCode === 400 || details.code === 400 || details.code === 'BadRequest';
}

function communityImagePath(recipeId: string, imageId: string): string {
  return `/api/community-recipes/${encodeURIComponent(recipeId)}/images/${encodeURIComponent(imageId)}`;
}

export const listCommunityRecipesHandler = withHandler(
  'communityRecipes.list',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const limit = parseCommunityLimit(request.query.get('limit'));
    if (limit === null) return { status: 400, jsonBody: { error: 'invalid_community_limit' } };
    const continuationToken = request.query.get('continuationToken');
    if (continuationToken === '') {
      return { status: 400, jsonBody: { error: 'invalid_community_continuation_token' } };
    }

    let page;
    try {
      page = await getRecipesRepository().listCommunity({
        limit,
        ...(continuationToken !== null ? { continuationToken } : {}),
      });
    } catch (error) {
      if (continuationToken !== null && isInvalidContinuationTokenError(error)) {
        return { status: 400, jsonBody: { error: 'invalid_community_continuation_token' } };
      }
      throw error;
    }

    const response: CommunityRecipesPage = {
      recipes: await Promise.all(page.recipes.map((recipe) =>
        projectCommunityRecipe(recipe, userId, communityImagePath),
      )),
      ...(page.continuationToken !== undefined ? { continuationToken: page.continuationToken } : {}),
    };
    logEvent(ctx, 'info', 'communityRecipes.list', { userId, count: response.recipes.length });
    return { status: 200, jsonBody: response };
  },
);

export const getCommunityRecipeHandler = withHandler(
  'communityRecipes.get',
  async (request: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const id = request.params['id'];
    if (!id) return { status: 400, jsonBody: { error: 'Missing recipe id' } };

    const recipe = await getRecipesRepository().getCommunityById(id);
    if (!recipe) return { status: 404, jsonBody: { error: 'Recipe not found' } };
    return {
      status: 200,
      jsonBody: await projectCommunityRecipe(recipe, userId, communityImagePath),
    };
  },
);

export const getCommunityRecipeImageHandler = withHandler(
  'communityRecipes.getImage',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const recipeId = request.params['id'];
    const imageId = request.params['imageId'];
    if (!recipeId || !imageId) return { status: 400, jsonBody: { error: 'Missing id' } };

    const recipe = await getRecipesRepository().getCommunityById(recipeId);
    const image = recipe?.images.find((candidate) => candidate.id === imageId);
    if (!recipe || !image) return { status: 404, jsonBody: { error: 'Recipe image not found' } };

    try {
      const downloaded = await downloadRecipeImageWithContentType(image.blobName);
      return {
        status: 200,
        body: downloaded.buffer,
        headers: {
          'Content-Type': downloaded.contentType,
          'Content-Length': String(downloaded.buffer.byteLength),
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      };
    } catch (error) {
      if (error instanceof RecipeImageTooLargeError) {
        return { status: 422, jsonBody: { error: 'IMAGE_TOO_LARGE' } };
      }
      if (error instanceof RecipeImageUnsupportedContentTypeError) {
        return { status: 415, jsonBody: { error: 'unsupported_recipe_image_type' } };
      }
      const statusCode = typeof error === 'object' && error !== null
        ? (error as { statusCode?: unknown }).statusCode
        : undefined;
      if (statusCode === 404) {
        logEvent(ctx, 'info', 'communityRecipes.imageNotFound', { userId, recipeId, imageId });
        return { status: 404, jsonBody: { error: 'Recipe image not found' } };
      }
      throw error;
    }
  },
);

app.http('community-recipes-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'community-recipes',
  handler: listCommunityRecipesHandler,
});

app.http('community-recipes-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'community-recipes/{id}',
  handler: getCommunityRecipeHandler,
});

app.http('community-recipes-get-image', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'community-recipes/{id}/images/{imageId}',
  handler: getCommunityRecipeImageHandler,
});