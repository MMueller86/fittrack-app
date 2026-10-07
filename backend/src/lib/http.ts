// Shared HTTP plumbing for Azure Function handlers.
//
// Two responsibilities:
//   1. `withHandler` — wraps a handler so any uncaught throw becomes a
//      structured 500 response (no stack traces leaked to clients) and
//      a single error log line. Without this, Cosmos timeouts, repo
//      bugs, or anything else thrown inside a handler bubble up as
//      unhelpful "An unexpected error has occurred" host responses.
//   2. `parseBody` — runs an incoming JSON body through a Zod schema.
//      Returns either the parsed value or a ready-to-return 400.
//      Replaces ad-hoc `as` casts plus hand-rolled validation.
//
// Both helpers use `InvocationContext` for logging so tests (which stub
// `ctx.log/error`) stay free of side effects.

import type {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { z, type ZodSchema } from 'zod';

import { UnauthorizedError } from './auth';
import { logEvent, type ValidationDiagnostic } from './log';

export type Handler = (
  request: HttpRequest,
  ctx: InvocationContext,
) => Promise<HttpResponseInit>;

const API_ERROR_IDENTIFIER_PATTERN = /^(?:[A-Z][A-Z0-9_]{1,79}|[a-z][a-z0-9]*(?:_[a-z0-9]+)+)$/u;

/**
 * Wrap a handler so it never throws past the host.
 *
 * - Logs `handler.response.failure` with status and stable API error codes
 *   for returned 4xx/5xx responses; response bodies are not logged.
 * - Logs structured `handler.start`, `handler.success`, and `handler.error`
 *   entries with handler name, method, and duration.
 * - On thrown error: returns 500 with a generic body (`{ error:
 *   'Internal server error' }`); the original error is logged but never
 *   serialised into the response.
 *
 * @param name  Logical handler name for log correlation, e.g. `weights.add`.
 * @param fn    The actual handler to invoke.
 */
export function withHandler(name: string, fn: Handler): Handler {
  return async (request, ctx) => {
    const started = Date.now();
    logEvent(ctx, 'info', 'handler.start', {
      handler: name,
      method: request.method,
    });
    try {
      const response = await fn(request, ctx);
      const status = response.status ?? 200;
      const duration_ms = Date.now() - started;
      if (status >= 400) {
        const body: unknown = response.jsonBody;
        const apiCodeCandidate =
          typeof body === 'object' && body !== null && 'code' in body &&
          typeof body.code === 'string'
            ? body.code
            : undefined;
        const apiCode = apiCodeCandidate && API_ERROR_IDENTIFIER_PATTERN.test(apiCodeCandidate)
          ? apiCodeCandidate
          : undefined;
        const bodyError =
          typeof body === 'object' && body !== null && 'error' in body &&
          typeof body.error === 'string'
            ? body.error
            : undefined;
        const apiErrorCode = bodyError && API_ERROR_IDENTIFIER_PATTERN.test(bodyError)
          ? bodyError
          : undefined;
        logEvent(ctx, status >= 500 ? 'error' : 'warn', 'handler.response.failure', {
          handler: name,
          method: request.method,
          status,
          duration_ms,
          ...(apiCode !== undefined ? { api_code: apiCode } : {}),
          ...(apiErrorCode !== undefined ? { api_error_code: apiErrorCode } : {}),
        });
      } else {
        logEvent(ctx, 'info', 'handler.success', {
          handler: name,
          method: request.method,
          status,
          duration_ms,
        });
      }
      return response;
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        logEvent(ctx, 'warn', 'handler.unauthorized', {
          handler: name,
          method: request.method,
          duration_ms: Date.now() - started,
          reason: err.message,
        });
        return {
          status: 401,
          jsonBody: { error: err.message },
        };
      }
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      logEvent(ctx, 'error', 'handler.error', {
        handler: name,
        method: request.method,
        duration_ms: Date.now() - started,
        error_message: message,
        error_stack: stack,
      });
      return {
        status: 500,
        jsonBody: { error: 'Internal server error' },
      };
    }
  };
}

export interface ParseSuccess<T> {
  ok: true;
  data: T;
}
export interface ParseFailure {
  ok: false;
  response: HttpResponseInit;
  diagnostics: ValidationDiagnostic[];
}

/**
 * Parse the JSON body of a request through a Zod schema.
 *
 * On success, returns `{ ok: true, data }`. On failure, returns a 400
 * response and value-free diagnostics containing Zod issue codes, sanitized
 * paths, and allowlisted unknown-key names for strict schemas.
 */
export async function parseBody<T>(
  request: HttpRequest,
  schema: ZodSchema<T>,
): Promise<ParseSuccess<T> | ParseFailure> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: { status: 400, jsonBody: { error: 'Invalid JSON body' } },
      diagnostics: [{ code: 'invalid_json', path: 'body' }],
    };
  }

  const parsed = schema.safeParse(raw);
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }

  return {
    ok: false,
    response: {
      status: 400,
      jsonBody: { error: formatZodError(parsed.error) },
    },
    diagnostics: parsed.error.issues.map((issue) => {
      const diagnostic = {
        code: issue.code,
        path: formatSafeZodPath(issue.path),
      };
      if (issue.code !== 'unrecognized_keys') return diagnostic;
      const keys = issue.keys.filter((key) => /^[A-Za-z][A-Za-z0-9_]{0,79}$/u.test(key));
      return { ...diagnostic, ...(keys.length > 0 ? { keys } : {}) };
    }),
  };
}

function formatSafeZodPath(path: PropertyKey[]): string {
  let formatted = '';
  for (const segment of path) {
    if (typeof segment === 'number') {
      formatted += `[${segment}]`;
      continue;
    }
    const field = typeof segment === 'string' && /^[A-Za-z][A-Za-z0-9_]*$/u.test(segment)
      ? segment
      : 'unknown';
    formatted += `${formatted.length > 0 ? '.' : ''}${field}`;
  }
  return formatted || 'body';
}

/**
 * Build a single-sentence error message from a ZodError. Picks the first
 * issue and renders it as `Field "name" <message>` so the message always
 * contains the field name — existing tests assert via `stringContaining`.
 */
function formatZodError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Invalid request body';
  const field = issue.path[0];
  if (typeof field === 'string') {
    return `Field "${field}" ${issue.message}`;
  }
  return issue.message;
}
