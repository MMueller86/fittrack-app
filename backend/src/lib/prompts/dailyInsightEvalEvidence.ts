import type { InsightNutritionDay } from '@fittrack/shared';

export function buildHistoricalComparisonEvidence(days: readonly InsightNutritionDay[]) {
  return days.map((day) => {
    const hasIntake = day.hasMealItem !== false && day.calories != null && Number.isFinite(day.calories);
    const hasTarget = day.baseTargetCalories != null && Number.isFinite(day.baseTargetCalories) && day.baseTargetCalories > 0
      && day.effectiveTargetCalories != null && Number.isFinite(day.effectiveTargetCalories) && day.effectiveTargetCalories > 0;
    const reliableSource = day.targetSource === 'day_target_snapshot'
      || (day.targetSource === 'special_activity_snapshot'
        && day.specialActivity?.dailyCalorieTarget != null
        && Number.isFinite(day.specialActivity.dailyCalorieTarget)
        && day.specialActivity.dailyCalorieTarget > 0);
    return {
      date: day.date,
      consumedCalories: hasIntake ? day.calories : null,
      targetCalories: hasTarget && reliableSource ? day.effectiveTargetCalories : null,
      relation: !hasIntake || !hasTarget || !reliableSource
        ? 'unavailable'
        : day.calories! < day.effectiveTargetCalories! ? 'below'
          : day.calories! > day.effectiveTargetCalories! ? 'above' : 'equal',
    };
  });
}