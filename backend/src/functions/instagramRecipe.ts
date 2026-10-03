import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { z } from 'zod';
import type { RecipeImage } from '@fittrack/shared';

import { requireUser } from '../lib/auth';
import { withHandler, parseBody } from '../lib/http';
import { logEvent, type LogFields } from '../lib/log';
import { getRecipesRepository } from '../lib/repositories/recipesRepository';
import {
  RecipeShareBundleExportDraftSchema,
  validateRecipeExportIngredients,
} from '../lib/recipeValidation';
import {
  downloadRecipeImage,
  RecipeImageTooLargeError,
} from '../lib/storage';
import {
  adaptRecipeToDetailsTemplateInput,
  adaptRecipeToRenderInput,
  renderInstagramRecipe,
  renderInstagramRecipeDetailsTemplate,
} from '../lib/instagramRenderer';
import type {
  RecipeDetailsTemplateRenderError,
  RenderError,
} from '../lib/instagramRenderer/types';

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
export const ShareBundleRequestSchema = InstagramRecipeRenderRequestSchema
  .omit({ recipeMeta: true })
  .extend({ exportViewDraft: RecipeShareBundleExportDraftSchema.optional() })
  .strict();

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
const UNRENDERABLE_DETAIL_ERROR_CODES = new Set([
  'INVALID_TEMPLATE_INPUT',
  'TEMPLATE_FIELD_OVERFLOW',
  'TEMPLATE_PROBE_FAILED',
]);

type RendererDiagnosticError = RenderError | RecipeDetailsTemplateRenderError;
type RenderFailureEventPrefix = 'recipes.instagramRender' | 'recipes.shareBundle.instagramRender';

function boundedLogText(value: string): string {
  return value.replace(/[\r\n\u2028\u2029]+/gu, ' ').slice(0, 1000);
}

function rendererErrorLogFields(error: RendererDiagnosticError): LogFields {
  const fields: LogFields = {
    code: error.code,
    error_message: boundedLogText(error.message),
  };

  if ('cause' in error && typeof error.cause === 'string') {
    fields['error_cause'] = boundedLogText(error.cause);
  }
  if ('field' in error) fields['field'] = error.field;
  if ('itemIndex' in error && error.itemIndex !== undefined) fields['item_index'] = error.itemIndex;
  if ('itemField' in error && error.itemField !== undefined) fields['item_field'] = error.itemField;
  if ('itemValue' in error && error.itemValue !== undefined) {
    fields['item_value'] = error.itemValue.slice(0, 200);
    if (error.itemValue.length > 200) fields['item_value_truncated'] = true;
  }
  if ('asset' in error) fields['asset'] = error.asset;
  if ('count' in error) fields['count'] = error.count;
  if ('max' in error) fields['count_max'] = error.max;
  if ('value' in error) fields['value'] = error.value;

  if ('measured' in error) {
    fields['measured_width'] = error.measured.width;
    if ('height' in error.measured) fields['measured_height'] = error.measured.height;
    if ('maxWidth' in error.measured && error.measured.maxWidth !== undefined) {
      fields['max_width'] = error.measured.maxWidth;
    }
    if ('maxHeight' in error.measured && error.measured.maxHeight !== undefined) {
      fields['max_height'] = error.measured.maxHeight;
    }
    if ('max' in error.measured) fields['max_width'] = error.measured.max;
  }

  return fields;
}

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
  eventPrefix: RenderFailureEventPrefix = 'recipes.instagramRender',
): HttpResponseInit {
  if (UNRENDERABLE_ERROR_CODES.has(error.code)) {
    logEvent(ctx, 'warn', `${eventPrefix}.unrenderable`, {
      userId,
      recipeId,
      ...rendererErrorLogFields(error),
    });
    return {
      status: 422,
      jsonBody: { error: 'Recipe cannot be rendered', code: error.code },
    };
  }

  logEvent(ctx, 'error', `${eventPrefix}.failed`, {
    userId,
    recipeId,
    ...rendererErrorLogFields(error),
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
        jsonBody: {
          error: 'Bitte lade zuerst ein Rezeptfoto hoch, bevor du das Rezept teilst.',
          code: 'NO_RECIPE_IMAGE',
        },
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

export const shareBundleHandler = withHandler(
  'recipes.shareBundle',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const recipeId = request.params['id'];
    if (!recipeId) return { status: 400, jsonBody: { error: 'Missing recipe id' } };

    const parsed = await parseBody(request, ShareBundleRequestSchema);
    if (!parsed.ok) return parsed.response;

    const repo = getRecipesRepository();
    const recipe = await repo.get(userId, recipeId);
    if (!recipe) return { status: 404, jsonBody: { error: 'Recipe not found' } };
    const exportViewDraft = parsed.data.exportViewDraft;
    const exportView = exportViewDraft ?? recipe.exportView;
    if (!exportView) {
      return {
        status: 422,
        jsonBody: { error: 'Recipe export view is required for sharing', code: 'MISSING_EXPORT_VIEW' },
      };
    }
    if (exportViewDraft && validateRecipeExportIngredients(exportViewDraft, recipe.ingredients)) {
      return { status: 400, jsonBody: { error: 'invalid_export_view_ingredient' } };
    }
    const recipeMeta = {
      totalTimeMinutes: exportView.totalTimeMinutes,
      difficulty: exportView.difficulty,
    };
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
        jsonBody: {
          error: 'Bitte lade zuerst ein Rezeptfoto hoch, bevor du das Rezept teilst.',
          code: 'NO_RECIPE_IMAGE',
        },
      };
    }
    if (!image.blobName.trim()) {
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
        return {
          status: 422,
          jsonBody: { error: 'Recipe image exceeds the 8 MB limit', code: 'IMAGE_TOO_LARGE' },
        };
      }
      throw error;
    }

    const instagramRender = await renderInstagramRecipe(
      adaptRecipeToRenderInput(recipe, imageBuffer, {
        ...parsed.data,
        storedHeroCrop: image.heroCrop,
        recipeMeta,
      }),
    );
    if (!instagramRender.ok) {
      return renderFailureResponse(
        instagramRender.error,
        userId,
        recipeId,
        ctx,
        'recipes.shareBundle.instagramRender',
      );
    }

    const detailRender = await renderInstagramRecipeDetailsTemplate(
      adaptRecipeToDetailsTemplateInput(recipe, imageBuffer, {
        presentation: parsed.data.presentation,
        storedHeroCrop: image.heroCrop,
        exportViewDraft,
        recipeMeta,
        highlight: parsed.data.nutritionHighlight ?? undefined,
      }),
    );
    if (!detailRender.ok) {
      if (UNRENDERABLE_DETAIL_ERROR_CODES.has(detailRender.error.code as string)) {
        logEvent(ctx, 'warn', 'recipes.shareBundle.unrenderableDetail', {
          userId,
          recipeId,
          ...rendererErrorLogFields(detailRender.error),
        });
        return {
          status: 422,
          jsonBody: {
            error: 'Recipe detail image cannot be rendered',
            code: detailRender.error.code,
          },
        };
      }
      logEvent(ctx, 'error', 'recipes.shareBundle.detailFailed', {
        userId,
        recipeId,
        ...rendererErrorLogFields(detailRender.error),
      });
      return { status: 500, jsonBody: { error: 'Internal server error' } };
    }

    return {
      status: 200,
      jsonBody: {
        recipeId,
        instagram: {
          mimeType: 'image/png',
          size: instagramRender.buffer.byteLength,
          data: instagramRender.buffer.toString('base64'),
        },
        detail: {
          mimeType: 'image/png',
          size: detailRender.buffer.byteLength,
          data: detailRender.buffer.toString('base64'),
        },
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

app.http('recipes-share-bundle', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'recipes/{id}/share-bundle',
  handler: shareBundleHandler,
});