import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { z } from 'zod';
import type { RecipeImage } from '@fittrack/shared';

import { requireUser } from '../lib/auth';
import { withHandler, parseBody } from '../lib/http';
import { logEvent } from '../lib/log';
import { getRecipesRepository } from '../lib/repositories/recipesRepository';
import {
  downloadRecipeImage,
  RecipeImageTooLargeError,
} from '../lib/storage';
import { renderInstagramRecipe } from '../lib/instagramRenderer';
import type { RenderError } from '../lib/instagramRenderer/types';
import { adaptRecipeToRenderInput } from '../lib/instagramRenderer/recipeAdapter';

const PresentationSchema = z
  .object({
    focusX: z.number().finite().min(0).max(1).optional(),
    focusY: z.number().finite().min(0).max(1).optional(),
    zoom: z.number().finite().min(1).optional(),
  })
  .strict();

const RecipeMetaSchema = z
  .object({
    totalTimeMinutes: z.number().finite().int().positive(),
    difficulty: z
      .string()
      .min(1)
      .refine((value) => value.trim().length > 0, 'must not be empty')
      .refine((value) => !/[\r\n\u2028\u2029]/u.test(value), 'must be a single-line string')
      .transform((value) => value.trim()),
  })
  .strict();

const SelectedTagsSchema = z
  .array(
    z
      .string()
      .min(1)
      .refine((value) => value.trim().length > 0, 'must not be empty'),
  )
  .max(4);

export const InstagramRecipeRenderRequestSchema = z
  .object({
    imageId: z.string().uuid().optional(),
    presentation: PresentationSchema.optional(),
    selectedTags: SelectedTagsSchema.optional(),
    nutritionHighlight: z.enum(['high-protein']).nullable().optional(),
    recipeMeta: RecipeMetaSchema.optional(),
  })
  .strict();

type InstagramRecipeRenderRequest = z.infer<typeof InstagramRecipeRenderRequestSchema>;

const UNRENDERABLE_ERROR_CODES = new Set<RenderError['code']>([
  'INVALID_RECIPE_META',
  'RECIPE_META_OVERFLOW',
  'TITLE_OVERFLOW',
  'TOO_MANY_TAGS',
  'TAG_ROW_OVERFLOW',
  'INVALID_ZOOM',
  'INVALID_FOCUS',
  'IMAGE_UNREADABLE',
]);

function selectRecipeImage(recipe: { images: RecipeImage[] }, imageId?: string) {
  if (imageId !== undefined) {
    return recipe.images.find((image) => image.id === imageId);
  }

  return [...recipe.images].sort((left, right) => {
    const leftOrder = Number.isFinite(left.order) ? left.order : Number.POSITIVE_INFINITY;
    const rightOrder = Number.isFinite(right.order) ? right.order : Number.POSITIVE_INFINITY;
    return leftOrder - rightOrder || left.id.localeCompare(right.id);
  })[0];
}

function hasValidSelectedTags(selectedTags: string[] | undefined, recipeTags: string[]): boolean {
  if (selectedTags === undefined) return true;

  const uniqueTags = new Set(selectedTags);
  if (uniqueTags.size !== selectedTags.length) return false;

  const availableTags = new Set(recipeTags);
  return selectedTags.every((tag) => availableTags.has(tag));
}

function renderFailureResponse(
  error: RenderError,
  userId: string,
  recipeId: string,
  ctx: InvocationContext,
): HttpResponseInit {
  if (UNRENDERABLE_ERROR_CODES.has(error.code)) {
    logEvent(ctx, 'warn', 'recipes.instagramRender.unrenderable', {
      userId,
      recipeId,
      code: error.code,
    });
    return {
      status: 422,
      jsonBody: { error: 'Recipe cannot be rendered', code: error.code },
    };
  }

  logEvent(ctx, 'error', 'recipes.instagramRender.failed', {
    userId,
    recipeId,
    code: error.code,
  });
  return { status: 500, jsonBody: { error: 'Internal server error' } };
}

export const instagramRecipeHandler = withHandler(
  'recipes.instagramRender',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const recipeId = request.params['id'];
    if (!recipeId) return { status: 400, jsonBody: { error: 'Missing recipe id' } };

    const parsed = await parseBody(request, InstagramRecipeRenderRequestSchema);
    if (!parsed.ok) return parsed.response;

    const repo = getRecipesRepository();
    const recipe = await repo.get(userId, recipeId);
    if (!recipe) return { status: 404, jsonBody: { error: 'Recipe not found' } };

    if (!hasValidSelectedTags(parsed.data.selectedTags, recipe.tags)) {
      return {
        status: 400,
        jsonBody: { error: 'selectedTags must be a unique subset of the stored recipe tags' },
      };
    }

    const image = selectRecipeImage(recipe, parsed.data.imageId);
    if (!image) {
      if (parsed.data.imageId !== undefined) {
        return { status: 404, jsonBody: { error: 'Image not found' } };
      }
      return {
        status: 422,
        jsonBody: { error: 'Recipe has no renderable image', code: 'NO_RECIPE_IMAGE' },
      };
    }
    if (!image.blobName.trim()) {
      logEvent(ctx, 'warn', 'recipes.instagramRender.invalidImageMetadata', {
        userId,
        recipeId,
        imageId: image.id,
      });
      return {
        status: 422,
        jsonBody: { error: 'Recipe image cannot be rendered', code: 'IMAGE_BLOB_INVALID' },
      };
    }

    let imageBuffer: Buffer;
    try {
      imageBuffer = await downloadRecipeImage(image.blobName);
    } catch (error) {
      if (error instanceof RecipeImageTooLargeError) {
        logEvent(ctx, 'warn', 'recipes.instagramRender.imageTooLarge', {
          userId,
          recipeId,
          imageId: image.id,
        });
        return {
          status: 422,
          jsonBody: { error: 'Recipe image exceeds the 8 MB limit', code: 'IMAGE_TOO_LARGE' },
        };
      }
      throw error;
    }

    const renderResult = await renderInstagramRecipe(
      adaptRecipeToRenderInput(recipe, imageBuffer, {
        ...parsed.data,
        storedHeroCrop: image.heroCrop,
      }),
    );
    if (!renderResult.ok) {
      return renderFailureResponse(renderResult.error, userId, recipeId, ctx);
    }

    return {
      status: 200,
      body: renderResult.buffer,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(renderResult.buffer.byteLength),
        'Content-Disposition': 'inline; filename="fittrack-recipe.png"',
        'Cache-Control': 'no-store',
      },
    };
  },
);

app.http('recipes-render-instagram', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'recipes/{id}/instagram-render',
  handler: instagramRecipeHandler,
});