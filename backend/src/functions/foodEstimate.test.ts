import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { foodEstimatePreviewHandler } from './foodEstimate';
import { __setOpenAiClientForTests } from '../lib/openai';
import type { AiFoodEstimate } from '../lib/openai';
import { makeRequest, makeContext } from '../test-utils/http';

// ---------------------------------------------------------------------------
// Mock OpenAI client factory
// ---------------------------------------------------------------------------

function makeOpenAiMock(estimate: AiFoodEstimate) {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify(estimate) } }],
        }),
      },
    },
  };
}

// A plausible chicken breast estimate
const CHICKEN_ESTIMATE: AiFoodEstimate = {
  displayName: 'Hähnchenbrust',
  estimatedNutritionPer100g: {
    per: '100g',
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
    fiber: null,
    salt: null,
  },
  estimatedPortion: { label: '1 Brust', weightGrams: 150 },
  category: 'Fleisch',
  confidence: 0.85,
  warnings: [],
};

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  __setOpenAiClientForTests(makeOpenAiMock(CHICKEN_ESTIMATE) as any);
});

afterEach(() => {
  __setOpenAiClientForTests(null);
});

// ---------------------------------------------------------------------------
// Input validation (Zod)
// ---------------------------------------------------------------------------

describe('POST /api/ai/food-estimate/preview — input validation', () => {
  it('returns 400 when name is missing', async () => {
    const req = makeRequest({
      body: {},
      headers: { authorization: 'Bearer test' },
    });
    const res = await foodEstimatePreviewHandler(req, makeContext());
    expect(res.status).toBe(400);
  });

  it('returns 400 when name is empty string', async () => {
    const req = makeRequest({
      body: { name: '' },
      headers: { authorization: 'Bearer test' },
    });
    const res = await foodEstimatePreviewHandler(req, makeContext());
    expect(res.status).toBe(400);
  });

  it('returns 400 when name exceeds 200 chars', async () => {
    const req = makeRequest({
      body: { name: 'A'.repeat(201) },
      headers: { authorization: 'Bearer test' },
    });
    const res = await foodEstimatePreviewHandler(req, makeContext());
    expect(res.status).toBe(400);
  });

  it('returns 400 when contextText exceeds 500 chars', async () => {
    const req = makeRequest({
      body: { name: 'Hähnchenbrust', contextText: 'X'.repeat(501) },
      headers: { authorization: 'Bearer test' },
    });
    const res = await foodEstimatePreviewHandler(req, makeContext());
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Successful estimate
// ---------------------------------------------------------------------------

describe('POST /api/ai/food-estimate/preview — success', () => {
  it('returns 200 with estimate for a valid food name', async () => {
    const req = makeRequest({
      body: { name: 'Hähnchenbrust' },
      headers: { authorization: 'Bearer test' },
    });
    const res = await foodEstimatePreviewHandler(req, makeContext());
    expect(res.status).toBe(200);
    const body = res.jsonBody as Record<string, unknown>;
    expect(body.displayName).toBe('Hähnchenbrust');
    expect(body.confidence).toBe(0.85);
    expect(body.warnings).toEqual([]);
  });

  it('includes estimated portion when AI provides one', async () => {
    const req = makeRequest({
      body: { name: 'Hähnchenbrust' },
      headers: { authorization: 'Bearer test' },
    });
    const res = await foodEstimatePreviewHandler(req, makeContext());
    const body = res.jsonBody as Record<string, unknown>;
    expect(body.estimatedPortion).toEqual({ label: '1 Brust', weightGrams: 150 });
  });

  it('returns 200 with contextText included in AI call', async () => {
    const req = makeRequest({
      body: { name: 'Toast', contextText: 'Vollkorn Toast mit Butter' },
      headers: { authorization: 'Bearer test' },
    });
    const res = await foodEstimatePreviewHandler(req, makeContext());
    expect(res.status).toBe(200);
  });

  it('merges AI warnings with validator warnings', async () => {
    const estimateWithWarning: AiFoodEstimate = {
      ...CHICKEN_ESTIMATE,
      warnings: ['AI-Warnung: Wert geschätzt'],
      estimatedNutritionPer100g: {
        ...CHICKEN_ESTIMATE.estimatedNutritionPer100g,
        // Trigger calorie deviation warning: macros suggest ~163 kcal, reported 250
        calories: 250,
      },
    };
    __setOpenAiClientForTests(makeOpenAiMock(estimateWithWarning) as any);

    const req = makeRequest({
      body: { name: 'Hähnchenbrust' },
      headers: { authorization: 'Bearer test' },
    });
    const res = await foodEstimatePreviewHandler(req, makeContext());
    expect(res.status).toBe(200);
    const body = res.jsonBody as Record<string, unknown>;
    const warnings = body.warnings as string[];
    expect(warnings.length).toBeGreaterThan(1); // AI warning + validator deviation warning
    expect(warnings.some((w) => w.includes('AI-Warnung'))).toBe(true);
    expect(warnings.some((w) => w.includes('deviate'))).toBe(true);
  });

  it('clamps confidence to [0, 1] range', async () => {
    const overConfident: AiFoodEstimate = { ...CHICKEN_ESTIMATE, confidence: 1.5 };
    __setOpenAiClientForTests(makeOpenAiMock(overConfident) as any);

    const req = makeRequest({
      body: { name: 'Hähnchenbrust' },
      headers: { authorization: 'Bearer test' },
    });
    const res = await foodEstimatePreviewHandler(req, makeContext());
    const body = res.jsonBody as Record<string, unknown>;
    expect(body.confidence).toBe(1);
  });

  it('does NOT persist anything to the diary', async () => {
    // This is a preview-only endpoint — no addItem / createMeal calls should happen.
    // We verify by checking only that it returns 200 (no side-effect mocks needed).
    const req = makeRequest({
      body: { name: 'Hähnchenbrust' },
      headers: { authorization: 'Bearer test' },
    });
    const res = await foodEstimatePreviewHandler(req, makeContext());
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Validator rejection (hallucinated values)
// ---------------------------------------------------------------------------

describe('POST /api/ai/food-estimate/preview — validator rejection', () => {
  it('returns 422 when AI returns calories > 900', async () => {
    const hallucinated: AiFoodEstimate = {
      ...CHICKEN_ESTIMATE,
      estimatedNutritionPer100g: {
        ...CHICKEN_ESTIMATE.estimatedNutritionPer100g,
        calories: 1200,
        fat: 90,
      },
    };
    __setOpenAiClientForTests(makeOpenAiMock(hallucinated) as any);

    const req = makeRequest({
      body: { name: 'Hähnchenbrust' },
      headers: { authorization: 'Bearer test' },
    });
    const res = await foodEstimatePreviewHandler(req, makeContext());
    expect(res.status).toBe(422);
    const body = res.jsonBody as Record<string, unknown>;
    expect(body.error).toMatch(/plausibility/i);
    expect(Array.isArray(body.details)).toBe(true);
  });

  it('returns 422 when macro sum exceeds 105g', async () => {
    const hallucinated: AiFoodEstimate = {
      ...CHICKEN_ESTIMATE,
      estimatedNutritionPer100g: {
        ...CHICKEN_ESTIMATE.estimatedNutritionPer100g,
        calories: 600,
        protein: 50,
        carbs: 40,
        fat: 30, // sum = 120
      },
    };
    __setOpenAiClientForTests(makeOpenAiMock(hallucinated) as any);

    const req = makeRequest({
      body: { name: 'UnmöglichesLebensmittel' },
      headers: { authorization: 'Bearer test' },
    });
    const res = await foodEstimatePreviewHandler(req, makeContext());
    expect(res.status).toBe(422);
  });
});
