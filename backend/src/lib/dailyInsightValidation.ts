import { z } from 'zod';
import type { InsightInputContext, InsightIntent, InsightResponse } from '@fittrack/shared';
import { selectInsightIntent } from './dailyInsightIntent';

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
const ENERGY_BALANCE_TERMS = /\b(?:(?:kalorien|energie)?(?:defizit|überschuss)|(?:energie|kalorien)(?:bilanz|balance))\b/i;
const ENERGY_BALANCE_NEGATION_BEFORE = /\b(?:kein(?:e|en|em|er)?|weder|ohne)\b[^,;.!?]{0,80}$|\bnicht\s+(?:(?:tatsächlich|wirklich|physiologisch|eindeutig|im|in|als|belegt|erreicht|vorhanden)\s+){0,5}$/i;
const ENERGY_BALANCE_NEGATION_AFTER = /\b(?:nicht|nie|keineswegs)\s+(?:(?:tatsächlich|wirklich|eindeutig|messbar|physiologisch)\s+)?(?:erreicht|vorhanden|belegt|nachweisbar|messbar|ermittelt|gemessen|feststellbar|ableitbar|abzuleiten|ableiten|herleitbar|herzuleiten|gegeben|vorliegen|vorliegt|vor|zu\s+behaupten|zu\s+bezeichnen|der\s+fall)\b|\b(?:besteht|liegt|ist|war|wird)\s+(?:nicht|nie|keineswegs)\s+(?:vor|gegeben|belegt|nachweisbar|messbar|ableitbar|feststellbar)\b/i;
const CALORIE_INTAKE_INCREASE = /(?:\b(?:kalorien(?:zufuhr|aufnahme|menge)?|energiezufuhr)\b[^.!?]{0,60}\b(?:erhöh\w*|steiger\w*|anheb\w*|aufstock\w*)\b|\b(?:erhöh\w*|steiger\w*|anheb\w*|aufstock\w*)\b[^.!?]{0,60}\b(?:kalorien(?:zufuhr|aufnahme|menge)?|energiezufuhr)\b|\bmehr\s+(?:kalorien|energie)\s+(?:ess\w*|aufnehm\w*)\b|\b(?:iss|esse|nimm)\b[^.!?]{0,40}\bmehr\b[^.!?]{0,20}\b(?:kalorien|energie)\b)/iu;
const OPEN_BUDGET_EATING_ACTION = /(?:\b(?:restlich\w*|verbleibend\w*)\b[^.!?]{0,60}\b(?:\d+\s*)?(?:kcal|kalorien)\b[^.!?]{0,80}\b(?:ess\w*|iss\w*|aufnehm\w*|nutz\w*|verbrauch\w*|ausschöpf\w*|aufbrauch\w*|auffüll\w*|mahlzeit|snack)\b|\b(?:kalorienspielraum|kalorienbudget|restbudget)\b[^.!?]{0,80}\b(?:ess\w*|iss\w*|aufnehm\w*|nutz\w*|verbrauch\w*|ausschöpf\w*|aufbrauch\w*|auffüll\w*|mahlzeit|snack)\b|\b(?:ess\w*|iss\w*|aufnehm\w*|nutz\w*|verbrauch\w*|ausschöpf\w*|aufbrauch\w*|auffüll\w*)\b[^.!?]{0,80}\b(?:restlich\w*|verbleibend\w*)\b[^.!?]{0,30}\b(?:\d+\s*)?(?:kcal|kalorien|kalorienspielraum|kalorienbudget)\b)/iu;
const LOCKED_MEAL_ACTION = /(?:\b(?:iss|plane|plan(?:e|st)?|nimm|gönn(?:e)?\s+dir|empfiehl(?:t)?|empfohlen)\b[^.!?]{0,80}\b(?:mahlzeit|snack|frühstück|abendessen)\b|\b(?:mahlzeit|snack|frühstück|abendessen)\b[^.!?]{0,80}\b(?:sinnvoll|empfehl(?:ung|en)?|wäre\s+(?:sinnvoll|empfehlenswert|passend|gut|hilfreich)|passt(?:\s+gut)?|hinzufügen|planen)\b)/i;
const HISTORICAL_TARGET_TERMS = /\b(?:ziel|tagesziel|kalorienziel|energiebedarf)\b/i;
const HISTORICAL_TARGET_NUMERIC_VALUE = /(?:\b(?:tagesziel|kalorienziel|energiebedarf|ziel)\b\s*:?\s*(?:(?:von|bei|war|betrug|lag\s+bei)\s+)?(\d{1,2}[.,]\d{3}|\d{3,5})\s*(?:kcal)?\b|\b(\d{1,2}[.,]\d{3}|\d{3,5})\s*kcal\s+(?:als\s+)?(?:tagesziel|kalorienziel|energiebedarf|ziel)\b)/iu;
const HISTORICAL_TARGET_RELATION = /(?<![\p{L}\p{N}_])(?:über|oberhalb|darüber|unter|unterhalb|darunter|mehr\s+als|weniger\s+als|zu\s+viel|zu\s+wenig|überschritten|unterschritten|verfehlt|erreicht)(?![\p{L}\p{N}_])/iu;
const HISTORICAL_ABOVE_TARGET = /(?<![\p{L}\p{N}_])(?:über|oberhalb|darüber|mehr\s+als|zu\s+viel|überschritten)(?![\p{L}\p{N}_])/iu;
const HISTORICAL_BELOW_TARGET = /(?<![\p{L}\p{N}_])(?:unter|unterhalb|darunter|weniger\s+als|zu\s+wenig|unterschritten|verfehlt)(?![\p{L}\p{N}_])/iu;
const HISTORICAL_NUTRITION_CLAIM = /(?<![\p{L}\p{N}_])(?:kalorien|kcal|protein|eiweiß|makros?|aufnahme|gegessen|mahlzeit)(?![\p{L}\p{N}_])/iu;
const HISTORICAL_DATA_UNAVAILABLE_DISCLAIMER = /\b(?:keine[nr]?\s+(?:ernährungs-?\s*)?einträge|keine[nr]?\s+daten|nicht\s+(?:verlässlich|belastbar|eindeutig)\s+einordn\w*|lässt\s+sich\s+(?:nicht|kaum)\s+(?:verlässlich\s+)?einordn\w*)\b/i;
const HISTORICAL_TARGET_AS_STORED_FACT = /\b(?:damalig\w*|historisch\w*|gespeichert\w*)\b|\b(?:ziel|tagesziel|kalorienziel)\s+(?:war|betrug|lag)\b|\b(?:war|betrug)\s+dein(?:e)?\s+(?:tagesziel|ziel)\b/i;
const EXPLICIT_CURRENT_PROFILE_TARGET = /\b(?:heutig\w*|aktuell\w*)\s+(?:profil(?:kalorien)?ziel|kalorienziel|tagesziel|ziel)\b/i;

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

function getResponseSentences(response: DailyInsightValidatedResponse): string[] {
  const text = [response.title, response.summary, response.recommendation, response.cta]
    .filter((value): value is string => value != null)
    .join(' ');
  return text.split(/(?<=[.!?])\s+/);
}

function getHistoricalDayIndex(sentence: string): number | null {
  if (/\b(?:vorgestern|vorgestrig\w*|vor\s+zwei\s+tagen)\b/i.test(sentence)) return 1;
  if (/\b(?:vor\s+drei\s+tagen|vor\s+3\s+tagen)\b/i.test(sentence)) return 2;
  if (/\b(?:gestern|gestrig\w*|am\s+vortag|vortag)\b/i.test(sentence)) return 0;
  return null;
}

function hasHistoricalNutrition(day: InsightInputContext['nutrition']['last3Days'][number] | undefined): boolean {
  return day != null
    && day.hasMealItem !== false
    && day.calories != null
    && Number.isFinite(day.calories);
}

function isPositiveFinite(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value) && value > 0;
}

function getHistoricalTargetCaloriesValue(sentence: string): number | null {
  const match = HISTORICAL_TARGET_NUMERIC_VALUE.exec(sentence);
  const rawValue = match?.[1] ?? match?.[2];
  if (rawValue == null) return null;

  const value = Number(rawValue.replace(/[.,](?=\d{3}$)/, ''));
  return Number.isFinite(value) ? value : null;
}

function hasUsableHistoricalTarget(
  day: InsightInputContext['nutrition']['last3Days'][number] | undefined,
): boolean {
  if (
    day == null
    || !hasHistoricalNutrition(day)
    || !isPositiveFinite(day.baseTargetCalories)
    || !isPositiveFinite(day.effectiveTargetCalories)
  ) {
    return false;
  }

  switch (day.targetSource) {
    case 'day_target_snapshot':
      return true;
    case 'special_activity_snapshot':
      return day.specialActivity != null
        && isPositiveFinite(day.specialActivity.dailyCalorieTarget);
    case 'profile_fallback':
      return day.specialActivity == null;
    default:
      return false;
  }
}

function validateHistoricalNutritionSemantics(
  response: DailyInsightValidatedResponse,
  context: InsightInputContext,
): void {
  let previousHistoricalDayIndex: number | null = null;
  for (const sentence of getResponseSentences(response)) {
    const mentionedDayIndex = getHistoricalDayIndex(sentence);
    if (mentionedDayIndex != null) {
      previousHistoricalDayIndex = mentionedDayIndex;
    } else if (/\b(?:heute|heutig\w*|aktuell\w*)\b/i.test(sentence)) {
      previousHistoricalDayIndex = null;
    }
    const dayIndex = mentionedDayIndex ?? previousHistoricalDayIndex;
    if (dayIndex == null) continue;

    const day = context.nutrition.last3Days[dayIndex];
    const hasNutritionClaim = HISTORICAL_NUTRITION_CLAIM.test(sentence);
    if (
      !hasHistoricalNutrition(day)
      && hasNutritionClaim
      && !HISTORICAL_DATA_UNAVAILABLE_DISCLAIMER.test(sentence)
    ) {
      throw new DailyInsightValidationError(
        'Daily insight makes a historical nutrition claim without logged nutrition data',
      );
    }

    const hasTargetRelation = HISTORICAL_TARGET_RELATION.test(sentence);
    const statedTargetCalories = getHistoricalTargetCaloriesValue(sentence);
    if (!hasTargetRelation && statedTargetCalories == null) {
      continue;
    }
    if (!hasUsableHistoricalTarget(day)) {
      throw new DailyInsightValidationError(
        'Daily insight compares a historical day without a reliable historical target source',
      );
    }
    if (
      day.targetSource === 'profile_fallback'
      && (
        HISTORICAL_TARGET_AS_STORED_FACT.test(sentence)
        || !EXPLICIT_CURRENT_PROFILE_TARGET.test(sentence)
      )
    ) {
      throw new DailyInsightValidationError(
        'Daily insight presents a read-only profile fallback as a historical target',
      );
    }

    const targetCalories = day.effectiveTargetCalories!;
    if (statedTargetCalories != null && statedTargetCalories !== targetCalories) {
      throw new DailyInsightValidationError(
        'Daily insight historical target value contradicts the resolved historical target',
      );
    }
    if (!hasTargetRelation) continue;

    const calories = day.calories!;
    if (
      (HISTORICAL_ABOVE_TARGET.test(sentence) && calories <= targetCalories)
      || (HISTORICAL_BELOW_TARGET.test(sentence) && calories >= targetCalories)
    ) {
      throw new DailyInsightValidationError(
        'Daily insight historical target comparison contradicts the resolved historical target',
      );
    }
  }
}

function validateMorningSourceSemantics(
  context: InsightInputContext,
  intent?: InsightIntent,
): void {
  if (intent === 'morning_orientation' && selectInsightIntent(context) !== 'morning_orientation') {
    throw new DailyInsightValidationError(
      'Daily insight morning intent requires an eligible morning source context',
    );
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

function validatePhaseProgressOpenBudgetSemantics(
  response: DailyInsightValidatedResponse,
  context: InsightInputContext,
  intent?: InsightIntent,
): void {
  if (
    intent !== 'phase_progress'
    || context.nutrition.remainingCalories == null
    || context.nutrition.remainingCalories <= 0
  ) {
    return;
  }

  const text = [response.title, response.summary, response.recommendation, response.cta]
    .filter(Boolean)
    .join(' ');
  if (
    CALORIE_INTAKE_INCREASE.test(text)
    || getResponseSentences(response).some((sentence) => OPEN_BUDGET_EATING_ACTION.test(sentence))
  ) {
    throw new DailyInsightValidationError(
      'Daily insight recommends increasing intake based on an open calorie budget',
    );
  }
}

function validateTargetRelativeEnergyBalanceSemantics(
  response: DailyInsightValidatedResponse,
  context: InsightInputContext,
): void {
  if (context.nutrition.remainingCalories == null) return;

  const fields = [response.title, response.summary, response.recommendation, response.cta]
    .filter((value): value is string => value != null);
  const hasAssertedEnergyBalanceClaim = fields.some((field) => {
    const clauses = field.split(/[,;.!?]|\b(?:aber|sondern|jedoch)\b/i);
    return clauses.some((clause) => {
      const terms = clause.matchAll(new RegExp(ENERGY_BALANCE_TERMS.source, 'gi'));
      for (const term of terms) {
        const termIndex = term.index ?? 0;
        const before = clause.slice(Math.max(0, termIndex - 80), termIndex);
        const after = clause.slice(termIndex + term[0].length, termIndex + term[0].length + 80);
        if (
          !ENERGY_BALANCE_NEGATION_BEFORE.test(before)
          && !ENERGY_BALANCE_NEGATION_AFTER.test(after)
        ) {
          return true;
        }
      }
      return false;
    });
  });

  if (hasAssertedEnergyBalanceClaim) {
    throw new DailyInsightValidationError(
      'Daily insight treats a target-relative calorie difference as an achieved energy balance',
    );
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
  validateMorningSourceSemantics(context, intent);
  validateHistoricalNutritionSemantics(response, context);
  validateTargetRelativeEnergyBalanceSemantics(response, context);
  validatePhaseProgressOpenBudgetSemantics(response, context, intent);
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