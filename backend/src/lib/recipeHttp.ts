import type { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { type ZodSchema } from 'zod';

import { UnauthorizedError, UserWriteBlockedDuringProfileDeletionError } from './auth';
import { ProfileDeletionInProgressError } from './repositories/profileDeletionRepository';
import { withHandler, type Handler } from './http';
import { legacyIssueCode } from './zodCompat';
import { logEvent, type ValidationDiagnostic } from './log';

export type RecipeApiErrorCategory =
  | 'authentication'
  | 'authorization'
  | 'validation'
  | 'not_found'
  | 'conflict'
  | 'quota'
  | 'dependency'
  | 'internal';

export interface RecipeFieldError {
  path: string;
  code: string;
}

type RecipeBodyParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: HttpResponseInit; diagnostics: ValidationDiagnostic[] };

export interface RecipeApiErrorBody {
  code: string;
  message: string;
  category: RecipeApiErrorCategory;
  retryable: boolean;
  correlationId: string;
  fieldErrors?: RecipeFieldError[];
  quota?: {
    feature: string;
    used: number;
    limit: number;
    resetsAt: string;
  };
}

export class RecipeDependencyError extends Error {
  constructor(
    readonly failureStage: string,
    readonly originalError: unknown,
  ) {
    super('Recipe dependency failed');
    this.name = 'RecipeDependencyError';
  }
}

const LEGACY_CODES: Record<string, string> = {
  'missing recipe id': 'MISSING_RECIPE_ID',
  'missing id': 'MISSING_RESOURCE_ID',
  'missing image file': 'MISSING_IMAGE_FILE',
  'image must be image/jpeg or image/png': 'UNSUPPORTED_MEDIA_TYPE',
  'image exceeds 8 mb limit': 'IMAGE_TOO_LARGE',
  'recipe image exceeds the 8 mb limit': 'IMAGE_TOO_LARGE',
  'recipe image cannot be rendered': 'IMAGE_BLOB_INVALID',
  'heroCrop must be a json object': 'INVALID_HERO_CROP',
  'heroCrop must be valid json': 'INVALID_JSON',
  'invalid herocrop': 'INVALID_HERO_CROP',
  invalid_json: 'INVALID_JSON',
  invalid_export_view_confirmation: 'INVALID_EXPORT_VIEW_CONFIRMATION',
  invalid_export_view_ingredient: 'INVALID_EXPORT_VIEW_INGREDIENT',
  invalid_export_preparation_request: 'INVALID_EXPORT_PREPARATION_REQUEST',
  recipe_visibility_requires_dedicated_endpoint: 'RECIPE_VISIBILITY_REQUIRES_DEDICATED_ENDPOINT',
  recipe_revision_conflict: 'RECIPE_CONFLICT',
  invalid_recipe_portions: 'INVALID_RECIPE_PORTIONS',
  invalid_community_limit: 'INVALID_COMMUNITY_LIMIT',
  invalid_community_continuation_token: 'INVALID_COMMUNITY_CONTINUATION_TOKEN',
  quota_exceeded: 'QUOTA_EXCEEDED',
  unsupported_recipe_image_type: 'UNSUPPORTED_MEDIA_TYPE',
  no_recipe_image: 'NO_RECIPE_IMAGE',
  missing_export_view: 'MISSING_EXPORT_VIEW',
  image_too_large: 'IMAGE_TOO_LARGE',
  image_blob_invalid: 'IMAGE_BLOB_INVALID',
};

const ERROR_MESSAGES: Record<string, string> = {
  AUTHENTICATION_REQUIRED: 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.',
  PROFILE_DELETION_IN_PROGRESS: 'Dein Konto wird gerade gelöscht. Bitte warte und versuche es danach erneut.',
  FORBIDDEN: 'Du hast keine Berechtigung für diese Aktion.',
  INVALID_JSON: 'Die Anfrage enthält kein gültiges JSON.',
  INVALID_REQUEST: 'Die Anfrage ist ungültig. Bitte prüfe deine Eingaben.',
  MISSING_RECIPE_ID: 'Die Rezept-ID fehlt. Lade die Rezeptansicht neu.',
  MISSING_RESOURCE_ID: 'Eine erforderliche ID fehlt. Lade die Ansicht neu.',
  MISSING_IMAGE_FILE: 'Wähle zuerst ein Rezeptfoto aus.',
  INVALID_HERO_CROP: 'Der Bildausschnitt ist ungültig. Setze ihn zurück und versuche es erneut.',
  INVALID_SELECTED_TAGS: 'Die ausgewählten Tags passen nicht mehr zum Rezept. Lade das Rezept neu.',
  INVALID_EXPORT_VIEW_CONFIRMATION: 'Bitte bestätige die Exportansicht erneut.',
  INVALID_EXPORT_VIEW_INGREDIENT: 'Die Zutaten der Exportansicht passen nicht mehr zum Rezept.',
  INVALID_EXPORT_PREPARATION_REQUEST: 'Die Anfrage zur Exportvorbereitung ist ungültig.',
  RECIPE_VISIBILITY_REQUIRES_DEDICATED_ENDPOINT: 'Bitte ändere die Sichtbarkeit über die dafür vorgesehene Aktion.',
  INVALID_RECIPE_PORTIONS: 'Die Portionsanzahl ist ungültig.',
  INVALID_COMMUNITY_LIMIT: 'Die angeforderte Seitengröße ist ungültig.',
  INVALID_COMMUNITY_CONTINUATION_TOKEN: 'Die Rezeptliste kann mit diesem Seitentoken nicht fortgesetzt werden.',
  INVALID_IMAGE_ORDER: 'Die Bildreihenfolge ist ungültig. Lade das Rezept neu und versuche es erneut.',
  RECIPE_NOT_FOUND: 'Das Rezept wurde nicht gefunden oder ist nicht mehr verfügbar.',
  RECIPE_IMAGE_NOT_FOUND: 'Das Rezeptbild wurde nicht gefunden oder ist nicht mehr verfügbar.',
  MEAL_NOT_FOUND: 'Die ausgewählte Mahlzeit wurde nicht gefunden. Lade den Ernährungstagebuch-Tag neu.',
  RESOURCE_NOT_FOUND: 'Der angeforderte Eintrag wurde nicht gefunden.',
  RECIPE_CONFLICT: 'Das Rezept wurde zwischenzeitlich geändert. Lade es neu und prüfe deine Änderungen.',
  NO_RECIPE_IMAGE: 'Bitte lade zuerst ein Rezeptfoto hoch, bevor du das Rezept teilst.',
  MISSING_EXPORT_VIEW: 'Bereite zuerst die Exportansicht vor, bevor du das Rezept teilst.',
  TITLE_OVERFLOW: 'Der Titel ist leider zu lang, um ihn in das Template zu bringen. Bitte kürze den Rezeptnamen.',
  INVALID_RECIPE_META: 'Die Exportangaben sind ungültig. Prüfe Zeit und Schwierigkeitsgrad.',
  RECIPE_META_OVERFLOW: 'Die Zeit- oder Schwierigkeitsangabe passt nicht ins Bild. Kürze die Angabe.',
  TOO_MANY_TAGS: 'Wähle höchstens vier Tags für das Bild aus.',
  TAG_ROW_OVERFLOW: 'Die Tags passen nicht ins Bild. Wähle weniger oder kürzere Tags.',
  INVALID_ZOOM: 'Der Bildausschnitt ist ungültig. Setze den Zoom zurück.',
  INVALID_FOCUS: 'Der Bildausschnitt ist ungültig. Setze den Bildausschnitt zurück.',
  IMAGE_UNREADABLE: 'Das Rezeptfoto kann nicht gelesen werden. Lade ein anderes Foto hoch.',
  INVALID_TEMPLATE_INPUT: 'Ein Teil der Exportansicht ist ungültig. Prüfe die Texte und versuche es erneut.',
  TEMPLATE_FIELD_OVERFLOW: 'Ein Text passt nicht ins Bild. Kürze die markierte Angabe und versuche es erneut.',
  IMAGE_TOO_LARGE: 'Das Rezeptbild ist zu groß. Verwende ein Bild mit höchstens 8 MB.',
  IMAGE_BLOB_INVALID: 'Das gespeicherte Rezeptbild kann nicht verarbeitet werden. Lade es erneut hoch.',
  UNSUPPORTED_MEDIA_TYPE: 'Dieses Bildformat wird nicht unterstützt. Verwende JPEG oder PNG.',
  RECIPE_UNPROCESSABLE: 'Das Rezept kann mit den aktuellen Angaben nicht verarbeitet werden.',
  AI_OUTPUT_INVALID: 'Die Rezeptdaten konnten nicht zuverlässig geprüft werden. Bitte versuche es erneut.',
  QUOTA_EXCEEDED: 'Das Nutzungslimit für diese Funktion ist erreicht.',
  UPSTREAM_UNAVAILABLE: 'Der Dienst ist vorübergehend nicht verfügbar. Bitte versuche es später erneut.',
  INTERNAL_ERROR: 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es später erneut.',
};

function categoryForStatus(status: number): RecipeApiErrorCategory {
  if (status === 401) return 'authentication';
  if (status === 403) return 'authorization';
  if (status === 404) return 'not_found';
  if (status === 409 || status === 412) return 'conflict';
  if (status === 429) return 'quota';
  if (status === 502 || status === 503) return 'dependency';
  if (status >= 500) return 'internal';
  return 'validation';
}

function safeCorrelationId(ctx: InvocationContext): string {
  const id = ctx.invocationId;
  return typeof id === 'string' && /^[A-Za-z0-9-]{1,100}$/u.test(id) ? id : 'unknown';
}

function recipeRequestLogFields(request: HttpRequest): Record<string, string> {
  const fields: Record<string, string> = {};
  const recipeId = request.params['id'];
  const imageId = request.params['imageId'];
  if (recipeId !== undefined && /^[A-Za-z0-9_.-]{1,100}$/u.test(recipeId)) fields['recipe_id'] = recipeId;
  if (imageId !== undefined && /^[A-Za-z0-9_.-]{1,100}$/u.test(imageId)) fields['image_id'] = imageId;
  return fields;
}

export function recipeApiError(
  ctx: InvocationContext,
  status: number,
  code: string,
  options: {
    message?: string;
    category?: RecipeApiErrorCategory;
    retryable?: boolean;
    fieldErrors?: RecipeFieldError[];
    quota?: RecipeApiErrorBody['quota'];
  } = {},
): HttpResponseInit {
  const body: RecipeApiErrorBody = {
    code,
    message: options.message ?? ERROR_MESSAGES[code] ?? ERROR_MESSAGES[status >= 500 ? 'INTERNAL_ERROR' : 'INVALID_REQUEST']!,
    category: options.category ?? categoryForStatus(status),
    retryable: options.retryable ?? (status === 429 || status === 502 || status === 503),
    correlationId: safeCorrelationId(ctx),
    ...(options.fieldErrors !== undefined ? { fieldErrors: options.fieldErrors } : {}),
    ...(options.quota !== undefined ? { quota: options.quota } : {}),
  };
  return { status, jsonBody: body };
}

function legacyCode(status: number, body: unknown): string {
  if (typeof body === 'object' && body !== null) {
    const record = body as Record<string, unknown>;
    const explicit = typeof record['code'] === 'string' ? record['code'] : undefined;
    const error = typeof record['error'] === 'string' ? record['error'] : undefined;
    const candidate = explicit ?? error;
    if (candidate !== undefined) {
      const legacy = LEGACY_CODES[candidate.toLowerCase()];
      if (legacy) return legacy;
      if (/^[A-Z][A-Z0-9_]{1,79}$/u.test(candidate)) return candidate;
      if (/^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/u.test(candidate)) {
        return candidate.toUpperCase();
      }
      if (/imageids must contain each recipe image/iu.test(candidate)) return 'INVALID_IMAGE_ORDER';
      if (/selectedtags must be a unique subset/iu.test(candidate)) return 'INVALID_SELECTED_TAGS';
      if (/\bmeal not found\b/iu.test(candidate)) return 'MEAL_NOT_FOUND';
      if (/\b(recipe )?image not found\b/iu.test(candidate)) return 'RECIPE_IMAGE_NOT_FOUND';
      if (/\brecipe not found\b/iu.test(candidate)) return 'RECIPE_NOT_FOUND';
      if (/^image exceeds 8 mb limit$/iu.test(candidate) || /^recipe image exceeds the 8 mb limit$/iu.test(candidate)) {
        return 'IMAGE_TOO_LARGE';
      }
    }
    const quota = record['error'] === 'quota_exceeded';
    if (quota) return 'QUOTA_EXCEEDED';
    const details = record['details'];
    if (Array.isArray(details) && details.length > 0 && status === 422) return 'AI_OUTPUT_INVALID';
  }

  if (status === 401) return 'AUTHENTICATION_REQUIRED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'RESOURCE_NOT_FOUND';
  if (status === 409 || status === 412) return 'RECIPE_CONFLICT';
  if (status === 415) return 'UNSUPPORTED_MEDIA_TYPE';
  if (status === 422) return 'RECIPE_UNPROCESSABLE';
  if (status === 429) return 'QUOTA_EXCEEDED';
  if (status === 502 || status === 503) return 'UPSTREAM_UNAVAILABLE';
  if (status >= 500) return 'INTERNAL_ERROR';
  return 'INVALID_REQUEST';
}

function safeFieldErrors(body: Record<string, unknown> | undefined): RecipeFieldError[] | undefined {
  if (!body) return undefined;
  const code = body['code'];
  if (code === 'TOO_MANY_TAGS' || code === 'TAG_ROW_OVERFLOW' || code === 'INVALID_SELECTED_TAGS') {
    return [{ path: 'selectedTags', code: String(code).toLowerCase() }];
  }
  if (code === 'RECIPE_META_OVERFLOW') return [{ path: 'recipeMeta', code: 'overflow' }];
  if (code === 'INVALID_ZOOM') return [{ path: 'presentation.zoom', code: 'invalid_value' }];
  if (code === 'IMAGE_UNREADABLE' || code === 'IMAGE_TOO_LARGE' || code === 'UNSUPPORTED_MEDIA_TYPE') {
    return [{ path: 'image', code: String(code).toLowerCase() }];
  }

  const fromFieldErrors = body['fieldErrors'];
  if (Array.isArray(fromFieldErrors)) {
    return fromFieldErrors.flatMap((entry) => {
      if (typeof entry !== 'object' || entry === null) return [];
      const record = entry as Record<string, unknown>;
      if (typeof record['path'] !== 'string' || typeof record['code'] !== 'string') return [];
      if (!/^[A-Za-z0-9_.\[\]-]{1,200}$/u.test(record['path'])) return [];
      if (!/^[A-Za-z0-9_.-]{1,80}$/u.test(record['code'])) return [];
      return [{ path: record['path'], code: record['code'] }];
    }).slice(0, 20);
  }

  if (code === 'TITLE_OVERFLOW') return [{ path: 'name', code }];
  if (code === 'INVALID_EXPORT_VIEW_INGREDIENT') {
    return [{ path: 'exportView.includedIngredientIds', code: 'invalid_reference' }];
  }

  const field = body['field'];
  if (typeof field === 'string' && /^[A-Za-z][A-Za-z0-9]{0,79}$/u.test(field)) {
    const allowedFields = new Set([
      'title', 'description', 'totalTimeMinutes', 'difficulty', 'portions', 'ingredients',
      'steps', 'recipeMeta', 'focusX', 'focusY',
    ]);
    if (!allowedFields.has(field)) return undefined;
    const itemIndex = body['itemIndex'];
    const itemField = body['itemField'];
    const path = typeof itemIndex === 'number' && Number.isInteger(itemIndex) && itemIndex >= 0 && itemIndex < 100
      ? field === 'steps'
        ? `steps[${itemIndex}]`
        : field === 'ingredients' && (itemField === 'amount' || itemField === 'name')
          ? `ingredients[${itemIndex}].${itemField}`
          : field === 'title' ? 'name' : field
      : field === 'title' ? 'name' : field;
    return [{ path, code: typeof code === 'string' ? code : 'invalid_template_input' }];
  }

  const details = body['details'];
  if (!Array.isArray(details)) return undefined;
  const parsed = details.flatMap((detail) => {
    if (typeof detail !== 'string') return [];
    const match = /^(?:[A-Za-z][A-Za-z0-9_-]*:)?([A-Za-z][A-Za-z0-9_-]*)@([A-Za-z0-9_.\[\]-]{1,200})$/u.exec(detail);
    return match ? [{ code: match[1]!.slice(0, 80), path: match[2]! }] : [];
  }).slice(0, 20);
  return parsed.length > 0 ? parsed : undefined;
}

function normalizeRecipeResponse(ctx: InvocationContext, response: HttpResponseInit): HttpResponseInit {
  const status = response.status ?? 200;
  if (status < 400) return response;

  const original = typeof response.jsonBody === 'object' && response.jsonBody !== null
    ? response.jsonBody as Record<string, unknown>
    : undefined;
  const code = legacyCode(status, response.jsonBody);
  const quotaRecord = original?.['error'] === 'quota_exceeded' ? original : undefined;
  const quota = quotaRecord
    && typeof quotaRecord['feature'] === 'string'
    && typeof quotaRecord['used'] === 'number'
    && typeof quotaRecord['limit'] === 'number'
    && typeof quotaRecord['resetsAt'] === 'string'
    ? {
        feature: quotaRecord['feature'],
        used: quotaRecord['used'],
        limit: quotaRecord['limit'],
        resetsAt: quotaRecord['resetsAt'],
      }
    : undefined;
  const fieldErrors = safeFieldErrors(original);

  return {
    ...response,
    jsonBody: recipeApiError(ctx, status, code, {
      ...(quota ? { quota } : {}),
      ...(fieldErrors ? { fieldErrors } : {}),
    }).jsonBody,
  };
}

export function recipeExceptionLogFields(error: unknown): Record<string, string | number> {
  const source = error instanceof RecipeDependencyError ? error.originalError : error;
  const record = typeof source === 'object' && source !== null
    ? source as Record<string, unknown>
    : undefined;
  const name = source instanceof Error ? source.name : 'NonErrorThrown';
  const fields: Record<string, string | number> = {
    error_name: /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/u.test(name) ? name : 'unknown',
  };
  const code = record?.['code'];
  if (typeof code === 'string' && /^[A-Za-z0-9_.-]{1,100}$/u.test(code)) fields['error_code'] = code;
  const status = record?.['statusCode'] ?? record?.['status'];
  if (typeof status === 'number' && Number.isInteger(status)) fields['error_status'] = status;
  const requestId = record?.['requestId'] ?? record?.['request_id'];
  if (typeof requestId === 'string' && /^[A-Za-z0-9_.-]{1,100}$/u.test(requestId)) {
    fields['provider_request_id'] = requestId;
  }
  return fields;
}

export function withRecipeHandler(name: string, handler: Handler): Handler {
  const wrapped = withHandler(name, async (request, ctx) => {
    const started = Date.now();
    try {
      const response = await handler(request, ctx);
      return normalizeRecipeResponse(ctx, response);
    } catch (error) {
      const correlationId = safeCorrelationId(ctx);
      if (error instanceof UnauthorizedError) {
        logEvent(ctx, 'warn', 'recipes.request.unauthorized', {
          handler: name,
          correlation_id: correlationId,
          duration_ms: Date.now() - started,
          ...recipeRequestLogFields(request),
        });
        return recipeApiError(ctx, 401, 'AUTHENTICATION_REQUIRED');
      }
      if (error instanceof UserWriteBlockedDuringProfileDeletionError || error instanceof ProfileDeletionInProgressError) {
        return recipeApiError(ctx, 409, 'PROFILE_DELETION_IN_PROGRESS', {
          category: 'conflict',
          retryable: true,
        });
      }

      const dependencyFailure = error instanceof RecipeDependencyError;
      logEvent(ctx, 'error', dependencyFailure ? 'recipes.request.dependencyFailed' : 'recipes.request.failed', {
        handler: name,
        correlation_id: correlationId,
        failure_stage: dependencyFailure ? error.failureStage : 'handler',
        duration_ms: Date.now() - started,
        ...recipeRequestLogFields(request),
        ...recipeExceptionLogFields(error),
      });
      if (dependencyFailure) return recipeApiError(ctx, 502, 'UPSTREAM_UNAVAILABLE');
      return recipeApiError(ctx, 500, 'INTERNAL_ERROR');
    }
  });

  return async (request, ctx) => {
    const response = await wrapped(request, ctx);
    const status = response.status ?? 200;
    if (status < 400) return response;

    const body = typeof response.jsonBody === 'object' && response.jsonBody !== null
      ? response.jsonBody as RecipeApiErrorBody
      : undefined;
    logEvent(ctx, status >= 500 ? 'error' : 'warn', 'recipes.request.failure', {
      handler: name,
      correlation_id: safeCorrelationId(ctx),
      status,
      ...recipeRequestLogFields(request),
      ...(body ? {
        api_code: body.code,
        category: body.category,
        retryable: body.retryable,
        ...(body.fieldErrors ? { field_errors: JSON.stringify(body.fieldErrors) } : {}),
        ...(body.quota ? {
          quota_feature: body.quota.feature,
          quota_used: body.quota.used,
          quota_limit: body.quota.limit,
          quota_resets_at: body.quota.resetsAt,
        } : {}),
      } : {}),
    });
    return response;
  };
}

export async function parseRecipeBody<T>(
  request: HttpRequest,
  schema: ZodSchema<T>,
  ctx: InvocationContext,
): Promise<RecipeBodyParseResult<T>> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    return {
      ok: false,
      response: recipeApiError(ctx, 400, 'INVALID_JSON', {
        fieldErrors: [{ path: 'body', code: 'invalid_json' }],
      }),
      diagnostics: [{ code: 'invalid_json', path: 'body' }],
    };
  }
  return validateRecipeValue(value, schema, ctx);
}

export function validateRecipeValue<T>(
  value: unknown,
  schema: ZodSchema<T>,
  ctx: InvocationContext,
): RecipeBodyParseResult<T> {
  const parsed = schema.safeParse(value);
  if (parsed.success) return { ok: true, data: parsed.data };

  const diagnostics: ValidationDiagnostic[] = parsed.error.issues.slice(0, 20).map((issue) => {
    let path = '';
    for (const segment of issue.path) {
      if (typeof segment === 'number') {
        path += `[${segment}]`;
      } else {
        const field = typeof segment === 'string' && /^[A-Za-z][A-Za-z0-9_]*$/u.test(segment)
          ? segment : 'unknown';
        path += `${path.length > 0 ? '.' : ''}${field}`;
      }
    }
    const keys = issue.code === 'unrecognized_keys'
      ? issue.keys.filter((key) => /^[A-Za-z][A-Za-z0-9_]{0,79}$/u.test(key)).slice(0, 8)
      : undefined;
    return { code: legacyIssueCode(issue), path: path || 'body', ...(keys && keys.length > 0 ? { keys } : {}) };
  });
  const fieldErrors = diagnostics.map(({ path, code }) => ({ path: path.slice(0, 200), code: code.slice(0, 80) }));
  const invalidExportIngredients = parsed.error.issues.some(
    (issue) => issue.message === 'invalid_export_view_ingredient',
  );
  return {
    ok: false,
    response: recipeApiError(ctx, 400, invalidExportIngredients ? 'INVALID_EXPORT_VIEW_INGREDIENT' : 'INVALID_REQUEST', {
      fieldErrors,
    }),
    diagnostics,
  };
}