import { afterEach, describe, expect, it, vi } from 'vitest';
import { __setOpenAiClientForTests, analyzeRecipeText, prepareRecipeExport, RecipeAnalysisContractError, type RecipePreparationContext } from './openai';
import { prepareValidatedRecipeExport } from './recipePreparation';
import { RECIPE_PREPARATION_SYSTEM_PROMPT, RECIPE_PREPARATION_CORRECTION_SYSTEM_PROMPT, RECIPE_TEXT_CORRECTION_SYSTEM_PROMPT } from './prompts/recipeAnalyze';

afterEach(() => {
  __setOpenAiClientForTests(null);
});

describe('analyzeRecipeText structured output schema', () => {
  it('requires positive numeric ingredient amounts while allowing null', async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ ingredients: [] }) } }],
    });
    __setOpenAiClientForTests({ chat: { completions: { create } } } as never);

    await analyzeRecipeText('Gemüse in der Pfanne garen.');

    const request = create.mock.calls[0]?.[0] as {
      response_format: {
        json_schema: {
          schema: {
            properties: {
              ingredients: {
                items: {
                  properties: {
                    amountGrams: { type: readonly string[]; minimum: number };
                  };
                };
              };
            };
          };
        };
      };
    };
    const amountGramsSchema = request.response_format.json_schema.schema.properties.ingredients.items.properties.amountGrams;

    expect(amountGramsSchema.type).toEqual(['number', 'null']);
    expect(amountGramsSchema.minimum).toBeGreaterThan(0);
  });
});

describe('B-2 Preparation SDK contract', () => {
  const context: RecipePreparationContext = {
    recipeContext: { name: 'Brot', portions: 2, tags: [], ingredients: [{ displayName: 'Mehl', amountGrams: 100, inputAmount: 100, unit: 'g' }] },
    steps: [{ order: 3, description: 'Mische Mehl und Wasser.' }, { order: 7, description: 'Backe den Teig.' }],
  };
  const output = { version: 1, teaser: 'Brot', totalTimeMinutes: null, difficulty: null,
    steps: [{ order: 1, description: 'Mische den Teig.', sourceStepOrders: [3] }, { order: 2, description: 'Backe den Teig.', sourceStepOrders: [7] }] };
  const completion = (value: unknown) => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] });

  it('sends only overflowing text and its measured bounds, then preserves the rest of the draft', async () => {
    const latestDraft = structuredClone(output);
    latestDraft.steps[0]!.description = 'Vermische Mehl, Quark, Zucker, Backpulver, Ei, Kerne und Salz zu einem Teig.';
    const shortened = 'Mische Mehl, Quark, Zucker, Backpulver, Ei, Kerne und Salz zu Teig.';
    const create = vi.fn().mockResolvedValue(completion({ texts: [shortened] }));
    __setOpenAiClientForTests({ chat: { completions: { create } } } as never);
    const before = structuredClone(latestDraft);
    const result = await prepareRecipeExport(context, { correction: { latestDraft, validationErrors: [{
      phase: 'template', code: 'TEMPLATE_FIELD_OVERFLOW', path: 'steps[0].description', stepIndex: 0,
      actual: { width: 300, height: 112 }, bounds: { width: 302, height: 105, tolerance: 0.5 },
    }] } });
    expect(JSON.parse(create.mock.calls[0]![0].messages[1].content)).toEqual({ texts: [{
      text: before.steps[0]!.description, actual: { width: 300, height: 112 }, bounds: { width: 302, height: 105 }, maxCharacters: 53,
    }] });
    expect(create.mock.calls[0]![0].response_format.json_schema.name).toBe('recipe_text_correction');
    expect(create.mock.calls[0]![0].messages[0].content).toBe(RECIPE_TEXT_CORRECTION_SYSTEM_PROMPT);
    expect(create.mock.calls[0]![1]).toMatchObject({ maxRetries: 0, timeout: 20_000, signal: undefined });
    expect(result).toEqual({ ...before, steps: [{ ...before.steps[0], description: shortened }, before.steps[1]] });
    expect(latestDraft).toEqual(before);
    expect(JSON.stringify(create.mock.calls[0]![0])).not.toContain('originalPreparation');
    expect(JSON.stringify(create.mock.calls[0]![0])).not.toContain('ingredients');
  });

  it('uses the unchanged small schema for initial and structural requests with bounded SDK options', async () => {
    const create = vi.fn().mockResolvedValue(completion(output));
    __setOpenAiClientForTests({ chat: { completions: { create } } } as never);
    const controller = new AbortController();
    const validationErrors = [{ phase: 'schema' as const, code: 'invalid_type', path: 'totalTimeMinutes' }];
    await prepareRecipeExport(context, { signal: controller.signal, timeout: 30_000 });
    await prepareRecipeExport(context, { signal: controller.signal, timeout: 1234, correction: { latestDraft: output, validationErrors } });
    for (const [request, options] of create.mock.calls) {
      expect(request).toMatchObject({ temperature: 0.2, max_tokens: 2048,
        messages: [{ role: 'system' }, { role: 'user' }],
        response_format: { type: 'json_schema', json_schema: { name: 'recipe_export_preparation', strict: true,
          schema: { additionalProperties: false, required: ['version', 'teaser', 'totalTimeMinutes', 'difficulty', 'steps'],
            properties: { teaser: { maxLength: 96 }, totalTimeMinutes: { maximum: 10080 }, steps: { minItems: 1, maxItems: 5,
              items: { additionalProperties: false, required: ['order', 'description', 'sourceStepOrders'], properties: { description: { maxLength: 90 } } } } } } } } });
      expect(options).toMatchObject({ maxRetries: 0, signal: controller.signal });
    }
    expect(create.mock.calls[0]![1].timeout).toBe(20_000);
    expect(create.mock.calls[1]![1].timeout).toBe(1234);
    expect(create.mock.calls[0]![0].messages[0].content).toBe(RECIPE_PREPARATION_SYSTEM_PROMPT);
    expect(create.mock.calls[0]![0].messages[0].content).not.toContain('Bei einer Korrektur');
    expect(create.mock.calls[0]![0].messages[0].content).not.toContain('Bei Textüberlauf');
    expect(create.mock.calls[1]![0].messages[0].content).not.toBe(RECIPE_PREPARATION_SYSTEM_PROMPT);
    expect(create.mock.calls[1]![0].messages[0].content).toBe(RECIPE_PREPARATION_CORRECTION_SYSTEM_PROMPT);
    expect(create).toHaveBeenCalledTimes(2);
    expect(JSON.parse(create.mock.calls[0]![0].messages[1].content)).toEqual(context);
    expect(JSON.parse(create.mock.calls[1]![0].messages[1].content)).toEqual({ originalPreparation: context, latestDraft: output, validationErrors });
    create.mockResolvedValueOnce(completion({ ingredients: [] }));
    await analyzeRecipeText('Import unchanged');
    expect(create.mock.calls[2]![1]).toEqual({ timeout: 30_000, maxRetries: 1 });
    expect(create.mock.calls[2]![0].response_format.json_schema.name).toBe('recipe_analyze');
  });

  it('returns a full draft ordered by first source reference even if the model emits groups out of order', async () => {
    const swapped = structuredClone(output);
    swapped.steps.reverse();
    const create = vi.fn().mockResolvedValue(completion(swapped));
    __setOpenAiClientForTests({ chat: { completions: { create } } } as never);
    expect(await prepareRecipeExport(context)).toEqual(output);
  });

  it('corrects mixed reference and overflow errors together without another shortening call', async () => {
    const create = vi.fn().mockResolvedValue(completion(output));
    __setOpenAiClientForTests({ chat: { completions: { create } } } as never);
    const latestDraft = structuredClone(output);
    latestDraft.steps.reverse();
    const validationErrors = [
      { phase: 'semantic' as const, code: 'export_source_trace_not_ascending', path: 'steps[0].sourceStepOrders' },
      { phase: 'template' as const, code: 'TEMPLATE_FIELD_OVERFLOW', path: 'steps[1].description', stepIndex: 1,
        actual: { width: 300, height: 112 }, bounds: { width: 302, height: 105, tolerance: 0.5 } },
    ];
    const before = structuredClone(latestDraft);
    expect(await prepareRecipeExport(context, { correction: { latestDraft, validationErrors } })).toEqual(output);
    expect(create).toHaveBeenCalledTimes(1);
    const request = create.mock.calls[0]![0];
    expect(request.messages[0].content).toBe(RECIPE_PREPARATION_CORRECTION_SYSTEM_PROMPT);
    expect(JSON.parse(request.messages[1].content)).toEqual({ originalPreparation: context, latestDraft: before, validationErrors });
    expect(request.response_format.json_schema.name).toBe('recipe_export_preparation');
    expect(latestDraft).toEqual(before);
  });

  it('corrects teaser and step together in one call without inventing height for width-only overflow', async () => {
    const create = vi.fn().mockResolvedValue(completion({ texts: ['Kurzes Brot', 'Mische Teig.'] }));
    __setOpenAiClientForTests({ chat: { completions: { create } } } as never);
    const latestDraft = structuredClone(output);
    const validationErrors = [
      { phase: 'template' as const, code: 'TEMPLATE_FIELD_OVERFLOW', path: 'teaser',
        actual: { width: 500 }, bounds: { width: 461, tolerance: 0.5 } },
      { phase: 'template' as const, code: 'TEMPLATE_FIELD_OVERFLOW', path: 'steps[0].description', stepIndex: 0,
        actual: { width: 300, height: 112 }, bounds: { width: 302, height: 105, tolerance: 0.5 } },
    ];
    const result = await prepareRecipeExport(context, { correction: { latestDraft, validationErrors } });
    expect(create).toHaveBeenCalledTimes(1);
    expect(JSON.parse(create.mock.calls[0]![0].messages[1].content).texts).toEqual([
      { text: latestDraft.teaser, actual: { width: 500 }, bounds: { width: 461 }, maxCharacters: 10 },
      { text: latestDraft.steps[0]!.description, actual: { width: 300, height: 112 }, bounds: { width: 302, height: 105 }, maxCharacters: 11 },
    ]);
    expect(result).toEqual({ ...latestDraft, teaser: 'Kurzes Brot',
      steps: [{ ...latestDraft.steps[0], description: 'Mische Teig.' }, latestDraft.steps[1]] });
  });

  it.each([
    { texts: [] }, { texts: ['Short.', 'Extra.'] }, { texts: [' '] },
    { texts: [42] }, { texts: ['Short.'], steps: [] },
  ])('rejects malformed text correction response %j without changing the draft', async (value) => {
    const create = vi.fn().mockResolvedValue(completion(value));
    __setOpenAiClientForTests({ chat: { completions: { create } } } as never);
    const latestDraft = structuredClone(output);
    await expect(prepareRecipeExport(context, { correction: { latestDraft, validationErrors: [{
      phase: 'template', code: 'TEMPLATE_FIELD_OVERFLOW', path: 'steps[0].description', stepIndex: 0,
      actual: { width: 300, height: 112 }, bounds: { width: 302, height: 105, tolerance: 0.5 },
    }] } })).rejects.toThrow();
    expect(latestDraft).toEqual(output);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('binds all three real SDK operations to unchanged original and the latest whole parsed draft and diagnostics', async () => {
    const first = { ...output, totalTimeMinutes: -1 };
    const second = { ...output, difficulty: 'bad\nmetadata' };
    const create = vi.fn().mockResolvedValueOnce(completion(first)).mockResolvedValueOnce(completion(second)).mockResolvedValueOnce(completion(output));
    __setOpenAiClientForTests({ chat: { completions: { create } } } as never);
    expect(await prepareValidatedRecipeExport(context)).toMatchObject({ status: 'success', logicalCalls: 3, corrections: 2 });
    expect(create).toHaveBeenCalledTimes(3);
    for (const [index, [request, options]] of create.mock.calls.entries()) {
      expect(request.messages[0].content).toBe(index === 0 ? RECIPE_PREPARATION_SYSTEM_PROMPT : RECIPE_PREPARATION_CORRECTION_SYSTEM_PROMPT);
      expect(options).toMatchObject({ maxRetries: 0, timeout: expect.any(Number), signal: expect.any(AbortSignal) });
      const input = JSON.parse(request.messages[1].content);
      if (index === 0) expect(input).toEqual(context);
      else {
        expect(input.originalPreparation).toEqual(context);
        expect(input.latestDraft).toEqual(index === 1 ? first : second);
        expect(input.validationErrors).toContainEqual(expect.objectContaining({ path: index === 1 ? 'totalTimeMinutes' : 'difficulty' }));
      }
    }
    expect(create.mock.calls[0]![1].signal).toBe(create.mock.calls[2]![1].signal);
  });

  it.each([0, 1, 2].flatMap((attempt) => ['empty', 'parse', 'refusal', 'truncation', 'transport'].map((kind) => ({ attempt, kind }))))(
    'terminates $kind at SDK attempt $attempt without retries or correction', async ({ attempt, kind }) => {
      const create = vi.fn().mockImplementation(async () => {
        if (create.mock.calls.length <= attempt) return completion({ ...output, totalTimeMinutes: -1 });
        if (kind === 'transport') throw new Error('PRIVATE_TRANSPORT_DETAIL');
        return { choices: [{ finish_reason: kind === 'truncation' ? 'length' : 'stop', message: {
          content: kind === 'empty' ? '' : kind === 'parse' ? '{PRIVATE_PARSE' : JSON.stringify(output),
          ...(kind === 'refusal' ? { refusal: 'PRIVATE_REFUSAL' } : {}),
        } }] };
      });
      __setOpenAiClientForTests({ chat: { completions: { create } } } as never);
      expect(await prepareValidatedRecipeExport(context)).toMatchObject({ status: 'terminal', kind: 'provider', logicalCalls: attempt + 1 });
      expect(create).toHaveBeenCalledTimes(attempt + 1);
      expect(create.mock.calls.every((call) => call[1].maxRetries === 0)).toBe(true);
    },
  );
});

describe('analyzeRecipeText import contract enforcement', () => {
  const src = (order: number, cookingEssential: boolean) => ({ order, title: null, description: `Schritt ${order}`, cookingEssential });
  const exp = (order: number, refs: number[]) => ({ order, description: `Export ${order}`, sourceStepOrders: refs, ingredientKeys: [] });
  const analysis = (steps: ReturnType<typeof src>[], exportSteps: ReturnType<typeof exp>[]) => ({ suggestedName: 'X', description: 'Y', suggestedPortions: 2,
    tags: [], ingredients: [], steps, exportSuggestion: { version: 1, teaser: 'T', totalTimeMinutes: null, difficulty: null, steps: exportSteps, includedIngredientKeys: [] } });
  const completion = (value: unknown) => ({ choices: [{ message: { content: JSON.stringify(value) } }] });
  const numbered = 'Zutaten: a\nZubereitung:\n1. Eins.\n2. Zwei.\n3. Drei.';

  it('strips the cookingEssential planning flag and does not retry a consistent analysis', async () => {
    const create = vi.fn().mockResolvedValue(completion(analysis([src(1, true), src(2, false), src(3, false)], [exp(1, [1])])));
    __setOpenAiClientForTests({ chat: { completions: { create } } } as never);
    const result = await analyzeRecipeText(numbered);
    expect(create).toHaveBeenCalledTimes(1);
    expect(result.steps.every((step) => !('cookingEssential' in step))).toBe(true);
  });

  it('asks once for a correction when an essential cooking step is not referenced', async () => {
    const bad = analysis([src(1, true), src(2, true), src(3, false)], [exp(1, [1])]);
    const good = analysis([src(1, true), src(2, true), src(3, false)], [exp(1, [1]), exp(2, [2])]);
    const create = vi.fn().mockResolvedValueOnce(completion(bad)).mockResolvedValueOnce(completion(good));
    __setOpenAiClientForTests({ chat: { completions: { create } } } as never);
    const result = await analyzeRecipeText(numbered);
    expect(create).toHaveBeenCalledTimes(2);
    const retryMessages = create.mock.calls[1]![0].messages;
    expect(retryMessages).toHaveLength(4);
    expect(retryMessages[2]).toEqual({ role: 'assistant', content: JSON.stringify(bad) });
    expect(retryMessages[3].content).toContain('Quellschritte 2');
    expect(result.exportSuggestion.steps).toHaveLength(2);
  });

  it('fails in a controlled way when numbered input stays merged after two corrections', async () => {
    const merged = analysis([src(1, false), src(2, false)], [exp(1, [1])]);
    const create = vi.fn().mockResolvedValue(completion(merged));
    __setOpenAiClientForTests({ chat: { completions: { create } } } as never);
    const error = await analyzeRecipeText(numbered).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RecipeAnalysisContractError);
    expect((error as RecipeAnalysisContractError).details.join(' ')).toContain('3 nummerierte Anweisungen');
    expect(create).toHaveBeenCalledTimes(3);
    expect(create.mock.calls[1]![0].messages[3].content).toContain('3 nummerierte Anweisungen');
  });

  it('does not enforce the numbered-step count without a preparation heading', async () => {
    const create = vi.fn().mockResolvedValue(completion(analysis([src(1, false), src(2, false)], [exp(1, [1])])));
    __setOpenAiClientForTests({ chat: { completions: { create } } } as never);
    await analyzeRecipeText('1. 200 g Mehl\n2. 100 g Quark\n3. 1 Ei');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('repairs an interleaved trace by moving references only, never dropping steps or changing texts', async () => {
    const interleaved = analysis([src(1, false), src(2, false), src(3, false)], [exp(1, [1, 3]), exp(2, [2])]);
    const create = vi.fn().mockResolvedValue(completion(interleaved));
    __setOpenAiClientForTests({ chat: { completions: { create } } } as never);
    const result = await analyzeRecipeText('Freitext ohne Nummern');
    expect(create).toHaveBeenCalledTimes(3);
    expect(result.exportSuggestion.steps.map((step) => step.description)).toEqual(['Export 1', 'Export 2']);
    expect(result.exportSuggestion.steps.map((step) => step.sourceStepOrders)).toEqual([[1, 2], [3]]);
  });

  it('fails in a controlled way when the trace cannot be repaired without dropping a step', async () => {
    const duplicated = analysis([src(1, false), src(2, false), src(3, false)], [exp(1, [1]), exp(2, [1])]);
    const create = vi.fn().mockResolvedValue(completion(duplicated));
    __setOpenAiClientForTests({ chat: { completions: { create } } } as never);
    await expect(analyzeRecipeText(numbered)).rejects.toMatchObject({ details: [expect.stringContaining('globally unique')] });
    expect(create).toHaveBeenCalledTimes(3);
  });

  it('serves an unreferenced cookingEssential step after the corrections when the input has no numbered instructions', async () => {
    const create = vi.fn().mockResolvedValue(completion(analysis([src(1, true), src(2, false)], [exp(1, [2])])));
    __setOpenAiClientForTests({ chat: { completions: { create } } } as never);
    const result = await analyzeRecipeText('200 g Mehl, 100 g Quark');
    expect(create).toHaveBeenCalledTimes(3);
    expect(result.exportSuggestion.steps).toHaveLength(1);
  });

  it('blocks an unreferenced cookingEssential step after the corrections when the input has numbered instructions', async () => {
    const create = vi.fn().mockResolvedValue(completion(analysis([src(1, true), src(2, false), src(3, false)], [exp(1, [2])])));
    __setOpenAiClientForTests({ chat: { completions: { create } } } as never);
    await expect(analyzeRecipeText(numbered)).rejects.toMatchObject({ details: [expect.stringContaining('cookingEssential')] });
  });

  it('feeds server contract violations such as duplicate export references back to the model', async () => {
    const dup = analysis([src(1, false), src(2, false), src(3, false)], [exp(1, [1, 2]), exp(2, [2, 3])]);
    const ok = analysis([src(1, false), src(2, false), src(3, false)], [exp(1, [1, 2]), exp(2, [3])]);
    const create = vi.fn().mockResolvedValueOnce(completion(dup)).mockResolvedValueOnce(completion(ok));
    __setOpenAiClientForTests({ chat: { completions: { create } } } as never);
    const result = await analyzeRecipeText(numbered);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1]![0].messages[3].content).toContain('globally unique');
    expect(result.exportSuggestion.steps[1]!.sourceStepOrders).toEqual([3]);
  });

  it('feeds back a temperature in the export text that the referenced source does not contain', async () => {
    const invented = analysis([src(1, false), src(2, false), src(3, false)], [{ ...exp(1, [1]), description: 'Backe bei 220 Grad.' }]);
    const ok = analysis([src(1, false), src(2, false), src(3, false)], [{ ...exp(1, [1]), description: 'Backe das Brot.' }]);
    const create = vi.fn().mockResolvedValueOnce(completion(invented)).mockResolvedValueOnce(completion(ok));
    __setOpenAiClientForTests({ chat: { completions: { create } } } as never);
    await analyzeRecipeText(numbered);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1]![0].messages[3].content).toContain('220 Grad');
  });

  it('orders export steps by first source reference', async () => {
    const create = vi.fn().mockResolvedValue(completion(analysis([src(1, false), src(2, false), src(3, false)], [exp(1, [1]), exp(2, [3]), exp(3, [2])])));
    __setOpenAiClientForTests({ chat: { completions: { create } } } as never);
    const result = await analyzeRecipeText('Freitext ohne Nummern');
    expect(result.exportSuggestion.steps.map((step) => [step.order, step.sourceStepOrders])).toEqual([[1, [1]], [2, [2]], [3, [3]]]);
  });
});
