import { z } from 'zod';
import type { InsightInputContext, InsightIntent, InsightResponse } from '@fittrack/shared';

export const DAILY_INSIGHT_TITLE_MAX_LENGTH = 40;
export const DAILY_INSIGHT_SUMMARY_MAX_LENGTH = 600;
export const DAILY_INSIGHT_RECOMMENDATION_MAX_LENGTH = 240;
export const DAILY_INSIGHT_CTA_MAX_LENGTH = 80;

export const DAILY_INSIGHT_RESPONSE_SCHEMA = z.object({
  title: z.string().trim().min(1).max(DAILY_INSIGHT_TITLE_MAX_LENGTH),
  summary: z.string().trim().min(1).max(DAILY_INSIGHT_SUMMARY_MAX_LENGTH),
  recommendation: z.string().trim().min(1).max(DAILY_INSIGHT_RECOMMENDATION_MAX_LENGTH).nullable(),
  cta: z.string().trim().min(1).max(DAILY_INSIGHT_CTA_MAX_LENGTH).nullable(),
  ctaTarget: z.enum(['Nutrition', 'Weight', 'Training', 'Recipe']).nullable(),
}).strict();

export type DailyInsightValidatedResponse = z.infer<typeof DAILY_INSIGHT_RESPONSE_SCHEMA>;

export class DailyInsightValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DailyInsightValidationError';
  }
}

function includesDefinitiveActivityLanguage(text: string): boolean {
  return /\b(absolviert|abgeschlossen|durchgeführt|beendet|gemacht)\b/i.test(text)
    || /\bdu\s+(?:hast|bist)\b[^.!?]{0,100}\b(?:tour|wanderung|fahrt|aktivität|rad|berg|strecke)\b/i.test(text);
}

const NATURAL_ACTIVITY_TARGET_VOCABULARY = /\b(?:kalorienziel|tagesziel|energiebedarf|ziel)\b/i;
const LOCKED_PROTEIN_OR_MEAL_ACTION = /\b(?:protein|eiweiß|mahlzeit|snack|frühstück|abendessen|essen)\b/i;
const LOCKED_MEAL_ACTION = /(?:\b(?:iss|plane|plan(?:e|st)?|nimm|gönn(?:e)?\s+dir|empfiehl(?:t)?|empfohlen)\b[^.!?]{0,80}\b(?:mahlzeit|snack|frühstück|abendessen)\b|\b(?:mahlzeit|snack|frühstück|abendessen)\b[^.!?]{0,80}\b(?:sinnvoll|empfehl(?:ung|en)?|wäre\s+(?:sinnvoll|empfehlenswert|passend|gut|hilfreich)|passt(?:\s+gut)?|hinzufügen|planen)\b)/i;

function isCurrentEffectiveActivityBudgetContext(
  context: InsightInputContext,
  intent?: InsightIntent,
): boolean {
  const targets = context.nutrition.targets;
  return intent === 'activity_focus'
    && context.specialActivity != null
    && context.nutrition.remainingCalories != null
    && targets != null
    && targets.targetSource === 'special_activity_snapshot'
    && targets.baseCalories != null
    && targets.activityBonusCalories != null;
}

function validateActivityBudgetSemantics(
  response: DailyInsightValidatedResponse,
  context: InsightInputContext,
  intent?: InsightIntent,
): void {
  if (!isCurrentEffectiveActivityBudgetContext(context, intent)) return;

  const narrative = [response.title, response.summary].join(' ');
  if (!NATURAL_ACTIVITY_TARGET_VOCABULARY.test(narrative)) {
    throw new DailyInsightValidationError('Daily insight must name the effective activity target naturally');
  }
}

function validateBudgetSemantics(response: DailyInsightValidatedResponse, context: InsightInputContext): void {
  const text = [response.summary, response.recommendation, response.cta].filter(Boolean).join(' ');
  const lowerText = text.toLocaleLowerCase('de-DE');

  if (context.nutrition.remainingCalories != null && context.nutrition.remainingCalories < 0) {
    const recommendation = [response.recommendation, response.cta].filter(Boolean).join(' ').toLocaleLowerCase('de-DE');
    if (/\b(iss|essen|nachessen|snack|proteinshake|magerquark|skyr|hüttenkäse|frühstück|abendessen|mahlzeit)\b/i.test(recommendation)
      && !/\b(morgen|übermorgen|am nächsten tag)\b/i.test(recommendation)) {
      throw new DailyInsightValidationError('Daily insight recommends eating after the calorie budget was exceeded');
    }
  }

  if (context.nutrition.remainingCalories != null && context.nutrition.remainingCalories > 0
    && /\b(zu wenig gegessen|unter deinem ziel|unter dem ziel|dein kalorienverbrauch liegt unter)\b/i.test(lowerText)) {
    throw new DailyInsightValidationError('Daily insight judges an open day as completed');
  }
}

function validateProteinSemantics(
  response: DailyInsightValidatedResponse,
  context: InsightInputContext,
  intent?: InsightIntent,
): void {
  const remainingProteinG = context.nutrition.remainingProteinG;
  if (remainingProteinG == null || remainingProteinG > 20) return;

  const text = [response.title, response.summary, response.recommendation, response.cta]
    .filter(Boolean)
    .join(' ');
  const proteinAction = /\b(?:mehr\s+(?:protein|eiweiß)|zusätzlich(?:es|e)?\s+(?:protein|eiweiß)|proteinreich\w*\s+(?:\w+\s+)?(?:mahlzeit|essen|snack|frühstück)|eiweißreich\w*\s+(?:\w+\s+)?(?:mahlzeit|essen|snack|frühstück)|proteinshake|magerquark|skyr|hüttenkäse|hähnchenbrust)\b/i;
  if (proteinAction.test(text)) {
    throw new DailyInsightValidationError('Daily insight recommends additional protein after the protein target is nearly complete');
  }

  if (LOCKED_MEAL_ACTION.test(text)) {
    throw new DailyInsightValidationError('Daily insight recommends a protein or meal action after the protein target is nearly complete');
  }

  const actionText = [response.recommendation, response.cta].filter(Boolean).join(' ');
  if (LOCKED_PROTEIN_OR_MEAL_ACTION.test(actionText)) {
    throw new DailyInsightValidationError('Daily insight recommends a protein or meal action after the protein target is nearly complete');
  }

  if (
    intent === 'nutrition_guidance'
    && context.nutrition.remainingCalories != null
    && context.nutrition.remainingCalories > 0
    && (response.recommendation != null || response.cta != null || response.ctaTarget != null)
  ) {
    throw new DailyInsightValidationError('Daily insight action fields must be null when the protein target is nearly complete');
  }
}

function validateActivitySemantics(response: DailyInsightValidatedResponse, context: InsightInputContext): void {
  if (context.specialActivity == null) return;
  const text = [response.summary, response.recommendation].filter(Boolean).join(' ');
  const hasUncertaintyMarker = /\b(wahrscheinlich|vermutlich|vielleicht|möglicherweise|könnte|dürfte|wenn|falls|sofern)\b/i.test(text);
  if (includesDefinitiveActivityLanguage(text) && (
    context.activityCompletionStatus !== 'likely_completed' || !hasUncertaintyMarker
  )) {
    throw new DailyInsightValidationError('Daily insight treats a planned or unknown activity as completed');
  }
}

function validateWeightSemantics(response: DailyInsightValidatedResponse, context: InsightInputContext): void {
  if (context.weight.daysSinceLastMeasurement == null || context.weight.daysSinceLastMeasurement <= 14) return;
  const text = [response.title, response.summary, response.recommendation, response.cta].filter(Boolean).join(' ');
  const lowerText = text.toLocaleLowerCase('de-DE');
  const hasWeightReference = /\b(?:gewicht\w*|trend\w*|kg)\b/i.test(text);
  const hasStaleMarker = /\b(?:veraltet\w*|unsicher\w*|unklar\w*|älter\w*|nicht\s+(?:mehr\s+)?aktuell\w*|nicht\s+(?:mehr\s+)?belastbar\w*|nicht\s+(?:mehr\s+)?aussagekräftig\w*|liegt\b[^.!?]{0,40}\bzurück\b|kein(?:e|en|es)?\b[^.!?]{0,30}\bgewicht\w*\b|neu(?:e|er|en|es)?\b[^.!?]{0,20}\b(?:messung|eintrag)\w*\b)/i.test(lowerText);
  if (hasWeightReference && !hasStaleMarker) {
    throw new DailyInsightValidationError('Daily insight refers to stale weight data as current');
  }
}

function validateToneSemantics(response: DailyInsightValidatedResponse): void {
  const text = [response.title, response.summary, response.recommendation, response.cta]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('de-DE');
  const forbiddenPhrases = [
    'positive entwicklung',
    'positive fortschrittsphase',
    'regressionsphase erkannt',
    'plateau_active',
    'freshnessscore',
    'std dev',
    'medizinische diagnose',
  ];
  if (forbiddenPhrases.some((phrase) => text.includes(phrase))) {
    throw new DailyInsightValidationError('Daily insight contains a forbidden technical or abstract phrase');
  }
}

export function validateDailyInsightSemantics(
  response: DailyInsightValidatedResponse,
  context: InsightInputContext,
  intent?: InsightIntent,
): void {
  if ((response.cta == null) !== (response.ctaTarget == null)) {
    throw new DailyInsightValidationError('CTA and CTA target must be provided together');
  }
  validateBudgetSemantics(response, context);
  validateProteinSemantics(response, context, intent);
  validateActivityBudgetSemantics(response, context, intent);
  validateActivitySemantics(response, context);
  validateWeightSemantics(response, context);
  validateToneSemantics(response);
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
    title: response.title,
    summary: response.summary,
  };
  if (response.recommendation != null) result.recommendation = response.recommendation;
  if (response.cta != null) result.cta = response.cta;
  if (response.ctaTarget != null) result.ctaTarget = response.ctaTarget;
  return result;
}