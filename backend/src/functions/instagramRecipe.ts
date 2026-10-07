import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { z } from 'zod';
import type { RecipeImage } from '@fittrack/shared';

import { requireUser } from '../lib/auth';
import { withHandler, parseBody } from '../lib/http';
import {
  logEvent,
  type LogFields,
  validationDiagnosticLogFields,
} from '../lib/log';
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
type RecipeShareHandlerName = 'recipes.instagramRender' | 'recipes.shareBundle';
type RecipeShareFailureStage =
  | 'request_validation'
  | 'recipe_lookup'
  | 'export_view'
  | 'image_selection'
  | 'image_download';

const SAFE_OPERATION_IDENTIFIER = /^[A-Za-z0-9_.-]{1,100}$/u;

function logSharePreconditionFailure(
  ctx: InvocationContext,
  handler: RecipeShareHandlerName,
  failureStage: RecipeShareFailureStage,
  failureCode: string,
  fields: LogFields = {},
): void {
  logEvent(ctx, 'warn', `${handler}.preconditionFailed`, {
    failure_stage: failureStage,
    failure_code: failureCode,
    ...fields,
  });
}

function storageFailureLogFields(error: unknown): LogFields {
  const record = typeof error === 'object' && error !== null
    ? error as Record<string, unknown>
    : undefined;
  const errorName = error instanceof Error ? error.name : 'NonErrorThrown';
  const fields: LogFields = {
    storage_error_name: SAFE_OPERATION_IDENTIFIER.test(errorName) ? errorName : 'unknown',
  };
  const details = record?.['details'];
  const detailErrorCode = typeof details === 'object' && details !== null
    ? (details as Record<string, unknown>)['errorCode']
    : undefined;
  const code = record?.['code'] ?? detailErrorCode;
  if (typeof code === 'string' && SAFE_OPERATION_IDENTIFIER.test(code)) {
    fields['storage_error_code'] = code;
  }
  const status = record?.['statusCode'] ?? record?.['status'];
  if (typeof status === 'number' && Number.isInteger(status)) {
    fields['storage_status_code'] = status;
  }
  return fields;
}

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
  imageId?: string,
): HttpResponseInit {
  if (UNRENDERABLE_ERROR_CODES.has(error.code)) {
    logEvent(ctx, 'warn', `${eventPrefix}.unrenderable`, {
      userId,
      recipeId,
      image_id: imageId,
      failure_stage: 'instagram_render',
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
    image_id: imageId,
    failure_stage: 'instagram_render',
    ...rendererErrorLogFields(error),
  });
  return { status: 500, jsonBody: { error: 'Internal server error' } };
}

export const instagramRecipeHandler = withHandler(
  'recipes.instagramRender',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const recipeId = request.params['id'];
    if (!recipeId) {
      logSharePreconditionFailure(ctx, 'recipes.instagramRender', 'request_validation', 'missing_recipe_id');
      return { status: 400, jsonBody: { error: 'Missing recipe id' } };
    }

    const parsed = await parseBody(request, InstagramRecipeRenderRequestSchema);
    if (!parsed.ok) {
      logSharePreconditionFailure(
        ctx,
        'recipes.instagramRender',
        'request_validation',
        'invalid_request_body',
        validationDiagnosticLogFields(parsed.diagnostics),
      );
      return parsed.response;
    }

    const repo = getRecipesRepository();
    const recipe = await repo.get(userId, recipeId);
    if (!recipe) {
      logSharePreconditionFailure(ctx, 'recipes.instagramRender', 'recipe_lookup', 'recipe_not_found');
      return { status: 404, jsonBody: { error: 'Recipe not found' } };
    }

    if (!hasValidSelectedTags(parsed.data.selectedTags, recipe.tags)) {
      logSharePreconditionFailure(ctx, 'recipes.instagramRender', 'request_validation', 'selected_tags_mismatch');
      return {
        status: 400,
        jsonBody: { error: 'selectedTags must be a unique subset of the stored recipe tags' },
      };
    }

    const image = selectRecipeImage(recipe, parsed.data.imageId);
    if (!image) {
      if (parsed.data.imageId !== undefined) {
        logSharePreconditionFailure(ctx, 'recipes.instagramRender', 'image_selection', 'requested_image_not_found');
        return { status: 404, jsonBody: { error: 'Image not found' } };
      }
      logSharePreconditionFailure(ctx, 'recipes.instagramRender', 'image_selection', 'recipe_image_missing');
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
        failure_stage: 'image_selection',
        failure_code: 'empty_blob_name',
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
          failure_stage: 'image_download',
          failure_code: 'image_too_large',
        });
        return {
          status: 422,
          jsonBody: { error: 'Recipe image exceeds the 8 MB limit', code: 'IMAGE_TOO_LARGE' },
        };
      }
      logEvent(ctx, 'error', 'recipes.instagramRender.imageDownloadFailed', {
        failure_stage: 'image_download',
        ...storageFailureLogFields(error),
      });
      throw error;
    }

    const renderResult = await renderInstagramRecipe(
      adaptRecipeToRenderInput(recipe, imageBuffer, {
        ...parsed.data,
        storedHeroCrop: image.heroCrop,
      }),
    );
    if (!renderResult.ok) {
      return renderFailureResponse(renderResult.error, userId, recipeId, ctx, 'recipes.instagramRender', image.id);
    }

    logEvent(ctx, 'info', 'recipes.instagramRender.completed', {
      image_id: image.id,
      output_width: renderResult.width,
      output_height: renderResult.height,
      output_bytes: renderResult.buffer.byteLength,
    });
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
    if (!recipeId) {
      logSharePreconditionFailure(ctx, 'recipes.shareBundle', 'request_validation', 'missing_recipe_id');
      return { status: 400, jsonBody: { error: 'Missing recipe id' } };
    }

    const parsed = await parseBody(request, ShareBundleRequestSchema);
    if (!parsed.ok) {
      logSharePreconditionFailure(
        ctx,
        'recipes.shareBundle',
        'request_validation',
        'invalid_request_body',
        validationDiagnosticLogFields(parsed.diagnostics),
      );
      return parsed.response;
    }

    const repo = getRecipesRepository();
    const recipe = await repo.get(userId, recipeId);
    if (!recipe) {
      logSharePreconditionFailure(ctx, 'recipes.shareBundle', 'recipe_lookup', 'recipe_not_found');
      return { status: 404, jsonBody: { error: 'Recipe not found' } };
    }
    const exportViewDraft = parsed.data.exportViewDraft;
    const exportView = exportViewDraft ?? recipe.exportView;
    if (!exportView) {
      logSharePreconditionFailure(ctx, 'recipes.shareBundle', 'export_view', 'missing_export_view');
      return {
        status: 422,
        jsonBody: { error: 'Recipe export view is required for sharing', code: 'MISSING_EXPORT_VIEW' },
      };
    }
    if (exportViewDraft && validateRecipeExportIngredients(exportViewDraft, recipe.ingredients)) {
      logSharePreconditionFailure(ctx, 'recipes.shareBundle', 'export_view', 'invalid_ingredient_reference');
      return { status: 400, jsonBody: { error: 'invalid_export_view_ingredient' } };
    }
    const recipeMeta = {
      totalTimeMinutes: exportView.totalTimeMinutes,
      difficulty: exportView.difficulty,
    };
    if (!hasValidSelectedTags(parsed.data.selectedTags, recipe.tags)) {
      logSharePreconditionFailure(ctx, 'recipes.shareBundle', 'request_validation', 'selected_tags_mismatch');
      return {
        status: 400,
        jsonBody: { error: 'selectedTags must be a unique subset of the stored recipe tags' },
      };
    }

    const image = selectRecipeImage(recipe, parsed.data.imageId);
    if (!image) {
      if (parsed.data.imageId !== undefined) {
        logSharePreconditionFailure(ctx, 'recipes.shareBundle', 'image_selection', 'requested_image_not_found');
        return { status: 404, jsonBody: { error: 'Image not found' } };
      }
      logSharePreconditionFailure(ctx, 'recipes.shareBundle', 'image_selection', 'recipe_image_missing');
      return {
        status: 422,
        jsonBody: {
          error: 'Bitte lade zuerst ein Rezeptfoto hoch, bevor du das Rezept teilst.',
          code: 'NO_RECIPE_IMAGE',
        },
      };
    }
    if (!image.blobName.trim()) {
      logSharePreconditionFailure(ctx, 'recipes.shareBundle', 'image_selection', 'empty_blob_name', {
        image_id: image.id,
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
          logSharePreconditionFailure(ctx, 'recipes.shareBundle', 'image_download', 'image_too_large', {
            image_id: image.id,
          });
        return {
          status: 422,
          jsonBody: { error: 'Recipe image exceeds the 8 MB limit', code: 'IMAGE_TOO_LARGE' },
        };
      }
        logEvent(ctx, 'error', 'recipes.shareBundle.imageDownloadFailed', {
          failure_stage: 'image_download',
          image_id: image.id,
          ...storageFailureLogFields(error),
        });
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
        image.id,
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
          image_id: image.id,
          failure_stage: 'detail_render',
          export_view_source: exportViewDraft ? 'request_draft' : 'stored_confirmed',
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
        image_id: image.id,
        failure_stage: 'detail_render',
        export_view_source: exportViewDraft ? 'request_draft' : 'stored_confirmed',
        ...rendererErrorLogFields(detailRender.error),
      });
      return { status: 500, jsonBody: { error: 'Internal server error' } };
    }

    logEvent(ctx, 'info', 'recipes.shareBundle.completed', {
      image_id: image.id,
      export_view_source: exportViewDraft ? 'request_draft' : 'stored_confirmed',
      instagram_output_bytes: instagramRender.buffer.byteLength,
      detail_output_bytes: detailRender.buffer.byteLength,
    });
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