import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { makeContext, makeRequest } from '../test-utils/http';
import { UnauthorizedError } from './auth';
import { parseRecipeBody, recipeExceptionLogFields, withRecipeHandler } from './recipeHttp';

describe('recipe API errors', () => {
  it('normalizes legacy recipe failures into a stable, actionable envelope', async () => {
    const handler = withRecipeHandler('recipes.get', async () => ({
      status: 404,
      jsonBody: { error: 'Recipe not found' },
    }));

    const response = await handler(makeRequest(), makeContext());

    expect(response.status).toBe(404);
    expect(response.jsonBody).toMatchObject({
      code: 'RECIPE_NOT_FOUND',
      message: expect.any(String),
      category: 'not_found',
      retryable: false,
      correlationId: expect.any(String),
    });
    expect(response.jsonBody).not.toHaveProperty('error');
  });

  it('returns field paths and validation codes without echoing submitted values', async () => {
    const ctx = makeContext();
    const parsed = await parseRecipeBody(
      makeRequest({ body: { name: 'private dish', portions: 'invalid' } }),
      z.object({ name: z.string(), portions: z.number() }).strict(),
      ctx,
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.response.status).toBe(400);
    expect(parsed.response.jsonBody).toMatchObject({
      code: 'INVALID_REQUEST',
      category: 'validation',
      retryable: false,
      fieldErrors: expect.arrayContaining([
        expect.objectContaining({ path: 'portions', code: 'invalid_type' }),
      ]),
    });
    expect(JSON.stringify(parsed.response.jsonBody)).not.toContain('private dish');
  });

  it('maps malformed JSON to INVALID_JSON', async () => {
    const parsed = await parseRecipeBody(
      makeRequest({ rawBody: '{invalid' }),
      z.object({ name: z.string() }),
      makeContext(),
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.response.jsonBody).toMatchObject({ code: 'INVALID_JSON' });
  });

  it('projects only safe diagnostic codes and paths from AI validation failures', async () => {
    const handler = withRecipeHandler('recipes.prepareExportView', async () => ({
      status: 422,
      jsonBody: {
        error: 'private provider validation text',
        details: ['semantic:unknown_source_step_reference@steps[0].sourceStepOrders', 'private recipe step text'],
      },
    }));

    const response = await handler(makeRequest(), makeContext());

    expect(response.jsonBody).toMatchObject({
      code: 'AI_OUTPUT_INVALID',
      fieldErrors: [{ path: 'steps[0].sourceStepOrders', code: 'unknown_source_step_reference' }],
    });
    expect(JSON.stringify(response.jsonBody)).not.toContain('private');
  });

  it.each([
    [{ error: 'Recipe cannot be rendered', code: 'TOO_MANY_TAGS' }, 'selectedTags', 'too_many_tags'],
    [{ error: 'Recipe cannot be rendered', code: 'RECIPE_META_OVERFLOW' }, 'recipeMeta', 'overflow'],
    [{ error: 'Recipe cannot be rendered', code: 'INVALID_ZOOM' }, 'presentation.zoom', 'invalid_value'],
  ])('maps renderer error fields for the client: %j', async (body, path, code) => {
    const handler = withRecipeHandler('recipes.shareBundle', async () => ({ status: 422, jsonBody: body }));

    const response = await handler(makeRequest(), makeContext());

    expect(response.jsonBody).toMatchObject({ fieldErrors: [{ path, code }] });
  });

  it('logs exception metadata without exposing the exception message or stack', async () => {
    const ctx = makeContext();
    const errorSpy = vi.spyOn(ctx, 'error');
    const handler = withRecipeHandler('recipes.update', async () => {
      throw new Error('Password=do-not-log');
    });

    const response = await handler(makeRequest(), ctx);
    const logged = errorSpy.mock.calls.map(([line]) => String(line)).join('\n');

    expect(response.status).toBe(500);
    expect(response.jsonBody).toMatchObject({ code: 'INTERNAL_ERROR', retryable: false });
    expect(logged).toContain('recipes.request.failed');
    expect(logged).toContain('error_name');
    expect(logged).not.toContain('Password=do-not-log');
    expect(logged).not.toContain('error_stack');
  });

  it('projects only allowlisted exception metadata for locally caught failures', () => {
    const error = Object.assign(new Error('private provider response'), {
      code: 'ETIMEDOUT',
      status: 503,
      requestId: 'request-123',
    });

    expect(recipeExceptionLogFields(error)).toEqual({
      error_name: 'Error',
      error_code: 'ETIMEDOUT',
      error_status: 503,
      provider_request_id: 'request-123',
    });
    expect(JSON.stringify(recipeExceptionLogFields(error))).not.toContain('private provider response');
  });

  it('logs a correlated stable code for returned failures without logging the response message', async () => {
    const ctx = makeContext();
    const warnSpy = vi.spyOn(ctx, 'warn');
    const handler = withRecipeHandler('recipes.get', async () => ({
      status: 404,
      jsonBody: { error: 'Recipe not found' },
    }));

    await handler(makeRequest({ params: { id: 'recipe-123', imageId: 'image-456' } }), ctx);

    const lines = warnSpy.mock.calls.map(([line]) => String(line));
    const failure = lines.find((line) => line.includes('"event":"recipes.request.failure"'));
    expect(failure).toContain('"correlation_id":"unknown"');
    expect(failure).toContain('"api_code":"RECIPE_NOT_FOUND"');
    expect(failure).toContain('"recipe_id":"recipe-123"');
    expect(failure).toContain('"image_id":"image-456"');
    expect(failure).not.toContain('Das Rezept wurde nicht gefunden');
  });

  it('logs route resource IDs for unauthorized requests', async () => {
    const ctx = makeContext();
    const warnSpy = vi.spyOn(ctx, 'warn');
    const handler = withRecipeHandler('recipes.get', async () => {
      throw new UnauthorizedError();
    });

    const response = await handler(makeRequest({ params: { id: 'recipe-123' } }), ctx);

    expect(response.status).toBe(401);
    const unauthorized = warnSpy.mock.calls.map(([line]) => String(line))
      .find((line) => line.includes('"event":"recipes.request.unauthorized"'));
    expect(unauthorized).toContain('"recipe_id":"recipe-123"');
  });

  it('logs quota counters and reset time without logging response text', async () => {
    const ctx = makeContext();
    const warnSpy = vi.spyOn(ctx, 'warn');
    const handler = withRecipeHandler('recipes.prepareExportView', async () => ({
      status: 429,
      jsonBody: { error: 'quota_exceeded', feature: 'recipe-analyze', used: 5, limit: 5, resetsAt: '2026-10-22T00:00:00Z' },
    }));

    const response = await handler(makeRequest(), ctx);

    expect(response.jsonBody).toMatchObject({
      code: 'QUOTA_EXCEEDED',
      quota: { feature: 'recipe-analyze', used: 5, limit: 5, resetsAt: '2026-10-22T00:00:00Z' },
    });
    const failure = warnSpy.mock.calls.map(([line]) => String(line))
      .find((line) => line.includes('"event":"recipes.request.failure"'));
    expect(failure).toContain('"quota_feature":"recipe-analyze"');
    expect(failure).toContain('"quota_used":5');
    expect(failure).toContain('"quota_limit":5');
    expect(failure).toContain('"quota_resets_at":"2026-10-22T00:00:00Z"');
    expect(failure).not.toContain('quota_exceeded');
  });
});