import { describe, expect, it } from 'vitest';
import type { InsightInputContext } from '@fittrack/shared';
import {
  validateDailyInsightResponse,
  type DailyInsightValidatedResponse,
} from './dailyInsightValidation';

function makeContext(overrides: Partial<InsightInputContext> = {}): InsightInputContext {
  return {
    date: '2026-08-20',
    dayType: 'rest',
    workoutType: null,
    weight: {
      latestKg: 80,
      previousKg: 80.2,
      targetKg: 78,
      weeklyTrend30d: 'losing',
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
      last3Days: [],
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

function response(overrides: Partial<DailyInsightValidatedResponse> = {}): DailyInsightValidatedResponse {
  return {
    title: 'Dein Tagesfokus',
    summary: 'Heute hast du eine gute Basis gelegt und kannst den restlichen Tag ruhig und passend zu deinem Ziel gestalten.',
    recommendation: null,
    cta: null,
    ctaTarget: null,
    ...overrides,
  };
}

function historicalDay(
  overrides: Partial<InsightInputContext['nutrition']['last3Days'][number]> = {},
): InsightInputContext['nutrition']['last3Days'][number] {
  return {
    date: '2026-08-19',
    calories: 2100,
    protein: 130,
    carbs: 200,
    fat: 70,
    hasMealItem: true,
    mealItemCount: 3,
    baseTargetCalories: 2250,
    effectiveTargetCalories: 2250,
    activityBonusCalories: 0,
    targetSource: 'day_target_snapshot',
    dayType: 'rest',
    workoutType: null,
    specialActivity: null,
    ...overrides,
  };
}

describe('validateDailyInsightResponse', () => {
  it('accepts the strict nullable response shape', () => {
    expect(validateDailyInsightResponse(response(), makeContext())).toEqual(response());
  });

  it('rejects missing nullable properties and additional properties', () => {
    expect(() => validateDailyInsightResponse({
      title: 'Titel',
      summary: 'Zusammenfassung',
      recommendation: null,
      cta: null,
      extra: true,
    }, makeContext())).toThrow('invalid schema');
  });

  it('requires a CTA target whenever a CTA is present', () => {
    expect(() => validateDailyInsightResponse(
      response({ cta: 'Mahlzeit hinzufügen' }),
      makeContext(),
    )).toThrow('CTA and CTA target');
  });

  it('rejects eating recommendations after the calorie budget is exceeded', () => {
    expect(() => validateDailyInsightResponse(
      response({
        recommendation: 'Iss heute noch einen proteinreichen Snack.',
        cta: 'Mahlzeit hinzufügen',
        ctaTarget: 'Nutrition',
      }),
      makeContext({ nutrition: { ...makeContext().nutrition, remainingCalories: -100 } }),
    )).toThrow('calorie budget');
  });

  it('allows an explicitly tomorrow-oriented meal outlook after budget overage', () => {
    const context = makeContext({
      nutrition: { ...makeContext().nutrition, remainingCalories: -100 },
    });
    const valid = response({
      recommendation: 'Morgen kannst du eine proteinreiche Mahlzeit einplanen.',
    });

    expect(validateDailyInsightResponse(valid, context)).toEqual(valid);
  });

  it('rejects additional protein recommendations when the protein target is nearly complete', () => {
    expect(() => validateDailyInsightResponse(
      response({ recommendation: 'Eine proteinreiche Mahlzeit wäre sinnvoll.' }),
      makeContext({ nutrition: { ...makeContext().nutrition, remainingProteinG: 20 } }),
    )).toThrow('protein target is nearly complete');
  });

  it('rejects protein action language and non-null actions throughout an open nearly-complete day', () => {
    expect(() => validateDailyInsightResponse(
      response({
        summary: 'Dein Protein ist fast optimal, eine proteinreiche Mahlzeit passt heute trotzdem gut.',
        recommendation: 'Plane den restlichen Tag bewusst.',
      }),
      makeContext({ nutrition: { ...makeContext().nutrition, remainingCalories: 600, remainingProteinG: 10 } }),
      'nutrition_guidance',
    )).toThrow('protein target is nearly complete');
  });

  it('requires null action fields for nutrition guidance when protein is nearly complete', () => {
    expect(() => validateDailyInsightResponse(
      response({
        summary: 'Dein Tag ist noch offen und du bist für heute gut aufgestellt.',
        recommendation: 'Gestalte den restlichen Abend ganz nach deinem Rhythmus.',
      }),
      makeContext({ nutrition: { ...makeContext().nutrition, remainingCalories: 600, remainingProteinG: 10 } }),
      'nutrition_guidance',
    )).toThrow('action fields must be null');
  });

  it('keeps open-day protein-gap guidance consistent without weakening the budget lock', () => {
    const context = makeContext({
      nutrition: { ...makeContext().nutrition, remainingCalories: 600, remainingProteinG: 80 },
    });
    const valid = response({
      title: 'Protein im Fokus',
      summary: 'Der Tag ist noch offen und eine proteinreiche nächste Mahlzeit passt gut in deinen verbleibenden Spielraum.',
      recommendation: 'Magerquark mit Beeren wäre eine passende nächste Mahlzeit.',
      cta: 'Mahlzeit hinzufügen',
      ctaTarget: 'Nutrition',
    });

    expect(validateDailyInsightResponse(valid, context, 'nutrition_guidance')).toEqual(valid);
    expect(() => validateDailyInsightResponse(
      response({ summary: 'Du hast heute zu wenig gegessen und liegst unter deinem Ziel.' }),
      context,
      'nutrition_guidance',
    )).toThrow('open day as completed');
  });

  it('rejects phase-progress calorie-increase advice based on an open budget at noon', () => {
    const base = makeContext();
    const context = makeContext({
      currentHourLocal: 12,
      nutrition: { ...base.nutrition, remainingCalories: 700, remainingProteinG: 40 },
      progressIntelligence: {
        ...base.progressIntelligence,
        primarySignal: { type: 'phase_context', confidence: 0.9, freshnessScore: 0 },
        phase: { type: 'progressing' },
      },
    });
    const unsafeResponses: Array<Partial<DailyInsightValidatedResponse>> = [
      { title: 'Kalorienzufuhr erhöhen' },
      { summary: 'Nutze die restlichen Kalorien für eine zusätzliche Mahlzeit.' },
      { recommendation: 'Erhöhe deine Kalorienzufuhr, damit du dein Tagesziel erreichst.' },
      { cta: 'Kalorienspielraum ausschöpfen', ctaTarget: 'Nutrition' },
    ];

    for (const fields of unsafeResponses) {
      expect(() => validateDailyInsightResponse(
        response(fields),
        context,
        'phase_progress',
      )).toThrow('open calorie budget');
    }

    const validProgress = response({
      summary: 'Dein Gewichtsverlauf zeigt weiter in die richtige Richtung.',
    });
    expect(validateDailyInsightResponse(validProgress, context, 'phase_progress')).toEqual(validProgress);
  });

  it('rejects achieved energy-balance claims but allows target-relative wording on an open day', () => {
    const openContext = makeContext({
      nutrition: { ...makeContext().nutrition, remainingCalories: 600 },
    });

    expect(() => validateDailyInsightResponse(
      response({ summary: 'Du bist heute in einem Energiedefizit.' }),
      openContext,
      'phase_progress',
    )).toThrow('target-relative calorie difference');

    const targetRelativeResponse = response({
      summary: 'Im Vergleich zu deinem Tagesziel bleibt heute noch Spielraum.',
    });
    expect(validateDailyInsightResponse(
      targetRelativeResponse,
      openContext,
      'phase_progress',
    )).toEqual(targetRelativeResponse);
  });

  it('rejects achieved deficit or surplus claims in every field for a negative target-relative budget', () => {
    const base = makeContext();
    const context = makeContext({
      nutrition: { ...base.nutrition, remainingCalories: -100 },
    });
    const claims = [
      'Energiedefizit erreicht',
      'Energieüberschuss erreicht',
    ];
    const fields: Array<Partial<DailyInsightValidatedResponse>> = [
      { title: claims[0] },
      { summary: claims[0] },
      { recommendation: claims[0] },
      { cta: claims[0], ctaTarget: 'Nutrition' },
      { title: claims[1] },
      { summary: claims[1] },
      { recommendation: claims[1] },
      { cta: claims[1], ctaTarget: 'Nutrition' },
    ];

    for (const outputFields of fields) {
      expect(() => validateDailyInsightResponse(
        response(outputFields),
        context,
        'nutrition_guidance',
      )).toThrow('target-relative calorie difference');
    }
  });

  it('allows explicit denial of an achieved balance and supported negative target-relative wording', () => {
    const base = makeContext();
    const context = makeContext({
      nutrition: { ...base.nutrition, remainingCalories: -100 },
    });
    const responseWithSupportedComparison = response({
      summary: 'Deine Aufnahme liegt heute 100 kcal über deinem Tagesziel; daraus lässt sich kein tatsächlich erreichtes Energiedefizit ableiten.',
    });

    expect(validateDailyInsightResponse(
      responseWithSupportedComparison,
      context,
      'nutrition_guidance',
    )).toEqual(responseWithSupportedComparison);

    expect(() => validateDailyInsightResponse(
      response({
        summary: 'Daraus folgt kein Energiedefizit, aber ein Energieüberschuss liegt vor.',
      }),
      context,
      'nutrition_guidance',
    )).toThrow('target-relative calorie difference');
  });

  it('checks historical comparisons against the resolved historical target, not today\'s target', () => {
    const base = makeContext();
    const context = makeContext({
      nutrition: {
        ...base.nutrition,
        today: { ...base.nutrition.today!, calories: 1600 },
        targets: { ...base.nutrition.targets!, calories: 2000 },
        remainingCalories: 400,
        last3Days: [historicalDay()],
      },
    });
    const validHistoricalComparison = response({
      summary: 'Gestern lagen deine Einträge knapp unter dem gespeicherten Tagesziel von 2.250 kcal.',
    });

    expect(validateDailyInsightResponse(
      validHistoricalComparison,
      context,
      'nutrition_guidance',
    )).toEqual(validHistoricalComparison);

    expect(() => validateDailyInsightResponse(
      response({
        summary: 'Gestern lagen deine Einträge über dem gespeicherten Tagesziel von 2.250 kcal.',
      }),
      context,
      'nutrition_guidance',
    )).toThrow('historical target comparison');
  });

  it('validates explicit historical target numbers and rejects an ambiguous source', () => {
    const base = makeContext();
    const context = makeContext({
      currentHourLocal: 8,
      nutrition: {
        ...base.nutrition,
        today: null,
        remainingCalories: null,
        remainingProteinG: null,
        last3Days: [historicalDay()],
      },
    });
    const supportedHistoricalValue = response({
      summary: 'Gestern lag dein gespeichertes Tagesziel bei 2.250 kcal.',
    });

    expect(validateDailyInsightResponse(
      supportedHistoricalValue,
      context,
      'morning_orientation',
    )).toEqual(supportedHistoricalValue);

    expect(() => validateDailyInsightResponse(
      response({ summary: 'Gestern lag dein gespeichertes Tagesziel bei 2.000 kcal.' }),
      context,
      'morning_orientation',
    )).toThrow('historical target value');

    const ambiguousContext = makeContext({
      currentHourLocal: 8,
      nutrition: {
        ...base.nutrition,
        today: null,
        remainingCalories: null,
        remainingProteinG: null,
        last3Days: [historicalDay({
          baseTargetCalories: 2000,
          effectiveTargetCalories: 2000,
          targetSource: 'profile_fallback',
          specialActivity: { dailyCalorieTarget: 1400 } as InsightInputContext['nutrition']['last3Days'][number]['specialActivity'],
        })],
      },
    });

    expect(() => validateDailyInsightResponse(
      response({ summary: 'Gestern lag dein gespeichertes Tagesziel bei 2.000 kcal.' }),
      ambiguousContext,
      'morning_orientation',
    )).toThrow('historical target source');
  });

  it('rejects historical target comparisons when the target source is unavailable or ambiguous', () => {
    const base = makeContext();
    const context = makeContext({
      nutrition: {
        ...base.nutrition,
        last3Days: [historicalDay({
          baseTargetCalories: null,
          effectiveTargetCalories: null,
          targetSource: 'unavailable',
          specialActivity: {} as InsightInputContext['nutrition']['last3Days'][number]['specialActivity'],
        })],
      },
    });

    expect(() => validateDailyInsightResponse(
      response({ summary: 'Gestern lagen deine Einträge über deinem Tagesziel.' }),
      context,
      'nutrition_guidance',
    )).toThrow('historical target source');
  });

  it('carries the historical day into a following target relation sentence', () => {
    const base = makeContext();
    const context = makeContext({
      currentHourLocal: 8,
      nutrition: {
        ...base.nutrition,
        today: null,
        remainingCalories: null,
        remainingProteinG: null,
        last3Days: [historicalDay({
          baseTargetCalories: null,
          effectiveTargetCalories: null,
          targetSource: 'unavailable',
          specialActivity: {} as InsightInputContext['nutrition']['last3Days'][number]['specialActivity'],
        })],
      },
    });

    expect(() => validateDailyInsightResponse(
      response({
        summary: 'Gestern hast du 2.100 kcal aufgenommen. Deine Kalorienaufnahme liegt über einem verlässlichen Ziel, obwohl kein historischer Vergleich möglich ist.',
      }),
      context,
      'morning_orientation',
    )).toThrow('historical target source');
  });

  it('does not present a profile fallback as a historically stored target', () => {
    const base = makeContext();
    const context = makeContext({
      nutrition: {
        ...base.nutrition,
        last3Days: [historicalDay({ targetSource: 'profile_fallback' })],
      },
    });

    expect(() => validateDailyInsightResponse(
      response({ summary: 'Gestern lagen deine Einträge unter deinem damaligen Tagesziel.' }),
      context,
      'nutrition_guidance',
    )).toThrow('profile fallback');

    const validReadOnlyComparison = response({
      summary: 'Verglichen mit dem heutigen Profilziel lagen die gestrigen Einträge leicht darunter.',
    });
    expect(validateDailyInsightResponse(
      validReadOnlyComparison,
      context,
      'nutrition_guidance',
    )).toEqual(validReadOnlyComparison);
  });

  it('rejects morning output outside the eligible morning context', () => {
    const base = makeContext();
    const context = makeContext({
      currentHourLocal: 12,
      nutrition: {
        ...base.nutrition,
        today: null,
        remainingCalories: null,
        remainingProteinG: null,
      },
    });

    expect(() => validateDailyInsightResponse(
      response(),
      context,
      'morning_orientation',
    )).toThrow('morning intent');
  });

  it('does not treat an unlogged prior day as zero intake in morning output', () => {
    const base = makeContext();
    const context = makeContext({
      currentHourLocal: 8,
      nutrition: {
        ...base.nutrition,
        today: null,
        remainingCalories: null,
        remainingProteinG: null,
        last3Days: [historicalDay({
          calories: null,
          protein: null,
          hasMealItem: false,
          mealItemCount: 0,
          baseTargetCalories: 2000,
          effectiveTargetCalories: 2000,
          targetSource: 'profile_fallback',
        })],
      },
    });

    for (const unsupportedSummary of [
      'Gestern hast du nichts gegessen.',
      'Gestern lag deine Aufnahme bei 0 kcal.',
      'Gestern lag dein Eiweiß bei null.',
    ]) {
      expect(() => validateDailyInsightResponse(
        response({ summary: unsupportedSummary }),
        context,
        'morning_orientation',
      )).toThrow('historical nutrition claim');
    }

    const validUnavailableSource = response({
      summary: 'Zu gestern liegen keine Einträge vor, deshalb lässt sich die Aufnahme nicht verlässlich einordnen.',
    });
    expect(validateDailyInsightResponse(
      validUnavailableSource,
      context,
      'morning_orientation',
    )).toEqual(validUnavailableSource);
  });

  it('requires natural effective-target vocabulary for an activity budget context', () => {
    const context = makeContext({
      specialActivity: {} as InsightInputContext['specialActivity'],
      activityCompletionStatus: 'likely_completed',
      activityStatusSource: 'local_time_heuristic',
      nutrition: {
        ...makeContext().nutrition,
        targets: {
          ...makeContext().nutrition.targets!,
          baseCalories: 2300,
          activityBonusCalories: 700,
          targetSource: 'special_activity_snapshot',
        },
        remainingCalories: 200,
        remainingProteinG: 10,
      },
    });

    expect(() => validateDailyInsightResponse(
      response({
        title: 'Dein Aktivitätsfokus',
        summary: 'Die Tour steht im Mittelpunkt und dein Tag bleibt heute ruhig und offen.',
      }),
      context,
      'activity_focus',
    )).toThrow('effective activity target');

    expect(validateDailyInsightResponse(
      response({
        title: 'Dein Aktivitätsfokus',
        summary: 'Die Tour steht im Mittelpunkt und dein Kalorienziel berücksichtigt den zusätzlichen Bedarf.',
      }),
      context,
      'activity_focus',
    )).toEqual(response({
      title: 'Dein Aktivitätsfokus',
      summary: 'Die Tour steht im Mittelpunkt und dein Kalorienziel berücksichtigt den zusätzlichen Bedarf.',
    }));
  });

  it('rejects a generic meal action under the protein lock for activity focus', () => {
    const context = makeContext({
      specialActivity: {} as InsightInputContext['specialActivity'],
      activityCompletionStatus: 'likely_completed',
      activityStatusSource: 'local_time_heuristic',
      nutrition: {
        ...makeContext().nutrition,
        targets: {
          ...makeContext().nutrition.targets!,
          baseCalories: 2300,
          activityBonusCalories: 700,
          targetSource: 'special_activity_snapshot',
        },
        remainingCalories: 200,
        remainingProteinG: 10,
      },
    });

    expect(() => validateDailyInsightResponse(
      response({
        title: 'Dein Aktivitätsfokus',
        summary: 'Die Tour steht im Mittelpunkt und dein Kalorienziel berücksichtigt den zusätzlichen Bedarf.',
        recommendation: 'Plane noch eine Mahlzeit für den Abend.',
        cta: 'Mahlzeit hinzufügen',
        ctaTarget: 'Nutrition',
      }),
      context,
      'activity_focus',
    )).toThrow('protein or meal action');

    expect(() => validateDailyInsightResponse(
      response({
        title: 'Dein Aktivitätsfokus',
        summary: 'Die Tour steht im Mittelpunkt und eine weitere Mahlzeit wäre heute sinnvoll.',
      }),
      context,
      'activity_focus',
    )).toThrow('protein or meal action');
  });

  it('rejects completed activity language for planned and unknown activity', () => {
    for (const status of ['planned', 'unknown'] as const) {
      expect(() => validateDailyInsightResponse(
        response({ summary: 'Du hast die Wanderung absolviert.' }),
        makeContext({
          specialActivity: {} as InsightInputContext['specialActivity'],
          activityCompletionStatus: status,
          activityStatusSource: status === 'unknown' ? 'unavailable' : 'local_time_heuristic',
        }),
      )).toThrow('activity as completed');
    }
  });

  it('allows only uncertain activity language for likely completed activity', () => {
    expect(validateDailyInsightResponse(
      response({ summary: 'Die Wanderung hat wahrscheinlich stattgefunden.' }),
      makeContext({
        specialActivity: {} as InsightInputContext['specialActivity'],
        activityCompletionStatus: 'likely_completed',
        activityStatusSource: 'local_time_heuristic',
      }),
    )).toEqual(response({ summary: 'Die Wanderung hat wahrscheinlich stattgefunden.' }));

    expect(() => validateDailyInsightResponse(
      response({ summary: 'Du hast die Wanderung absolviert.' }),
      makeContext({
        specialActivity: {} as InsightInputContext['specialActivity'],
        activityCompletionStatus: 'likely_completed',
        activityStatusSource: 'local_time_heuristic',
      }),
    )).toThrow('activity as completed');
  });

  it('keeps day 14 current and rejects current weight language from day 15 onward', () => {
    const currentResponse = response({ summary: 'Dein Gewicht ist heute klar gesunken.' });

    expect(validateDailyInsightResponse(
      currentResponse,
      makeContext({ weight: { ...makeContext().weight, daysSinceLastMeasurement: 14 } }),
    )).toEqual(currentResponse);

    expect(() => validateDailyInsightResponse(
      currentResponse,
      makeContext({ weight: { ...makeContext().weight, daysSinceLastMeasurement: 15 } }),
    )).toThrow('stale weight');
  });

  it('accepts a neutral stale-weight notice', () => {
    expect(validateDailyInsightResponse(
      response({ summary: 'Deine Gewichtsdaten sind veraltet. Ein neuer Eintrag würde die Analyse verbessern.' }),
      makeContext({ weight: { ...makeContext().weight, daysSinceLastMeasurement: 15 } }),
    )).toEqual(response({ summary: 'Deine Gewichtsdaten sind veraltet. Ein neuer Eintrag würde die Analyse verbessern.' }));
  });

  it('accepts an explicit stale marker for a weight trend', () => {
    expect(validateDailyInsightResponse(
      response({ summary: 'Der Trend deines Gewichts ist nicht aktuell.' }),
      makeContext({ weight: { ...makeContext().weight, daysSinceLastMeasurement: 15 } }),
    )).toEqual(response({ summary: 'Der Trend deines Gewichts ist nicht aktuell.' }));
  });

  it('rejects known abstract and technical phrases', () => {
    expect(() => validateDailyInsightResponse(
      response({ summary: 'Das ist eine positive Entwicklung.' }),
      makeContext(),
    )).toThrow('forbidden technical');
  });
});