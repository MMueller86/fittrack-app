import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareValidatedRecipeExport, recipePreparationAffectedFields } from './recipePreparation';
import { probeInstagramRecipeDetailsGeneratedText as realProbe } from './instagramRenderer';
import { validateRecipeExportPreparationOutput } from './recipeAnalyzeValidation';
import type { RecipePreparationContext, RecipeExportPreparationOutput } from './openai';
import { RECIPE_PREPARATION_PROMPT_VERSION, RECIPE_PREPARATION_SYSTEM_PROMPT, RECIPE_PREPARATION_CORRECTION_SYSTEM_PROMPT, RECIPE_TEXT_CORRECTION_SYSTEM_PROMPT } from './prompts/recipeAnalyze';
import { RECIPE_PREPARATION_EVAL_FIXTURES, assertRecipePreparationSemantics } from './prompts/recipeAnalyze.eval.fixtures';

afterEach(() => vi.useRealTimers());

const source: RecipePreparationContext = {
  recipeContext: { name: 'Quarkbroetchen', portions: 2, tags: [], ingredients: [] },
  steps: [1, 2, 3, 4, 5, 6, 7].map((order) => ({ order, description: 'Saved action.' })),
};
function draft(description = 'Mische den Teig.', count = 4): RecipeExportPreparationOutput {
  return { version: 1, teaser: 'Goldbraune Broetchen', totalTimeMinutes: null, difficulty: null,
    steps: Array.from({ length: count }, (_, index) => ({ order: index + 1, description, sourceStepOrders: [index + 1] })) };
}

describe('B-2 bounded Preparation loop', () => {
  it.each([RECIPE_PREPARATION_SYSTEM_PROMPT, RECIPE_PREPARATION_CORRECTION_SYSTEM_PROMPT])('CORR2 prioritizes essential cooking and decides time before compression', (prompt) => {
    expect(prompt).toContain('Entscheide totalTimeMinutes vor dem Zusammenfassen');
    expect(prompt).toContain('Gesamtzeit ausdrücklich genannt');
    expect(prompt).toContain('jede notwendige Handlung zeitlich belegt');
    expect(prompt).toContain('Beilagen nur zu nennen ersetzt ihr separates Garen nicht');
    expect(prompt).toContain('Garendpunkt vor optionalem Vorheizen, Ölerhitzen, Ruhen oder Servieren');
    expect(prompt).toContain('Prüfe die ersten Quellenverweise vor der Ausgabe');
    expect(prompt).not.toContain('totalTimeMinutes ist eine zuverlässig aus der Quelle ableitbare');
  });

  it('CORR2 shortening protects cooking before optional text', () => {
    expect(RECIPE_TEXT_CORRECTION_SYSTEM_PROMPT).toContain('Streiche zuerst optionale Formulierungen');
    expect(RECIPE_TEXT_CORRECTION_SYSTEM_PROMPT).toContain('separates Garen');
  });

  it.each([RECIPE_PREPARATION_SYSTEM_PROMPT, RECIPE_PREPARATION_CORRECTION_SYSTEM_PROMPT])('Q21 requires source-supported totals and cooking endpoints in full-output prompts', (prompt) => {
    expect(prompt).toContain('Garendpunkte');
    expect(prompt).toContain('Eine Garzeit ersetzt keine Garbedingung');
    expect(prompt).toContain('ausdrücklich genannte Gesamtzeit');
    expect(prompt).toContain('vollständig zeitlich belegten, ausdrücklich sequenziellen Ablauf');
    expect(prompt).toContain('Untimierte Vorbereitung');
    expect(prompt).toContain('unklare Überlappung');
    expect(prompt).toContain('keine geschätzten Zuschläge');
  });

  it('Q21 preserves cooking endpoints when shortening text without the original source', () => {
    expect(RECIPE_TEXT_CORRECTION_SYSTEM_PROMPT).toContain('Garendpunkte');
    expect(RECIPE_TEXT_CORRECTION_SYSTEM_PROMPT).toContain('Eine Garzeit ersetzt keine Garbedingung');
  });

  it.each([RECIPE_PREPARATION_SYSTEM_PROMPT, RECIPE_PREPARATION_CORRECTION_SYSTEM_PROMPT])('requires a concrete time-evidence check instead of promoting component durations', (prompt) => {
    expect(prompt).toContain('Beginne mit totalTimeMinutes = null');
    expect(prompt).toContain('Schrittnummern belegen keine zeitliche Sequenz');
    expect(prompt).toContain('separat bedeutet nicht nacheinander');
    expect(prompt).toContain('40 Minuten bleiben im Backschritt erhalten');
    expect(prompt).toContain('15 und 10 Minuten bleiben bei Sauce und Pasta erhalten');
  });

  it('QA-R1 explicitly directs correction at the measured failing field, not fitting neighbours', () => {
    expect(RECIPE_PREPARATION_PROMPT_VERSION).toBe('v12');
    expect(RECIPE_TEXT_CORRECTION_SYSTEM_PROMPT).toContain('Kürze die übergebenen Rezepttexte deutlich');
    expect(RECIPE_TEXT_CORRECTION_SYSTEM_PROMPT).not.toContain('originalPreparation');
    expect(RECIPE_PREPARATION_SYSTEM_PROMPT).not.toContain('latestDraft');
    expect(RECIPE_PREPARATION_SYSTEM_PROMPT).not.toContain('validationErrors');
    expect(RECIPE_PREPARATION_CORRECTION_SYSTEM_PROMPT).toContain('path und stepIndex sind nullbasiert');
    expect(RECIPE_PREPARATION_CORRECTION_SYSTEM_PROMPT).toContain('unter dem Zeichenlimit');
    expect(RECIPE_PREPARATION_CORRECTION_SYSTEM_PROMPT).toContain('nicht unverändert übernehmen');
    expect(RECIPE_PREPARATION_CORRECTION_SYSTEM_PROMPT).toContain('nur andere, bereits passende Texte');
    expect(RECIPE_PREPARATION_CORRECTION_SYSTEM_PROMPT).toContain('erstelle keinen neuen Vorschlag');
    expect(RECIPE_PREPARATION_SYSTEM_PROMPT).toContain('Du entscheidest selbst, welche Handlungen du zusammenfasst');
    expect(RECIPE_PREPARATION_SYSTEM_PROMPT).toContain('Selbsterklärende Schritte und nachrangige Details dürfen entfallen');
    expect(RECIPE_PREPARATION_SYSTEM_PROMPT).toContain('Behalte die Reihenfolge der enthaltenen Handlungen aus dem Originalrezept bei');
    expect(RECIPE_PREPARATION_CORRECTION_SYSTEM_PROMPT).toContain('Bei Reihenfolgefehlern stelle die betroffenen vollständigen Exportschritte um');
    expect(RECIPE_PREPARATION_SYSTEM_PROMPT).not.toContain('nur aufeinanderfolgende Schritte');
  });

  it('QA-R1 reproduces the recorded oven field and preserves cooking core in a complete corrected draft', async () => {
    const fixture = RECIPE_PREPARATION_EVAL_FIXTURES[1]!;
    const initial: RecipeExportPreparationOutput = { version: 1, teaser: 'Ein einfacher und leckerer Kartoffelauflauf aus dem Ofen.',
      totalTimeMinutes: 50, difficulty: 'einfach', steps: [
        { order: 1, description: 'Schneide die Kartoffeln in dünne Scheiben und fette die Auflaufform ein.', sourceStepOrders: [1, 2] },
        { order: 2, description: 'Schichte die Kartoffeln in die Form, gieße die Sahne darüber und streue den Käse.', sourceStepOrders: [3, 4] },
        { order: 3, description: 'Heize den Ofen auf 180°C vor und backe den Auflauf für 40 Minuten.', sourceStepOrders: [5, 6] },
        { order: 4, description: 'Lasse den Auflauf kurz ruhen und serviere ihn.', sourceStepOrders: [7] },
      ] };
    const corrected = structuredClone(initial);
    corrected.totalTimeMinutes = null;
    corrected.steps[1]!.description = 'Schichte Kartoffeln mit Sahne in die Form und streue Käse darüber.';
    corrected.steps[2]!.description = 'Backe Kartoffeln bei 180°C für 40 Min., bis sie gar sind.';
    const generate = vi.fn().mockResolvedValueOnce(initial).mockResolvedValueOnce(initial).mockResolvedValueOnce(corrected);
    const before = structuredClone(fixture.preparation);
    const result = await prepareValidatedRecipeExport(fixture.preparation, { generate });
    expect(result).toMatchObject({ status: 'success', logicalCalls: 3, corrections: 2, data: corrected });
    for (const call of generate.mock.calls.slice(1)) {
      expect(call[0]).toEqual(before);
      expect(call[1].correction.latestDraft).toEqual(initial);
      expect(call[1].correction.validationErrors).toEqual([expect.objectContaining({ path: 'steps[1].description', stepIndex: 1,
        stepOrder: 2, actual: { width: 300, height: 112 }, bounds: { width: 302, height: 105, tolerance: 0.5 } })]);
    }
    assertRecipePreparationSemantics(corrected, before.steps, fixture.constraints);
    expect(fixture.constraints.manualExportReview).toBe(true);
    expect(fixture.preparation).toEqual(before);
  });

  it('QA-R1 excludes nested unknown-key-only diagnostics from affected text', () => {
    const output = draft('Mische den Teig.', 1);
    Object.assign(output.steps[0]!, { extra: 'UNKNOWN_OBJECT_SENTINEL' });
    const validation = validateRecipeExportPreparationOutput(output, source.steps);
    expect(validation.ok).toBe(false);
    if (validation.ok) throw new Error('Expected unknown-key rejection');
    expect(validation.diagnostics).toMatchObject([{ phase: 'schema', code: 'unrecognized_keys', path: 'steps[0]' }]);
    expect(recipePreparationAffectedFields(output, validation.diagnostics)).toEqual([]);
  });

  it('QA-R1 keeps nonstring affected values metadata-only', () => {
    const output = { ...draft(), teaser: { secret: 'NONSTRING_SENTINEL' }, difficulty: 42,
      steps: [{ order: 1, description: { secret: 'NONSTRING_SENTINEL' }, sourceStepOrders: [1] }] };
    const validation = validateRecipeExportPreparationOutput(output, source.steps);
    expect(validation.ok).toBe(false);
    if (validation.ok) throw new Error('Expected nonstring rejection');
    expect(recipePreparationAffectedFields(output, validation.diagnostics)).toEqual([]);
  });

  it.each([4, 5])('QA-R1 uses production step and teaser font metadata for %i steps', async (count) => {
    const output = draft('Mische den Teig.', count);
    output.steps[0]!.description = 'W'.repeat(90);
    output.teaser = 'W'.repeat(96);
    const generate = vi.fn().mockResolvedValue(output);
    const result = await prepareValidatedRecipeExport(source, { generate });
    expect(result.status).toBe('exhausted');
    if (result.status !== 'exhausted') throw new Error('Expected measured exhaustion');
    for (const errors of [result.diagnostics, ...generate.mock.calls.slice(1).map((call) => call[1].correction.validationErrors)]) {
      expect(errors).toContainEqual(expect.objectContaining({ path: 'steps[0].description',
        layout: count === 5 ? 'compact' : 'large', stepCount: count,
        font: { family: 'Inter', size: count === 5 ? 18 : 22, weight: 500, style: 'normal', lineHeight: count === 5 ? 1.17 : 1.25 } }));
      expect(errors).toContainEqual(expect.objectContaining({ path: 'teaser',
        font: { family: 'Inter', size: 18, weight: 500, style: 'italic', lineHeight: 1.25 } }));
    }
    const fields = recipePreparationAffectedFields(result.latestDraft, result.diagnostics);
    expect(fields).toHaveLength(2);
    expect(fields.find((field) => field.path === 'steps[0].description')!.diagnoses[0]!.font!.lineHeight).toBe(count === 5 ? 1.17 : 1.25);
    expect(generate).toHaveBeenCalledTimes(3);
  });

  it('extracts only exact known affected text for element-level schema references', () => {
    const output = draft();
    output.steps[0]!.description = 'Exact "text"\n\\untrimmed ';
    output.steps[0]!.sourceStepOrders = [-1];
    Object.assign(output.steps[0]!, { secret: 'UNKNOWN_OBJECT_SENTINEL' });
    const validation = validateRecipeExportPreparationOutput(output, source.steps);
    expect(validation.ok).toBe(false);
    if (validation.ok) throw new Error('Expected rejected reference');
    const fields = recipePreparationAffectedFields(output, validation.diagnostics);
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({ path: 'steps[0].description', stepIndex: 0, text: output.steps[0]!.description });
    expect(JSON.stringify(fields)).not.toContain('UNKNOWN_OBJECT_SENTINEL');
  });

  it.each([0, 1, 2])('succeeds after %i corrections with original context and latest draft only', async (corrections) => {
    const drafts: RecipeExportPreparationOutput[] = Array.from({ length: corrections }, (_, index) => ({ ...draft(), totalTimeMinutes: -index - 1 }));
    drafts.push(draft());
    const generate = vi.fn().mockImplementation(async () => drafts.shift());
    const before = structuredClone(source);
    const result = await prepareValidatedRecipeExport(source, { generate });
    expect(result).toMatchObject({ status: 'success', logicalCalls: corrections + 1, corrections });
    expect(generate).toHaveBeenCalledTimes(corrections + 1);
    for (const [index, call] of generate.mock.calls.entries()) {
      expect(call[0]).toEqual(before);
      expect(call[1]).toMatchObject({ timeout: expect.any(Number), signal: expect.any(AbortSignal) });
      if (index === 0) expect(call[1]).not.toHaveProperty('correction');
      else expect(call[1].correction.latestDraft.totalTimeMinutes).toBe(-index);
    }
    expect(source).toEqual(before);
  });

  it('corrects the real Alpha sentence at four steps without a mocked measurement', async () => {
    const initial = draft();
    initial.steps[0]!.description = 'Vermische Mehl, Quark, Zucker, Backpulver, Ei, Kerne und Salz zu einem Teig.';
    const corrected = structuredClone(initial);
    corrected.steps[0]!.description = 'Mische Mehl, Quark, Zucker, Backpulver, Ei, Kerne und Salz zu Teig.';
    const generate = vi.fn().mockResolvedValueOnce(initial).mockResolvedValueOnce(corrected);
    const result = await prepareValidatedRecipeExport(source, { generate });
    expect(result).toMatchObject({ status: 'success', logicalCalls: 2 });
    expect(generate.mock.calls[1]![1].correction.validationErrors).toContainEqual(expect.objectContaining({
      phase: 'template', path: 'steps[0].description', actual: { width: 300, height: 112 },
      bounds: { width: 302, height: 105, tolerance: 0.5 },
    }));
  });

  it('exhausts exactly three parsed drafts and returns only the latest diagnosis', async () => {
    const values = [-1, -2, -3].map((totalTimeMinutes) => ({ ...draft(), totalTimeMinutes }));
    const generate = vi.fn().mockImplementation(async () => values[generate.mock.calls.length - 1]);
    const result = await prepareValidatedRecipeExport(source, { generate });
    expect(result).toMatchObject({ status: 'exhausted', logicalCalls: 3, corrections: 2, latestDraft: values[2] });
    expect(generate).toHaveBeenCalledTimes(3);
  });

  it.each([4, 5])('recomputes all real geometry after changing from %i steps', async (count) => {
    const initial = { ...draft('Mische den Teig.', count), totalTimeMinutes: -1 };
    const final = draft('Mische den Teig.', count === 4 ? 5 : 4);
    const generate = vi.fn().mockResolvedValueOnce(initial).mockResolvedValueOnce(final);
    const { probeInstagramRecipeDetailsGeneratedText } = await import('./instagramRenderer');
    const probe = vi.fn(probeInstagramRecipeDetailsGeneratedText);
    expect(await prepareValidatedRecipeExport(source, { generate, probe })).toMatchObject({ status: 'success', logicalCalls: 2 });
    expect(probe.mock.calls.map(([input]) => input.steps.length)).toEqual([count, count === 4 ? 5 : 4]);
  });

  it.each(['unknown', 'duplicate', 'local-reverse', 'group-reverse', 'order', 'shape', 'text', 'metadata'] as const)(
    'fully revalidates %s introduced by a correction before another correction', async (kind) => {
      const initial = { ...draft(), totalTimeMinutes: -1 };
      const invalid = draft();
      if (kind === 'unknown') invalid.steps[0]!.sourceStepOrders = [99];
      if (kind === 'duplicate') invalid.steps[1]!.sourceStepOrders = [1];
      if (kind === 'local-reverse') invalid.steps[0]!.sourceStepOrders = [2, 1];
      if (kind === 'group-reverse') invalid.steps[0]!.sourceStepOrders = [5];
      if (kind === 'order') invalid.steps[0]!.order = 2;
      if (kind === 'shape') Object.assign(invalid, { ingredients: [{ secret: 'UNKNOWN_PAYLOAD' }] });
      if (kind === 'text') invalid.steps[0]!.description = '';
      if (kind === 'metadata') invalid.difficulty = ' easy ';
      const generate = vi.fn().mockResolvedValueOnce(initial).mockResolvedValueOnce(invalid).mockResolvedValueOnce(draft());
      const result = await prepareValidatedRecipeExport(source, { generate });
      expect(result).toMatchObject({ status: 'success', logicalCalls: 3 });
      expect(generate.mock.calls[2]![1].correction.latestDraft).toEqual(invalid);
      expect(generate.mock.calls[2]![1].correction.validationErrors.length).toBeGreaterThan(0);
      expect(generate.mock.calls.every(([context]) => JSON.stringify(context) === JSON.stringify(source))).toBe(true);
    },
  );

  it('retains FIRST-group interleaving, gaps and noncontiguous saved authority after correction', async () => {
    const saved = { ...source, steps: [1, 4, 5, 6, 9].map((order) => ({ order, description: 'Saved.' })) };
    const final = draft('Mische den Teig.', 2);
    final.steps[0]!.sourceStepOrders = [1, 4, 6];
    final.steps[1]!.sourceStepOrders = [5];
    const generate = vi.fn().mockResolvedValueOnce({ ...final, totalTimeMinutes: -1 }).mockResolvedValueOnce(final);
    expect(await prepareValidatedRecipeExport(saved, { generate })).toMatchObject({ status: 'success', logicalCalls: 2, data: final });
  });

  it('rechecks previously fitting text that regresses while correcting metadata', async () => {
    const initial = { ...draft(), totalTimeMinutes: -1 };
    const regression = draft();
    regression.steps[2]!.description = 'Vermische Mehl, Quark, Zucker, Backpulver, Ei, Kerne und Salz zu einem Teig.';
    const generate = vi.fn().mockResolvedValueOnce(initial).mockResolvedValueOnce(regression).mockResolvedValueOnce(draft());
    expect(await prepareValidatedRecipeExport(source, { generate })).toMatchObject({ status: 'success', logicalCalls: 3 });
    expect(generate.mock.calls[2]![1].correction.validationErrors).toContainEqual(expect.objectContaining({
      phase: 'template', path: 'steps[2].description', actual: { width: 300, height: 112 },
    }));
  });

  it.each([false, true])('collects existing teaser input failure and real overflowing steps, multi=%s', async (multi) => {
    const invalid = draft();
    invalid.teaser = 'Goldbraune\nBroetchen';
    if (multi) for (const step of invalid.steps) step.description = 'Vermische Mehl, Quark, Zucker, Backpulver, Ei, Kerne und Salz zu einem Teig.';
    const generate = vi.fn().mockResolvedValueOnce(invalid).mockResolvedValueOnce(draft());
    expect(await prepareValidatedRecipeExport(source, { generate })).toMatchObject({ status: 'success', logicalCalls: 2 });
    const errors = generate.mock.calls[1]![1].correction.validationErrors;
    expect(errors.filter((error: { phase: string }) => error.phase === 'template')).toHaveLength(multi ? 5 : 1);
    expect(errors).toContainEqual(expect.objectContaining({ path: 'teaser', code: 'INVALID_TEXT' }));
  });

  it.each([false, true])('uses real teaser width-only overflow with no invented height, multi=%s', async (multi) => {
    const invalid = draft();
    invalid.teaser = 'W'.repeat(96);
    if (multi) invalid.steps[0]!.description = 'W'.repeat(90);
    const generate = vi.fn().mockResolvedValueOnce(invalid).mockResolvedValueOnce(draft());
    expect(await prepareValidatedRecipeExport(source, { generate })).toMatchObject({ status: 'success', logicalCalls: 2 });
    const errors = generate.mock.calls[1]![1].correction.validationErrors;
    expect(errors).toHaveLength(multi ? 2 : 1);
    for (const error of errors) {
      expect(error).toMatchObject({ phase: 'template', code: 'TEMPLATE_FIELD_OVERFLOW', actual: { width: expect.any(Number) },
        bounds: { width: expect.any(Number), tolerance: 0.5 } });
      expect(error.actual.width).toBeGreaterThan(error.bounds.width);
      expect(error.actual).not.toHaveProperty('height');
      expect(error.bounds).not.toHaveProperty('height');
    }
    expect(errors[0].font).toMatchObject({ size: 18, style: 'italic' });
  });

  it('recomputes natural 4-to-5 fitting text when 5-to-4 regresses in the final correction', async () => {
    const alpha = 'Vermische Mehl, Quark, Zucker, Backpulver, Ei, Kerne und Salz zu einem Teig.';
    const four = draft();
    four.steps[0]!.description = alpha;
    const five = draft('Mische den Teig.', 5);
    five.steps[0]!.description = alpha;
    five.totalTimeMinutes = -1;
    const generate = vi.fn().mockResolvedValueOnce(four).mockResolvedValueOnce(five).mockResolvedValueOnce(four);
    const probe = vi.fn(realProbe);
    expect(await prepareValidatedRecipeExport(source, { generate, probe })).toMatchObject({ status: 'exhausted', logicalCalls: 3,
      diagnostics: [expect.objectContaining({ phase: 'template', path: 'steps[0].description', layout: 'large', actual: { width: 300, height: 112 } })] });
    expect(probe.mock.calls.map(([input]) => input.steps.length)).toEqual([4, 5, 4]);
    expect(generate.mock.calls[2]![1].correction.validationErrors).toHaveLength(1);
    expect(generate.mock.calls[2]![1].correction.validationErrors[0].path).toBe('totalTimeMinutes');
  });

  it.each([[], [{ order: 2, description: 'Saved.' }, { order: 1, description: 'Saved.' }], [{ order: 1, description: '' }]].map((steps) => ({ steps })))(
    'terminates invalid source before any work: $steps', async ({ steps }) => {
      const generate = vi.fn();
      const probe = vi.fn();
      expect(await prepareValidatedRecipeExport({ ...source, steps }, { generate, probe })).toMatchObject({ status: 'terminal', kind: 'source', logicalCalls: 0 });
      expect(generate).not.toHaveBeenCalled();
      expect(probe).not.toHaveBeenCalled();
    },
  );

  it.each([0, 1, 2])('terminates provider exception on attempt %i without another call', async (attempt) => {
    const generate = vi.fn().mockImplementation(async () => {
      if (generate.mock.calls.length === attempt + 1) throw new Error('PRIVATE_PROVIDER_PAYLOAD');
      return { ...draft(), totalTimeMinutes: -1 };
    });
    const result = await prepareValidatedRecipeExport(source, { generate });
    expect(result).toMatchObject({ status: 'terminal', kind: 'provider', logicalCalls: attempt + 1 });
    expect(generate).toHaveBeenCalledTimes(attempt + 1);
  });

  it.each(['missing', 'nonfinite', 'duplicate-index', 'absent-measured'] as const)(
    'treats %s probe measurements as technical even alongside correctable errors', async (kind) => {
      const output = draft();
      const result = await realProbe({ savedTitle: source.recipeContext.name, teaser: output.teaser, steps: output.steps.map((step) => step.description) });
      expect(result.status).toBe('success');
      if (kind === 'missing') result.diagnostics.pop();
      if (kind === 'nonfinite') {
        const entry = result.diagnostics.find((entry) => entry.field === 'steps' && 'measured' in entry)!;
        if ('measured' in entry) entry.measured.width = NaN;
      }
      if (kind === 'duplicate-index') {
        const entry = result.diagnostics.find((entry) => entry.field === 'steps')!;
        entry.itemIndex = 2;
      }
      if (kind === 'absent-measured') {
        const entry = result.diagnostics.find((entry) => entry.field === 'steps')!;
        Reflect.deleteProperty(entry, 'measured');
      }
      const generate = vi.fn().mockResolvedValue({ ...output, totalTimeMinutes: -1 });
      expect(await prepareValidatedRecipeExport(source, { generate, probe: vi.fn().mockResolvedValue(result) }))
        .toMatchObject({ status: 'terminal', kind: 'technical', logicalCalls: 1 });
      expect(generate).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['MISSING_ASSET', 'FONT_OR_SATORI_FAILED', 'NON_FINITE_MEASUREMENT'] as const)('gives %s technical probe precedence', async (code) => {
    const generate = vi.fn().mockResolvedValue({ ...draft(), totalTimeMinutes: -1 });
    const probe = vi.fn().mockResolvedValue({ ok: false, status: 'technical-failure', diagnostics: [], error: { code, message: 'PRIVATE_FONT_DETAIL' } });
    expect(await prepareValidatedRecipeExport(source, { generate, probe })).toMatchObject({ status: 'terminal', kind: 'technical', code, logicalCalls: 1 });
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('does not probe an unmeasurable shape or pretend partial fields fit', async () => {
    const generate = vi.fn().mockResolvedValue({ version: 1, teaser: 'Bread', steps: [{ description: 3 }] });
    const probe = vi.fn(realProbe);
    expect(await prepareValidatedRecipeExport(source, { generate, probe })).toMatchObject({ status: 'exhausted', logicalCalls: 3 });
    expect(probe).not.toHaveBeenCalled();
  });

  it('keeps immutable original context even if a provider mutates its copy', async () => {
    const before = structuredClone(source);
    const generate = vi.fn().mockImplementation(async (context) => {
      context.steps[0].description = 'MUTATED_PROVIDER_COPY';
      return generate.mock.calls.length === 1 ? { ...draft(), totalTimeMinutes: -1 } : draft();
    });
    expect(await prepareValidatedRecipeExport(source, { generate })).toMatchObject({ status: 'success', logicalCalls: 2 });
    expect(source).toEqual(before);
  });

  it('aborts a per-call timeout and discards late completed output without validation or correction', async () => {
    vi.useFakeTimers();
    let complete!: (output: RecipeExportPreparationOutput) => void;
    const generate = vi.fn().mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    const validate = vi.fn(validateRecipeExportPreparationOutput);
    const probe = vi.fn(realProbe);
    const pending = prepareValidatedRecipeExport(source, { generate, validate, probe, now: () => Date.now() });
    await vi.advanceTimersByTimeAsync(20_000);
    expect(await pending).toMatchObject({ status: 'terminal', kind: 'timeout', logicalCalls: 1 });
    expect(generate.mock.calls[0]![1].signal.aborted).toBe(true);
    complete(draft());
    await vi.advanceTimersByTimeAsync(1);
    expect(validate).not.toHaveBeenCalled();
    expect(probe).not.toHaveBeenCalled();
    expect(generate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds an async probe to remaining aggregate time and discards its late result', async () => {
    const output = draft();
    const measured = await realProbe({ savedTitle: source.recipeContext.name, teaser: output.teaser, steps: output.steps.map((step) => step.description) });
    vi.useFakeTimers();
    let complete!: (value: typeof measured) => void;
    const generate = vi.fn().mockResolvedValue(output);
    const probe = vi.fn().mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    const pending = prepareValidatedRecipeExport(source, { generate, probe, now: () => Date.now() });
    await vi.advanceTimersByTimeAsync(75_000);
    expect(await pending).toMatchObject({ status: 'terminal', kind: 'timeout', logicalCalls: 1 });
    complete(measured);
    await vi.advanceTimersByTimeAsync(1);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['provider', 'validation', 'probe', 'before-next'] as const)('checks aggregate deadline at %s boundary', async (boundary) => {
    let clock = 0;
    const generate = vi.fn().mockImplementation(async () => {
      if (boundary === 'provider') clock = 75_000;
      return { ...draft(), totalTimeMinutes: -1 };
    });
    const validate = vi.fn().mockImplementation((...args: Parameters<typeof validateRecipeExportPreparationOutput>) => {
      if (boundary === 'validation') clock = 75_000;
      return validateRecipeExportPreparationOutput(...args);
    });
    const probe = vi.fn().mockImplementation(async (input) => {
      const result = await realProbe(input);
      if (boundary === 'probe' || boundary === 'before-next') clock = 75_000;
      return result;
    });
    expect(await prepareValidatedRecipeExport(source, { generate, validate, probe, now: () => clock }))
      .toMatchObject({ status: 'terminal', kind: 'timeout', logicalCalls: 1 });
    expect(generate).toHaveBeenCalledTimes(1);
    if (boundary === 'provider') expect(validate).not.toHaveBeenCalled();
    if (boundary === 'validation') expect(probe).not.toHaveBeenCalled();
  });

  it('passes the smaller remaining provider timeout without resetting aggregate budget', async () => {
    let clock = 0;
    const generate = vi.fn().mockResolvedValueOnce({ ...draft(), totalTimeMinutes: -1 }).mockResolvedValueOnce(draft());
    const probe = vi.fn().mockImplementation(async (input) => {
      const result = await realProbe(input);
      clock = 65_000;
      return result;
    });
    expect(await prepareValidatedRecipeExport(source, { generate, probe, now: () => clock })).toMatchObject({ status: 'success', logicalCalls: 2 });
    expect(generate.mock.calls[0]![1].timeout).toBe(20_000);
    expect(generate.mock.calls[1]![1].timeout).toBe(10_000);
    expect(generate.mock.calls[0]![1].signal).toBe(generate.mock.calls[1]![1].signal);
  });
});