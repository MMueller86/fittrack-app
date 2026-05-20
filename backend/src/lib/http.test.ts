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
    }
  });
});
