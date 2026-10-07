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

export const DAILY_INSIGHT_PROMPT_VERSION = 'v15' as const;
export const DAILY_INSIGHT_PROMPT_ASSEMBLY_VERSION = 'v2' as const;

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
  materialProteinGap: { operator: '>', threshold: 20 },
  nearlyCompleteProtein: { operator: '<=', threshold: 20 },
  staleWeight: { operator: '>', thresholdDays: 14 },
  openDayPhaseProgress: { operator: '>', threshold: 0 },
  effectiveActivityTargetSource: 'special_activity_snapshot',
  morningHistoricalSource: '## Verbindliche serverseitige Zuordnung historischer Morgenwerte\nDer folgende Datenblock benennt den passenden Eintrag für gestern und dessen zulässige Einordnung. Folge dieser Zuordnung exakt. Verwende keine anderen Ziele oder Rohfelder als Ersatz.',
} as const;

export const DAILY_INSIGHT_PROMPT_GUARD_TEXTS = {
  finalNegativeBudget: `## Abschließende Sperre bei negativem Kalorienbudget
remainingCalories ist negativ. Diese Budget-Sperre hat Vorrang vor jedem Protein-Gap und allen Mahlzeitenregeln, auch wenn remainingProteinG größer als 20 ist. Empfiehl für heute keine Mahlzeit, keinen Snack und keine zusätzliche Proteinquelle. Setze recommendation, cta und ctaTarget exakt auf null: {"recommendation": null, "cta": null, "ctaTarget": null}. Eine Empfehlung oder ein CTA für eine proteinreiche nächste Mahlzeit ist ebenfalls verboten.`,
  openBudgetWithProteinGap: '## Zwingender Vertrag für Proteinlücke bei offenem Kalorienbudget\nremainingCalories ist positiv und remainingProteinG ist größer als 20. Der Tag ist noch offen und die materielle Proteinlücke ist ein vorausschauendes Signal für die nächste Mahlzeit, keine abgeschlossene Tagesbewertung. Formuliere im gesamten JSON ausschließlich offen und vorausschauend: Bewerte die bisherige Kalorienaufnahme nicht als zu gering und stelle den Tag nicht als abgeschlossen dar. Verwende insbesondere nicht "zu wenig gegessen", "unter deinem Ziel", "unter dem Ziel" oder "dein Kalorienverbrauch liegt unter". Gib eine konkrete proteinreiche nächste Mahlzeit als einzigen Ernährungshinweis; widersprüchliche Aussagen wie "Proteinziel ist erreicht" oder "fast optimal" sind unzulässig.',
  openDay: '## Zwingender Schutz für den offenen Tag\nremainingCalories ist positiv: Der Tag ist noch offen. Verwende keine abgeschlossene Bewertung und keine Sprache, die den offenen Tag als abgeschlossen darstellt. Formuliere ausschließlich offen und vorausschauend. Gib in diesem Kontext keine Handlungsempfehlung und keinen CTA aus: recommendation, cta und ctaTarget müssen exakt null sein.',
  phaseProgressOpenDay: '## Schutz für phase_progress an einem offenen Tag\nremainingCalories ist positiv. Es ist nur der noch offene Abstand zwischen dem heutigen Ziel und den bisher protokollierten Kalorien; es ist kein erreichtes Energiedefizit oder ein vollständiges Tagesergebnis. Leite daraus weder einen erreichten Defizit-/Überschuss noch eine Erklärung des längerfristigen Gewichtsverlaufs ab. Bewerte phase_progress ausschließlich anhand der Gewichtssignale und ordne die heutige Aufnahme nicht als zu niedrig oder abgeschlossen ein. Empfiehl nicht, die Kalorienzufuhr zu erhöhen oder restliche Kalorien durch Essen auszuschöpfen; ein positiver Rest allein ist kein Grund für zusätzliche Kalorien oder eine zusätzliche Mahlzeit. Stelle verbleibende Kalorien nicht als verfügbares Essensbudget dar und beschreibe sie nicht als Möglichkeit, flexibel weitere Nahrung zu wählen oder das Tagesziel durch eine Mahlzeit zu erreichen. Gib weder eine Empfehlung noch einen CTA, der verbleibende Kalorien nutzt, auffüllt oder ausschöpft. Wenn das Restbudget der einzige Grund für recommendation oder cta wäre, setze recommendation, cta und ctaTarget auf null. Eine davon unabhängige, sachlich begründete nicht-ernährungsbezogene Empfehlung bleibt möglich.',
  negativeBudget: `## Zwingender Budget-Schutz
remainingCalories ist negativ: Die protokollierte Aufnahme liegt damit über dem effektiven Kalorienziel. Das ist nur eine Zielrelation und belegt keinen tatsächlich erreichten Energieüberschuss oder eine Energiebilanz. Nenne höchstens die Aufnahme im Verhältnis zum Ziel; behaupte keinen physiologischen Defizit- oder Überschusszustand. Empfehle heute weder Essen noch Protein; recommendation und cta müssen null sein, sofern keine nicht-ernährungsbezogene Aktion zwingend ist.`,
  unknownProtein: '## Zwingender Protein-Daten-Schutz\nremainingProteinG ist null. Der Proteinstatus ist unbekannt, nicht null und nicht automatisch eine Lücke. Berechne keinen Gap aus today.protein oder targets.proteinG und gib keine Protein-Empfehlung aus. Wenn keine nicht-ernährungsbezogene Aktion zwingend ist, müssen die JSON-Felder recommendation, cta und ctaTarget wörtlich null sein. Jede andere Belegung dieser Felder wäre ungültig.',
  nearlyCompleteProtein: '## Zwingender Protein-Schutz\nremainingProteinG ist höchstens 20. Das Proteinziel ist nahezu erreicht. Empfehle heute weder zusätzliches Protein noch irgendeine weitere Mahlzeit oder einen Snack nur zum Ausschöpfen des verbleibenden Kalorienbudgets; der vorhandene Kalorienspielraum hebt diese Sperre nicht auf. Wenn keine nicht-ernährungsbezogene Aktion zwingend ist, müssen die JSON-Felder recommendation, cta und ctaTarget wörtlich null sein: {"recommendation": null, "cta": null, "ctaTarget": null}. Jede andere Belegung dieser Felder wäre ungültig.',
  effectiveActivityBudget: `## Verbindlicher Vertrag für das aktuelle effektive Aktivitätsziel\nDie Aktivität und ihr serverseitig berechnetes effektives Tagesziel sind für diesen Output verbindlich. Nenne in title oder summary mindestens einen natürlichen Begriff für dieses Ziel: "Kalorienziel", "Tagesziel", "Energiebedarf" oder eindeutig bezogen "Ziel". Eine reine Aktivitätsbeschreibung ohne diese Zielvokabel ist ungültig. Beurteile die gegessenen Kalorien niemals isoliert, sondern nur im Verhältnis zum effektiven Ziel mit Aktivitätsbonus.\nWenn remainingProteinG höchstens 20 ist, ist der Protein-Lock aktiv: Liefere keine zusätzliche Proteinquelle, proteinreiche Mahlzeit, Mahlzeit, Snack oder sonstige protein- oder mahlzeitenbezogene Aktion. Ein möglicher recommendation- oder cta-Inhalt darf dann nur einen nicht-ernährungsbezogenen Aktivitäts-, Flüssigkeits- oder Erholungshinweis enthalten.`,
  finalOutput: `## Letzte Ausgabekontrolle für diesen konkreten Fall\nDer verbindliche Intent ist nutrition_guidance, remainingCalories ist positiv und remainingProteinG ist höchstens 20. Das Proteinziel ist damit nahezu erreicht. Setze in deinem JSON recommendation, cta und ctaTarget exakt auf null. Gib keine allgemeine Empfehlung und keinen CTA aus. Schreibe auch in title oder summary keine Handlung zum zusätzlichen Essen oder Protein; insbesondere sind "proteinreiche Mahlzeit", "proteinreich essen", Proteinshake, Magerquark, Skyr und Hüttenkäse im gesamten JSON verboten. Eine neutrale Einordnung wie "Das Proteinziel ist fast erreicht" ist erlaubt. Diese Sperre gilt trotz verbleibender Kalorien.`,
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
  guardTexts: DAILY_INSIGHT_PROMPT_GUARD_TEXTS,
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

function buildMorningHistoricalSourceGuard(context: InsightInputContext): string {
  const currentDate = /^\d{4}-\d{2}-\d{2}$/.test(context.date)
    ? new Date(`${context.date}T00:00:00.000Z`)
    : null;
  if (currentDate == null || !Number.isFinite(currentDate.getTime())) {
    return 'Die gestrige Quelle ist nicht eindeutig. Behaupte keine gestrige Aufnahme oder Zielrelation.';
  }

  currentDate.setUTCDate(currentDate.getUTCDate() - 1);
  const yesterday = currentDate.toISOString().slice(0, 10);
  const day = context.nutrition?.last3Days?.find((entry) => entry.date === yesterday);
  if (!day) {
    return 'Für gestern gibt es keinen passenden last3Days-Eintrag. Behaupte keine gestrige Aufnahme oder Zielrelation und ersetze den Eintrag nicht durch einen älteren Tag.';
  }
  if (day.hasMealItem === false || day.calories == null || !Number.isFinite(day.calories)) {
    return `Der Eintrag für gestern (${yesterday}) hat keine protokollierte Aufnahme; calories=${day.calories ?? 'null'}, hasMealItem=${day.hasMealItem ?? 'unknown'}. Die Aufnahme ist unbekannt, nicht null oder 0 kcal. Behaupte keine Menge, Makros oder Zielrelation für gestern.`;
  }

  const target = day.effectiveTargetCalories;
  const baseTarget = day.baseTargetCalories;
  const sourceIsReliable = day.targetSource === 'day_target_snapshot'
    || (
      day.targetSource === 'special_activity_snapshot'
      && isPositiveFiniteTarget(day.specialActivity?.dailyCalorieTarget)
    );
  if (!isPositiveFiniteTarget(baseTarget) || !isPositiveFiniteTarget(target) || !sourceIsReliable) {
    return `Der Eintrag für gestern (${yesterday}) hat ${day.calories} kcal, aber kein eindeutig nutzbares historisches Ziel (targetSource=${day.targetSource ?? 'unknown'}). Verwende weder das aktuelle Profilziel noch ein Aktivitäts-Rohfeld; stelle keine numerische oder richtungsbezogene Zielrelation her. Lasse den Vergleich weg oder sage, dass kein verlässlicher historischer Zielvergleich möglich ist.`;
  }

  const relation = day.calories < target ? 'unter' : day.calories > target ? 'über' : 'genau auf';
  const operator = relation === 'unter' ? '<' : relation === 'über' ? '>' : '=';
  return `Der Eintrag für gestern (${yesterday}) hat ${day.calories} kcal; sein maßgebliches ${day.targetSource} beträgt ${target} kcal. Die einzige zulässige Zielrelation ist ${relation} (${day.calories} ${operator} ${target}). Ersetze diesen Wert nicht durch nutrition.targets oder specialActivity.dailyCalorieTarget.`;
}

function buildPromptInputContext(
  intent: InsightIntent,
  context: InsightInputContext,
): InsightInputContext {
  const historicalDays = context.nutrition?.last3Days;
  if (intent !== 'morning_orientation' || historicalDays == null) return context;

  return {
    ...context,
    nutrition: {
      ...context.nutrition,
      last3Days: historicalDays.map((day) => day.targetSource === 'profile_fallback'
        ? { ...day, baseTargetCalories: null, effectiveTargetCalories: null }
        : day),
    },
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
  const remainingProteinG = context.nutrition?.remainingProteinG;
  const targets = context.nutrition?.targets;
  const contextGuards = [
    intent === 'nutrition_guidance'
    && remainingCalories != null
    && remainingCalories > DAILY_INSIGHT_PROMPT_GUARD_POLICY.openCalorieBudget.threshold
    && remainingProteinG != null
    && remainingProteinG > DAILY_INSIGHT_PROMPT_GUARD_POLICY.materialProteinGap.threshold
      ? DAILY_INSIGHT_PROMPT_GUARD_TEXTS.openBudgetWithProteinGap
      : null,
    remainingCalories != null
    && remainingCalories > DAILY_INSIGHT_PROMPT_GUARD_POLICY.openCalorieBudget.threshold
    && remainingProteinG != null
    && remainingProteinG <= DAILY_INSIGHT_PROMPT_GUARD_POLICY.nearlyCompleteProtein.threshold
      ? DAILY_INSIGHT_PROMPT_GUARD_TEXTS.openDay
      : null,
    context.nutrition?.remainingCalories != null
    && context.nutrition.remainingCalories < DAILY_INSIGHT_PROMPT_GUARD_POLICY.negativeCalorieBudget.threshold
      ? DAILY_INSIGHT_PROMPT_GUARD_TEXTS.negativeBudget
      : null,
    remainingProteinG == null
      ? DAILY_INSIGHT_PROMPT_GUARD_TEXTS.unknownProtein
      : remainingProteinG <= DAILY_INSIGHT_PROMPT_GUARD_POLICY.nearlyCompleteProtein.threshold
      ? DAILY_INSIGHT_PROMPT_GUARD_TEXTS.nearlyCompleteProtein
      : null,
  ].filter((guard) => guard !== null);
  const phaseProgressOpenDayGuard =
    intent === 'phase_progress'
    && remainingCalories != null
    && remainingCalories > DAILY_INSIGHT_PROMPT_GUARD_POLICY.openDayPhaseProgress.threshold
      ? DAILY_INSIGHT_PROMPT_GUARD_TEXTS.phaseProgressOpenDay
      : null;
  const morningHistoricalGuard = intent === 'morning_orientation'
    ? [
      DAILY_INSIGHT_PROMPT_GUARD_POLICY.morningHistoricalSource,
      buildMorningHistoricalSourceGuard(context),
    ].join('\n')
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
  const finalOutputGuard =
    intent === 'nutrition_guidance'
    && remainingCalories != null
    && remainingCalories > DAILY_INSIGHT_PROMPT_GUARD_POLICY.openCalorieBudget.threshold
    && remainingProteinG != null
    && remainingProteinG <= DAILY_INSIGHT_PROMPT_GUARD_POLICY.nearlyCompleteProtein.threshold
      ? DAILY_INSIGHT_PROMPT_GUARD_TEXTS.finalOutput
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
    ...(morningHistoricalGuard === null ? [] : [morningHistoricalGuard]),
    DAILY_INSIGHT_OUTPUT_CONTRACT,
    ...(phaseProgressOpenDayGuard === null ? [] : [phaseProgressOpenDayGuard]),
    ...contextGuards,
    ...(effectiveActivityBudgetGuard === null ? [] : [effectiveActivityBudgetGuard]),
    ...(finalOutputGuard === null ? [] : [finalOutputGuard]),
    ...(finalNegativeBudgetGuard === null ? [] : [finalNegativeBudgetGuard]),
  ].join('\n\n');
  const user = JSON.stringify({ intent, context: buildPromptInputContext(intent, context) });
  return { system, user };
}