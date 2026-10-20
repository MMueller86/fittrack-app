import type { InsightInputContext, InsightIntent } from '@fittrack/shared';

export type { InsightIntent } from '@fittrack/shared';

function hasCurrentMealItem(context: InsightInputContext): boolean {
  return context.nutrition.today?.hasMealItem ?? context.nutrition.today !== null;
}

export function selectInsightIntent(context: InsightInputContext): InsightIntent {
  if (context.specialActivity != null) return 'activity_focus';

  if (context.progressIntelligence.milestone != null) return 'weight_signal';

  if (context.currentHourLocal != null && context.currentHourLocal < 10 && !hasCurrentMealItem(context)) {
    return 'morning_orientation';
  }

  if (context.nutrition.today != null && context.nutrition.targets != null) {
    return 'nutrition_guidance';
  }

  return 'general';
}