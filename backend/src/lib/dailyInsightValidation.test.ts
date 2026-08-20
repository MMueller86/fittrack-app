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