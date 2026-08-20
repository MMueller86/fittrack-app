import { describe, expect, it } from 'vitest';
import type { InsightInputContext, InsightIntent } from '@fittrack/shared';
import {
  DAILY_INSIGHT_PROMPT_MODULES,
  DAILY_INSIGHT_PROMPT_VERSION,
  buildDailyInsightPrompt,
} from './dailyInsightV10';

const context = { date: '2026-08-20' } as InsightInputContext;
const intents: InsightIntent[] = [
  'activity_focus',
  'weight_signal',
  'phase_progress',
  'morning_orientation',
  'nutrition_guidance',
  'general',
];

describe('daily insight v11 prompts', () => {
  it('uses the v11 version and has one module for every intent', () => {
    expect(DAILY_INSIGHT_PROMPT_VERSION).toBe('v11');
    for (const intent of intents) {
      expect(DAILY_INSIGHT_PROMPT_MODULES[intent].length).toBeGreaterThan(0);
    }
  });

  it.each(intents)('builds an exact server-owned snapshot for %s', (intent) => {
    const snapshot = buildDailyInsightPrompt(intent, context);
    expect(snapshot.system).toContain(`## Verbindlicher Intent\n${intent}`);
    expect(snapshot.system).toContain('Antworte ausschließlich mit diesem JSON-Objekt');
    expect(JSON.parse(snapshot.user)).toEqual({ intent, context });
  });

  it.each(intents)('includes the stale-weight guard in the active %s prompt snapshot', (intent) => {
    const snapshot = buildDailyInsightPrompt(intent, context);

    expect(snapshot.system).toContain(
      'Bei mehr als 14 Tagen darfst du Gewicht oder Trend nur auslassen oder mit einem eindeutigen Marker erwähnen',
    );
    expect(snapshot.system).toContain('Ein Satz wie "Der Trend zeigt ..." ohne Marker ist verboten.');
  });

  it('keeps activity uncertainty and the nutrition budget lock in the selected modules', () => {
    expect(DAILY_INSIGHT_PROMPT_MODULES.activity_focus).toContain('likely_completed');
    expect(DAILY_INSIGHT_PROMPT_MODULES.activity_focus).toContain('planned');
    expect(DAILY_INSIGHT_PROMPT_MODULES.activity_focus).toContain('unknown');
    expect(DAILY_INSIGHT_PROMPT_MODULES.nutrition_guidance).toContain('remainingCalories kleiner als null');
    expect(DAILY_INSIGHT_PROMPT_MODULES.weight_signal).toContain('daysSinceLastMeasurement');
  });

  it('keeps phase progress concrete when describing an outlier context', () => {
    const weightModule = DAILY_INSIGHT_PROMPT_MODULES.phase_progress;

    expect(weightModule).toContain('positive Entwicklung');
    expect(weightModule).toContain('positive Fortschrittsphase');
    expect(weightModule).toContain('Der Wochenverlauf zeigt weiter in die richtige Richtung');
    expect(weightModule).toContain('Du bist auf Kurs');
  });

  it('makes qualitative endurance signals require an explicit fueling hint', () => {
    expect(DAILY_INSIGHT_PROMPT_MODULES.activity_focus).toContain('mehrstündige Bewegungszeit');
    expect(DAILY_INSIGHT_PROMPT_MODULES.activity_focus).toContain('Fueling-Hinweis');
  });

  it('treats a missing protein gap as unknown instead of an invitation to infer one', () => {
    const snapshot = buildDailyInsightPrompt('nutrition_guidance', {
      ...context,
      nutrition: {
        remainingCalories: 400,
        remainingProteinG: null,
      },
    } as InsightInputContext);

    expect(snapshot.system).toContain('remainingProteinG ist null');
    expect(snapshot.system).toContain('keine Protein-Empfehlung');
  });

  it('protects an open day when protein is already nearly complete', () => {
    const snapshot = buildDailyInsightPrompt('nutrition_guidance', {
      ...context,
      nutrition: {
        remainingCalories: 600,
        remainingProteinG: 10,
      },
    } as InsightInputContext);

    expect(snapshot.system).toContain('remainingCalories ist positiv: Der Tag ist noch offen');
    expect(snapshot.system).toContain('keine abgeschlossene Bewertung');
    expect(snapshot.system).toContain('recommendation, cta und ctaTarget wörtlich null');
    expect(snapshot.system).toContain('proteinreiche Mahlzeit');
    expect(snapshot.system).toContain('Letzte Ausgabekontrolle');
  });

  it('prioritizes an open calorie budget with a material protein gap', () => {
    const snapshot = buildDailyInsightPrompt('nutrition_guidance', {
      ...context,
      nutrition: {
        remainingCalories: 600,
        remainingProteinG: 80,
      },
    } as InsightInputContext);

    expect(snapshot.system).toContain('Zwingender Vertrag für Proteinlücke bei offenem Kalorienbudget');
    expect(snapshot.system).toContain('remainingCalories ist positiv und remainingProteinG ist größer als 20');
    expect(snapshot.system).toContain('Der Tag ist noch offen');
    expect(snapshot.system).toContain('keine abgeschlossene Tagesbewertung');
    expect(snapshot.system).toContain('eine konkrete proteinreiche nächste Mahlzeit');
  });

  it('hardens the current effective activity budget contract', () => {
    const snapshot = buildDailyInsightPrompt('activity_focus', {
      ...context,
      specialActivity: {} as InsightInputContext['specialActivity'],
      nutrition: {
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
        last3Days: [],
      },
    } as InsightInputContext);

    expect(snapshot.system).toContain('Verbindlicher Vertrag für das aktuelle effektive Aktivitätsziel');
    expect(snapshot.system).toContain('Kalorienziel');
    expect(snapshot.system).toContain('keine zusätzliche Proteinquelle');
  });
});