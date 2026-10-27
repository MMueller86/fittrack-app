import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  enforceQuota: vi.fn(),
  trackUsage: vi.fn(),
}));

vi.mock('../lib/quota', () => ({
  enforceQuota: mocks.enforceQuota,
  trackUsage: mocks.trackUsage,
}));

import { foodEstimateBatchHandler } from './foodEstimateBatch';
import { __setOpenAiClientForTests } from '../lib/openai';
import type { AiFoodEstimate } from '../lib/openai';
import { makeContext, makeAuthRequest, setupTestAuth, teardownTestAuth } from '../test-utils/http';

const estimateFor = (name: string): AiFoodEstimate => ({
  displayName: name,
  estimatedNutritionPer100g: { per: '100g', calories: 120, protein: 8, carbs: 12, fat: 4, fiber: null, salt: null },
  estimatedPortion: null,
  category: null,
  sourceProduct: null,
  searchTerms: [],
  confidence: 0.8,
  warnings: [],
});

function makeOpenAiMock() {
  const create = vi.fn().mockImplementation(async (request: { messages: Array<{ role: string; content: string }> }) => {
    const names = request.messages[1]?.content.split('\n').map((line) => line.replace(/^\d+\. /u, '')) ?? [];
    return { choices: [{ message: { content: JSON.stringify({ items: names.map(estimateFor) }) } }] };
  });
  __setOpenAiClientForTests({ chat: { completions: { create } } } as never);
  return create;
}

beforeAll(async () => {
  await setupTestAuth();
});

afterAll(() => {
  teardownTestAuth();
});

beforeEach(() => {
  mocks.enforceQuota.mockResolvedValue(null);
  mocks.trackUsage.mockResolvedValue(undefined);
});

afterEach(() => {
  __setOpenAiClientForTests(null);
});

describe('POST /api/ai/food-estimate/batch request schema', () => {
  it('accepts the minimum batch and trims Unicode surrounding whitespace', async () => {
    const create = makeOpenAiMock();
    const request = await makeAuthRequest({ body: { items: [{ name: '\u00a0Haferflocken\u00a0' }] } });

    const response = await foodEstimateBatchHandler(request, makeContext());

    expect(response.status).toBe(200);
    expect((response.jsonBody as { results: Array<{ displayName: string }> }).results[0]?.displayName).toBe('Haferflocken');
    expect(create.mock.calls[0]?.[0].messages[1]?.content).toBe('1. Haferflocken');
  });

  it('accepts ten items at the 200-character name boundary', async () => {
    const create = makeOpenAiMock();
    const name = 'A'.repeat(200);
    const request = await makeAuthRequest({ body: { items: Array.from({ length: 10 }, () => ({ name })) } });

    const response = await foodEstimateBatchHandler(request, makeContext());

    expect(response.status).toBe(200);
    expect((response.jsonBody as { results: unknown[] }).results).toHaveLength(10);
    expect(create).toHaveBeenCalledOnce();
    expect(mocks.trackUsage).toHaveBeenCalledTimes(10);
  });

  it.each([
    ['missing items', {}],
    ['null items', { items: null }],
    ['empty batch', { items: [] }],
    ['eleven items', { items: Array.from({ length: 11 }, () => ({ name: 'Hafer' })) }],
    ['missing name', { items: [{}] }],
    ['null name', { items: [{ name: null }] }],
    ['non-string name', { items: [{ name: 7 }] }],
    ['empty name', { items: [{ name: '' }] }],
    ['whitespace-only name', { items: [{ name: ' \t\n ' }] }],
    ['201-character name', { items: [{ name: 'A'.repeat(201) }] }],
  ])('returns 400 for %s and does not call AI', async (_label, body) => {
    const create = makeOpenAiMock();
    const request = await makeAuthRequest({ body });

    const response = await foodEstimateBatchHandler(request, makeContext());

    expect(response.status).toBe(400);
    expect(response.jsonBody).toMatchObject({ error: expect.any(String) });
    expect(create).not.toHaveBeenCalled();
  });

  it('strips unknown top-level and item fields under the current non-strict Zod objects', async () => {
    const create = makeOpenAiMock();
    const request = await makeAuthRequest({ body: { extra: 'ignored', items: [{ name: 'Hafer', extra: 'ignored' }] } });

    const response = await foodEstimateBatchHandler(request, makeContext());

    expect(response.status).toBe(200);
    expect(create.mock.calls[0]?.[0].messages[1]?.content).toBe('1. Hafer');
  });
});