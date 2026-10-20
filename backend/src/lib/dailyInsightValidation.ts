import { z } from 'zod';
import type { InsightInputContext, InsightIntent, InsightResponse } from '@fittrack/shared';

export const DAILY_INSIGHT_TITLE_MAX_LENGTH = 40;
export const DAILY_INSIGHT_SUMMARY_MAX_LENGTH = 5_000;
export const DAILY_INSIGHT_RECOMMENDATION_MAX_LENGTH = 240;
export const DAILY_INSIGHT_GREETING_MAX_LENGTH = 120;
export const DAILY_INSIGHT_SHORT_INSIGHT_MAX_LENGTH = 240;

export const DAILY_INSIGHT_RESPONSE_SCHEMA = z.object({
  greeting: z.string().trim().min(1).max(DAILY_INSIGHT_GREETING_MAX_LENGTH),
  shortInsight: z.string().trim().min(1).max(DAILY_INSIGHT_SHORT_INSIGHT_MAX_LENGTH),
  title: z.string().trim().min(1).max(DAILY_INSIGHT_TITLE_MAX_LENGTH),
  summary: z.string().trim().min(1).max(DAILY_INSIGHT_SUMMARY_MAX_LENGTH),
  recommendation: z.string().trim().min(1).max(DAILY_INSIGHT_RECOMMENDATION_MAX_LENGTH).nullable(),
}).strict();

export type DailyInsightValidatedResponse = z.infer<typeof DAILY_INSIGHT_RESPONSE_SCHEMA>;

export class DailyInsightValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DailyInsightValidationError';
  }
}

const CALORIE_VALUE = /(\d{1,3}(?:[.,]\d{3})+|\d+)\s*(?:kcal|kalorien)\b/giu;

// The validator only enforces structure and supplied numbers. Wording quality belongs to the prompt and evals.
function validateCompactFields(response: DailyInsightValidatedResponse, context: InsightInputContext): void {
  const prefix = `Hallo, ${context.displayName}! `;
  const emoji = response.greeting.slice(prefix.length);
  if (!response.greeting.startsWith(prefix)
    || !/^(?:\p{Extended_Pictographic}\uFE0F?[\p{Emoji_Modifier}]?(?:\u200D\p{Extended_Pictographic}\uFE0F?[\p{Emoji_Modifier}]?)*|\p{Regional_Indicator}{2})$/u.test(emoji)) {
    throw new DailyInsightValidationError('Daily insight greeting must greet the context name with one emoji');
  }

  const sentence = response.shortInsight;
  const boundaryText = sentence
    .replace(/\b(?:z\.\s?B\.|d\.\s?h\.|u\.\s?a\.|bzw\.|ca\.|Dr\.|Prof\.|Std\.|Min\.)/giu, (abbreviation) => abbreviation.replace(/\./g, ''))
    .replace(/(\d)\.(?=\d)/g, '$1');
  if (/[\r\n*_#`~<>\[\]]|\.{2}|…/u.test(sentence)
    || !/^[\p{L}\p{N}]/u.test(sentence)
    || !/[.!?]$/.test(sentence)
    || /[.!?]/.test(boundaryText.slice(0, -1))
    || sentence.trim().split(/\s+/).length < 3) {
    throw new DailyInsightValidationError('Daily insight shortInsight must be one complete plain sentence');
  }
}

function getSuppliedCalorieValues(context: InsightInputContext): Set<number> {
  const targets = context.nutrition.targets;
  const activity = context.specialActivity;
  const values: Array<number | null | undefined> = [
    context.nutrition.today?.calories,
    targets?.calories,
    targets?.baseCalories,
    targets?.activityBonusCalories,
    context.nutrition.remainingCalories,
    activity?.activityBonus,
    activity?.activityCalories,
    activity?.alreadyAccountedCalories,
    activity?.dailyCalorieTarget,
    ...context.nutrition.last3Days.flatMap((day) => [
      day.calories,
      day.baseTargetCalories,
      day.effectiveTargetCalories,
      day.activityBonusCalories,
    ]),
  ];
  const result = new Set<number>();
  for (const value of values) {
    if (value != null && Number.isFinite(value)) result.add(Math.abs(Math.round(value)));
  }
  return result;
}

function validateCalorieValues(response: DailyInsightValidatedResponse, context: InsightInputContext): void {
  const supplied = getSuppliedCalorieValues(context);
  const text = [response.shortInsight, response.title, response.summary, response.recommendation]
    .filter((value): value is string => value != null)
    .join(' ');
  for (const match of text.matchAll(CALORIE_VALUE)) {
    const value = Number((match[1] ?? '').replace(/[.,]/g, ''));
    if (!Number.isFinite(value) || !supplied.has(value)) {
      throw new DailyInsightValidationError('Daily insight includes a calorie value that was not supplied');
    }
  }
}

export function validateDailyInsightSemantics(
  response: DailyInsightValidatedResponse,
  context: InsightInputContext,
  intent?: InsightIntent,
): void {
  validateCompactFields(response, context);
  validateDailyInsightContentSemantics(response, context, intent);
}

export function validateDailyInsightContentSemantics(
  response: DailyInsightValidatedResponse,
  context: InsightInputContext,
  _intent?: InsightIntent,
): void {
  validateCalorieValues(response, context);
}

export function validateDailyInsightResponse(
  value: unknown,
  context: InsightInputContext,
  intent?: InsightIntent,
): DailyInsightValidatedResponse {
  const parsed = DAILY_INSIGHT_RESPONSE_SCHEMA.safeParse(value);
  if (!parsed.success) {
    throw new DailyInsightValidationError('Daily insight response has an invalid schema');
  }
  validateDailyInsightSemantics(parsed.data, context, intent);
  return parsed.data;
}

export function toInsightResponse(
  response: DailyInsightValidatedResponse,
): Omit<InsightResponse, 'generatedAt' | 'promptVersion' | 'status'> {
  const result: Omit<InsightResponse, 'generatedAt' | 'promptVersion' | 'status'> = {
    greeting: response.greeting,
    shortInsight: response.shortInsight,
    title: response.title,
    summary: response.summary,
  };
  if (response.recommendation != null) result.recommendation = response.recommendation;
  return result;
}
