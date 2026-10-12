import { RECIPE_EXPORT_MAX_STEPS } from '../../../shared/types/recipeExport';

interface ImportStepLike { order?: unknown; cookingEssential?: unknown }

/** Source orders flagged as essential cooking that no export step references; empty when the check does not apply. */
export function missingEssentialCookingOrders(parsed: unknown): number[] {
  const candidate = parsed as { steps?: unknown; exportSuggestion?: { steps?: unknown } } | null;
  const sourceSteps = candidate?.steps;
  const exportSteps = candidate?.exportSuggestion?.steps;
  if (!Array.isArray(sourceSteps) || !Array.isArray(exportSteps)) return [];
  const essential = (sourceSteps as ImportStepLike[])
    .filter((step) => step && step.cookingEssential === true && typeof step.order === 'number')
    .map((step) => step.order as number);
  if (essential.length === 0 || essential.length > RECIPE_EXPORT_MAX_STEPS) return [];
  const referenced = new Set(exportSteps.flatMap((step) => (Array.isArray(step?.sourceStepOrders) ? step.sourceStepOrders as unknown[] : [])));
  return essential.filter((order) => !referenced.has(order));
}

/** Temperatures in export texts that the referenced source steps do not contain. */
export function inventedExportTemperatures(parsed: unknown): string[] {
  const candidate = parsed as { steps?: Array<{ order?: unknown; description?: unknown }>; exportSuggestion?: { steps?: unknown } } | null;
  const sourceSteps = candidate?.steps;
  const exportSteps = candidate?.exportSuggestion?.steps;
  if (!Array.isArray(sourceSteps) || !Array.isArray(exportSteps)) return [];
  const pattern = /\d+\s*(?:°\s*[CF]|Grad|Celsius|Fahrenheit)/giu;
  const normalize = (value: string) => value.replace(/\s/gu, '').toLowerCase();
  const invented: string[] = [];
  for (const step of exportSteps as Array<{ description?: unknown; sourceStepOrders?: unknown }>) {
    if (typeof step?.description !== 'string' || !Array.isArray(step.sourceStepOrders)) continue;
    const sourceText = sourceSteps.filter((source) => (step.sourceStepOrders as unknown[]).includes(source?.order))
      .map((source) => (typeof source?.description === 'string' ? source.description : '')).join(' ');
    const known = (sourceText.match(pattern) ?? []).map(normalize);
    for (const temperature of step.description.match(pattern) ?? []) {
      if (!known.includes(normalize(temperature))) invented.push(temperature);
    }
  }
  return invented;
}

/** Number of numbered instruction lines below a "Zubereitung"-style heading; 0 without heading to avoid counting numbered ingredient lists. */
export function countNumberedInstructions(text: string): number {
  const lines = text.split(/\r?\n/u);
  const heading = lines.findIndex((line) => /^\s*(?:zubereitung|anleitung|zubereitungsschritte|schritte)\b/iu.test(line));
  if (heading < 0) return 0;
  return lines.slice(heading + 1).filter((line) => /^\s*\d+[.)]\s+\S/u.test(line)).length;
}

/** First place where the flattened export references stop being strictly ascending, described for the model. */
export function exportTraceDiagnosis(parsed: unknown): string | null {
  const exportSteps = (parsed as { exportSuggestion?: { steps?: unknown } } | null)?.exportSuggestion?.steps;
  if (!Array.isArray(exportSteps)) return null;
  let last = 0;
  let lastStep = 0;
  for (const [index, step] of (exportSteps as Array<{ sourceStepOrders?: unknown }>).entries()) {
    if (!Array.isArray(step?.sourceStepOrders)) return null;
    for (const ref of step.sourceStepOrders as unknown[]) {
      if (typeof ref !== 'number') return null;
      if (ref <= last) {
        return `Konkret (Exportschritte nach ihrem ersten Verweis sortiert): Exportschritt ${index + 1} verweist auf Quellschritt ${ref}, obwohl Exportschritt ${lastStep} bereits bis Quellschritt ${last} reicht. Ändere nur sourceStepOrders: Entferne ${last} aus Exportschritt ${lastStep} oder nenne in Exportschritt ${index + 1} nur Quellschritte größer als ${last}; die Beschreibungen bleiben unverändert.`;
      }
      last = ref;
      lastStep = index + 1;
    }
  }
  return null;
}

export type ImportViolationKind = 'trace' | 'contract' | 'numbered' | 'essential' | 'temperature';
export interface ImportViolation { kind: ImportViolationKind; message: string }

const TRACE_ERROR = /sourceStepOrders must be ascending|references must be globally unique|trace must be strictly ascending/u;

/** Deterministic contract violations of an import analysis (server-generated messages without recipe text). */
export function importViolations(inputText: string, parsed: unknown, contractViolations: string[] = []): ImportViolation[] {
  const problems: ImportViolation[] = [];
  const traceErrors = contractViolations.filter((violation) => TRACE_ERROR.test(violation));
  const otherErrors = contractViolations.filter((violation) => !TRACE_ERROR.test(violation));
  if (otherErrors.length > 0) {
    problems.push({ kind: 'contract', message: `Der Server hat Vertragsverletzungen gefunden: ${otherErrors.join('; ')}.` });
  }
  if (traceErrors.length > 0) {
    const diagnosis = exportTraceDiagnosis(parsed);
    problems.push({ kind: 'trace', message: `Der Server hat Vertragsverletzungen gefunden: ${traceErrors.join('; ')}. Alle sourceStepOrders aller Exportschritte hintereinander gelesen müssen streng aufsteigen und dürfen sich nicht wiederholen, z. B. [1], [2, 3], [5]; ungültig sind [3, 5], [4] und [2, 3], [3].${diagnosis ? ` ${diagnosis}` : ''}` });
  }
  const numbered = countNumberedInstructions(inputText);
  const sourceSteps = (parsed as { steps?: unknown } | null)?.steps;
  if (numbered >= 2 && Array.isArray(sourceSteps) && sourceSteps.length !== numbered) {
    problems.push({ kind: 'numbered', message: `Die Eingabe enthält ${numbered} nummerierte Anweisungen, steps enthält aber ${sourceSteps.length} Einträge. steps muss genau einen Eintrag je nummerierter Anweisung in derselben Reihenfolge enthalten; nur exportSuggestion.steps darf zusammenfassen.` });
  }
  const missing = missingEssentialCookingOrders(parsed);
  if (missing.length > 0) {
    problems.push({ kind: 'essential', message: `Der Exportvorschlag verweist nicht auf die als cookingEssential markierten Quellschritte ${missing.join(', ')}. Nimm diese Garhandlungen in sourceStepOrders eines Exportschritts auf, fasse dazu aufeinanderfolgende Handlungen derselben Komponente zusammen und lasse stattdessen Würzen, Ölerhitzen, Ruhen oder Servieren weg.` });
  }
  const invented = inventedExportTemperatures(parsed);
  if (invented.length > 0) {
    problems.push({ kind: 'temperature', message: `Die Exportschritte nennen Temperaturen (${invented.join(', ')}), die in den referenzierten Quellschritten nicht stehen. Erfinde keine Temperaturen; übernimm nur Temperaturen aus der Quelle.` });
  }
  return problems;
}

/**
 * Violations that must not be served after the corrections are exhausted. A missing cookingEssential reference only blocks when the
 * input has numbered instructions, i.e. a real cooking basis; for ingredient-only text the model's step flags are not meaningful.
 */
export function blockingImportViolations(inputText: string, violations: ImportViolation[]): ImportViolation[] {
  const hasBasis = countNumberedInstructions(inputText) >= 2;
  return violations.filter((violation) => violation.kind !== 'essential' || hasBasis);
}

/** Directed correction message for the model. */
export function importCorrectionFeedback(violations: ImportViolation[]): string {
  return `${violations.map((violation) => violation.message).join(' ')} Gib die gesamte Analyse erneut aus.`;
}

/** The flag is a provider-side planning aid, not part of the public analysis contract. */
export function stripCookingEssential<Parsed extends { steps?: unknown }>(parsed: Parsed): Parsed {
  if (!Array.isArray(parsed.steps)) return parsed;
  return { ...parsed, steps: parsed.steps.map((step) => {
    if (!step || typeof step !== 'object') return step;
    const { cookingEssential: _flag, ...rest } = step as Record<string, unknown>;
    return rest;
  }) };
}
