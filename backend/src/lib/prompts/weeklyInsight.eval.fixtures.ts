import type { WeeklyInsightPromptContext } from './weeklyInsightV2';

export interface WeeklyInsightEvalFixture {
  id: string;
  description: string;
  input: WeeklyInsightPromptContext;
  forbiddenPhrases: string[];
}

export type WeeklyInsightDiagnosticRelation = 'within_effective_target' | 'at_effective_target';

export interface WeeklyInsightSpecialActivityDiagnosticFixture {
  id: string;
  description: string;
  input: WeeklyInsightPromptContext;
  expectedBasis: 'effective_target';
  expectedRelation: WeeklyInsightDiagnosticRelation;
  expectedConsumedCalories: number;
  expectedBaseTargetCalories: 2300;
  expectedActivityBonusCalories: 1300;
  expectedEffectiveTargetCalories: 3600;
  expectedTargetPercent: number;
}

function makeSpecialActivityDiagnosticInput(consumedCalories: number): WeeklyInsightPromptContext {
  const dates = [
    '2026-08-07',
    '2026-08-08',
    '2026-08-09',
    '2026-08-10',
    '2026-08-11',
    '2026-08-12',
    '2026-08-13',
  ];

  return {
    periodStart: '2026-08-07',
    periodEnd: '2026-08-13',
    days: dates.map((date) => date === '2026-08-13'
      ? {
          date,
          consumedCalories,
          baseTargetCalories: 2300,
          effectiveTargetCalories: 3600,
          activityBonusCalories: 1300,
          targetPercent: (consumedCalories / 3600) * 100,
          dayType: null,
          activity: { type: 'cycling' as const, label: 'Radtour' },
          hasNutritionData: true,
        }
      : {
          date,
          consumedCalories: null,
          baseTargetCalories: null,
          effectiveTargetCalories: null,
          activityBonusCalories: null,
          targetPercent: null,
          dayType: null,
          activity: null,
          hasNutritionData: false,
        }),
    totals: {
      includedDayCount: 1,
      totalConsumedCalories: consumedCalories,
      totalTargetCalories: 3600,
      averageConsumedCalories: consumedCalories,
      averageTargetCalories: 3600,
      overallTargetPercent: (consumedCalories / 3600) * 100,
    },
  };
}

// US-01 AC-2/AC-4 and KB domain/02: the activity bonus raises the effective target.
export const WEEKLY_INSIGHT_SPECIAL_ACTIVITY_DIAGNOSTIC_FIXTURES:
  WeeklyInsightSpecialActivityDiagnosticFixture[] = [
    {
      id: 'special-activity-under-effective-target',
      description: '3000 kcal exceeds the base target but remains below the activity-adjusted target.',
      input: makeSpecialActivityDiagnosticInput(3000),
      expectedBasis: 'effective_target',
      expectedRelation: 'within_effective_target',
      expectedConsumedCalories: 3000,
      expectedBaseTargetCalories: 2300,
      expectedActivityBonusCalories: 1300,
      expectedEffectiveTargetCalories: 3600,
      expectedTargetPercent: 83.33333333333333,
    },
    {
      id: 'special-activity-at-effective-target',
      description: '3600 kcal is exactly the activity-adjusted target, not an exceedance.',
      input: makeSpecialActivityDiagnosticInput(3600),
      expectedBasis: 'effective_target',
      expectedRelation: 'at_effective_target',
      expectedConsumedCalories: 3600,
      expectedBaseTargetCalories: 2300,
      expectedActivityBonusCalories: 1300,
      expectedEffectiveTargetCalories: 3600,
      expectedTargetPercent: 100,
    },
  ];

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
    id: 'training-day-activitybonus-under-target',
    description: 'Keeps three consecutive training days below their activity-adjusted targets even when they exceed the base target.',
    input: {
      periodStart: '2026-08-07',
      periodEnd: '2026-08-13',
      days: [
        {
          date: '2026-08-07',
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
          date: '2026-08-08',
          consumedCalories: 2772,
          baseTargetCalories: 2300,
          effectiveTargetCalories: 2800,
          activityBonusCalories: 500,
          targetPercent: 99,
          dayType: 'training',
          activity: null,
          hasNutritionData: true,
        },
        {
          date: '2026-08-09',
          consumedCalories: 2700,
          baseTargetCalories: 2300,
          effectiveTargetCalories: 3000,
          activityBonusCalories: 700,
          targetPercent: 90,
          dayType: 'training',
          activity: null,
          hasNutritionData: true,
        },
        {
          date: '2026-08-10',
          consumedCalories: 2592,
          baseTargetCalories: 2300,
          effectiveTargetCalories: 3200,
          activityBonusCalories: 900,
          targetPercent: 81,
          dayType: 'training',
          activity: null,
          hasNutritionData: true,
        },
        {
          date: '2026-08-11',
          consumedCalories: 2250,
          baseTargetCalories: 2300,
          effectiveTargetCalories: 2300,
          activityBonusCalories: 0,
          targetPercent: 97.8260869565,
          dayType: 'rest',
          activity: null,
          hasNutritionData: true,
        },
        {
          date: '2026-08-12',
          consumedCalories: null,
          baseTargetCalories: null,
          effectiveTargetCalories: null,
          activityBonusCalories: null,
          targetPercent: null,
          dayType: null,
          activity: null,
          hasNutritionData: false,
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
        totalConsumedCalories: 12314,
        totalTargetCalories: 13600,
        averageConsumedCalories: 2462.8,
        averageTargetCalories: 2720,
        overallTargetPercent: 90.5441176471,
      },
    },
    // AC-5 and KB domain/07: effective targets, not base targets, govern exceedance wording.
    forbiddenPhrases: [
      'überschritten',
      'überschreitung',
      'über dem ziel',
      'über deinem ziel',
      'über deinen bedarf',
      'über dein ziel',
    ],
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