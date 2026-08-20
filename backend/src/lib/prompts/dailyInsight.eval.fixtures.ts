import type { InsightInputContext, InsightIntent, InsightNutritionDay } from '@fittrack/shared';

export interface DailyInsightEvalFixture {
  id: string;
  description: string;
  input: InsightInputContext;
  intent: InsightIntent;
  forbiddenPhrases: string[];
  /** Each group represents one required concept; one natural-language alternative must occur. */
  requiredPhraseGroups?: readonly (readonly string[])[];
  expectNullActionFields?: boolean;
}

// AC-1/AC-4/AC-7/AC-8/AC-9 and KB domain/07: generated copy must remain human-facing.
const COMMON_FORBIDDEN_PHRASES = [
  'positive entwicklung',
  'positive fortschrittsphase',
  'regressionsphase erkannt',
  'plateau_active',
  'freshnessscore',
  'remainingcalories',
  'activitycompletionstatus',
  'latestkg',
  'trend7d',
  'std dev',
  'medizinische diagnose',
];

const historicalDay: InsightNutritionDay = {
  date: '2026-08-19',
  calories: 1980,
  protein: 145,
  carbs: 210,
  fat: 65,
  hasMealItem: true,
  mealItemCount: 3,
  baseTargetCalories: 2100,
  effectiveTargetCalories: 2100,
  activityBonusCalories: 0,
  targetSource: 'profile_fallback',
  dayType: 'rest',
  workoutType: null,
  specialActivity: null,
};

function baseContext(overrides: Partial<InsightInputContext> = {}): InsightInputContext {
  return {
    date: '2026-08-20',
    dayType: 'rest',
    workoutType: null,
    weight: {
      latestKg: 80,
      previousKg: 80.2,
      targetKg: 78,
      trend7d: 'losing',
      last7Values: [80, 80.2, 80.4],
      isOutlierPrevious: false,
      isOutlierLatest: false,
      daysSinceLastMeasurement: 0,
      lastMeasurementDate: '2026-08-20',
    },
    nutrition: {
      today: { calories: 1500, protein: 100, carbs: 150, fat: 50, fiber: 20, hasMealItem: true },
      targets: { calories: 2000, proteinG: 140, carbsG: 220, fatG: 70, fiberG: 30 },
      remainingCalories: 500,
      remainingProteinG: 40,
      last3Days: [historicalDay, { ...historicalDay, date: '2026-08-18' }, { ...historicalDay, date: '2026-08-17' }],
    },
    userGoal: 'lose_weight',
    userGoalIntensity: 'moderate',
    displayName: 'Sportler',
    progressIntelligence: {
      version: 'v1',
      primarySignal: { type: 'daily_context', confidence: 0.5, freshnessScore: 0 },
      contextSignals: [],
      progress: null,
      phase: null,
      plateau: null,
      milestone: null,
      monthlyTrend: null,
      dayCompleteness: 1,
      goalAtCalculation: 'lose_weight',
    },
    currentHourLocal: 18,
    specialActivity: null,
    activityCompletionStatus: null,
    activityStatusSource: null,
    ...overrides,
  };
}

const hikingActivity = {
  type: 'hiking' as const,
  movementTimeMinutes: 300,
  distanceKm: 24,
  elevationGainM: 1200,
  bodyWeightKg: 80,
  dailyCalorieTarget: 2300,
  calculatedAt: '2026-08-20T08:00:00.000Z',
  estimatedMet: 7,
  activityCalories: 1800,
  alreadyAccountedCalories: 300,
  activityBonus: 1200,
  terrainType: 'alpine' as const,
  packCategory: 'medium' as const,
};

const historicalHikingActivity = {
  ...hikingActivity,
  dailyCalorieTarget: 3200,
  activityBonus: 900,
  calculatedAt: '2026-08-19T20:00:00.000Z',
};

export const DAILY_INSIGHT_EVAL_FIXTURES: DailyInsightEvalFixture[] = [
  {
    id: 'weight-outlier-context',
    description: 'A single adverse weight fluctuation is subordinate to the goal-aligned weekly trend.',
    input: baseContext({
      currentHourLocal: 21,
      weight: {
        ...baseContext().weight,
        latestKg: 80.4,
        previousKg: 82,
        trend7d: 'losing',
        last7Values: [80.4, 82, 80.8, 80.7, 80.6, 80.5, 80.4],
        isOutlierPrevious: true,
        isOutlierLatest: false,
      },
      progressIntelligence: {
        ...baseContext().progressIntelligence,
        primarySignal: { type: 'phase_context', confidence: 0.9, freshnessScore: 0 },
        phase: { type: 'progressing' },
      },
    }),
    intent: 'phase_progress',
    // AC-1/AC-5/AC-9: acknowledge variance, use the longer trend, and motivate without a setback claim.
    requiredPhraseGroups: [
      ['trend', 'wochenverlauf', 'gewichtsverlauf', 'richtung'],
      ['auf kurs', 'richtige richtung', 'weiter', 'rückgang', 'ziel'],
    ],
    forbiddenPhrases: [
      ...COMMON_FORBIDDEN_PHRASES,
      'kg weniger als gestern',
      'du hast zugenommen',
      'dein gewicht ist gestiegen',
    ],
  },
  {
    id: 'current-effective-activity-budget',
    description: 'An elevated current activity target prevents a high absolute intake from being judged in isolation.',
    input: baseContext({
      currentHourLocal: 22,
      specialActivity: {
        ...hikingActivity,
        movementTimeMinutes: 180,
        distanceKm: 16,
        dailyCalorieTarget: 3000,
        activityBonus: 700,
      },
      activityCompletionStatus: 'likely_completed',
      activityStatusSource: 'local_time_heuristic',
      nutrition: {
        ...baseContext().nutrition,
        today: { calories: 2800, protein: 130, carbs: 340, fat: 80, fiber: 28, hasMealItem: true },
        targets: {
          calories: 3000,
          proteinG: 140,
          carbsG: 360,
          fatG: 85,
          fiberG: 30,
          baseCalories: 2300,
          activityBonusCalories: 700,
          targetSource: 'special_activity_snapshot',
        },
        remainingCalories: 200,
        remainingProteinG: 10,
      },
    }),
    intent: 'activity_focus',
    // AC-2/AC-3 and KB domain/01: the effective target, not absolute calories, controls the assessment.
    requiredPhraseGroups: [
      ['kalorienziel', 'tagesziel', 'energiebedarf', 'ziel'],
      ['aktivität', 'wanderung', 'tour'],
    ],
    forbiddenPhrases: [
      ...COMMON_FORBIDDEN_PHRASES,
      'über deinem ziel',
      'über dem ziel',
      'zu viele kalorien',
    ],
  },
  {
    id: 'historical-effective-target',
    description: 'A completed activity day is compared with its own historical effective target.',
    input: baseContext({
      currentHourLocal: 23,
      nutrition: {
        ...baseContext().nutrition,
        today: { calories: 1800, protein: 100, carbs: 180, fat: 60, fiber: 20, hasMealItem: true },
        targets: {
          calories: 2200,
          proteinG: 140,
          carbsG: 220,
          fatG: 70,
          fiberG: 30,
          baseCalories: 2200,
          activityBonusCalories: 0,
          targetSource: 'profile_fallback',
        },
        remainingCalories: 400,
        remainingProteinG: 40,
        last3Days: [
          {
            date: '2026-08-19',
            calories: 3000,
            protein: 150,
            carbs: 330,
            fat: 80,
            hasMealItem: true,
            mealItemCount: 4,
            baseTargetCalories: 2300,
            effectiveTargetCalories: 3200,
            activityBonusCalories: 900,
            targetSource: 'special_activity_snapshot',
            dayType: 'training',
            workoutType: null,
            specialActivity: historicalHikingActivity,
          },
          { ...historicalDay, date: '2026-08-18' },
          { ...historicalDay, date: '2026-08-17' },
        ],
      },
    }),
    intent: 'nutrition_guidance',
    // AC-4: historical target snapshots are interpreted per day and never replaced by today's target.
    requiredPhraseGroups: [
      ['gestern', 'letzten tag', 'vergangenen tag', 'letzten tage'],
      ['ziel', 'energiebedarf', 'kalorien'],
    ],
    forbiddenPhrases: [
      ...COMMON_FORBIDDEN_PHRASES,
      'gestern über deinem ziel',
      'gestern zu viel gegessen',
      'kalorienüberschuss gestern',
    ],
  },
  {
    id: 'planned-activity',
    description: 'A planned activity is not described as completed.',
    input: baseContext({
      currentHourLocal: 19,
      specialActivity: hikingActivity,
      activityCompletionStatus: 'planned',
      activityStatusSource: 'local_time_heuristic',
    }),
    intent: 'activity_focus',
    // US Insight F4 and the ActivityCompletionStatus contract: planned is not completed.
    requiredPhraseGroups: [['geplant', 'eingetragen', 'später', 'vorbereiten']],
    forbiddenPhrases: [
      ...COMMON_FORBIDDEN_PHRASES,
      'absolviert',
      'abgeschlossen',
      'sicher durchgeführt',
      'hat stattgefunden',
      'du hast die wanderung gemacht',
    ],
  },
  {
    id: 'likely-completed-activity',
    description: 'A late-day activity is described only probabilistically, never as a confirmed fact.',
    input: baseContext({
      currentHourLocal: 22,
      specialActivity: hikingActivity,
      activityCompletionStatus: 'likely_completed',
      activityStatusSource: 'local_time_heuristic',
    }),
    intent: 'activity_focus',
    // AC-6/AC-7: the 20:00 heuristic permits only probabilistic or conditional language.
    requiredPhraseGroups: [['wahrscheinlich', 'vermutlich', 'könnte', 'wenn', 'falls']],
    forbiddenPhrases: [
      ...COMMON_FORBIDDEN_PHRASES,
      'absolviert',
      'sicher durchgeführt',
      'du hast die wanderung gemacht',
      'du hast die tour gemacht',
    ],
  },
  {
    id: 'unknown-activity',
    description: 'An activity without a usable local hour stays neutral.',
    input: baseContext({
      currentHourLocal: null,
      specialActivity: hikingActivity,
      activityCompletionStatus: 'unknown',
      activityStatusSource: 'unavailable',
    }),
    intent: 'activity_focus',
    // US Insight F4: missing or invalid time must not create a completion fact.
    forbiddenPhrases: [
      ...COMMON_FORBIDDEN_PHRASES,
      'absolviert',
      'abgeschlossen',
      'sicher durchgeführt',
      'hat stattgefunden',
      'du hast die wanderung gemacht',
    ],
  },
  {
    id: 'intensive-endurance-fueling',
    description: 'A long alpine endurance activity receives fueling and recovery guidance beyond a generic protein snack.',
    input: baseContext({
      currentHourLocal: 23,
      specialActivity: {
        ...hikingActivity,
        movementTimeMinutes: 360,
        distanceKm: 30,
        elevationGainM: 1600,
        dailyCalorieTarget: 3400,
        activityBonus: 1100,
      },
      activityCompletionStatus: 'likely_completed',
      activityStatusSource: 'local_time_heuristic',
      nutrition: {
        ...baseContext().nutrition,
        today: { calories: 2700, protein: 90, carbs: 280, fat: 75, fiber: 25, hasMealItem: true },
        targets: {
          calories: 3400,
          proteinG: 150,
          carbsG: 420,
          fatG: 90,
          fiberG: 30,
          baseCalories: 2300,
          activityBonusCalories: 1100,
          targetSource: 'special_activity_snapshot',
        },
        remainingCalories: 700,
        remainingProteinG: 60,
      },
    }),
    intent: 'activity_focus',
    // AC-8 and DV-2: qualitative endurance guidance must cover fuel, fluids, and recovery without invented thresholds.
    requiredPhraseGroups: [
      ['kohlenhydrate', 'energie'],
      ['regeneration', 'regener', 'erholung', 'erhol'],
      ['flüssigkeit', 'trinken', 'hydration'],
    ],
    forbiddenPhrases: [
      ...COMMON_FORBIDDEN_PHRASES,
      'nur ein proteinreicher snack',
      'ausschließlich protein',
      'pro stunde',
      'exakt',
    ],
  },
  {
    id: 'budget-lock',
    description: 'A negative remaining budget does not trigger another meal recommendation.',
    input: baseContext({
      currentHourLocal: 22,
      nutrition: {
        ...baseContext().nutrition,
        remainingCalories: -120,
        remainingProteinG: 60,
      },
    }),
    intent: 'nutrition_guidance',
    // US Insight F6 and KB domain/07: the budget lock has priority over a protein gap.
    forbiddenPhrases: [
      ...COMMON_FORBIDDEN_PHRASES,
      'iss noch',
      'mehr essen',
      'noch etwas essen',
      'heute noch essen',
      'proteinshake',
      'mahlzeit hinzufügen',
      'proteinreiche mahlzeit',
    ],
  },
  {
    id: 'protein-gap-with-budget',
    description: 'A real protein gap with remaining calories may receive one concrete next-meal suggestion.',
    input: baseContext({
      currentHourLocal: 18,
      nutrition: {
        ...baseContext().nutrition,
        today: { calories: 1600, protein: 70, carbs: 160, fat: 50, fiber: 20, hasMealItem: true },
        remainingCalories: 600,
        remainingProteinG: 80,
      },
    }),
    intent: 'nutrition_guidance',
    // AC-6: protein guidance is appropriate only when the budget is not exceeded and the gap is material.
    requiredPhraseGroups: [
      ['protein', 'eiweiß'],
      ['magerquark', 'skyr', 'hüttenkäse', 'hähnchen', 'proteinreiche'],
    ],
    forbiddenPhrases: [
      ...COMMON_FORBIDDEN_PHRASES,
      'fast optimal',
      'proteinziel ist erreicht',
    ],
  },
  {
    id: 'protein-nearly-complete',
    description: 'A nearly complete protein target is not turned into a contradictory urgent eating recommendation.',
    input: baseContext({
      currentHourLocal: 18,
      nutrition: {
        ...baseContext().nutrition,
        today: { calories: 1600, protein: 130, carbs: 160, fat: 50, fiber: 20, hasMealItem: true },
        remainingCalories: 600,
        remainingProteinG: 10,
      },
    }),
    intent: 'nutrition_guidance',
    // AC-6: remainingProteinG <= 20 is nearly complete; no additional protein action should follow.
    requiredPhraseGroups: [['protein', 'eiweiß']],
    forbiddenPhrases: [
      ...COMMON_FORBIDDEN_PHRASES,
      'mehr protein',
      'zusätzlich protein',
      'proteinreiche mahlzeit',
      'proteinreich essen',
      'proteinshake',
      'magerquark',
      'skyr',
      'hüttenkäse',
      'hähnchenbrust',
    ],
    expectNullActionFields: true,
  },
  {
    id: 'empty-morning',
    description: 'An empty early morning uses historical data without judging today.',
    input: baseContext({
      currentHourLocal: 8,
      nutrition: { ...baseContext().nutrition, today: null, remainingCalories: null, remainingProteinG: null },
    }),
    intent: 'morning_orientation',
    // US Insight F7 and the zero-versus-missing contract: no current MealItem is not a deficit.
    requiredPhraseGroups: [['gestern', 'vortag', 'letzten tage', 'letzten drei tage', 'letzten drei tagen', 'vergangenen tage']],
    forbiddenPhrases: [
      ...COMMON_FORBIDDEN_PHRASES,
      'zu wenig gegessen',
      'heute nichts gegessen',
      'unter deinem ziel',
    ],
  },
  {
    id: 'stale-weight',
    description: 'Stale weight data is not presented as a current trend.',
    input: baseContext({
      weight: {
        ...baseContext().weight,
        latestKg: null,
        previousKg: null,
        trend7d: null,
        last7Values: [],
        daysSinceLastMeasurement: 20,
        lastMeasurementDate: '2026-07-31',
      },
      progressIntelligence: {
        ...baseContext().progressIntelligence,
        primarySignal: { type: 'phase_context', confidence: 0.6, freshnessScore: 0 },
      },
    }),
    intent: 'phase_progress',
    // US Insight F2 and KB domain/07: old measurements are not current evidence.
    requiredPhraseGroups: [
      ['lange kein gewicht', 'gewichtsdaten sind veraltet', 'nicht aktuell', 'neuer eintrag', 'neue messung'],
      ['veraltet', 'nicht aktuell', 'älteren messungen', 'liegt länger zurück', 'unsicher', 'neuer eintrag', 'neue messung'],
    ],
    forbiddenPhrases: [
      ...COMMON_FORBIDDEN_PHRASES,
      'dein gewicht ist heute',
      'dein trend zeigt heute',
      'der trend zeigt heute',
      'der wochenverlauf zeigt heute',
      'kg weniger als gestern',
    ],
  },
];