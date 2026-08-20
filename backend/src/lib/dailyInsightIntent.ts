import type { InsightInputContext, InsightIntent, PrimarySignalType } from '@fittrack/shared';

export type { InsightIntent } from '@fittrack/shared';

const WEIGHT_SIGNAL_TYPES: ReadonlySet<PrimarySignalType> = new Set([
  'plateau_broken',
  'milestone_reached',
  'bad_phase_recovered',
]);

function hasCurrentMealItem(context: InsightInputContext): boolean {
  return context.nutrition.today?.hasMealItem ?? context.nutrition.today !== null;
}

export function selectInsightIntent(context: InsightInputContext): InsightIntent {
  if (context.specialActivity != null) return 'activity_focus';

  const primarySignal = context.progressIntelligence.primarySignal.type;
  if (WEIGHT_SIGNAL_TYPES.has(primarySignal)) return 'weight_signal';
  if (primarySignal === 'phase_context') return 'phase_progress';

  if (context.currentHourLocal != null && context.currentHourLocal < 10 && !hasCurrentMealItem(context)) {
    return 'morning_orientation';
  }

  if (context.nutrition.today != null && context.nutrition.targets != null) {
    return 'nutrition_guidance';
  }

  return 'general';
}