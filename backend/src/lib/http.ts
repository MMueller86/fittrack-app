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
import { logEvent } from './log';

export type Handler = (
  request: HttpRequest,
  ctx: InvocationContext,
) => Promise<HttpResponseInit>;

/**
 * Wrap a handler so it never throws past the host.
 *
 * - Logs a structured `handler.start` / `handler.success` / `handler.error`
 *   entry with `name`, `method`, and `duration_ms`.
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
      logEvent(ctx, 'info', 'handler.success', {
        handler: name,
        method: request.method,
        status: response.status,
        duration_ms: Date.now() - started,
      });
      return response;
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        logEvent(ctx, 'info', 'handler.unauthorized', {
          handler: name,
          method: request.method,
          duration_ms: Date.now() - started,
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
}

/**
 * Parse the JSON body of a request through a Zod schema.
 *
 * On success, returns `{ ok: true, data }`. On any failure (invalid JSON
 * or schema mismatch), returns `{ ok: false, response }` where `response`
 * is a 400 with a single human-readable error message that mentions the
 * first failing field by name (matches the existing error message
 * conventions, e.g. `Field "value" must be ...`).
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
  };
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
