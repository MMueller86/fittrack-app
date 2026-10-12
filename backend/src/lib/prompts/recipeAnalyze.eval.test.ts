// Prompt eval tests for recipeAnalyze (RECIPE_ANALYZE_PROMPT_VERSION).
//
// These tests make real Azure OpenAI API calls and are intentionally excluded
// from the default `npm test` run. Run explicitly via `npm run test:eval`.
//
// Three eval layers per fixture:
//   Layer 1 — Structural: required fields, correct types, non-negative values.
//   Layer 2 — Semantic:   category classification and amountGrams ranges from reviewed fixtures.
//   Layer 3 — Edge-case:  critical prompt rules (no invented items, exact counts).
//
// Tests are skipped automatically when AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY are absent.
// The prompt version guard runs unconditionally and fails immediately on a version mismatch.

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Completions } from 'openai/resources/chat/completions';
import type { RecipeIngredient, PrepareRecipeExportViewResponseV2 } from '@fittrack/shared';
import * as openai from '../openai';
import { analyzeRecipeText } from '../openai';
import type { AiRecipeIngredientLine } from '../openai';
import { RECIPE_ANALYZE_PROMPT_VERSION, RECIPE_ANALYZE_SYSTEM_PROMPT, RECIPE_PREPARATION_PROMPT_VERSION, RECIPE_PREPARATION_SYSTEM_PROMPT, RECIPE_PREPARATION_CORRECTION_SYSTEM_PROMPT, RECIPE_TEXT_CORRECTION_SYSTEM_PROMPT } from './recipeAnalyze';
import { prepareRecipeExportViewHandler } from '../../functions/recipes';
import { __resetRecipesRepositoryForTests, getRecipesRepository } from '../repositories/recipesRepository';
import { enforceQuota, trackUsage } from '../quota';
import { makeAuthRequest, makeContext, setupTestAuth, teardownTestAuth, TEST_USER_ID } from '../../test-utils/http';
import { validateRecipeAnalyzeOutput, validateRecipeExportPreparationOutput } from '../recipeAnalyzeValidation';
import * as renderer from '../instagramRenderer';
import {
  RECIPE_ANALYZE_EVAL_FIXTURES,
  RECIPE_PREPARATION_EVAL_FIXTURES,
  RECIPE_PREPARATION_FORCED_DOUGH_FIXTURE,
  assertRecipePreparationMetadata,
  assertRecipePreparationSemantics,
  assertRecipeStepSemantics,
  type AmountGramsConstraint,
  type KitchenAmountTextConstraint,
  type IngredientConstraint,
} from './recipeAnalyze.eval.fixtures';

vi.mock('../quota', () => ({ enforceQuota: vi.fn(), trackUsage: vi.fn() }));
vi.mock('../storage', () => ({
  uploadRecipeImage: vi.fn(), deleteRecipeImage: vi.fn(), generateRecipeImageSasUrl: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Prompt version guard — runs without credentials
// Fails immediately if the prompt was bumped without updating the fixtures.
// ---------------------------------------------------------------------------

/** Update this constant whenever RECIPE_ANALYZE_PROMPT_VERSION changes and re-review all fixtures. */
const TESTED_PROMPT_VERSION = 'v17';
const TESTED_PREPARATION_PROMPT_VERSION = 'v12';

it('prompt version matches fixture expectations', () => {
  expect(RECIPE_ANALYZE_PROMPT_VERSION).toBe(TESTED_PROMPT_VERSION);
});

it('preparation prompt version matches fixture expectations', () => {
  expect(RECIPE_PREPARATION_PROMPT_VERSION).toBe(TESTED_PREPARATION_PROMPT_VERSION);
});

it('import prompt plans export slots so finishing the main component is never dropped', () => {
  expect(RECIPE_ANALYZE_SYSTEM_PROMPT).toContain('Plane die Exportschritte vor dem Schreiben');
  expect(RECIPE_ANALYZE_SYSTEM_PROMPT).toContain('Das Fertiggaren der Hauptkomponente und das Garen einer eigenständigen Beilage fallen nie weg');
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findIngredient(
  ingredients: AiRecipeIngredientLine[],
  displayNameContains: string,
): AiRecipeIngredientLine | undefined {
  return ingredients.find((i) =>
    i.displayName.toLowerCase().includes(displayNameContains.toLowerCase()),
  );
}

function assertAmountGrams(
  actual: number | null,
  constraint: AmountGramsConstraint,
  label: string,
): void {
  if (constraint === null) {
    expect(actual, `${label}: expected amountGrams to be null`).toBeNull();
  } else if (constraint === 'not-null') {
    expect(actual, `${label}: expected amountGrams to be non-null (estimated)`).not.toBeNull();
    expect(actual, `${label}: expected amountGrams to be positive`).toBeGreaterThan(0);
  } else {
    expect(
      actual,
      `${label}: expected amountGrams >= ${constraint.min}`,
    ).toBeGreaterThanOrEqual(constraint.min);
    expect(
      actual,
      `${label}: expected amountGrams <= ${constraint.max}`,
    ).toBeLessThanOrEqual(constraint.max);
  }
}

function assertKitchenAmountText(
  actual: string | null,
  constraint: KitchenAmountTextConstraint,
  label: string,
): void {
  if (constraint === null) {
    expect(actual, `${label}: expected kitchenAmountText to be null`).toBeNull();
  } else {
    expect(actual, `${label}: expected kitchenAmountText to be a non-empty string`).toBeTruthy();
    expect(typeof actual, `${label}: expected kitchenAmountText to be a string`).toBe('string');
  }
}

function assertIngredientConstraint(
  ingredients: AiRecipeIngredientLine[],
  ic: IngredientConstraint,
): void {
  const found = findIngredient(ingredients, ic.displayNameContains);
  expect(
    found,
    `Expected an ingredient matching "${ic.displayNameContains}" in the output`,
  ).toBeDefined();
  if (!found) return;

  expect(
    found.category,
    `"${found.displayName}": expected category="${ic.category}"`,
  ).toBe(ic.category);

  if (ic.amountGrams !== undefined) {
    assertAmountGrams(found.amountGrams, ic.amountGrams, found.displayName);
  }

  if (ic.kitchenAmountText !== undefined) {
    assertKitchenAmountText(found.kitchenAmountText, ic.kitchenAmountText, found.displayName);
  }
}

// ---------------------------------------------------------------------------
// Live eval tests — skipped when credentials are absent
// ---------------------------------------------------------------------------

const hasCredentials =
  !!process.env['AZURE_OPENAI_ENDPOINT'] && !!process.env['AZURE_OPENAI_API_KEY'];

describe.skipIf(!hasCredentials)('recipeAnalyze: live prompt evaluation', () => {
  it.each(RECIPE_ANALYZE_EVAL_FIXTURES)('[$id] $description', async (fixture) => {
    const result = await analyzeRecipeText(fixture.input);
    const { constraints } = fixture;

    if (constraints.exportStepSemanticAssertions) {
      console.info('Synthetic import semantic evidence', JSON.stringify({
        fixture: fixture.id, source: result.steps, export: result.exportSuggestion.steps,
      }));
    }
    assertRecipeStepSemantics(result, constraints);

    // --- Layer 1: Structural / schema assertions ---

    expect(result.suggestedName, 'suggestedName must be non-empty').toBeTruthy();
    expect(result.description, 'description must be non-empty').toBeTruthy();
    expect(Array.isArray(result.ingredients), 'ingredients must be an array').toBe(true);
    expect(Array.isArray(result.steps), 'steps must be an array').toBe(true);
    expect(result.exportSuggestion, 'exportSuggestion must be present').toBeDefined();
    expect(typeof result.suggestedPortions).toBe('number');
    expect(result.suggestedPortions, 'suggestedPortions must be > 0').toBeGreaterThan(0);

    expect(result.exportSuggestion.version).toBe(1);
    expect(result.exportSuggestion.teaser.trim()).not.toBe('');
    expect(result.exportSuggestion.teaser.length).toBeLessThanOrEqual(96);
    expect(
      result.exportSuggestion.totalTimeMinutes === null ||
        (Number.isInteger(result.exportSuggestion.totalTimeMinutes) && result.exportSuggestion.totalTimeMinutes > 0),
    ).toBe(true);
    expect(
      result.exportSuggestion.difficulty === null ||
        (result.exportSuggestion.difficulty.trim().length > 0 && !/[\r\n]/u.test(result.exportSuggestion.difficulty)),
    ).toBe(true);
    expect(result.exportSuggestion.steps.length).toBeGreaterThanOrEqual(1);
    expect(result.exportSuggestion.steps.length).toBeLessThanOrEqual(5);
    expect(result.exportSuggestion.steps.map((step) => step.order)).toEqual(
      result.exportSuggestion.steps.map((_, index) => index + 1),
    );
    expect(new Set(result.exportSuggestion.includedIngredientKeys).size).toBe(
      result.exportSuggestion.includedIngredientKeys.length,
    );

    const analysisKeys = new Set<string>();
    for (const ing of result.ingredients) {
      expect(ing.analysisKey.trim()).toBe(ing.analysisKey);
      expect(ing.analysisKey).not.toBe('');
      expect(analysisKeys.has(ing.analysisKey), `analysisKey must be unique: ${ing.analysisKey}`).toBe(false);
      analysisKeys.add(ing.analysisKey);
      expect(
        ['food', 'seasoning'],
        `ingredient.category must be 'food' or 'seasoning', got "${ing.category}"`,
      ).toContain(ing.category);
      expect(
        ing.amountGrams === null || typeof ing.amountGrams === 'number',
        `amountGrams must be number | null, got ${typeof ing.amountGrams}`,
      ).toBe(true);
      if (typeof ing.amountGrams === 'number') {
        expect(ing.amountGrams, `amountGrams must be positive`).toBeGreaterThan(0);
      }
      // food items must never carry a kitchen amount text
      if (ing.category === 'food') {
        expect(
          ing.kitchenAmountText,
          `food ingredient "${ing.displayName}": kitchenAmountText must be null`,
        ).toBeNull();
      }
    }

    for (const key of result.exportSuggestion.includedIngredientKeys) {
      expect(analysisKeys.has(key), `includedIngredientKeys must reference ${key}`).toBe(true);
      const ingredient = result.ingredients.find((item) => item.analysisKey === key);
      expect(ingredient?.category, `includedIngredientKeys must exclude seasoning: ${key}`).not.toBe('seasoning');
    }

    const sourceOrders = result.steps.map((step) => step.order);
    expect(sourceOrders).toEqual(sourceOrders.map((_, index) => index + 1));
    if (constraints.sourceStepCountExact !== undefined) {
      expect(
        result.steps.length,
        `expected exactly ${constraints.sourceStepCountExact} source steps for the numbered input; received: ${result.steps.map((step) => `${step.order}: ${step.description}`).join(' | ')}`,
      ).toBe(constraints.sourceStepCountExact);
    }
    const tracedOrders = result.exportSuggestion.steps.flatMap((step) => step.sourceStepOrders);
    const exportStepTrace = result.exportSuggestion.steps
      .map((step) => `${step.order} [${step.sourceStepOrders.join(',')}]: ${step.description}`)
      .join(' | ');
    expect(new Set(tracedOrders).size, `export step trace: ${exportStepTrace}`).toBe(tracedOrders.length);
    expect(tracedOrders.every((order, index) => sourceOrders.includes(order) &&
      (index === 0 || order > tracedOrders[index - 1]!)), `export step trace: ${exportStepTrace}`).toBe(true);
    for (const step of result.exportSuggestion.steps) {
      expect(step.description.trim()).not.toBe('');
      expect(step.description.length).toBeLessThanOrEqual(90);
      expect(step.sourceStepOrders.length).toBeGreaterThanOrEqual(1);
      expect(new Set(step.sourceStepOrders).size).toBe(step.sourceStepOrders.length);
      for (const key of step.ingredientKeys) {
        expect(analysisKeys.has(key), `ingredientKeys must reference ${key}`).toBe(true);
      }
    }

    // --- Layer 1: Portions range ---

    if (constraints.suggestedPortionsMin !== undefined) {
      expect(result.suggestedPortions).toBeGreaterThanOrEqual(constraints.suggestedPortionsMin);
    }
    if (constraints.suggestedPortionsMax !== undefined) {
      expect(result.suggestedPortions).toBeLessThanOrEqual(constraints.suggestedPortionsMax);
    }

    // --- Layer 3: No lost or invented ingredients (exact count) ---

    if (constraints.exactIngredientCount !== undefined) {
      expect(
        result.ingredients,
        `expected exactly ${constraints.exactIngredientCount} ingredients`,
      ).toHaveLength(constraints.exactIngredientCount);
    }

    // --- Layer 2: Semantic constraint assertions (from reviewed fixtures) ---

    for (const ic of constraints.ingredients) {
      assertIngredientConstraint(result.ingredients, ic);
    }

    expect(validateRecipeAnalyzeOutput(result)).toMatchObject({ ok: true });
  }, 100_000);
});

describe.skipIf(!hasCredentials)('recipePreparation: total-time provenance regression', () => {
  const cases: Array<{ id: string; preparation: openai.RecipePreparationContext; expected: number | null; retainedMinutes?: number[] }> = [
    ...RECIPE_PREPARATION_EVAL_FIXTURES.map((fixture) => ({
      id: fixture.id, preparation: fixture.preparation, expected: null,
      retainedMinutes: fixture.id === 'synthetic-saved-oven-seven-steps' ? [40]
        : fixture.id === 'synthetic-saved-pasta-essential-sauce' ? [15, 10] : [],
    })),
    {
      id: 'explicit-total-with-untimed-preparation',
      preparation: {
        ...RECIPE_PREPARATION_EVAL_FIXTURES[1]!.preparation,
        recipeContext: { ...RECIPE_PREPARATION_EVAL_FIXTURES[1]!.preparation.recipeContext,
          description: 'Gesamtzeit inklusive Vorbereitung und Backen: 50 Minuten.' },
      },
      expected: 50,
    },
    {
      id: 'completely-timed-explicit-sequence',
      preparation: {
        recipeContext: { name: 'Tomatensauce', portions: 2, tags: [], ingredients: [
          { displayName: 'Passierte Tomaten', amountGrams: 400, inputAmount: 400, unit: 'g' },
        ], description: 'Der gesamte Ablauf besteht nur aus den folgenden zwei Handlungen, ohne weitere Vorbereitung oder Arbeit. Fuehre sie nacheinander aus, nicht parallel.' },
        steps: [
          { order: 1, description: 'Ruehre die passierten Tomaten 5 Minuten im Topf.' },
          { order: 2, description: 'Koche die Tomaten erst nach Ende des Ruehrens 10 Minuten.' },
        ],
      },
      expected: 15,
    },
    {
      id: 'component-times-without-explicit-sequence',
      preparation: {
        recipeContext: { name: 'Pasta mit Sauce', portions: 2, tags: [], ingredients: [
          { displayName: 'Pasta', amountGrams: 200, inputAmount: 200, unit: 'g' },
          { displayName: 'Tomatensauce', amountGrams: 400, inputAmount: 400, unit: 'g' },
        ] },
        steps: [
          { order: 1, description: 'Koche die fertige Tomatensauce 15 Minuten.' },
          { order: 2, description: 'Koche die Pasta separat 10 Minuten.' },
        ],
      },
      expected: null,
    },
  ];

  it.each(cases)('[$id] uses only source-supported total time', async ({ preparation, expected, retainedMinutes }) => {
    const before = structuredClone(preparation);
    const result = await openai.prepareRecipeExport(preparation);
    expect(result.totalTimeMinutes).toBe(expected);
    for (const minutes of retainedMinutes ?? []) {
      expect(result.steps.map((step) => step.description).join(' '))
        .toMatch(new RegExp(`\\b${minutes}\\s*Min`, 'iu'));
    }
    expect(preparation).toEqual(before);
  });
});

describe.skipIf(!hasCredentials)('recipePreparation: synthetic saved-source live evaluation', () => {
  beforeAll(async () => {
    vi.stubEnv('COSMOS_ENDPOINT', '');
    vi.stubEnv('COSMOS_KEY', '');
    __resetRecipesRepositoryForTests();
    await setupTestAuth();
  });

  afterAll(() => {
    teardownTestAuth();
    __resetRecipesRepositoryForTests();
    vi.unstubAllEnvs();
  });

  it.each([
    ...RECIPE_PREPARATION_EVAL_FIXTURES.map((fixture) => ({ ...fixture, forcedInitial: undefined as openai.RecipeExportPreparationOutput | undefined })),
    RECIPE_PREPARATION_FORCED_DOUGH_FIXTURE,
  ])('[$id] preserves saved source and selective cooking core', async (fixture) => {
    const before = structuredClone(fixture.preparation);
    const repo = getRecipesRepository();
    const nutrition = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    const ingredients: RecipeIngredient[] = before.recipeContext.ingredients.map((ingredient, index) => ({
      ...ingredient,
      id: `synthetic-saved-ingredient-${index + 1}`,
      inputMode: 'grams',
      linkedProductId: null,
      linkedReusableItemId: null,
      isAiEstimate: false,
      category: ingredient.amountGrams === null ? 'seasoning' : 'food',
      nutritionPer100g: { ...nutrition },
      nutritionContribution: { ...nutrition },
    }));
    const saved = await repo.create(TEST_USER_ID, {
      ...before.recipeContext, ingredients, steps: before.steps,
      nutritionTotal: { ...nutrition }, nutritionPerPortion: { ...nutrition },
    });
    const savedBefore = structuredClone(await repo.getVersioned(TEST_USER_ID, saved.id));
    expect(savedBefore!.recipe.steps).toEqual(before.steps);
    expect(savedBefore!.recipe.ingredients.map(({ displayName, amountGrams, inputAmount, unit }) => ({
      displayName, amountGrams, inputAmount, unit,
    }))).toEqual(before.recipeContext.ingredients);
    expect({ name: saved.name, description: saved.description, portions: saved.portions, tags: saved.tags })
      .toEqual({ name: before.recipeContext.name, description: before.recipeContext.description, portions: before.recipeContext.portions, tags: before.recipeContext.tags });
    vi.mocked(enforceQuota).mockReset().mockResolvedValue(null);
    vi.mocked(trackUsage).mockReset().mockResolvedValue(undefined);
    const request = await makeAuthRequest({ params: { id: saved.id }, body: { contractVersion: 2 } });
    const provider = vi.spyOn(Completions.prototype, 'create');
    const analyzer = vi.spyOn(openai, 'prepareRecipeExport');
    const probe = vi.spyOn(renderer, 'probeInstagramRecipeDetailsGeneratedText');
    if (fixture.forcedInitial) analyzer.mockResolvedValueOnce(structuredClone(fixture.forcedInitial));
    const update = vi.spyOn(repo, 'update');
    const replace = vi.spyOn(repo, 'compareAndReplace');
    const create = vi.spyOn(repo, 'create');
    try {
      const response = await prepareRecipeExportViewHandler(request, makeContext());
      const outputs = await Promise.all(analyzer.mock.results.map(async (entry) => entry.type === 'return'
        ? Promise.resolve(entry.value).catch(() => undefined) : undefined));
      const providerResponses = await Promise.all(provider.mock.results.map(async (entry) => entry.type === 'return'
        ? Promise.resolve(entry.value).catch(() => undefined) : undefined));
      const probes = await Promise.all(probe.mock.results.map(async (entry) => entry.type === 'return'
        ? Promise.resolve(entry.value).catch(() => undefined) : undefined));
      const result = outputs.at(-1);
      const content = JSON.stringify(result);
      console.info('Synthetic preparation complete attempt evidence', JSON.stringify({
        fixture: fixture.id, initial: fixture.forcedInitial ? 'forced synthetic draft; no initial SDK operation' : 'natural real provider draft',
        attempts: analyzer.mock.calls.map(([original, options], index) => ({ logicalCall: index + 1,
          original, correction: options?.correction, timeout: options?.timeout,
          signalPresent: options?.signal instanceof AbortSignal, output: outputs[index], probe: probes[index] })),
        sdk: provider.mock.calls.map(([request, options], index) => ({ request,
          options: { maxRetries: options?.maxRetries, timeout: options?.timeout, signalPresent: options?.signal instanceof AbortSignal },
          finishReason: providerResponses[index]?.choices[0]?.finish_reason,
          raw: providerResponses[index]?.choices[0]?.message?.content })),
      }));
      const sourceMatrix = (fixture.constraints.sourceStepSemanticAssertions ?? []).map((assertion) => {
        const source = savedBefore!.recipe.steps.find((step) => step.order === assertion.sourceStepOrder);
        return {
          order: assertion.sourceStepOrder, detail: assertion.description,
          sourcePatterns: assertion.patterns.map((pattern) => !!source && pattern.test(source.description)),
        };
      });
      const exportCoreMatrix = (fixture.constraints.exportStepSemanticAssertions ?? []).map((assertion) => {
        const group = result?.steps.find((step) => step.sourceStepOrders.includes(assertion.sourceStepOrder));
        return {
          order: assertion.sourceStepOrder, core: assertion.description, group: group?.sourceStepOrders,
          exportPatterns: assertion.patterns.map((pattern) => !!group && pattern.test(group.description)),
          contradictions: (assertion.contradictions ?? []).map((pattern) => !!group && pattern.test(group.description)),
        };
      });
      console.info('Synthetic preparation semantic evidence', JSON.stringify({
        fixture: fixture.id, promptVersion: RECIPE_PREPARATION_PROMPT_VERSION,
        savedSource: savedBefore!.recipe.steps,
        raw: result, sourceMatrix, exportCoreMatrix,
        reviewMode: fixture.constraints.manualExportReview ? 'manual' : 'automated',
      }));
      console.info('Synthetic preparation counts and handler evidence', JSON.stringify({
        fixture: fixture.id, sdkCalls: provider.mock.calls.length, preparationCalls: analyzer.mock.calls.length,
        model: provider.mock.calls[0]?.[0].model, apiVersion: process.env['AZURE_OPENAI_API_VERSION'] ?? '2024-07-01',
        temperature: provider.mock.calls[0]?.[0].temperature, maxTokens: provider.mock.calls[0]?.[0].max_tokens,
        finishReasons: providerResponses.map((value) => value?.choices[0]?.finish_reason),
        sourceCount: savedBefore!.recipe.steps.length, exportCount: result?.steps.length,
        lengths: result?.steps.map((step) => step.description.length),
        status: response.status, usageCalls: vi.mocked(trackUsage).mock.calls.length,
        writes: { update: update.mock.calls.length, replace: replace.mock.calls.length, create: create.mock.calls.length },
        unchanged: JSON.stringify(await repo.getVersioned(TEST_USER_ID, saved.id)) === JSON.stringify(savedBefore),
      }));
      expect(analyzer.mock.calls.length).toBeGreaterThanOrEqual(fixture.forcedInitial ? 2 : 1);
      expect(analyzer.mock.calls.length).toBeLessThanOrEqual(3);
      expect(provider).toHaveBeenCalledTimes(analyzer.mock.calls.length - (fixture.forcedInitial ? 1 : 0));
      for (const [index, [original, options]] of analyzer.mock.calls.entries()) {
        expect(original).toEqual(before);
        expect(options?.signal).toBeInstanceOf(AbortSignal);
        expect(options?.signal).toBe(analyzer.mock.calls[0]![1]?.signal);
        expect(options?.timeout).toBeGreaterThan(0);
        expect(options?.timeout).toBeLessThanOrEqual(20_000);
        if (index === 0) expect(options?.correction).toBeUndefined();
        else {
          expect(options?.correction?.latestDraft).toEqual(outputs[index - 1]);
          expect(options?.correction?.validationErrors.length).toBeGreaterThan(0);
          const structural = validateRecipeExportPreparationOutput(outputs[index - 1], before.steps);
          if (!structural.ok) for (const error of structural.diagnostics) expect(options?.correction?.validationErrors).toContainEqual(error);
          for (const diagnostic of probes[index - 1]?.diagnostics ?? []) {
            if (diagnostic.status !== 'overflow' && diagnostic.status !== 'width-overflow') continue;
            expect(options?.correction?.validationErrors).toContainEqual(expect.objectContaining({
              phase: 'template', path: diagnostic.field === 'steps' ? `steps[${diagnostic.itemIndex}].description` : diagnostic.field,
              actual: { width: diagnostic.measured.width, ...('height' in diagnostic.measured ? { height: diagnostic.measured.height } : {}) },
              bounds: { width: diagnostic.measured.maxWidth, ...('maxHeight' in diagnostic.measured ? { height: diagnostic.measured.maxHeight } : {}), tolerance: 0.5 },
              font: expect.objectContaining({ size: diagnostic.fontSize }),
            }));
          }
        }
        if (fixture.forcedInitial && index === 0) continue;
        const sdkIndex = index - (fixture.forcedInitial ? 1 : 0);
        const [sdkRequest, sdkOptions] = provider.mock.calls[sdkIndex]!;
        expect(sdkRequest).toMatchObject({ temperature: 0.2, max_tokens: 2048 });
        if (sdkRequest.response_format?.type === 'json_schema' && sdkRequest.response_format.json_schema.name === 'recipe_text_correction') {
          const previous = outputs[index - 1]!;
          const targets = [...new Map(options!.correction!.validationErrors.map((error) => [error.path, error])).values()];
          expect(targets.every((error) => error.phase === 'template' && error.code === 'TEMPLATE_FIELD_OVERFLOW')).toBe(true);
          const fields = targets.map((error) => {
            const match = /^steps\[(\d+)\]\.description$/u.exec(error.path);
            const stepIndex = match ? Number(match[1]) : undefined;
            return { stepIndex, text: stepIndex === undefined ? previous.teaser : previous.steps[stepIndex]!.description,
              actual: error.actual, bounds: { width: error.bounds!.width,
                ...(error.bounds!.height !== undefined ? { height: error.bounds!.height } : {}) } };
          });
          expect(sdkRequest.messages).toEqual([
            { role: 'system', content: RECIPE_TEXT_CORRECTION_SYSTEM_PROMPT },
            { role: 'user', content: JSON.stringify({ texts: fields.map(({ text, actual, bounds }) => ({ text, actual, bounds, maxCharacters: openai.textCorrectionLimit(text, actual, bounds) })) }) },
          ]);
          expect(sdkRequest.response_format.json_schema).toMatchObject({ strict: true, schema: {
            additionalProperties: false, required: ['texts'], properties: { texts: { minItems: fields.length, maxItems: fields.length } },
          } });
          const shortened = JSON.parse(providerResponses[sdkIndex]!.choices[0]!.message.content!).texts as string[];
          const merged = structuredClone(previous);
          fields.forEach((field, textIndex) => {
            if (field.stepIndex === undefined) merged.teaser = shortened[textIndex]!;
            else merged.steps[field.stepIndex]!.description = shortened[textIndex]!;
          });
          expect(outputs[index]).toEqual(merged);
        } else expect(sdkRequest).toMatchObject({
          response_format: { type: 'json_schema', json_schema: { name: 'recipe_export_preparation', strict: true,
            schema: { additionalProperties: false, properties: { steps: { items: { additionalProperties: false } } } } } },
          messages: [{ role: 'system', content: options?.correction ? RECIPE_PREPARATION_CORRECTION_SYSTEM_PROMPT : RECIPE_PREPARATION_SYSTEM_PROMPT }, { role: 'user', content: JSON.stringify(options?.correction ? {
            originalPreparation: before, latestDraft: outputs[index - 1], validationErrors: options.correction.validationErrors,
          } : before) }],
        });
        expect(sdkOptions).toMatchObject({ maxRetries: 0, timeout: options?.timeout, signal: options?.signal });
        expect(providerResponses[sdkIndex]?.choices[0]?.finish_reason).toBe('stop');
      }
      if (fixture.forcedInitial) {
        expect(probes[0]?.status).toBe('generated-text-failure');
        expect(analyzer.mock.calls[1]![1]?.correction?.validationErrors).toContainEqual(expect.objectContaining({
          path: 'steps[0].description', actual: { width: 300, height: 112 }, bounds: { width: 302, height: 105, tolerance: 0.5 },
        }));
      }
      expect(enforceQuota).toHaveBeenCalledTimes(1);
      expect(enforceQuota).toHaveBeenCalledWith(expect.objectContaining({ userId: TEST_USER_ID }), 'recipe-analyze');
      expect(vi.mocked(enforceQuota).mock.invocationCallOrder[0]).toBeLessThan(provider.mock.invocationCallOrder[0]!);
      expect(update).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
      expect(await repo.getVersioned(TEST_USER_ID, saved.id)).toEqual(savedBefore);
      expect(fixture.preparation).toEqual(before);
      expect(result).toBeDefined();
      expect(validateRecipeExportPreparationOutput(result, savedBefore!.recipe.steps)).toMatchObject({ ok: true });
      expect(probes.at(-1)).toMatchObject({ ok: true, status: 'success' });
      expect(probe.mock.calls.at(-1)![0]).toEqual({ savedTitle: before.recipeContext.name, teaser: result!.teaser,
        steps: result!.steps.map((step) => step.description) });
      expect(result!.steps.length).toBeGreaterThanOrEqual(1);
      expect(result!.steps.length).toBeLessThanOrEqual(5);
      expect(result!.steps.map((step) => step.order)).toEqual(result!.steps.map((_, index) => index + 1));
      for (const step of result!.steps) {
        expect(step.sourceStepOrders.length).toBeGreaterThanOrEqual(1);
        expect(step.description.trim()).not.toBe('');
        expect(step.description.length).toBeLessThanOrEqual(90);
      }
      expect(response.status).toBe(200);
      expect(trackUsage).toHaveBeenCalledTimes(1);
      expect(trackUsage).toHaveBeenCalledWith(expect.objectContaining({ userId: TEST_USER_ID }), 'recipe-analyze');
      expect(vi.mocked(trackUsage).mock.invocationCallOrder[0]).toBeGreaterThan(provider.mock.invocationCallOrder.at(-1)!);
      expect(vi.mocked(trackUsage).mock.invocationCallOrder[0]).toBeGreaterThan(probe.mock.invocationCallOrder.at(-1)!);
      const body = response.jsonBody as PrepareRecipeExportViewResponseV2;
      expect(body).toEqual({
        contractVersion: 2, recipeId: saved.id, sourceEtag: savedBefore!.etag,
        suggestion: {
          version: 1, teaser: result!.teaser,
          totalTimeMinutes: result!.totalTimeMinutes, difficulty: result!.difficulty,
          steps: result!.steps.map(({ order, description }) => ({ order, description })),
        },
      });
      for (const ingredient of saved.ingredients) {
        expect(JSON.stringify(body)).not.toContain(ingredient.id);
        expect(content).not.toContain(ingredient.id);
      }
      console.info('Synthetic preparation executed protection assertions', JSON.stringify({
        fixture: fixture.id, v2Body: true, quotaOrder: true, usageOrder: true, noWrites: true,
        savedSourceUnchanged: true, compactSchema: true, sdkCalls: provider.mock.calls.length,
        logicalCalls: analyzer.mock.calls.length, finalProbeFit: true, usageCalls: 1,
      }));
      assertRecipePreparationMetadata(result!, fixture.constraints);
      if (fixture.constraints.manualExportReview) {
        console.info('Synthetic preparation manual content review required', JSON.stringify({
          fixture: fixture.id, status: 'MANUAL_VALIDATION_REQUIRED',
          original: before, generated: result,
        }));
      } else {
        assertRecipePreparationSemantics(result!, savedBefore!.recipe.steps, fixture.constraints);
        console.info('Synthetic preparation executed semantic assertions', JSON.stringify({ fixture: fixture.id, semanticPassed: true }));
      }
    } finally {
      provider.mockRestore();
      analyzer.mockRestore();
      probe.mockRestore();
      update.mockRestore();
      replace.mockRestore();
      create.mockRestore();
    }
  }, 100_000);
});
