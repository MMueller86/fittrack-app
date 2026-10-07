// Tests for the shared HTTP plumbing in `lib/http.ts`.
//
// Covers the two responsibilities in isolation:
//   1. `withHandler` turns thrown errors into structured 500s and never
//      leaks the error message into the response body.
//   2. `parseBody` rejects invalid JSON and Zod-mismatched bodies with a
//      400 whose message names the offending field.

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';

import { parseBody, withHandler } from './http';
import { validationDiagnosticLogFields } from './log';
import { makeContext, makeRequest } from '../test-utils/http';

describe('withHandler', () => {
  it('passes the response through when the inner handler resolves', async () => {
    const wrapped = withHandler('test.ok', async () => ({
      status: 200,
      jsonBody: { hello: 'world' },
    }));

    const res = await wrapped(makeRequest(), makeContext());
    expect(res.status).toBe(200);
    expect(res.jsonBody).toEqual({ hello: 'world' });
  });

  it('logs returned 4xx responses with status and API code', async () => {
    const ctx = makeContext();
    const warnSpy = vi.spyOn(ctx, 'warn');
    const wrapped = withHandler('recipes.shareBundle', async () => ({
      status: 422,
      jsonBody: {
        error: 'Recipe detail image cannot be rendered',
        code: 'INVALID_TEMPLATE_INPUT',
        details: 'do not log response details',
      },
    }));

    const response = await wrapped(makeRequest(), ctx);

    expect(response.status).toBe(422);
    expect(warnSpy).toHaveBeenCalledOnce();
    const line = String(warnSpy.mock.calls[0]?.[0]);
    expect(line).toContain('"event":"handler.response.failure"');
    expect(line).toContain('"status":422');
    expect(line).toContain('"api_code":"INVALID_TEMPLATE_INPUT"');
    expect(line).not.toContain('do not log response details');
  });

  it('logs returned 5xx responses at error level', async () => {
    const ctx = makeContext();
    const errorSpy = vi.spyOn(ctx, 'error');
    const wrapped = withHandler('test.unavailable', async () => ({
      status: 503,
      jsonBody: { error: 'Service unavailable', code: 'UPSTREAM_UNAVAILABLE' },
    }));

    const response = await wrapped(makeRequest(), ctx);

    expect(response.status).toBe(503);
    expect(errorSpy).toHaveBeenCalledOnce();
    const line = String(errorSpy.mock.calls[0]?.[0]);
    expect(line).toContain('"event":"handler.response.failure"');
    expect(line).toContain('"status":503');
    expect(line).toContain('"api_code":"UPSTREAM_UNAVAILABLE"');
  });

  it('logs stable error identifiers without logging human-readable response details', async () => {
    const ctx = makeContext();
    const warnSpy = vi.spyOn(ctx, 'warn');
    const wrapped = withHandler('recipes.shareBundle', async () => ({
      status: 422,
      jsonBody: {
        error: 'invalid_export_view_ingredient',
        details: 'private recipe content must not be logged',
      },
    }));

    await wrapped(makeRequest(), ctx);

    const line = String(warnSpy.mock.calls[0]?.[0]);
    expect(line).toContain('"api_error_code":"invalid_export_view_ingredient"');
    expect(line).not.toContain('private recipe content');
  });

  it('does not treat a human-readable API error as a stable error identifier', async () => {
    const ctx = makeContext();
    const warnSpy = vi.spyOn(ctx, 'warn');
    const wrapped = withHandler('recipes.prepareExportView', async () => ({
      status: 422,
      jsonBody: {
        error: 'Recipe export preparation failed server-side validation',
        code: 'private response details',
      },
    }));

    await wrapped(makeRequest(), ctx);

    const line = String(warnSpy.mock.calls[0]?.[0]);
    expect(line).not.toContain('api_error_code');
    expect(line).not.toContain('api_code');
    expect(line).not.toContain('Recipe export preparation failed server-side validation');
    expect(line).not.toContain('private response details');
  });

  it('returns a generic 500 when the inner handler throws', async () => {
    const wrapped = withHandler('test.boom', async () => {
      throw new Error('database is on fire');
    });

    const res = await wrapped(makeRequest(), makeContext());
    expect(res.status).toBe(500);
    expect(res.jsonBody).toEqual({ error: 'Internal server error' });
  });

  it('does not leak the underlying error message to the client', async () => {
    const wrapped = withHandler('test.leak', async () => {
      throw new Error('SECRET_CONNECTION_STRING=Server=...;Password=hunter2');
    });

    const res = await wrapped(makeRequest(), makeContext());
    expect(JSON.stringify(res.jsonBody)).not.toContain('hunter2');
    expect(JSON.stringify(res.jsonBody)).not.toContain('SECRET_CONNECTION_STRING');
  });

  it('logs the error via ctx.error so AppInsights captures it', async () => {
    const ctx = makeContext();
    const errorSpy = vi.spyOn(ctx, 'error');

    const wrapped = withHandler('test.log', async () => {
      throw new Error('cosmos timeout');
    });

    await wrapped(makeRequest(), ctx);
    expect(errorSpy).toHaveBeenCalledOnce();
    const line = errorSpy.mock.calls[0][0] as string;
    expect(line).toContain('"event":"handler.error"');
    expect(line).toContain('"handler":"test.log"');
    expect(line).toContain('cosmos timeout');
  });

  it('also catches non-Error throws', async () => {
    const wrapped = withHandler('test.string-throw', async () => {
      throw 'just a string';
    });

    const res = await wrapped(makeRequest(), makeContext());
    expect(res.status).toBe(500);
  });

  it('returns 401 when handler throws UnauthorizedError', async () => {
    const { UnauthorizedError } = await import('./auth');
    const wrapped = withHandler('test.unauth', async () => {
      throw new UnauthorizedError('Token expired');
    });

    const res = await wrapped(makeRequest(), makeContext());
    expect(res.status).toBe(401);
    expect(res.jsonBody).toEqual({ error: 'Token expired' });
  });
});

describe('parseBody', () => {
  const Schema = z.object({
    name: z.string().min(1, 'must not be empty'),
    age: z.number().int().nonnegative(),
  });

  it('returns parsed data on a valid body', async () => {
    const result = await parseBody(makeRequest({ body: { name: 'Ada', age: 36 } }), Schema);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ name: 'Ada', age: 36 });
    }
  });

  it('returns 400 with "Invalid JSON body" when the body is not valid JSON', async () => {
    const result = await parseBody(makeRequest({ rawBody: '{not json' }), Schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      expect(result.response.jsonBody).toEqual({ error: 'Invalid JSON body' });
      expect(result.diagnostics).toEqual([{ code: 'invalid_json', path: 'body' }]);
    }
  });

  it('returns 400 mentioning the failing field name on schema mismatch', async () => {
    const result = await parseBody(makeRequest({ body: { name: '', age: 5 } }), Schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const body = result.response.jsonBody as { error: string };
      expect(body.error).toContain('name');
    }
  });

  it('reports type errors against the first failing field', async () => {
    const result = await parseBody(makeRequest({ body: { name: 'Ada', age: 'not a number' } }), Schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = result.response.jsonBody as { error: string };
      expect(body.error).toContain('age');
      expect(result.diagnostics).toEqual([{ code: 'invalid_type', path: 'age' }]);
    }
  });

  it('logs strict-schema unknown keys without request values and bounds the key list', async () => {
    const result = await parseBody(
      makeRequest({ body: { name: 'Ada', age: 36, unexpectedField: 'private request value' } }),
      Schema.strict(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.diagnostics).toEqual([{
      code: 'unrecognized_keys',
      path: 'body',
      keys: ['unexpectedField'],
    }]);
    const fields = validationDiagnosticLogFields(result.diagnostics);
    expect(fields).toMatchObject({
      validation_diagnostic_count: 1,
      validation_diagnostics: 'unrecognized_keys@body[unexpectedField]',
      validation_diagnostics_truncated: false,
    });
    expect(JSON.stringify(fields)).not.toContain('private request value');

    const boundedFields = validationDiagnosticLogFields([{
      code: 'unrecognized_keys',
      path: 'body',
      keys: Array.from({ length: 10 }, (_value, index) => `extra${index}`),
    }]);
    expect(boundedFields.validation_diagnostics).not.toContain('extra8');
    expect(boundedFields.validation_diagnostics_truncated).toBe(true);
  });
});
