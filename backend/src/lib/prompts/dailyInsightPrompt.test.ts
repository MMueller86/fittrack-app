import { describe, expect, it } from 'vitest';
import type { InsightInputContext, InsightIntent } from '@fittrack/shared';
import {
  DAILY_INSIGHT_PROMPT_ASSEMBLY_VERSION,
  DAILY_INSIGHT_PROMPT_BUNDLE,
  DAILY_INSIGHT_PROMPT_FINGERPRINT,
  DAILY_INSIGHT_PROMPT_MODULES,
  DAILY_INSIGHT_PROMPT_VERSION,
  buildDailyInsightPrompt,
  canonicalJson,
  computeDailyInsightPromptFingerprint,
  computeDailyInsightSystemPromptHash,
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

const V14_PROVIDER_SYSTEM_HASHES: Readonly<Record<InsightIntent, string>> = {
  activity_focus: 'sha256:ba5eb446ae9dec5ec1be5bf052efd921d3a10a319eb100a867194c04085663d9',
  weight_signal: 'sha256:f1b4566ff32979034ee608a8b787b39fd9b46ccc7bd614bd8619fadfc73c8294',
  phase_progress: 'sha256:30f14d8ae6df2079edf8212a737f076ac61ceeae0b8797f3ca136d37179a0de2',
  morning_orientation: 'sha256:732f3f7e114ab8ccf2869eaaae6a48a96506183fde8f77b2651739f69e77f589',
  nutrition_guidance: 'sha256:35c90eee68b5937cbc0d2c89c617f8f439527e209027a55687d6acd1afc3a472',
  general: 'sha256:c216b9577746cd1d1f0d7ec9fc8f37bb6189e437071724d42e3fb9ccec1d0125',
};

describe('daily insight v14 prompts', () => {
  it('uses the v14 version and has one module for every intent', () => {
    expect(DAILY_INSIGHT_PROMPT_VERSION).toBe('v14');
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

  it('computes a stable fingerprint for the complete v14 bundle', () => {
    expect(DAILY_INSIGHT_PROMPT_ASSEMBLY_VERSION).toBe('v1');
    expect(DAILY_INSIGHT_PROMPT_FINGERPRINT).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(computeDailyInsightPromptFingerprint(DAILY_INSIGHT_PROMPT_BUNDLE))
      .toBe(DAILY_INSIGHT_PROMPT_FINGERPRINT);
    expect(canonicalJson({ z: 1, a: { d: 2, c: 3 }, list: [{ b: 1, a: 2 }] }))
      .toBe('{"a":{"c":3,"d":2},"list":[{"a":2,"b":1}],"z":1}');
  });

  it('keeps the v14 provider system input byte-identical after root relocation', () => {
    const compatibilityContext = { date: '2026-08-20' } as InsightInputContext;

    for (const intent of intents) {
      const snapshot = buildDailyInsightPrompt(intent, compatibilityContext);
      expect(computeDailyInsightSystemPromptHash(snapshot.system))
        .toBe(V14_PROVIDER_SYSTEM_HASHES[intent]);
      expect(snapshot.user)
        .toBe(JSON.stringify({ intent, context: compatibilityContext }));
    }
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
    ['assembly version', { assemblyVersion: 'v2' }],
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