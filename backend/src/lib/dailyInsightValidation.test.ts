import { describe, expect, it } from 'vitest';
import type { InsightInputContext } from '@fittrack/shared';
import {
  toInsightResponse,
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
      dailyInsightProteinStatus: 'below_range',
      mealAdviceAllowed: true,
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
    dailyActivityStatus: null,
    ...overrides,
  };
}

function response(overrides: Partial<DailyInsightValidatedResponse> = {}): DailyInsightValidatedResponse {
  return {
    greeting: 'Hallo, Sportler! 👋',
    shortInsight: 'Dein Tag ist noch offen und du kannst ihn ruhig gestalten.',
    title: 'Dein Tagesfokus',
    summary: 'Heute hast du eine gute Basis gelegt und kannst den restlichen Tag ruhig und passend zu deinem Ziel gestalten.',
    recommendation: null,
    ...overrides,
  };
}

describe('validateDailyInsightResponse', () => {
  it('accepts a 5,000-character summary and rejects 5,001 characters', () => {
    const summary = 'x'.repeat(5_000);
    expect(validateDailyInsightResponse(response({ summary }), makeContext()).summary).toBe(summary);
    expect(() => validateDailyInsightResponse(response({ summary: `${summary}x` }), makeContext()))
      .toThrow('invalid schema');
  });

  it('accepts the strict nullable response shape', () => {
    expect(validateDailyInsightResponse(response(), makeContext())).toEqual(response());
  });

  it('rejects missing nullable properties and additional properties', () => {
    expect(() => validateDailyInsightResponse({
      title: 'Titel',
      summary: 'Zusammenfassung',
      recommendation: null,
      extra: true,
    }, makeContext())).toThrow('invalid schema');
  });

  it('rejects legacy CTA fields', () => {
    expect(() => validateDailyInsightResponse({ ...response(), cta: 'Ernährung öffnen' }, makeContext()))
      .toThrow('invalid schema');
    expect(() => validateDailyInsightResponse({ ...response(), ctaTarget: 'Nutrition' }, makeContext()))
      .toThrow('invalid schema');
  });

  it.each([
    '',
    '   ',
    'Dein Tag',
    'Dein Tag bleibt offen',
    'Dein Tag bleibt offen. Du hast Zeit.',
    'Dein Tag bleibt offen!Du hast Zeit.',
    'Dein Tag bleibt offen...',
    'Dein Tag bleibt offen…',
    '- Dein Tag bleibt offen.',
    '**Dein Tag bleibt offen.**',
    'Dein Tag\nbleibt offen.',
  ])('rejects invalid short copy: %s', (shortInsight) => {
    expect(() => validateDailyInsightResponse(response({ shortInsight }), makeContext())).toThrow();
  });

  it.each([
    'Guten Morgen, Sportler! 👋',
    'Hallo, Andere! 👋',
    'Hallo, Sportler!',
    'Hallo, Sportler! gut',
    'Hallo, Sportler! 👋💪',
  ])('rejects invalid greetings: %s', (greeting) => {
    expect(() => validateDailyInsightResponse(response({ greeting }), makeContext())).toThrow('greeting');
  });

  it('enforces JS length boundaries without truncating a long name or sentence', () => {
    const name = 'A'.repeat(109);
    const greeting = `Hallo, ${name}! 👋`;
    const shortInsight = `Dein Tag bleibt ${'a'.repeat(223)}.`;
    expect(greeting.length).toBe(120);
    expect(shortInsight.length).toBe(240);
    expect(validateDailyInsightResponse(response({ greeting, shortInsight }), makeContext({ displayName: name })))
      .toMatchObject({ greeting, shortInsight });
    expect(() => validateDailyInsightResponse(
      response({ greeting: `Hallo, ${name}A! 👋` }),
      makeContext({ displayName: `${name}A` }),
    )).toThrow('invalid schema');
    expect(() => validateDailyInsightResponse(
      response({ shortInsight: `${shortInsight.slice(0, -1)}a.` }),
      makeContext(),
    )).toThrow('invalid schema');
  });

  it('requires and preserves the greeting and short insight pair', () => {
    const value = response();
    expect(toInsightResponse(validateDailyInsightResponse(value, makeContext()))).toMatchObject({
      greeting: value.greeting,
      shortInsight: value.shortInsight,
    });
    const { greeting, ...withoutGreeting } = value;
    const { shortInsight, ...withoutShortInsight } = value;
    expect(() => validateDailyInsightResponse(withoutGreeting, makeContext())).toThrow('invalid schema');
    expect(() => validateDailyInsightResponse(withoutShortInsight, makeContext())).toThrow('invalid schema');
  });

  it('omits null optional fields when mapping to the API response', () => {
    const mapped = toInsightResponse(validateDailyInsightResponse(response(), makeContext()));
    expect(mapped).not.toHaveProperty('recommendation');
    expect(mapped).not.toHaveProperty('cta');
    expect(mapped).not.toHaveProperty('ctaTarget');
  });

  describe('supplied calorie values', () => {
    it('accepts calorie numbers that were supplied, including a negative remainder as an absolute value', () => {
      const base = makeContext();
      const context = makeContext({
        nutrition: { ...base.nutrition, today: { ...base.nutrition.today!, calories: 2100 }, remainingCalories: -100 },
      });
      const valid = response({
        summary: 'Du hast 2.100 kcal aufgenommen, dein Ziel liegt bei 2000 Kalorien, das sind 100 Kalorien darüber.',
      });
      expect(validateDailyInsightResponse(valid, context)).toEqual(valid);
    });

    it.each(['shortInsight', 'title', 'summary', 'recommendation'] as const)(
      'rejects an invented calorie value in %s',
      (field) => {
        const value = field === 'title' ? '777 kcal heute' : 'Du hast noch 777 Kalorien offen.';
        expect(() => validateDailyInsightResponse(response({ [field]: value }), makeContext()))
          .toThrow('calorie value that was not supplied');
      },
    );

    it('does not judge wording around supplied numbers', () => {
      const valid = response({
        title: 'Offener Tag mit Kalorienbilanz',
        summary: 'Du hast noch 500 Kalorien zur Verfügung, um deine Aufnahme zu erhöhen.',
        recommendation: 'Überlege, eine proteinreiche Mahlzeit hinzuzufügen.',
      });
      expect(validateDailyInsightResponse(valid, makeContext())).toEqual(valid);
    });
  });
});
