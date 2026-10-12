const HOURS = '(?:std\\w*|stunde\\w*|h\\b)';
const EXPRESSION = `(?:\\d+(?:[.,]\\d+)?\\s*${HOURS}\\.?(?:\\s*(?:und\\s*)?\\d+\\s*min\\w*\\.?)?|\\d+(?:[.,]\\d+)?\\s*(?:min\\w*|sek\\w*))`;
const TOTAL_KEY = '(?:gesamt\\w*|insgesamt|total\\w*)';

function toMinutes(value: string, unit: string): number {
  const amount = Number(value.replace(',', '.'));
  if (/^m/iu.test(unit)) return amount;
  if (/^s[eo]/iu.test(unit)) return amount / 60;
  return amount * 60;
}

/** Durations in minutes found in a text; "1 Std. 30 Min." counts as one 90 minute duration. */
function durations(text: string): number[] {
  const pattern = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${HOURS})\\.?(?:\\s*(?:und\\s*)?(\\d+)\\s*min\\w*\\.?)?|(\\d+(?:[.,]\\d+)?)\\s*(min\\w*|sek\\w*)`, 'giu');
  return [...text.matchAll(pattern)].map((match) => match[1]
    ? toMinutes(match[1], match[2]!) + (match[3] ? Number(match[3]) : 0)
    : toMinutes(match[4]!, match[5]!));
}

function explicitTotals(text: string): number[] {
  const patterns = [new RegExp(`${TOTAL_KEY}[^\\d\\n]{0,60}?(${EXPRESSION})`, 'giu'), new RegExp(`(${EXPRESSION})\\s*${TOTAL_KEY}`, 'giu')];
  return patterns.flatMap((pattern) => [...text.matchAll(pattern)].map((match) => Math.round(durations(match[1]!)[0] ?? NaN)));
}

const sum = (values: number[]) => Math.round(values.reduce((total, value) => total + value, 0));

// A total is only credible if the source states it, or its stated durations add up to it; otherwise the model's number is an estimate.
export function enforceSourceBackedTotalTime<Draft extends { totalTimeMinutes?: number | null }>(
  draft: Draft,
  source: { recipeContext: { description?: string }; steps: Array<{ title?: string; description: string }> },
): Draft {
  if (typeof draft.totalTimeMinutes !== 'number' || !Number.isInteger(draft.totalTimeMinutes) || draft.totalTimeMinutes < 1) return draft;
  const total = draft.totalTimeMinutes;
  const description = source.recipeContext.description ?? '';
  const text = [description, ...source.steps.flatMap((step) => [step.title ?? '', step.description])].join('\n');
  if (explicitTotals(text).includes(total)) return draft;
  const stepDurations = source.steps.map((step) => durations(step.description));
  if (stepDurations.every((list) => list.length > 0) && sum(stepDurations.flat()) === total) return draft;
  const stated = durations(description);
  if (stated.length >= 2 && sum(stated) === total) return draft;
  return { ...draft, totalTimeMinutes: null };
}
