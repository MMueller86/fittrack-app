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

function makeInvocationContext(invocationId: string) {
  return Object.assign(makeContext(), { invocationId });
}

function expectWorkerDiagnostics(
  line: unknown,
  invocationId: string,
  firstInvocation: boolean,
): void {
  const fields = JSON.parse(String(line)) as Record<string, unknown>;
  expect(fields).toMatchObject({
    invocation_id: invocationId,
    worker_first_invocation: firstInvocation,
  });
  expect(typeof fields['worker_uptime_ms']).toBe('number');
  expect(fields['worker_uptime_ms']).toBeGreaterThanOrEqual(0);
}

describe('withHandler', () => {
  it('passes the response through when the inner handler resolves', async () => {
    const ctx = makeInvocationContext('invocation-first');
    const logSpy = vi.spyOn(ctx, 'log');
    const wrapped = withHandler('test.ok', async () => ({
      status: 200,
      jsonBody: { hello: 'world' },
    }));

    const res = await wrapped(makeRequest(), ctx);
    expect(res.status).toBe(200);
    expect(res.jsonBody).toEqual({ hello: 'world' });
    expectWorkerDiagnostics(logSpy.mock.calls[0]?.[0], 'invocation-first', true);
    expectWorkerDiagnostics(logSpy.mock.calls[1]?.[0], 'invocation-first', true);
  });

  it('logs returned 4xx responses with status and API code', async () => {
    const ctx = makeInvocationContext('invocation-returned-failure');
    const logSpy = vi.spyOn(ctx, 'log');
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
    expectWorkerDiagnostics(logSpy.mock.calls[0]?.[0], 'invocation-returned-failure', false);
    expectWorkerDiagnostics(warnSpy.mock.calls[0]?.[0], 'invocation-returned-failure', false);
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
    const ctx = makeInvocationContext('invocation-error');
    const logSpy = vi.spyOn(ctx, 'log');
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
    expectWorkerDiagnostics(logSpy.mock.calls[0]?.[0], 'invocation-error', false);
    expectWorkerDiagnostics(errorSpy.mock.calls[0]?.[0], 'invocation-error', false);
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
    const ctx = makeInvocationContext('invocation-unauthorized');
    const logSpy = vi.spyOn(ctx, 'log');
    const warnSpy = vi.spyOn(ctx, 'warn');
    const wrapped = withHandler('test.unauth', async () => {
      throw new UnauthorizedError('Token expired');
    });

    const res = await wrapped(makeRequest(), ctx);
    expect(res.status).toBe(401);
    expect(res.jsonBody).toEqual({ error: 'Token expired' });
    expectWorkerDiagnostics(logSpy.mock.calls[0]?.[0], 'invocation-unauthorized', false);
    expectWorkerDiagnostics(warnSpy.mock.calls[0]?.[0], 'invocation-unauthorized', false);
  });

  it('logs profile-deletion 409 responses with invocation diagnostics', async () => {
    const { ProfileDeletionInProgressError } = await import('./repositories/profileDeletionRepository');
    const ctx = makeInvocationContext('invocation-profile-deletion');
    const logSpy = vi.spyOn(ctx, 'log');
    const warnSpy = vi.spyOn(ctx, 'warn');
    const wrapped = withHandler('test.profile-deletion', async () => {
      throw new ProfileDeletionInProgressError();
    });

    const response = await wrapped(makeRequest(), ctx);

    expect(response.status).toBe(409);
    expect(response.jsonBody).toEqual({ error: 'profile_deletion_in_progress', retryable: true });
    expect(warnSpy).toHaveBeenCalledOnce();
    expectWorkerDiagnostics(logSpy.mock.calls[0]?.[0], 'invocation-profile-deletion', false);
    expectWorkerDiagnostics(warnSpy.mock.calls[0]?.[0], 'invocation-profile-deletion', false);
    expect(String(warnSpy.mock.calls[0]?.[0])).not.toContain('userId');
  });

  it('does not add request content or credentials to lifecycle diagnostics', async () => {
    const ctx = makeInvocationContext('invocation-private-input');
    const logSpy = vi.spyOn(ctx, 'log');
    const wrapped = withHandler('test.private-input', async () => ({ status: 204 }));

    await wrapped(makeRequest({
      body: { note: 'private-body-marker' },
      headers: { authorization: 'Bearer private-header-marker' },
      query: { search: 'private-query-marker' },
    }), ctx);

    const lines = logSpy.mock.calls.map(([line]) => String(line));
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line).not.toContain('private-body-marker');
      expect(line).not.toContain('private-header-marker');
      expect(line).not.toContain('private-query-marker');
    }
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
