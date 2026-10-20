import { createHash } from 'node:crypto';
import type { InsightInputContext, InsightIntent } from '@fittrack/shared';
import { DAILY_INSIGHT_SCHEMA } from '../dailyInsightSchema';
import {
  DAILY_INSIGHT_OUTPUT_CONTRACT,
  DAILY_INSIGHT_SHARED_TONE,
} from './sharedTone';
import { DAILY_INSIGHT_ACTIVITY_MODULE } from './promptActivity';
import { DAILY_INSIGHT_GENERAL_MODULE } from './promptGeneral';
import { DAILY_INSIGHT_MORNING_MODULE } from './promptMorning';
import { DAILY_INSIGHT_NUTRITION_MODULE } from './promptNutrition';
import { DAILY_INSIGHT_WEIGHT_MODULE } from './promptWeight';

export const DAILY_INSIGHT_PROMPT_VERSION = 'v29' as const;
const DAILY_INSIGHT_ACTIVE_MACRO_GUARD = `## Abschließende Regel für heutige Makro-Einordnungen
Beurteile heutige Makros nur anhand der gelieferten nutrition.dailyInsightProteinStatus und nutrition.targets.macroRanges. Der serverseitige Proteinstatus ist maßgeblich; leite ihn nicht aus Grammwerten, Einzelzielen oder dem Text selbst her. Bei unknown bleibt die Proteineinordnung unbekannt. Der Kohlenhydratbereich ist Orientierung und begründet allein keine Korrektur. Bei in_range liegt die Proteinzufuhr im Ziel. Bei above_range (über 2,0 und unter 2,5 g/kg) gibt es keine besondere Proteinwarnung und kein Problem. Nur bei at_or_above_2_5_g_per_kg darfst du optional und nicht alarmistisch erwähnen, dass die Proteinzufuhr vermutlich über dem benötigten Maß liegt und die Kalorien auch aus anderen Lebensmitteln gewählt werden können, falls diese besser schmecken oder zufriedener machen; Protein ist dadurch nicht automatisch ein Problem. Liegt zugleich die Aufnahme über dem Kalorienziel, darfst du beides verbinden und eine künftige Anpassung der Lebensmittelauswahl anregen, ohne für heute eine Mahlzeit zu empfehlen.`;

export const DAILY_INSIGHT_PROMPT_ASSEMBLY_VERSION = 'v13' as const;

export interface DailyInsightPromptSnapshot {
  system: string;
  user: string;
}

export const DAILY_INSIGHT_PROMPT_MODULES: Readonly<Record<InsightIntent, string>> = {
  activity_focus: DAILY_INSIGHT_ACTIVITY_MODULE,
  weight_signal: DAILY_INSIGHT_WEIGHT_MODULE,
  phase_progress: DAILY_INSIGHT_WEIGHT_MODULE,
  morning_orientation: DAILY_INSIGHT_MORNING_MODULE,
  nutrition_guidance: DAILY_INSIGHT_NUTRITION_MODULE,
  general: DAILY_INSIGHT_GENERAL_MODULE,
};

export const DAILY_INSIGHT_PROMPT_GUARD_POLICY = {
  openCalorieBudget: { operator: '>', threshold: 0 },
  negativeCalorieBudget: { operator: '<', threshold: 0 },
  staleWeight: { operator: '>', thresholdDays: 14 },
  openDayPhaseProgress: { operator: '>', threshold: 0 },
  effectiveActivityTargetSource: 'special_activity_snapshot',
} as const;

export const DAILY_INSIGHT_PROMPT_GUARD_TEXTS = {
  currentMomentOnly: '## Nur der heutige Moment\nBeschreibe ausschließlich die heutige Ernährung und Aktivität. Erwähne oder vergleiche keine Einträge, Ziele oder Aktivitäten früherer Tage. Verwende dafür nur die heutigen Kontextfelder. Gelieferte aktuelle Gewichts- und Progress-Signale dürfen als heutiger Stand eingeordnet werden.',
  noCalorieSurplusTerm: '## Verbotene Energiebilanz-Bezeichnung\nVerwende niemals "Kalorienüberschuss". Eine Aufnahme über dem heutigen Kalorienziel darf nur als "über dem Kalorienziel" beschrieben werden und belegt keinen physiologischen Energieüberschuss.',
  claimGrounding: '## Konkrete serverseitige Aussagegrenzen\nDer JSON-Block grounding ordnet Fakten verbindlich ihren Quellen zu. mealAdviceAllowed false sperrt konkrete Mahlzeiten- und Essensempfehlungen in allen Textfeldern; bei true bleibt eine Empfehlung optional und muss zum Fokus passen. actionFields null bedeutet recommendation null. measurementRelation lower bedeutet kleiner, nicht stabil; higher bedeutet größer; equal allein bedeutet gleich. dailyActivityStatus completed erlaubt eine klare Abschlussaussage; unknown erlaubt keine Behauptung, die Aktivität sei abgeschlossen; sie darf als eingetragen, geplant oder anstehend beschrieben werden.',
  sourceBoundClaims: '## Verbindliche Quellenbindung jeder Aussage\nEin Ziel allein belegt keinen heutigen Spielraum. Wenn Aufnahme oder Rest null ist, behaupte keine verfügbaren Kalorien oder Möglichkeiten für restliche Mahlzeiten. weight.weeklyTrend30d ist die gelieferte Trendrichtung. Sind latestKg und previousKg verschieden, behaupte nicht, das Gewicht sei stabil oder unverändert; erfinde keine Schwelle. Bei dailyActivityStatus unknown behaupte keinen Abschluss; Planung oder Anstehen darf genannt werden; Tageszeit, Eintrag und Aktivitätsdetails sind kein zusätzlicher Beleg. Bei mealAdviceAllowed false gib keine Essens- oder Mahlzeitenempfehlung aus. Prüfe jeden Satz getrennt.',
  finalActivityFocus: '## Abschließender Vorrang des Aktivitätsfokus\nDie besondere Aktivität priorisiert das Thema, unterdrückt aber keine anderen relevanten gelieferten Signale. Bei langer oder intensiver Ausdauerbelastung müssen Kohlenhydrate oder Energie, Flüssigkeit und Regeneration oder Erholung im selben Output vorkommen; nenne in summary oder recommendation alle drei Punkte ausdrücklich, ohne einen davon ist die Antwort unvollständig, auch wenn weitere Signale wie Protein oder Gewicht erwähnt werden. Ordne die Aktivität bei vorhandenem Ziel natürlich zum effektiven Kalorien- oder Tagesziel ein. dailyActivityStatus unknown erlaubt keine Aussage über einen Abschluss; completed erlaubt klare Abschlussformulierungen. mealAdviceAllowed bleibt für konkrete Mahlzeitenhinweise maßgeblich. Erfinde weder Aktivitätsverbrauch noch Daten und addiere den Bonus nicht erneut.',
  finalWeightFocus: '## Abschließender Vorrang des Gewichtsfokus\nDer Intent priorisiert Gewicht, schließt aber weitere relevante gelieferte Signale nicht aus. Ordne Gewicht im Zusammenhang mit dem Nutzerziel ein und ergänze andere Signale, wenn sie die heutige Einordnung oder eine sichere Empfehlung beeinflussen. Bei mehr als 14 Tagen seit der letzten Messung fehlen aktuelle Gewichtsdaten: Beschreibe diese Unsicherheit und den Nutzen einer neuen Messung, ohne aktuelle Phase oder aktuellen Trend zu behaupten. Verwende niemals "positive Entwicklung", "positive Fortschrittsphase" oder "Regressionsphase erkannt"; lobe keinen Einzelwert als Fortschrittsbeweis.',
  activityOpenDay: '## Schutz für activity_focus am offenen Tag\nremainingCalories ist positiv. Aufnahme, effektives Tagesziel und Rest sind ein aktueller Zwischenstand. Verwende gelieferte Werte exakt; nutrition.targets.calories enthält den Aktivitätsbonus bereits. Addiere den Bonus nicht erneut und rekonstruiere keine fehlenden Werte. Stelle den Rest nicht als abgeschlossenes Tagesergebnis oder physiologisches Energiedefizit dar. dailyActivityStatus unknown erlaubt keine Aussage über einen Abschluss. Konkrete Mahlzeitenhinweise sind nur erlaubt, wenn mealAdviceAllowed true ist und sie zum Fokus passen.',
  activityCalorieValueAttribution: '## Feste Zuordnung aktueller Kalorienwerte\nOrdne jede Kalorienzahl ausschließlich ihrem Feld zu: nutrition.targets.calories ist das effektive Tagesziel, nutrition.today.calories die protokollierte Aufnahme, nutrition.remainingCalories ausschließlich der Restbetrag und specialActivity.activityBonus ausschließlich der benannte Bonus. Verwende den Zielwert niemals als Restbetrag oder die Aufnahme als Ziel. Der Bonus ist im effektiven Ziel enthalten und wird nicht erneut addiert.',
  finalNegativeBudget: '## Abschließende Sperre bei negativem Kalorienbudget\nremainingCalories ist negativ. Empfiehl für heute keine Mahlzeit und keinen Snack. Setze recommendation exakt auf null.',
  inconsistentNegativeBudget: '## Widersprüchliche aktuelle Kalorienwerte\nDer gelieferte negative Rest passt rechnerisch nicht zu Aufnahme und effektivem Ziel. Nenne keine aktuellen Kalorienzahlen und keine Aufnahme-Ziel-Rechnung; behaupte auch ohne Zahlen keine Überschreitung. Rekonstruiere oder korrigiere keinen Eingangswert. Die heutigen Kalorienangaben widersprechen sich. Die negative Budgetsperre bleibt aktiv. Die Relation bleibt unbekannt und erlaubt keine physiologische Bilanz. Behandle die Abweichung als Datenunsicherheit, ohne daraus eine Tagesbewertung abzuleiten.',
  phaseProgressOpenDay: '## Schutz für phase_progress an einem offenen Tag\nremainingCalories ist nur der Abstand zwischen dem heutigen Ziel und der protokollierten Aufnahme, kein erreichtes Energiedefizit oder vollständiges Tagesergebnis. Leite daraus keine physiologische Bilanz oder Erklärung des längerfristigen Gewichtsverlaufs ab. Der Gewichtsfokus bleibt vorrangig, schließt relevante Ernährungssignale aber nicht aus. Ein positiver Rest allein ist kein Grund für zusätzliche Kalorien oder eine Mahlzeitenempfehlung; konkrete Mahlzeitenhinweise richten sich nach mealAdviceAllowed.',
  negativeBudget: '## Zwingender Budget-Schutz\nremainingCalories ist negativ. Nur wenn Aufnahme, Ziel und Rest rechnerisch übereinstimmen, darfst du die Aufnahme als über dem effektiven Kalorienziel einordnen. Bei Widerspruch ist die Relation unbekannt, nicht überschritten. Eine konsistente Differenz ist nur eine Zielrelation und belegt keinen tatsächlich erreichten Energieüberschuss. Empfiehl heute keine Mahlzeit oder keinen Snack; recommendation muss null sein.',
  mealAdviceDenied: '## Serverseitige Mahlzeitenfreigabe\nmealAdviceAllowed ist false. Gib keine konkrete Mahlzeiten-, Snack- oder Essensempfehlung in einem Textfeld aus. Verwechsle diese Sperre nicht mit einem Proteinstatus.',
  effectiveActivityBudget: '## Verbindlicher Vertrag für das aktuelle effektive Aktivitätsziel\nDie Aktivität und ihr serverseitig berechnetes effektives Tagesziel sind für diesen Output verbindlich. Nenne in title oder summary mindestens einen natürlichen Begriff für dieses Ziel: "Kalorienziel", "Tagesziel", "Energiebedarf" oder eindeutig bezogen "Ziel". Eine Aktivitätsbeschreibung ohne diese Einordnung ist unvollständig. Beurteile Kalorien nur relativ zum effektiven Ziel; der Aktivitätsbonus ist bereits enthalten.',
} as const;

export interface DailyInsightPromptBundle {
  promptVersion: string;
  assemblyVersion: string;
  sharedTone: string;
  outputContract: string;
  intentModules: Readonly<Record<InsightIntent, string>>;
  guardTexts: Readonly<Record<string, string>>;
  guardPolicy: Readonly<Record<string, unknown>>;
  strictStructuredOutputSchema: Readonly<Record<string, unknown>>;
}

const sortedIntentModules = Object.fromEntries(
  Object.entries(DAILY_INSIGHT_PROMPT_MODULES).sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  ),
) as Readonly<Record<InsightIntent, string>>;

export const DAILY_INSIGHT_PROMPT_BUNDLE: DailyInsightPromptBundle = {
  promptVersion: DAILY_INSIGHT_PROMPT_VERSION,
  assemblyVersion: DAILY_INSIGHT_PROMPT_ASSEMBLY_VERSION,
  sharedTone: DAILY_INSIGHT_SHARED_TONE,
  outputContract: DAILY_INSIGHT_OUTPUT_CONTRACT,
  intentModules: sortedIntentModules,
  guardTexts: {
    ...DAILY_INSIGHT_PROMPT_GUARD_TEXTS,
    activeMacroRangesOnly: DAILY_INSIGHT_ACTIVE_MACRO_GUARD,
  },
  guardPolicy: DAILY_INSIGHT_PROMPT_GUARD_POLICY,
  strictStructuredOutputSchema: DAILY_INSIGHT_SCHEMA,
};

function sortForCanonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForCanonicalJson);
  if (value !== null && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((sorted, key) => {
        sorted[key] = sortForCanonicalJson((value as Record<string, unknown>)[key]);
        return sorted;
      }, {});
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  const serialized = JSON.stringify(sortForCanonicalJson(value));
  if (serialized === undefined) throw new Error('Cannot canonicalize undefined JSON');
  return serialized;
}

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function isPositiveFiniteTarget(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value) && value > 0;
}

function buildPromptInputContext(
  intent: InsightIntent,
  context: InsightInputContext,
 ) {
  const nutrition = context.nutrition;
  if (nutrition == null) return context;
  if (hasInconsistentNegativeBudget(context)) {
    return { ...context, nutrition: { budgetStatus: 'inconsistent' } };
  }
  const { last3Days: _last3Days, ...providerNutrition } = nutrition;

  const projectedTargets = nutrition.targets == null
    ? nutrition.targets
    : (() => {
      const { proteinG: _proteinG, carbsG: _carbsG, ...targets } = nutrition.targets!;
      return targets;
    })();
  const projectedToday = nutrition.today == null
    ? nutrition.today
    : (({ protein: _protein, ...today }) => today)(nutrition.today);
  const projectedSpecialActivity = context.specialActivity != null
    ? {
        type: context.specialActivity.type,
        movementTimeMinutes: context.specialActivity.movementTimeMinutes,
        distanceKm: context.specialActivity.distanceKm,
        elevationGainM: context.specialActivity.elevationGainM,
        bodyWeightKg: context.specialActivity.bodyWeightKg,
        dailyCalorieTarget: context.specialActivity.dailyCalorieTarget,
        calculatedAt: context.specialActivity.calculatedAt,
        activityBonus: context.specialActivity.activityBonus,
        ...(context.specialActivity.type === 'hiking'
          ? {
              terrainType: context.specialActivity.terrainType,
              packCategory: context.specialActivity.packCategory,
            }
          : {}),
      }
    : context.specialActivity;

  return {
    ...context,
    specialActivity: projectedSpecialActivity,
    nutrition: {
      ...providerNutrition,
      today: projectedToday,
      targets: projectedTargets,
    },
  };
}

function hasInconsistentNegativeBudget(context: InsightInputContext): boolean {
  const nutrition = context.nutrition;
  return nutrition?.remainingCalories != null && nutrition.remainingCalories < 0
    && nutrition.today != null && nutrition.targets != null
    && Math.round(nutrition.targets.calories - nutrition.today.calories) !== Math.round(nutrition.remainingCalories);
}

function buildClaimGrounding(intent: InsightIntent, context: InsightInputContext) {
  const nutrition = context.nutrition;
  if (nutrition == null) return undefined;
  const inconsistent = hasInconsistentNegativeBudget(context);
  const mealAdviceAllowed = nutrition.mealAdviceAllowed;
  const weight = context.weight;
  return {
    focus: inconsistent ? 'budget_uncertainty_only' : 'combined',
    mealAdviceAllowed,
    actionFields: inconsistent ? 'null' : 'intent_scoped',
    weight: {
      measurementRelation: weight?.latestKg == null || weight.previousKg == null ? 'unknown'
        : weight.latestKg < weight.previousKg ? 'lower' : weight.latestKg > weight.previousKg ? 'higher' : 'equal',
      weeklyTrend30d: weight?.weeklyTrend30d ?? null,
    },
    dailyActivityStatus: context.dailyActivityStatus,
  };
}

export function computeDailyInsightPromptFingerprint(
  bundle: DailyInsightPromptBundle = DAILY_INSIGHT_PROMPT_BUNDLE,
): string {
  return sha256(canonicalJson(bundle));
}

export const DAILY_INSIGHT_PROMPT_FINGERPRINT = computeDailyInsightPromptFingerprint();

export function computeDailyInsightSystemPromptHash(systemPrompt: string): string {
  return sha256(systemPrompt);
}

export function buildDailyInsightPrompt(
  intent: InsightIntent,
  context: InsightInputContext,
): DailyInsightPromptSnapshot {
  const remainingCalories = context.nutrition?.remainingCalories;
  const targets = context.nutrition?.targets;
  const contextGuards = [
    context.nutrition?.mealAdviceAllowed === false
      ? DAILY_INSIGHT_PROMPT_GUARD_TEXTS.mealAdviceDenied
      : null,
    context.nutrition?.remainingCalories != null
    && context.nutrition.remainingCalories < DAILY_INSIGHT_PROMPT_GUARD_POLICY.negativeCalorieBudget.threshold
      ? DAILY_INSIGHT_PROMPT_GUARD_TEXTS.negativeBudget
      : null,
  ].filter((guard) => guard !== null);
  const phaseProgressOpenDayGuard =
    intent === 'phase_progress'
    && remainingCalories != null
    && remainingCalories > DAILY_INSIGHT_PROMPT_GUARD_POLICY.openDayPhaseProgress.threshold
      ? DAILY_INSIGHT_PROMPT_GUARD_TEXTS.phaseProgressOpenDay
      : null;
  const effectiveActivityBudgetGuard =
    intent === 'activity_focus'
    && context.specialActivity != null
    && remainingCalories != null
    && targets != null
    && targets.targetSource === DAILY_INSIGHT_PROMPT_GUARD_POLICY.effectiveActivityTargetSource
    && targets.baseCalories != null
    && targets.activityBonusCalories != null
      ? DAILY_INSIGHT_PROMPT_GUARD_TEXTS.effectiveActivityBudget
      : null;
  const finalNegativeBudgetGuard =
    intent === 'nutrition_guidance'
    && remainingCalories != null
    && remainingCalories < DAILY_INSIGHT_PROMPT_GUARD_POLICY.negativeCalorieBudget.threshold
      ? DAILY_INSIGHT_PROMPT_GUARD_TEXTS.finalNegativeBudget
      : null;
  const system = [
    DAILY_INSIGHT_SHARED_TONE,
    `## Verbindlicher Intent\n${intent}`,
    DAILY_INSIGHT_PROMPT_MODULES[intent],
    DAILY_INSIGHT_PROMPT_GUARD_TEXTS.currentMomentOnly,
    DAILY_INSIGHT_PROMPT_GUARD_TEXTS.noCalorieSurplusTerm,
    DAILY_INSIGHT_OUTPUT_CONTRACT,
    DAILY_INSIGHT_ACTIVE_MACRO_GUARD,
    ...(phaseProgressOpenDayGuard === null ? [] : [phaseProgressOpenDayGuard]),
    ...contextGuards,
    ...(effectiveActivityBudgetGuard === null
      ? []
      : [effectiveActivityBudgetGuard, DAILY_INSIGHT_PROMPT_GUARD_TEXTS.activityCalorieValueAttribution]),
    ...(finalNegativeBudgetGuard === null ? [] : [finalNegativeBudgetGuard]),
    ...(remainingCalories != null && remainingCalories < 0
      && context.nutrition.today != null && targets != null
      && Math.round(targets.calories - context.nutrition.today.calories) !== Math.round(remainingCalories)
      ? [DAILY_INSIGHT_PROMPT_GUARD_TEXTS.inconsistentNegativeBudget] : []),
    ...(intent === 'activity_focus'
      && remainingCalories != null
      && remainingCalories > DAILY_INSIGHT_PROMPT_GUARD_POLICY.openCalorieBudget.threshold
      ? [DAILY_INSIGHT_PROMPT_GUARD_TEXTS.activityOpenDay] : []),
    ...(intent === 'activity_focus'
      ? [DAILY_INSIGHT_PROMPT_GUARD_TEXTS.finalActivityFocus] : []),
    DAILY_INSIGHT_PROMPT_GUARD_TEXTS.sourceBoundClaims,
    DAILY_INSIGHT_PROMPT_GUARD_TEXTS.claimGrounding,
    ...(intent === 'weight_signal' || intent === 'phase_progress'
      ? [DAILY_INSIGHT_PROMPT_GUARD_TEXTS.finalWeightFocus] : []),
  ].join('\n\n');
  const user = JSON.stringify({ intent, context: buildPromptInputContext(intent, context), grounding: buildClaimGrounding(intent, context) });
  return { system, user };
}