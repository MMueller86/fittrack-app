import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import type { CommunityRecipesPage } from '@fittrack/shared';

import { projectCommunityRecipe } from '../lib/communityRecipes';
import { withRecipeHandler } from '../lib/recipeHttp';
import { logEvent, type LogFields } from '../lib/log';
import { getRecipesRepository } from '../lib/repositories/recipesRepository';
import { requireUser } from '../lib/auth';
import {
  downloadRecipeImageWithContentType,
  RECIPE_IMAGE_MAX_BYTES,
  RecipeImageTooLargeError,
  RecipeImageUnsupportedContentTypeError,
} from '../lib/storage';

const DEFAULT_COMMUNITY_PAGE_SIZE = 20;
const MAX_COMMUNITY_PAGE_SIZE = 50;
const SAFE_ERROR_IDENTIFIER = /^[A-Za-z0-9_.-]{1,100}$/u;

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

function safeErrorLogFields(error: unknown, source: 'repository' | 'storage'): LogFields {
  const record = typeof error === 'object' && error !== null
    ? error as Record<string, unknown>
    : undefined;
  const name = error instanceof Error ? error.name : 'NonErrorThrown';
  const fields: LogFields = {
    [`${source}_error_name`]: SAFE_ERROR_IDENTIFIER.test(name) ? name : 'unknown',
  };
  const code = record?.['code'];
  if (typeof code === 'string' && SAFE_ERROR_IDENTIFIER.test(code)) fields[`${source}_error_code`] = code;
  const status = record?.['statusCode'] ?? record?.['status'];
  if (typeof status === 'number' && Number.isInteger(status)) fields[`${source}_status_code`] = status;
  const requestId = record?.['requestId'] ?? record?.['request_id'];
  if (typeof requestId === 'string' && SAFE_ERROR_IDENTIFIER.test(requestId)) {
    fields[`${source}_request_id`] = requestId;
  }
  return fields;
}

function logRequestValidationFailure(ctx: InvocationContext, failureCode: string): void {
  logEvent(ctx, 'warn', 'communityRecipes.requestValidationFailed', {
    failure_stage: 'request_validation',
    failure_code: failureCode,
  });
}

function communityImagePath(recipeId: string, imageId: string): string {
  return `/api/community-recipes/${encodeURIComponent(recipeId)}/images/${encodeURIComponent(imageId)}`;
}

export const listCommunityRecipesHandler = withRecipeHandler(
  'communityRecipes.list',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const limit = parseCommunityLimit(request.query.get('limit'));
    if (limit === null) {
      logRequestValidationFailure(ctx, 'invalid_community_limit');
      return { status: 400, jsonBody: { error: 'invalid_community_limit' } };
    }
    const continuationToken = request.query.get('continuationToken');
    if (continuationToken === '') {
      logRequestValidationFailure(ctx, 'invalid_community_continuation_token');
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
        logEvent(ctx, 'warn', 'communityRecipes.invalidContinuationToken', {
          failure_stage: 'community_list',
          failure_code: 'invalid_community_continuation_token',
          rejection_source: 'repository',
          ...safeErrorLogFields(error, 'repository'),
        });
        return { status: 400, jsonBody: { error: 'invalid_community_continuation_token' } };
      }
      logEvent(ctx, 'error', 'communityRecipes.listFailed', {
        failure_stage: 'community_list',
        failure_code: 'community_list_failed',
        ...safeErrorLogFields(error, 'repository'),
      });
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

export const getCommunityRecipeHandler = withRecipeHandler(
  'communityRecipes.get',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const id = request.params['id'];
    if (!id) {
      logRequestValidationFailure(ctx, 'missing_recipe_id');
      return { status: 400, jsonBody: { error: 'Missing recipe id' } };
    }

    const recipe = await getRecipesRepository().getCommunityById(id);
    if (!recipe) {
      logEvent(ctx, 'info', 'communityRecipes.recipeUnavailable', {
        recipe_id: id,
        failure_stage: 'recipe_lookup',
        failure_code: 'recipe_not_found_or_unavailable',
      });
      return { status: 404, jsonBody: { error: 'Recipe not found' } };
    }
    return {
      status: 200,
      jsonBody: await projectCommunityRecipe(recipe, userId, communityImagePath),
    };
  },
);

export const getCommunityRecipeImageHandler = withRecipeHandler(
  'communityRecipes.getImage',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const recipeId = request.params['id'];
    const imageId = request.params['imageId'];
    if (!recipeId || !imageId) {
      logRequestValidationFailure(ctx, 'missing_recipe_or_image_id');
      return { status: 400, jsonBody: { error: 'Missing id' } };
    }

    const recipe = await getRecipesRepository().getCommunityById(recipeId);
    const image = recipe?.images.find((candidate) => candidate.id === imageId);
    if (!recipe || !image) {
      logEvent(ctx, 'info', 'communityRecipes.imageUnavailable', {
        recipe_id: recipeId,
        image_id: imageId,
        failure_stage: 'community_lookup',
        failure_code: 'recipe_image_not_found_or_unavailable',
      });
      return { status: 404, jsonBody: { error: 'Recipe image not found' } };
    }

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
        logEvent(ctx, 'warn', 'communityRecipes.imageDownloadRejected', {
          recipe_id: recipeId,
          image_id: imageId,
          failure_stage: 'image_download',
          failure_code: 'image_too_large',
          max_bytes: RECIPE_IMAGE_MAX_BYTES,
        });
        return { status: 422, jsonBody: { error: 'IMAGE_TOO_LARGE' } };
      }
      if (error instanceof RecipeImageUnsupportedContentTypeError) {
        logEvent(ctx, 'warn', 'communityRecipes.imageDownloadRejected', {
          recipe_id: recipeId,
          image_id: imageId,
          failure_stage: 'image_download',
          failure_code: 'unsupported_image_content_type',
          allowed_content_types: 'image/jpeg,image/png',
        });
        return { status: 415, jsonBody: { error: 'unsupported_recipe_image_type' } };
      }
      const statusCode = typeof error === 'object' && error !== null
        ? (error as { statusCode?: unknown }).statusCode
        : undefined;
      if (statusCode === 404) {
        logEvent(ctx, 'info', 'communityRecipes.imageUnavailable', {
          recipe_id: recipeId,
          image_id: imageId,
          failure_stage: 'image_download',
          failure_code: 'blob_not_found_or_unavailable',
          ...safeErrorLogFields(error, 'storage'),
        });
        return { status: 404, jsonBody: { error: 'Recipe image not found' } };
      }
      logEvent(ctx, 'error', 'communityRecipes.imageDownloadFailed', {
        recipe_id: recipeId,
        image_id: imageId,
        failure_stage: 'image_download',
        failure_code: 'storage_download_failed',
        ...safeErrorLogFields(error, 'storage'),
      });
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