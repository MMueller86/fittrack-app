import { describe, expect, it } from 'vitest';
import type { InsightInputContext, InsightIntent } from '@fittrack/shared';
import { DAILY_INSIGHT_EVAL_FIXTURES } from './dailyInsight.eval.fixtures';
import {
  DAILY_INSIGHT_SHARED_TONE,
} from './sharedTone';
import {
  DAILY_INSIGHT_PROMPT_ASSEMBLY_VERSION,
  DAILY_INSIGHT_PROMPT_BUNDLE,
  DAILY_INSIGHT_PROMPT_FINGERPRINT,
  DAILY_INSIGHT_PROMPT_GUARD_TEXTS,
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

describe('daily insight v30 prompts', () => {
  it('uses the B1.1 protein, meal-advice, and activity facts in provider context', () => {
    const fixture = DAILY_INSIGHT_EVAL_FIXTURES.find((candidate) => candidate.id === 'protein-gap-with-budget')!;
    const inputContext: InsightInputContext = {
      ...structuredClone(fixture.input),
      dailyActivityStatus: 'completed',
      nutrition: {
        ...fixture.input.nutrition,
        dailyInsightProteinStatus: 'at_or_above_2_5_g_per_kg',
        mealAdviceAllowed: false,
      },
    };
    const projected = JSON.parse(buildDailyInsightPrompt('general', inputContext).user);

    expect(projected.context.dailyActivityStatus).toBe('completed');
    expect(projected.context).not.toHaveProperty('activityCompletionStatus');
    expect(projected.context.nutrition).toMatchObject({
      dailyInsightProteinStatus: 'at_or_above_2_5_g_per_kg',
      mealAdviceAllowed: false,
    });
    expect(projected.context.nutrition).not.toHaveProperty('proteinCoachingBand');
    expect(projected.context.nutrition.today).not.toHaveProperty('protein');
    expect(projected.grounding.mealAdviceAllowed).toBe(false);
  });

  it.each(['stale-weight', 'phase-progress-open-day'])('keeps nutrition available alongside weight context for %s', (fixtureId) => {
    const fixture = DAILY_INSIGHT_EVAL_FIXTURES.find((candidate) => candidate.id === fixtureId)!;
    const before = structuredClone(fixture.input);
    const input = JSON.parse(buildDailyInsightPrompt(fixture.intent, fixture.input).user);
    expect(input.context.nutrition).toBeDefined();
    expect(input.grounding.focus).toBe('combined');
    expect(fixture.input).toEqual(before);
  });

  it('C2 suppresses contradictory budget arithmetic only in provider projection', () => {
    const fixture = DAILY_INSIGHT_EVAL_FIXTURES.find((candidate) => candidate.id === 'budget-lock')!;
    const before = structuredClone(fixture.input);
    const input = JSON.parse(buildDailyInsightPrompt(fixture.intent, fixture.input).user);
    expect(input.context.nutrition).toEqual({ budgetStatus: 'inconsistent' });
    expect(input.grounding).toMatchObject({ focus: 'budget_uncertainty_only', mealAdviceAllowed: false, actionFields: 'null' });
    expect(fixture.input).toEqual(before);
  });

  it.each(['midday-empty-day-not-morning', 'carbohydrates-below-range-neutral'])('uses only the Home weight trend for direction: %s', (fixtureId) => {
    const fixture = DAILY_INSIGHT_EVAL_FIXTURES.find((candidate) => candidate.id === fixtureId)!;
    const input = JSON.parse(buildDailyInsightPrompt(fixture.intent, fixture.input).user);
    expect(input.grounding.weight).toEqual({ homeTrend14d: fixture.input.weight.homeTrend14d ?? null });
    expect(input.context.weight).not.toHaveProperty('weeklyTrend30d');
    expect(input.context.weight).not.toHaveProperty('previousKg');
    expect(input.context.weight).not.toHaveProperty('last7Values');
    expect(input.context.progressIntelligence).toEqual({ milestone: fixture.input.progressIntelligence.milestone });
  });

  it('keeps milestone facts while excluding other weight-derived prompt inputs', () => {
    const fixture = DAILY_INSIGHT_EVAL_FIXTURES.find((candidate) => candidate.id === 'midday-empty-day-not-morning')!;
    const inputContext = structuredClone(fixture.input);
    const milestone = {
      value: 80,
      unit: 'kg' as const,
      reachedAt: '2026-08-19',
      confirmed: true,
      movingAvgAtThreshold: 79.9,
    };
    inputContext.weight.homeTrend14d = 'gaining';
    inputContext.progressIntelligence.milestone = milestone;

    const projected = JSON.parse(buildDailyInsightPrompt(fixture.intent, inputContext).user);

    expect(projected.context.weight).toEqual({
      latestKg: inputContext.weight.latestKg,
      homeTrend14d: 'gaining',
      daysSinceLastMeasurement: inputContext.weight.daysSinceLastMeasurement,
      lastMeasurementDate: inputContext.weight.lastMeasurementDate,
    });
    expect(projected.context.progressIntelligence).toEqual({ milestone });
    expect(projected.grounding.weight).toEqual({ homeTrend14d: 'gaining' });
  });

  it('keeps prior diary days out of the current-moment insight prompt', () => {
    const fixture = DAILY_INSIGHT_EVAL_FIXTURES.find((candidate) => candidate.id === 'midday-empty-day-not-morning')!;
    const before = structuredClone(fixture.input);
    const input = JSON.parse(buildDailyInsightPrompt(fixture.intent, fixture.input).user);
    const snapshot = buildDailyInsightPrompt(fixture.intent, fixture.input);

    expect(input.context.nutrition).not.toHaveProperty('last3Days');
    expect(input.grounding).not.toHaveProperty('history');
    expect(snapshot.system).toContain('## Nur der heutige Moment');
    expect(fixture.input).toEqual(before);
  });

  it('explicitly prohibits the calorie-surplus label', () => {
    const fixture = DAILY_INSIGHT_EVAL_FIXTURES.find((candidate) => candidate.id === 'target-relative-overage-not-achieved-surplus')!;
    const { system } = buildDailyInsightPrompt(fixture.intent, fixture.input);
    expect(system).toContain('Verwende niemals "Kalorienüberschuss"');
  });

  it('requires stale-weight markers separately in shortInsight and full text', () => {
    const fixture = DAILY_INSIGHT_EVAL_FIXTURES.find((candidate) => candidate.id === 'stale-weight')!;
    const { system } = buildDailyInsightPrompt(fixture.intent, fixture.input);
    expect(system).toContain('Die Felder shortInsight und der Langtext (title, summary, recommendation zusammen) werden getrennt geprüft');
    expect(system).toContain('Erwähnt eines von beiden Gewicht, braucht es dort selbst den Marker');
  });

  it('does not project historical activities or target relations to the provider', () => {
    const fixture = DAILY_INSIGHT_EVAL_FIXTURES.find((candidate) => candidate.id === 'historical-target-source-priority')!;
    const before = structuredClone(fixture.input);
    const input = JSON.parse(buildDailyInsightPrompt(fixture.intent, fixture.input).user);
    expect(input.context.nutrition).not.toHaveProperty('last3Days');
    expect(input.grounding).not.toHaveProperty('history');
    expect(fixture.input).toEqual(before);
  });

  it.each(['personal-neutral-greeting', 'long-name-neutral-greeting', 'meal-advice-denied'])('projects the fixture-specific B1.1 meal permission: %s', (fixtureId) => {
    const fixture = DAILY_INSIGHT_EVAL_FIXTURES.find((candidate) => candidate.id === fixtureId)!;
    const input = JSON.parse(buildDailyInsightPrompt(fixture.intent, fixture.input).user);
    expect(input.grounding.mealAdviceAllowed).toBe(fixture.input.nutrition.mealAdviceAllowed);
    expect(input.context.nutrition.today).toBeDefined();
    expect(input.context.nutrition.targets).toBeDefined();
  });

  it('preserves open-day context while omitting raw protein values', () => {
    const fixture = DAILY_INSIGHT_EVAL_FIXTURES.find((candidate) => candidate.id === 'meal-advice-denied')!;
    const before = structuredClone(fixture.input);
    const input = JSON.parse(buildDailyInsightPrompt(fixture.intent, fixture.input).user);

    expect(input.context.nutrition).toMatchObject({
      today: { calories: fixture.input.nutrition.today.calories },
      targets: { calories: fixture.input.nutrition.targets.calories },
      remainingCalories: fixture.input.nutrition.remainingCalories,
    });
    expect(input.context.nutrition).not.toHaveProperty('last3Days');
    expect(input.context.nutrition.today).not.toHaveProperty('protein');
    expect(input.context).toHaveProperty('weight');
    expect(input.context).toHaveProperty('userGoal');
    expect(input.context).toHaveProperty('progressIntelligence');
    expect(input.grounding.mealAdviceAllowed).toBe(false);
    expect(fixture.input).toEqual(before);
  });

  it('keeps the B1.1 protein status under a negative-budget lock', () => {
    const fixture = DAILY_INSIGHT_EVAL_FIXTURES.find((candidate) => candidate.id === 'target-relative-overage-not-achieved-surplus')!;
    const before = structuredClone(fixture.input);
    const input = JSON.parse(buildDailyInsightPrompt(fixture.intent, fixture.input).user);

    expect(input.context.nutrition).toMatchObject({
      today: { calories: fixture.input.nutrition.today.calories },
      targets: { calories: fixture.input.nutrition.targets.calories },
      remainingCalories: fixture.input.nutrition.remainingCalories,
    });
    expect(input.context.nutrition.today).not.toHaveProperty('protein');
    expect(input.context.nutrition.dailyInsightProteinStatus).toBe(fixture.input.nutrition.dailyInsightProteinStatus);
    expect(input.grounding.mealAdviceAllowed).toBe(false);
    expect(fixture.input).toEqual(before);
  });

  it('Q1-04 never instructs an above-target assertion from an inconsistent negative remainder', () => {
    const fixture = DAILY_INSIGHT_EVAL_FIXTURES.find((candidate) => candidate.id === 'budget-lock')!;
    const { system } = buildDailyInsightPrompt(fixture.intent, fixture.input);
    expect(system).not.toContain('remainingCalories ist negativ: Die protokollierte Aufnahme liegt damit über');
    expect(system).not.toContain('Bei remainingCalories kleiner als null ist das Kalorienbudget bereits überschritten');
    expect(system).toContain('Nur wenn Aufnahme, Ziel und Rest rechnerisch übereinstimmen');
    expect(system).toContain('Die heutigen Kalorienangaben widersprechen sich');
  });

  it.each(['midday-empty-day-not-morning', 'intensive-endurance-fueling', 'historical-target-source-priority'])('Q1 preserves authoritative grounding in %s', (fixtureId) => {
    const fixture = DAILY_INSIGHT_EVAL_FIXTURES.find((candidate) => candidate.id === fixtureId)!;
    const { system } = buildDailyInsightPrompt(fixture.intent, fixture.input);
    expect(system).toContain('dailyActivityStatus unknown');
    expect(system).toContain('Ein Ziel allein belegt keinen heutigen Spielraum');
    expect(system).toContain('Leite keine Trendrichtung aus Einzelmessungen, Ziel oder anderen Progress-Signalen ab');
  });

  it('keeps the contradictory budget fixture unchanged and forbids invented arithmetic', () => {
    const fixture = DAILY_INSIGHT_EVAL_FIXTURES.find((candidate) => candidate.id === 'budget-lock')!;
    const before = structuredClone(fixture.input);
    expect(before.nutrition.today?.calories).toBe(1500);
    expect(before.nutrition.targets?.calories).toBe(2000);
    expect(before.nutrition.remainingCalories).toBe(-120);
    const { system } = buildDailyInsightPrompt(fixture.intent, fixture.input);
    expect(system).toContain('## Widersprüchliche aktuelle Kalorienwerte');
    expect(system).toContain('Nenne keine aktuellen Kalorienzahlen und keine Aufnahme-Ziel-Rechnung');
    expect(system).toContain('Die negative Budgetsperre bleibt aktiv');
    expect(fixture.input).toEqual(before);
  });

  it('does not mark a coherent negative budget as contradictory', () => {
    const fixture = DAILY_INSIGHT_EVAL_FIXTURES.find((candidate) => candidate.id === 'target-relative-overage-not-achieved-surplus')!;
    expect(buildDailyInsightPrompt(fixture.intent, fixture.input).system)
      .not.toContain('## Widersprüchliche aktuelle Kalorienwerte');
  });

  it('repeats the existing abstract-phrase prohibition in the final weight guard', () => {
    const fixture = DAILY_INSIGHT_EVAL_FIXTURES.find((candidate) => candidate.id === 'phase-progress-open-day')!;
    const { system } = buildDailyInsightPrompt('weight_signal', fixture.input);
    expect(system.slice(system.lastIndexOf('## Abschließender Vorrang des Gewichtsfokus')))
      .toContain('Verwende niemals "positive Entwicklung"');
  });

  it.each(['personal-neutral-greeting', 'carbohydrates-above-range-neutral', 'midday-empty-day-not-morning'])('omits historical diary days from provider input without changing stored context: %s', (fixtureId) => {
    const fixture = DAILY_INSIGHT_EVAL_FIXTURES.find((candidate) => candidate.id === fixtureId)!;
    const before = structuredClone(fixture.input);
    const projected = JSON.parse(buildDailyInsightPrompt(fixture.intent, fixture.input).user).context;
    expect(projected.nutrition).not.toHaveProperty('last3Days');
    expect(fixture.input).toEqual(before);
  });

  it('tells every intent to stay with today even when historical targets are unavailable', () => {
    const fixture = DAILY_INSIGHT_EVAL_FIXTURES.find((candidate) => candidate.id === 'historical-target-unavailable')!;
    const system = buildDailyInsightPrompt(fixture.intent, fixture.input).system;
    expect(system).toContain('## Nur der heutige Moment');
    expect(system).not.toContain('Der Eintrag für gestern');
  });

  it.each(intents)('requires the compact pair in the same output for %s', (intent) => {
    const system = buildDailyInsightPrompt(intent, context).system;
    expect(system).toContain('"greeting": "Hallo, <displayName>! <Emoji>"');
    expect(system).toContain('"shortInsight"');
    expect(system).toContain('Maximal 120 Zeichen');
    expect(system).toContain('maximal 240 Zeichen');
    expect(system).toContain('genau einem vollständigen');
    expect(system).toContain('Keine Tageszeit');
    expect(system).toContain('Keine Widersprüche zum Volltext');
  });
  it('CORR2 gives the exact unknown-activity context a final activity open-day guard', () => {
    const fixture = DAILY_INSIGHT_EVAL_FIXTURES.find((candidate) => candidate.id === 'unknown-activity')!;
    expect(fixture.intent).toBe('activity_focus');
    expect(fixture.input.currentHourLocal).toBeNull();
    expect(fixture.input.dailyActivityStatus).toBe('unknown');
    expect(fixture.input.nutrition.remainingCalories).toBe(2000);
    expect(fixture.input.nutrition.mealAdviceAllowed).toBe(true);
    const before = structuredClone(fixture.input);
    const snapshot = buildDailyInsightPrompt(fixture.intent, fixture.input);
    const projectedActivity = JSON.parse(snapshot.user).context.specialActivity;
    expect(snapshot.system).toContain('Schutz für activity_focus am offenen Tag');
    expect(snapshot.system.indexOf('Schutz für activity_focus am offenen Tag'))
      .toBeGreaterThan(snapshot.system.indexOf('## Ausgabe'));
    expect(snapshot.system).toContain('Aufnahme, effektives Tagesziel und Rest sind ein aktueller Zwischenstand');
    expect(snapshot.system).toContain('nutrition.targets.calories enthält den Aktivitätsbonus bereits');
    expect(snapshot.system).toContain('dailyActivityStatus unknown erlaubt keine Aussage über einen Abschluss');
    expect(snapshot.system).not.toContain('Bei activity_focus nenne weder bisherige Aufnahme noch Restbetrag');
    expect(snapshot.system).toContain('Bei unknown behaupte keine Durchführung');
    expect(snapshot.system).not.toContain('likely_completed');
    expect(JSON.parse(snapshot.user).intent).toBe(fixture.intent);
    expect(projectedActivity).toMatchObject({
      type: fixture.input.specialActivity!.type,
      movementTimeMinutes: fixture.input.specialActivity!.movementTimeMinutes,
      distanceKm: fixture.input.specialActivity!.distanceKm,
      elevationGainM: fixture.input.specialActivity!.elevationGainM,
    });
    expect(projectedActivity).not.toHaveProperty('activityCalories');
    expect(projectedActivity).not.toHaveProperty('estimatedMet');
    expect(projectedActivity).not.toHaveProperty('alreadyAccountedCalories');
    expect(JSON.parse(snapshot.user).context.nutrition.targets).not.toHaveProperty('proteinG');
    expect(JSON.parse(snapshot.user).context.nutrition.targets).not.toHaveProperty('carbsG');
    expect(fixture.input).toEqual(before);
  });

  it('projects cycling activity without hiking-only fields or activity expenditure', () => {
    const fixture = DAILY_INSIGHT_EVAL_FIXTURES.find((candidate) => candidate.id === 'unknown-activity')!;
    const input: InsightInputContext = {
      ...fixture.input,
      specialActivity: {
        type: 'cycling',
        movementTimeMinutes: 90,
        distanceKm: 24,
        elevationGainM: 500,
        elevationLossM: 500,
        asphaltShare: 0.5,
        gravelShare: 0.3,
        trailShare: 0.2,
        ebikeSupport: 'NONE',
        bodyWeightKg: 80,
        dailyCalorieTarget: 2200,
        calculatedAt: '2026-08-20T08:00:00.000Z',
        estimatedMet: 6,
        activityCalories: 900,
        alreadyAccountedCalories: 200,
        activityBonus: 500,
      },
    };

    const projected = JSON.parse(buildDailyInsightPrompt('activity_focus', input).user).context.specialActivity;
    expect(projected).toMatchObject({
      type: 'cycling',
      movementTimeMinutes: 90,
      distanceKm: 24,
      elevationGainM: 500,
      dailyCalorieTarget: 2200,
      activityBonus: 500,
    });
    expect(projected).not.toHaveProperty('terrainType');
    expect(projected).not.toHaveProperty('packCategory');
    expect(projected).not.toHaveProperty('activityCalories');
    expect(projected).not.toHaveProperty('estimatedMet');
    expect(projected).not.toHaveProperty('alreadyAccountedCalories');
  });

  it('CORR2 applies the activity guard only to an open activity context without suppressing fueling', () => {
    const fixture = DAILY_INSIGHT_EVAL_FIXTURES.find((candidate) => candidate.id === 'unknown-activity')!;
    const closed = { ...fixture.input, nutrition: { ...fixture.input.nutrition, remainingCalories: 0 } };
    expect(buildDailyInsightPrompt(fixture.intent, closed).system)
      .not.toContain('Schutz für activity_focus am offenen Tag');
    expect(buildDailyInsightPrompt('phase_progress', fixture.input).system)
      .not.toContain('Schutz für activity_focus am offenen Tag');
    const system = buildDailyInsightPrompt(fixture.intent, fixture.input).system;
    expect(system).toContain('Fueling-Hinweis verpflichtend');
    expect(system).toContain('Bei langer oder intensiver Ausdauerbelastung ist ein Fueling-Hinweis verpflichtend');
  });

  it('does not route stale weight from hidden phase context or expose hidden progress signals', () => {
    const fixture = DAILY_INSIGHT_EVAL_FIXTURES.find((candidate) => candidate.id === 'stale-weight')!;
    expect(fixture.intent).toBe('nutrition_guidance');
    expect(fixture.input.nutrition.remainingCalories).toBe(500);
    expect(fixture.input.progressIntelligence.primarySignal?.type).toBe('phase_context');
    const before = structuredClone(fixture.input);
    const snapshot = buildDailyInsightPrompt(fixture.intent, fixture.input);
    expect(snapshot.system).toContain('Bei mehr als 14 Tagen sind Gewichtsdaten veraltet');
    expect(snapshot.system).not.toContain('Schutz für phase_progress an einem offenen Tag');
    const projected = JSON.parse(snapshot.user);
    expect(projected.intent).toBe(fixture.intent);
    expect(projected.context.nutrition).toBeDefined();
    expect(projected.context.progressIntelligence).toEqual({ milestone: null });
    expect(projected.context.weight).toEqual({
      latestKg: null,
      homeTrend14d: null,
      daysSinceLastMeasurement: 20,
      lastMeasurementDate: '2026-07-31',
    });
    expect(fixture.input).toEqual(before);
  });

  it.each(['weight_signal', 'phase_progress'] as const)('ends %s with weight focus after the generic macro guard', (intent) => {
    const fixture = DAILY_INSIGHT_EVAL_FIXTURES.find((candidate) => candidate.id === 'stale-weight')!;
    const before = structuredClone(fixture.input);
    const snapshot = buildDailyInsightPrompt(intent, fixture.input);
    const finalGuard = DAILY_INSIGHT_PROMPT_GUARD_TEXTS.finalWeightFocus;
    expect(finalGuard).toBeTypeOf('string');
    expect(snapshot.system.endsWith(finalGuard)).toBe(true);
    expect(snapshot.system.lastIndexOf(finalGuard))
      .toBeGreaterThan(snapshot.system.lastIndexOf('## Abschließende Regel für Makro-Einordnungen'));
    expect(finalGuard).toContain('priorisiert Gewicht');
    expect(finalGuard).toContain('schließt aber weitere relevante gelieferte Signale nicht aus');
    expect(finalGuard).toContain('mehr als 14 Tagen');
    expect(fixture.input).toEqual(before);
  });

  it.each([
    ['meal-advice-denied', '## Serverseitige Mahlzeitenfreigabe'],
    ['budget-lock', '## Abschließende Sperre bei negativem Kalorienbudget'],
  ])('keeps %s server-derived safety rules after generic macro guidance', (fixtureId, finalHeading) => {
    const fixture = DAILY_INSIGHT_EVAL_FIXTURES.find((candidate) => candidate.id === fixtureId)!;
    const { system } = buildDailyInsightPrompt(fixture.intent, fixture.input);
    expect(system.lastIndexOf(finalHeading))
      .toBeGreaterThan(system.lastIndexOf('## Abschließende Regel für Makro-Einordnungen'));
  });

  it('closes activity focus with the existing fueling, fluids and recovery duties', () => {
    const fixture = DAILY_INSIGHT_EVAL_FIXTURES.find((candidate) => candidate.id === 'intensive-endurance-fueling')!;
    const { system } = buildDailyInsightPrompt(fixture.intent, fixture.input);
    expect(system).toMatch(/## Abschließender Vorrang des Aktivitätsfokus[^]*Kohlenhydrate[^]*Flüssigkeit[^]*Regeneration[^]*Erholung/);
    expect(system.lastIndexOf('## Abschließender Vorrang des Aktivitätsfokus'))
      .toBeGreaterThan(system.lastIndexOf('## Abschließende Regel für Makro-Einordnungen'));
  });

  it('uses the v30 version and has one module for every intent', () => {
    expect(DAILY_INSIGHT_PROMPT_VERSION).toBe('v30');
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
    expect(DAILY_INSIGHT_PROMPT_MODULES.activity_focus).toContain('completed oder unknown');
    expect(DAILY_INSIGHT_PROMPT_MODULES.activity_focus)
      .toContain('Ist remainingCalories positiv, ist der Tag noch offen');
    expect(DAILY_INSIGHT_PROMPT_MODULES.activity_focus)
      .toContain('addiere weder activityBonusCalories noch specialActivity.dailyCalorieTarget erneut');
    expect(DAILY_INSIGHT_PROMPT_MODULES.activity_focus)
      .toContain('Erfinde oder schätze niemals den Kalorienverbrauch der Aktivität');
    expect(DAILY_INSIGHT_PROMPT_MODULES.activity_focus)
      .toContain('Wenn du ihn bezifferst, verwende nur den exakt gelieferten Wert');
    expect(DAILY_INSIGHT_PROMPT_MODULES.activity_focus)
      .toContain('mealAdviceAllowed entscheidet serverseitig');
    expect(DAILY_INSIGHT_PROMPT_MODULES.activity_focus)
      .toContain('Bei unknown behaupte keine Durchführung');
    expect(DAILY_INSIGHT_SHARED_TONE)
      .toContain('Bei activity_focus darfst du Aufnahme, effektives Tagesziel und Restbetrag als aktuellen Zwischenstand nennen');
    expect(DAILY_INSIGHT_PROMPT_MODULES.nutrition_guidance).toContain('Bei negativem remainingCalories gib keine Empfehlung zum Essen oder Snack für heute');
    expect(DAILY_INSIGHT_PROMPT_MODULES.weight_signal).toContain('daysSinceLastMeasurement');
  });

  it('clarifies that a negative target remainder is not an achieved energy surplus', () => {
    const snapshot = buildDailyInsightPrompt('nutrition_guidance', {
      ...context,
      nutrition: {
        remainingCalories: -100,
        dailyInsightProteinStatus: 'below_range',
        mealAdviceAllowed: false,
      },
    } as InsightInputContext);

    expect(snapshot.system).toContain('nur eine Zielrelation');
    expect(snapshot.system).toContain('keinen tatsächlich erreichten Energieüberschuss');
    expect(snapshot.system).toContain('Bei positivem remainingCalories ist der Tag noch offen');
    expect(snapshot.system).toContain('Abschließende Sperre bei negativem Kalorienbudget');
    expect(snapshot.system).toContain('Empfiehl heute keine Mahlzeit oder keinen Snack');
    expect(snapshot.system).toContain('Setze recommendation exakt auf null');
  });

  it('does not expose hidden phase wording when Home trend is authoritative', () => {
    const weightModule = DAILY_INSIGHT_PROMPT_MODULES.phase_progress;

    expect(weightModule).toContain('homeTrend14d');
    expect(weightModule).toContain('Weitere Phasen-, Plateau-, Monats- oder Langzeitverlaufssignale stehen dem Modell nicht zur Verfügung');
    expect(weightModule).not.toContain('Der Wochenverlauf zeigt weiter in die richtige Richtung');
    expect(weightModule).not.toContain('Du bist auf Kurs');
  });

  it('makes qualitative endurance signals require an explicit fueling hint', () => {
    expect(DAILY_INSIGHT_PROMPT_MODULES.activity_focus).toContain('mehrstündige Bewegungszeit');
    expect(DAILY_INSIGHT_PROMPT_MODULES.activity_focus).toContain('Fueling-Hinweis');
  });

  it('passes an unknown server protein status without inferring a gram gap', () => {
    const snapshot = buildDailyInsightPrompt('nutrition_guidance', {
      ...context,
      nutrition: {
        remainingCalories: 400,
        dailyInsightProteinStatus: 'unknown',
      },
    } as InsightInputContext);

    expect(JSON.parse(snapshot.user).context.nutrition.dailyInsightProteinStatus).toBe('unknown');
    expect(snapshot.system).toContain('Bei unknown bleibt die Proteineinordnung unbekannt');
    expect(snapshot.system).not.toContain('remainingProteinG');
  });

  it('applies the meal-advice denial independently of protein status', () => {
    const snapshot = buildDailyInsightPrompt('nutrition_guidance', {
      ...context,
      nutrition: {
        remainingCalories: 600,
        dailyInsightProteinStatus: 'below_range',
        mealAdviceAllowed: false,
      },
    } as InsightInputContext);

    expect(snapshot.system).toContain('mealAdviceAllowed ist false');
    expect(snapshot.system).toContain('Verwechsle diese Sperre nicht mit einem Proteinstatus');
    expect(snapshot.system).not.toContain('remainingProteinG');
  });

  it('adds the phase-progress open-day guard only while target-relative intake is still open', () => {
    const openContext = {
      ...context,
      nutrition: {
        today: null,
        targets: null,
        remainingCalories: 600,
        dailyInsightProteinStatus: 'below_range',
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
    expect(openPrompt.system).toContain('Ein positiver Rest allein ist kein Grund für zusätzliche Kalorien');
    expect(openPrompt.system).toContain('konkrete Mahlzeitenhinweise richten sich nach mealAdviceAllowed');
    expect(closedPrompt.system).not.toContain('Schutz für phase_progress an einem offenen Tag');
  });

  it('keeps all active intent modules within current-day nutrition', () => {
    const nutritionModule = DAILY_INSIGHT_PROMPT_MODULES.nutrition_guidance;
    const morningModule = DAILY_INSIGHT_PROMPT_MODULES.morning_orientation;

    expect(nutritionModule).toContain('Verwende ausschließlich die heutigen Ernährungs- und Zielfelder');
    expect(nutritionModule).not.toContain('last3Days');
    expect(morningModule).toContain('Nutze ausschließlich den heutigen Kontext');
    expect(morningModule).not.toContain('gestern');
  });

  it('omits historical profile fallback data from the morning model input', () => {
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

    expect(promptContext.context.nutrition).not.toHaveProperty('last3Days');
    expect(snapshot.system).toContain('## Nur der heutige Moment');
    expect(fallbackContext.nutrition.last3Days[0]!.effectiveTargetCalories).toBe(2100);
  });

  it('does not add a yesterday source decision to the morning system prompt', () => {
    const morningContext = {
      ...context,
      date: '2026-08-20',
      nutrition: {
        today: null,
        remainingCalories: null,
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

    expect(snapshot.system).toContain('## Nur der heutige Moment');
    expect(snapshot.system).not.toContain('Der Eintrag für gestern');
    expect(JSON.parse(snapshot.user).context.nutrition).not.toHaveProperty('last3Days');
  });

  it('uses meal permission without a protein-gap threshold', () => {
    const snapshot = buildDailyInsightPrompt('nutrition_guidance', {
      ...context,
      nutrition: {
        remainingCalories: 600,
        dailyInsightProteinStatus: 'below_range',
        mealAdviceAllowed: true,
      },
    } as InsightInputContext);

    expect(JSON.parse(snapshot.user).context.nutrition.mealAdviceAllowed).toBe(true);
    expect(snapshot.system).not.toContain('remainingProteinG');
    expect(snapshot.system).not.toContain('20 g');
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
        dailyInsightProteinStatus: 'below_range',
        mealAdviceAllowed: false,
        last3Days: [],
      },
    } satisfies InsightInputContext;
    const snapshot = buildDailyInsightPrompt('activity_focus', activityContext);

    expect(snapshot.system).toContain('Verbindlicher Vertrag für das aktuelle effektive Aktivitätsziel');
    expect(snapshot.system).toContain('Ordne jede Kalorienzahl ausschließlich ihrem Feld zu');
    expect(snapshot.system).toContain('Verwende den Zielwert niemals als Restbetrag');
    expect(snapshot.system).toContain('Kalorienziel');
    expect(snapshot.system).toContain('mealAdviceAllowed ist false');
  });

  it('uses range-based macro semantics and keeps activity bonus calorie-only', () => {
    const nutritionModule = DAILY_INSIGHT_PROMPT_MODULES.nutrition_guidance;
    const activityModule = DAILY_INSIGHT_PROMPT_MODULES.activity_focus;

    expect(nutritionModule).toContain('nutrition.targets.macroRanges');
    expect(nutritionModule).toContain('nutrition.dailyInsightProteinStatus');
    expect(nutritionModule).toContain('Werte außerhalb des Kohlenhydratbereichs dürfen weder als zu niedrig/zu hoch');
    expect(nutritionModule).toContain('Makroeinordnungen beziehen sich ausschließlich auf die heutige Aufnahme');
    expect(activityModule).toContain('Der activityBonus erhöht ausschließlich das effektive Kalorienziel');
    expect(activityModule).toContain('begründet keine temporären Makrobereiche');
    expect(activityModule).toContain('Fueling-Hinweise bleiben qualitativ');
  });

  it('appends the today-only macro guard to every intent', () => {
    for (const intent of intents) {
      const system = buildDailyInsightPrompt(intent, context).system;
      const guardIndex = system.lastIndexOf('## Abschließende Regel für heutige Makro-Einordnungen');

      expect(guardIndex).toBeGreaterThan(system.lastIndexOf('## Ausgabe'));
      expect(system.slice(guardIndex)).toContain('nutrition.targets.macroRanges');
      expect(system.slice(guardIndex)).toContain('nutrition.dailyInsightProteinStatus');
    }
  });

  it('adds the protein-above-range guidance to every intent', () => {
    for (const intent of intents) {
      const guard = buildDailyInsightPrompt(intent, context).system.split('## Abschließende Regel für heutige Makro-Einordnungen').pop()!;

      expect(guard).toContain('Bei in_range liegt die Proteinzufuhr im Ziel');
      expect(guard).toContain('Bei above_range (über 2,0 und unter 2,5 g/kg) gibt es keine besondere Proteinwarnung');
      expect(guard).toContain('Nur bei at_or_above_2_5_g_per_kg darfst du optional und nicht alarmistisch');
      expect(guard).toContain('ohne für heute eine Mahlzeit zu empfehlen');
    }
  });

  it('computes a stable fingerprint for the complete v30 bundle', () => {
    expect(DAILY_INSIGHT_PROMPT_ASSEMBLY_VERSION).toBe('v14');
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