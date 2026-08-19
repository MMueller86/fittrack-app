import type { WeeklyInsightPromptContext } from './weeklyInsightV1';

export interface WeeklyInsightEvalFixture {
  id: string;
  description: string;
  input: WeeklyInsightPromptContext;
  forbiddenPhrases: string[];
}

export const WEEKLY_INSIGHT_EVAL_FIXTURES: WeeklyInsightEvalFixture[] = [
  {
    id: 'mixed-data-and-adjusted-activity-target',
    description: 'Interprets a mixed week without treating missing days as under-supply.',
    input: {
      periodStart: '2026-08-07',
      periodEnd: '2026-08-13',
      days: [
        {
          date: '2026-08-07',
          consumedCalories: 2185,
          baseTargetCalories: 2300,
          effectiveTargetCalories: 2300,
          activityBonusCalories: 0,
          targetPercent: 95,
          dayType: 'rest',
          activity: null,
          hasNutritionData: true,
        },
        {
          date: '2026-08-08',
          consumedCalories: 3150,
          baseTargetCalories: 2300,
          effectiveTargetCalories: 3000,
          activityBonusCalories: 700,
          targetPercent: 105,
          dayType: 'training',
          activity: { type: 'hiking', label: 'Wanderung' },
          hasNutritionData: true,
        },
        {
          date: '2026-08-09',
          consumedCalories: null,
          baseTargetCalories: 2300,
          effectiveTargetCalories: 2300,
          activityBonusCalories: 0,
          targetPercent: null,
          dayType: 'rest',
          activity: null,
          hasNutritionData: false,
        },
        {
          date: '2026-08-10',
          consumedCalories: 0,
          baseTargetCalories: 2300,
          effectiveTargetCalories: 2300,
          activityBonusCalories: 0,
          targetPercent: 0,
          dayType: 'rest',
          activity: null,
          hasNutritionData: true,
        },
        {
          date: '2026-08-11',
          consumedCalories: 2400,
          baseTargetCalories: null,
          effectiveTargetCalories: null,
          activityBonusCalories: null,
          targetPercent: null,
          dayType: null,
          activity: null,
          hasNutritionData: true,
        },
        {
          date: '2026-08-12',
          consumedCalories: 2000,
          baseTargetCalories: 2300,
          effectiveTargetCalories: 2300,
          activityBonusCalories: 0,
          targetPercent: 86.9565217391,
          dayType: 'rest',
          activity: null,
          hasNutritionData: true,
        },
        {
          date: '2026-08-13',
          consumedCalories: null,
          baseTargetCalories: null,
          effectiveTargetCalories: null,
          activityBonusCalories: null,
          targetPercent: null,
          dayType: null,
          activity: null,
          hasNutritionData: false,
        },
      ],
      totals: {
        includedDayCount: 5,
        totalConsumedCalories: 9735,
        totalTargetCalories: 12100,
        averageConsumedCalories: 1947,
        averageTargetCalories: 2420,
        overallTargetPercent: 80.4545454545,
      },
    },
    // AC-11/AC-13 and KB domain/07: missing data is not an under-supply diagnosis.
    forbiddenPhrases: ['unterversorgt', 'defizit', 'diagnose', 'medizinisch'],
  },
  {
    id: 'zero-calorie-entry-is-data',
    description: 'Does not turn a valid zero-calorie MealItem into missing nutrition.',
    input: {
      periodStart: '2026-08-07',
      periodEnd: '2026-08-13',
      days: Array.from({ length: 7 }, (_, index) => ({
        date: `2026-08-${String(index + 7).padStart(2, '0')}`,
        consumedCalories: index === 6 ? 0 : null,
        baseTargetCalories: index === 6 ? 2000 : null,
        effectiveTargetCalories: index === 6 ? 2000 : null,
        activityBonusCalories: index === 6 ? 0 : null,
        targetPercent: index === 6 ? 0 : null,
        dayType: index === 6 ? 'rest' as const : null,
        activity: null,
        hasNutritionData: index === 6,
      })),
      totals: {
        includedDayCount: 1,
        totalConsumedCalories: 0,
        totalTargetCalories: 2000,
        averageConsumedCalories: 0,
        averageTargetCalories: 2000,
        overallTargetPercent: 0,
      },
    },
    // AC-6/AC-13: the zero value is factual data, but the prompt must not create medical copy.
    forbiddenPhrases: ['diagnose', 'medizinisch'],
  },
];