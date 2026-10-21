import { performance } from 'node:perf_hooks';
import { prepareRecipeExport, type RecipePreparationContext, type RecipeExportPreparationOutput } from './openai';
import { validateRecipeExportPreparationOutput, validateRecipePreparationSource, type RecipeExportPreparationDiagnostic } from './recipeAnalyzeValidation';
import { probeInstagramRecipeDetailsGeneratedText, type RecipeDetailsGeneratedTextProbeResult } from './instagramRenderer';
import { getRecipeDetailsTextLayoutFields } from './instagramRenderer/recipeDetailsTemplateV3';

export const RECIPE_PREPARATION_DEADLINE_MS = 75_000;
export const RECIPE_PREPARATION_REQUEST_MS = 20_000;

interface PreparationDependencies {
  generate: typeof prepareRecipeExport;
  validate: typeof validateRecipeExportPreparationOutput;
  probe: typeof probeInstagramRecipeDetailsGeneratedText;
  now: () => number;
}

interface AttemptMetadata {
  logicalCalls: number;
  corrections: number;
  elapsedMs: number;
}

export type RecipePreparationResult = AttemptMetadata & (
  | { status: 'success'; data: RecipeExportPreparationOutput; deadlineAt: number }
  | { status: 'exhausted'; latestDraft: unknown; diagnostics: RecipeExportPreparationDiagnostic[] }
  | {
      status: 'terminal'; kind: 'source' | 'provider' | 'timeout' | 'technical'; code: string; error?: unknown;
      titleProbe?: {
        stepCount: number;
        layout: 'large' | 'compact';
        fontSize?: number;
        measured?: { width: number; maxWidth: number; height?: number; maxHeight?: number };
      };
    }
);

class PreparationTimeout extends Error {}

function probeInput(raw: unknown, savedTitle: string) {
  if (!raw || typeof raw !== 'object') return undefined;
  const draft = raw as Record<string, unknown>;
  if (typeof draft['teaser'] !== 'string' || !Array.isArray(draft['steps']) || draft['steps'].length < 1 || draft['steps'].length > 5) return undefined;
  const steps: string[] = [];
  for (const step of draft['steps']) {
    if (!step || typeof step !== 'object' || typeof step.description !== 'string') return undefined;
    steps.push(step.description);
  }
  return { savedTitle, teaser: draft['teaser'], steps };
}

function templateDiagnostics(result: RecipeDetailsGeneratedTextProbeResult, draft: unknown, savedTitle: string): RecipeExportPreparationDiagnostic[] {
  const candidate = draft as RecipeExportPreparationOutput;
  return result.diagnostics.flatMap((diagnostic): RecipeExportPreparationDiagnostic[] => {
    if (diagnostic.field === 'title' || diagnostic.status === 'fits' || diagnostic.status === 'technical-failure') return [];
    const stepIndex = diagnostic.field === 'steps' ? diagnostic.itemIndex : undefined;
    const path = stepIndex !== undefined ? `steps[${stepIndex}].description` : diagnostic.field;
    const common = { phase: 'template' as const, path, stepIndex,
      ...(stepIndex !== undefined && Number.isFinite(candidate.steps[stepIndex]?.order) ? { stepOrder: candidate.steps[stepIndex]!.order } : {}),
      stepCount: candidate.steps.length, layout: candidate.steps.length === 5 ? 'compact' as const : 'large' as const };
    if (diagnostic.status === 'invalid-text') {
      return [{ ...common, code: diagnostic.code, constraint: 'existing_template_text_input',
        textLength: (stepIndex !== undefined ? candidate.steps[stepIndex]!.description : candidate.teaser).length,
        explanation: 'Text must satisfy the existing template input rules.' }];
    }
    const measured = diagnostic.measured;
    const { style } = getRecipeDetailsTextLayoutFields({ title: savedTitle, description: candidate.teaser,
      steps: candidate.steps.map((step) => step.description) }, diagnostic.fontSize)
      .find((field) => diagnostic.field === 'teaser' ? field.field === 'description' : field.field === 'steps' && field.itemIndex === stepIndex)!;
    return [{ ...common, code: 'TEMPLATE_FIELD_OVERFLOW', constraint: 'measured_text_bounds',
      font: { family: style.fontFamily, size: style.fontSize, weight: style.fontWeight,
        style: style.fontStyle ?? 'normal', lineHeight: style.lineHeight },
      actual: { width: measured.width, ...('height' in measured ? { height: measured.height } : {}) },
      bounds: { width: measured.maxWidth, ...('maxHeight' in measured ? { height: measured.maxHeight } : {}), tolerance: 0.5 },
      explanation: 'Reword the affected text to fit these measured production bounds without changing source-backed meaning.' }];
  });
}

export async function prepareValidatedRecipeExport(original: RecipePreparationContext, overrides: Partial<PreparationDependencies> = {}): Promise<RecipePreparationResult> {
  const dependencies: PreparationDependencies = { generate: prepareRecipeExport, validate: validateRecipeExportPreparationOutput,
    probe: probeInstagramRecipeDetailsGeneratedText, now: () => performance.now(), ...overrides };
  if (!validateRecipePreparationSource(original.steps).ok) {
    return { status: 'terminal', kind: 'source', code: 'INVALID_SAVED_SOURCE', logicalCalls: 0, corrections: 0, elapsedMs: 0 };
  }
  const preparation = structuredClone(original);
  const originalJson = JSON.stringify(preparation);
  const startedAt = dependencies.now();
  const deadlineAt = startedAt + RECIPE_PREPARATION_DEADLINE_MS;
  const controller = new AbortController();
  let logicalCalls = 0;
  let latestDraft: unknown;
  let diagnostics: RecipeExportPreparationDiagnostic[] = [];
  let stage: 'provider' | 'technical' = 'provider';
  const metadata = (): AttemptMetadata => ({ logicalCalls, corrections: Math.max(0, logicalCalls - 1),
    elapsedMs: Math.max(0, dependencies.now() - startedAt) });
  const remaining = () => {
    const value = deadlineAt - dependencies.now();
    if (value <= 0) throw new PreparationTimeout('Preparation deadline exceeded');
    return value;
  };
  const bounded = async <Value>(work: () => Promise<Value>, limit: number): Promise<Value> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const value = await Promise.race([Promise.resolve().then(work), new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new PreparationTimeout('Preparation deadline exceeded')); }, limit);
      })]);
      remaining();
      return value;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  };
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      stage = 'provider';
      const timeout = Math.min(RECIPE_PREPARATION_REQUEST_MS, remaining());
      const options = { timeout, signal: controller.signal,
        ...(attempt > 0 ? { correction: { latestDraft: structuredClone(latestDraft), validationErrors: structuredClone(diagnostics) } } : {}) };
      latestDraft = await bounded(() => {
        remaining();
        logicalCalls += 1;
        return dependencies.generate(JSON.parse(originalJson) as RecipePreparationContext, options);
      }, timeout);
      remaining();
      stage = 'technical';
      const validation = dependencies.validate(latestDraft, preparation.steps);
      remaining();
      diagnostics = validation.ok ? [] : validation.diagnostics;
      const input = probeInput(latestDraft, preparation.recipeContext.name);
      if (input) {
        const probe = await bounded(() => { remaining(); return dependencies.probe(input); }, remaining());
        if (probe.status === 'technical-failure' || probe.diagnostics.some((entry) => entry.status === 'technical-failure')) {
          const code = probe.status === 'technical-failure' ? probe.error.code : 'PROBE_FAILED';
          const titleDiagnostic = probe.diagnostics.find((entry) =>
            entry.field === 'title' && entry.status === 'technical-failure',
          );
          const titleProbe = code === 'TITLE_LAYOUT_FAILED' ? {
            stepCount: input.steps.length,
            layout: input.steps.length === 5 ? 'compact' as const : 'large' as const,
            ...(titleDiagnostic && 'fontSize' in titleDiagnostic ? { fontSize: titleDiagnostic.fontSize } : {}),
            ...(titleDiagnostic && 'measured' in titleDiagnostic ? { measured: titleDiagnostic.measured } : {}),
          } : undefined;
          return {
            status: 'terminal', kind: 'technical', code,
            ...(titleProbe ? { titleProbe } : {}),
            ...metadata(),
          };
        }
        const measured = probe.diagnostics.filter((entry) => entry.field !== 'title');
        const fieldKeys = measured.map((entry) => entry.field === 'teaser' ? 'teaser' : `steps[${entry.itemIndex}]`);
        const expectedKeys = ['teaser', ...input.steps.map((_step, index) => `steps[${index}]`)];
        if (measured.length !== expectedKeys.length || expectedKeys.some((key) => fieldKeys.filter((value) => value === key).length !== 1) ||
          measured.some((entry) => {
            if (entry.status === 'invalid-text') return false;
            if (!('measured' in entry) || !entry.measured) return true;
            const values = entry.measured;
            return !Number.isFinite(values.width) || !Number.isFinite(values.maxWidth) || !Number.isFinite(entry.fontSize) ||
              (entry.status !== 'width-overflow' && (!('height' in values) || !Number.isFinite(values.height) ||
                !('maxHeight' in values) || !Number.isFinite(values.maxHeight)));
          })) {
          return { status: 'terminal', kind: 'technical', code: 'MISSING_OR_NON_FINITE_MEASUREMENT', ...metadata() };
        }
        diagnostics = [...diagnostics, ...templateDiagnostics(probe, latestDraft, preparation.recipeContext.name)];
        if (!probe.ok && diagnostics.length === 0) {
          return { status: 'terminal', kind: 'technical', code: 'MISSING_MEASUREMENT', ...metadata() };
        }
      } else if (validation.ok) {
        return { status: 'terminal', kind: 'technical', code: 'MISSING_MEASUREMENT', ...metadata() };
      }
      remaining();
      if (validation.ok && diagnostics.length === 0) return { status: 'success', data: validation.data, deadlineAt, ...metadata() };
      if (attempt === 2) return { status: 'exhausted', latestDraft, diagnostics, ...metadata() };
    }
    throw new Error('Unreachable preparation state');
  } catch (error) {
    controller.abort();
    return { status: 'terminal', kind: error instanceof PreparationTimeout ? 'timeout' : stage,
      code: error instanceof PreparationTimeout ? 'PREPARATION_TIMEOUT' : stage === 'provider' ? 'PROVIDER_FAILED' : 'PROBE_FAILED', error, ...metadata() };
  } finally {
    controller.abort();
  }
}

export function recipePreparationAffectedFields(latestDraft: unknown, diagnostics: RecipeExportPreparationDiagnostic[]) {
  const draft = latestDraft && typeof latestDraft === 'object' ? latestDraft as Record<string, unknown> : undefined;
  const records = new Map<string, { path: string; stepIndex?: number; stepOrder?: number; text: string; textLength: number; diagnoses: RecipeExportPreparationDiagnostic[] }>();
  for (const diagnostic of diagnostics) {
    if (diagnostic.code === 'unrecognized_keys') continue;
    let path = diagnostic.path;
    let text: unknown;
    let stepOrder: unknown;
    const match = /^steps\[(\d+)\](?:\.(?:description|sourceStepOrders(?:\[\d+\])?|order))?$/u.exec(path);
    if (match) {
      const index = Number(match[1]);
      const step = Array.isArray(draft?.['steps']) ? draft['steps'][index] : undefined;
      if (step && typeof step === 'object') { text = step.description; stepOrder = step.order; }
      path = `steps[${index}].description`;
    } else if (path === 'teaser' || path === 'difficulty') text = draft?.[path];
    if (typeof text !== 'string') continue;
    const record = records.get(path) ?? { path, ...(match ? { stepIndex: Number(match[1]) } : {}),
      ...(typeof stepOrder === 'number' && Number.isFinite(stepOrder) ? { stepOrder } : {}), text, textLength: text.length, diagnoses: [] };
    record.diagnoses.push(diagnostic);
    records.set(path, record);
  }
  return [...records.values()];
}