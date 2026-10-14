import { describe, expect, it } from 'vitest';
import type { InsightInputContext, InsightIntent } from '@fittrack/shared';
import { DAILY_INSIGHT_EVAL_FIXTURES } from './dailyInsight.eval.fixtures';
import {
  DAILY_INSIGHT_PROMPT_ASSEMBLY_VERSION,
  DAILY_INSIGHT_PROMPT_BUNDLE,
  DAILY_INSIGHT_PROMPT_FINGERPRINT,
  DAILY_INSIGHT_PROMPT_MODULES,
  DAILY_INSIGHT_PROMPT_VERSION,
  buildDailyInsightPrompt,
  canonicalJson,
  computeDailyInsightPromptFingerprint,
} from './dailyInsightPrompt';

const context = { date: '2026-08-20' } as InsightInputContext;
const intents: InsightIntent[] = [
  'activity_focus',
  'weight_signal',
  'phase_progress',
  'morning_orientation',
  'nutrition_guidance',
  'general',
];

describe('daily insight v18 prompts', () => {
  it('CORR2 gives the exact unknown-activity context a final activity open-day guard', () => {
    const fixture = DAILY_INSIGHT_EVAL_FIXTURES.find((candidate) => candidate.id === 'unknown-activity')!;
    expect(fixture.intent).toBe('activity_focus');
    expect(fixture.input.currentHourLocal).toBeNull();
    expect(fixture.input.activityCompletionStatus).toBe('unknown');
    expect(fixture.input.nutrition.remainingCalories).toBe(500);
    expect(fixture.input.nutrition.remainingProteinG).toBe(20);
    const before = structuredClone(fixture.input);
    const snapshot = buildDailyInsightPrompt(fixture.intent, fixture.input);
    expect(snapshot.system).toContain('Abschließender Schutz für activity_focus am offenen Tag');
    expect(snapshot.system.indexOf('Abschließender Schutz für activity_focus am offenen Tag'))
      .toBeGreaterThan(snapshot.system.indexOf('## Ausgabe'));
    expect(snapshot.system).toContain('Nenne weder die bisherige Aufnahme noch den Restbetrag');
    expect(snapshot.system).toContain('Fueling, Flüssigkeit und Erholung bleiben konditional');
    expect(snapshot.system).not.toContain('Bei positivem Rest beschreibe nur den noch offenen Spielraum,');
    expect(JSON.parse(snapshot.user).intent).toBe(fixture.intent);
    expect(JSON.parse(snapshot.user).context.nutrition.targets).not.toHaveProperty('proteinG');
    expect(JSON.parse(snapshot.user).context.nutrition.targets).not.toHaveProperty('carbsG');
    expect(fixture.input).toEqual(before);
  });

  it('CORR2 applies the activity guard only to an open activity context without suppressing fueling', () => {
    const fixture = DAILY_INSIGHT_EVAL_FIXTURES.find((candidate) => candidate.id === 'unknown-activity')!;
    const closed = { ...fixture.input, nutrition: { ...fixture.input.nutrition, remainingCalories: 0 } };
    expect(buildDailyInsightPrompt(fixture.intent, closed).system)
      .not.toContain('Abschließender Schutz für activity_focus am offenen Tag');
    expect(buildDailyInsightPrompt('phase_progress', fixture.input).system)
      .not.toContain('Abschließender Schutz für activity_focus am offenen Tag');
    const system = buildDailyInsightPrompt(fixture.intent, fixture.input).system;
    expect(system).toContain('Fueling-Hinweis verpflichtend');
    expect(system).toContain('Bei "planned" und "unknown" muss dieser Hinweis passend konditional bleiben');
  });

  it('Q21 gives the actual stale-weight phase context no contradictory below-target instruction', () => {
    const fixture = DAILY_INSIGHT_EVAL_FIXTURES.find((candidate) => candidate.id === 'stale-weight')!;
    expect(fixture.intent).toBe('phase_progress');
    expect(fixture.input.nutrition.remainingCalories).toBe(500);
    const before = structuredClone(fixture.input);
    const snapshot = buildDailyInsightPrompt(fixture.intent, fixture.input);
    expect(snapshot.system).not.toContain('Formuliere die Differenz nur als Aufnahme über oder unter dem Ziel');
    expect(snapshot.system).toContain('Bei positivem Rest beschreibe nur den noch offenen Spielraum');
    expect(snapshot.system).toContain('"unter dem Ziel"');
    expect(snapshot.system).toContain('Schutz für phase_progress an einem offenen Tag');
    const expectedProviderTargets = Object.fromEntries(
      Object.entries(before.nutrition.targets!).filter(([key]) => key !== 'proteinG' && key !== 'carbsG'),
    );
    expect(JSON.parse(snapshot.user)).toEqual({
      intent: fixture.intent,
      context: {
        ...before,
        nutrition: { ...before.nutrition, targets: expectedProviderTargets },
      },
    });
    const providerContext = JSON.parse(snapshot.user).context as InsightInputContext;
    expect(providerContext.nutrition.targets?.macroRanges)
      .toEqual(fixture.input.nutrition.targets?.macroRanges);
    expect(providerContext.nutrition.targets).not.toHaveProperty('proteinG');
    expect(providerContext.nutrition.targets).not.toHaveProperty('carbsG');
    expect(providerContext.nutrition.remainingProteinG).toBe(fixture.input.nutrition.remainingProteinG);
    expect(providerContext.nutrition.proteinCoachingBand).toBe(fixture.input.nutrition.proteinCoachingBand);
    expect(fixture.input).toEqual(before);
  });

  it('uses the v18 version and has one module for every intent', () => {
    expect(DAILY_INSIGHT_PROMPT_VERSION).toBe('v18');
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
    expect(DAILY_INSIGHT_PROMPT_MODULES.activity_focus)
      .toContain('Ist remainingCalories positiv, ist der Tag noch offen');
    expect(DAILY_INSIGHT_PROMPT_MODULES.nutrition_guidance).toContain('remainingCalories kleiner als null');
    expect(DAILY_INSIGHT_PROMPT_MODULES.weight_signal).toContain('daysSinceLastMeasurement');
  });

  it('clarifies that a negative target remainder is not an achieved energy surplus', () => {
    const snapshot = buildDailyInsightPrompt('nutrition_guidance', {
      ...context,
      nutrition: {
        remainingCalories: -100,
        remainingProteinG: 40,
      },
    } as InsightInputContext);

    expect(snapshot.system).toContain('nur eine Zielrelation');
    expect(snapshot.system).toContain('keinen tatsächlich erreichten Energieüberschuss');
    expect(snapshot.system).toContain('Bei positivem Rest beschreibe nur den noch offenen Spielraum');
    expect(snapshot.system).toContain('Abschließende Sperre bei negativem Kalorienbudget');
    expect(snapshot.system).toContain('Vorrang vor jedem Protein-Gap und allen Mahlzeitenregeln');
    expect(snapshot.system).toContain('Setze recommendation, cta und ctaTarget exakt auf null');
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

  it('adds the phase-progress open-day guard only while target-relative intake is still open', () => {
    const openContext = {
      ...context,
      nutrition: {
        today: null,
        targets: null,
        remainingCalories: 600,
        remainingProteinG: 40,
        last3Days: [],
      },
    } as InsightInputContext;
    const closedContext = {
      ...openContext,
      nutrition: { ...openContext.nutrition, remainingCalories: 0 },
    };

    const openPrompt = buildDailyInsightPrompt('phase_progress', openContext);
    const closedPrompt = buildDailyInsightPrompt('phase_progress', closedContext);

    expect(openPrompt.system).toContain('Schutz für phase_progress an einem offenen Tag');
    expect(openPrompt.system).toContain('kein erreichtes Energiedefizit');
    expect(openPrompt.system).toContain('ein positiver Rest allein ist kein Grund für zusätzliche Kalorien');
    expect(openPrompt.system).toContain('Stelle verbleibende Kalorien nicht als verfügbares Essensbudget dar');
    expect(openPrompt.system).toContain('Wenn das Restbudget der einzige Grund für recommendation oder cta wäre');
    expect(openPrompt.system).toContain('nicht-ernährungsbezogene Empfehlung bleibt möglich');
    expect(closedPrompt.system).not.toContain('Schutz für phase_progress an einem offenen Tag');
  });

  it('uses only resolved historical targets and declines unavailable or ambiguous comparisons', () => {
    const nutritionModule = DAILY_INSIGHT_PROMPT_MODULES.nutrition_guidance;

    expect(nutritionModule).toContain('effectiveTargetCalories und targetSource sind serverseitig bereits nach Quellenpriorität aufgelöst');
    expect(nutritionModule).toContain('profile_fallback ist nur ein aktueller, schreibgeschützter Vergleichswert');
    expect(nutritionModule).toContain('targetSource unavailable');
    expect(nutritionModule).toContain('belegt weder ein tatsächlich erreichtes physiologisches Energiedefizit');
    expect(DAILY_INSIGHT_PROMPT_MODULES.morning_orientation)
      .toContain('Vergleiche calories direkt mit diesem effectiveTargetCalories');
    expect(DAILY_INSIGHT_PROMPT_MODULES.morning_orientation)
      .toContain('die Aufnahme entsprach deinem Tagesziel');
  });

  it('withholds read-only profile fallback targets from the morning model input', () => {
    const fallbackContext = {
      date: '2026-08-20',
      nutrition: {
        last3Days: [{
          date: '2026-08-19',
          calories: 1980,
          hasMealItem: true,
          baseTargetCalories: 2100,
          effectiveTargetCalories: 2100,
          activityBonusCalories: 0,
          targetSource: 'profile_fallback',
          specialActivity: null,
        }],
      },
    } as InsightInputContext;
    const snapshot = buildDailyInsightPrompt('morning_orientation', fallbackContext);
    const promptContext = JSON.parse(snapshot.user) as {
      context: InsightInputContext;
    };
    const promptDay = promptContext.context.nutrition.last3Days[0]!;

    expect(promptDay).toMatchObject({
      baseTargetCalories: null,
      effectiveTargetCalories: null,
      targetSource: 'profile_fallback',
    });
    expect(snapshot.system).toContain('kein eindeutig nutzbares historisches Ziel (targetSource=profile_fallback)');
    expect(fallbackContext.nutrition.last3Days[0]!.effectiveTargetCalories).toBe(2100);
  });

  it('adds the exact yesterday source decision to the morning system prompt', () => {
    const morningContext = {
      ...context,
      date: '2026-08-20',
      nutrition: {
        today: null,
        remainingCalories: null,
        remainingProteinG: null,
        last3Days: [{
          date: '2026-08-19',
          calories: 2100,
          hasMealItem: true,
          baseTargetCalories: 2250,
          effectiveTargetCalories: 2250,
          targetSource: 'day_target_snapshot',
          specialActivity: { dailyCalorieTarget: 1400 },
        }],
      },
    } as InsightInputContext;
    const snapshot = buildDailyInsightPrompt('morning_orientation', morningContext);

    expect(snapshot.system).toContain('Der Eintrag für gestern');
    expect(snapshot.system).toContain('2100 kcal');
    expect(snapshot.system).toContain('2250 kcal');
    expect(snapshot.system).toContain('Die einzige zulässige Zielrelation ist unter');
    expect(snapshot.system).toContain('Ersetze diesen Wert nicht durch nutrition.targets oder specialActivity.dailyCalorieTarget');
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
    const activityContext = {
      ...context,
      specialActivity: {
        type: 'hiking',
        movementTimeMinutes: 120,
        distanceKm: 8,
        elevationGainM: 500,
        estimatedMet: 6,
        activityCalories: 840,
        alreadyAccountedCalories: 140,
        activityBonus: 700,
        bodyWeightKg: 70,
        dailyCalorieTarget: 2300,
        calculatedAt: '2026-08-20T12:00:00.000Z',
      },
      nutrition: {
        today: null,
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
    } satisfies InsightInputContext;
    const snapshot = buildDailyInsightPrompt('activity_focus', activityContext);

    expect(snapshot.system).toContain('Verbindlicher Vertrag für das aktuelle effektive Aktivitätsziel');
    expect(snapshot.system).toContain('Kalorienziel');
    expect(snapshot.system).toContain('keine zusätzliche Proteinquelle');
  });

  it('uses range-based macro semantics and keeps activity bonus calorie-only', () => {
    const nutritionModule = DAILY_INSIGHT_PROMPT_MODULES.nutrition_guidance;
    const activityModule = DAILY_INSIGHT_PROMPT_MODULES.activity_focus;

    expect(nutritionModule).toContain('nutrition.targets.macroRanges');
    expect(nutritionModule).toContain('nutrition.proteinCoachingBand');
    expect(nutritionModule).toContain('Werte außerhalb dürfen weder als zu niedrig/zu hoch');
    expect(nutritionModule).toContain('Es gibt keine historischen Makro-Zielbereiche');
    expect(activityModule).toContain('Der activityBonus erhöht ausschließlich das Kalorienziel');
    expect(activityModule).toContain('keine temporären Makrobereiche');
    expect(activityModule).toContain('keine numerischen Makroziele oder Grammwerte');
  });

  it('appends the active-range-only macro guard to every intent', () => {
    for (const intent of intents) {
      const system = buildDailyInsightPrompt(intent, context).system;
      const guardIndex = system.lastIndexOf('## Abschließende Regel für Makro-Einordnungen');

      expect(guardIndex).toBeGreaterThan(system.lastIndexOf('## Ausgabe'));
      expect(system.slice(guardIndex)).toContain('nutrition.targets.macroRanges');
      expect(system.slice(guardIndex)).toContain('nutrition.proteinCoachingBand');
      expect(system.slice(guardIndex)).toContain('Makros in last3Days');
    }
  });

  it('computes a stable fingerprint for the complete v18 bundle', () => {
    expect(DAILY_INSIGHT_PROMPT_ASSEMBLY_VERSION).toBe('v2');
    expect(DAILY_INSIGHT_PROMPT_FINGERPRINT).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(computeDailyInsightPromptFingerprint(DAILY_INSIGHT_PROMPT_BUNDLE))
      .toBe(DAILY_INSIGHT_PROMPT_FINGERPRINT);
    expect(canonicalJson({ z: 1, a: { d: 2, c: 3 }, list: [{ b: 1, a: 2 }] }))
      .toBe('{"a":{"c":3,"d":2},"list":[{"a":2,"b":1}],"z":1}');
  });

  it.each([
    ['shared tone', { sharedTone: `${DAILY_INSIGHT_PROMPT_BUNDLE.sharedTone} changed` }],
    ['output contract', { outputContract: `${DAILY_INSIGHT_PROMPT_BUNDLE.outputContract} changed` }],
    ['activity intent module', {
      intentModules: {
        ...DAILY_INSIGHT_PROMPT_BUNDLE.intentModules,
        activity_focus: `${DAILY_INSIGHT_PROMPT_BUNDLE.intentModules.activity_focus} changed`,
      },
    }],
    ['general intent module', {
      intentModules: {
        ...DAILY_INSIGHT_PROMPT_BUNDLE.intentModules,
        general: `${DAILY_INSIGHT_PROMPT_BUNDLE.intentModules.general} changed`,
      },
    }],
    ['morning intent module', {
      intentModules: {
        ...DAILY_INSIGHT_PROMPT_BUNDLE.intentModules,
        morning_orientation: `${DAILY_INSIGHT_PROMPT_BUNDLE.intentModules.morning_orientation} changed`,
      },
    }],
    ['nutrition intent module', {
      intentModules: {
        ...DAILY_INSIGHT_PROMPT_BUNDLE.intentModules,
        nutrition_guidance: `${DAILY_INSIGHT_PROMPT_BUNDLE.intentModules.nutrition_guidance} changed`,
      },
    }],
    ['shared weight intent module', {
      intentModules: {
        ...DAILY_INSIGHT_PROMPT_BUNDLE.intentModules,
        weight_signal: `${DAILY_INSIGHT_PROMPT_BUNDLE.intentModules.weight_signal} changed`,
        phase_progress: `${DAILY_INSIGHT_PROMPT_BUNDLE.intentModules.phase_progress} changed`,
      },
    }],
    ['guard text', {
      guardTexts: {
        ...DAILY_INSIGHT_PROMPT_BUNDLE.guardTexts,
        openDay: `${DAILY_INSIGHT_PROMPT_BUNDLE.guardTexts.openDay} changed`,
      },
    }],
    ['guard policy', {
      guardPolicy: {
        ...DAILY_INSIGHT_PROMPT_BUNDLE.guardPolicy,
        staleWeight: { operator: '>', thresholdDays: 15 },
      },
    }],
    ['assembly version', { assemblyVersion: 'v1' }],
    ['strict schema', {
      strictStructuredOutputSchema: {
        ...DAILY_INSIGHT_PROMPT_BUNDLE.strictStructuredOutputSchema,
        additionalProperties: true,
      },
    }],
  ])('changes the fingerprint when %s changes', (_label, change) => {
    expect(computeDailyInsightPromptFingerprint({
      ...DAILY_INSIGHT_PROMPT_BUNDLE,
      ...change,
    })).not.toBe(DAILY_INSIGHT_PROMPT_FINGERPRINT);
  });
});