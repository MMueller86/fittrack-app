import type { InsightInputContext, InsightIntent } from '@fittrack/shared';
import {
  DAILY_INSIGHT_OUTPUT_CONTRACT,
  DAILY_INSIGHT_SHARED_TONE,
} from './sharedTone';
import { DAILY_INSIGHT_ACTIVITY_MODULE } from './promptActivity';
import { DAILY_INSIGHT_GENERAL_MODULE } from './promptGeneral';
import { DAILY_INSIGHT_MORNING_MODULE } from './promptMorning';
import { DAILY_INSIGHT_NUTRITION_MODULE } from './promptNutrition';
import { DAILY_INSIGHT_WEIGHT_MODULE } from './promptWeight';

export const DAILY_INSIGHT_PROMPT_VERSION = 'v11';

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

export const DAILY_INSIGHT_SYSTEM_PROMPT = [
  DAILY_INSIGHT_SHARED_TONE,
  DAILY_INSIGHT_GENERAL_MODULE,
  DAILY_INSIGHT_OUTPUT_CONTRACT,
].join('\n\n');

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
    && remainingCalories > 0
    && remainingProteinG != null
    && remainingProteinG > 20
      ? '## Zwingender Vertrag für Proteinlücke bei offenem Kalorienbudget\nremainingCalories ist positiv und remainingProteinG ist größer als 20. Der Tag ist noch offen und die materielle Proteinlücke ist ein vorausschauendes Signal für die nächste Mahlzeit, keine abgeschlossene Tagesbewertung. Formuliere im gesamten JSON ausschließlich offen und vorausschauend: Bewerte die bisherige Kalorienaufnahme nicht als zu gering und stelle den Tag nicht als abgeschlossen dar. Verwende insbesondere nicht "zu wenig gegessen", "unter deinem Ziel", "unter dem Ziel" oder "dein Kalorienverbrauch liegt unter". Gib eine konkrete proteinreiche nächste Mahlzeit als einzigen Ernährungshinweis; widersprüchliche Aussagen wie "Proteinziel ist erreicht" oder "fast optimal" sind unzulässig.'
      : null,
    remainingCalories != null && remainingCalories > 0 && remainingProteinG != null && remainingProteinG <= 20
      ? '## Zwingender Schutz für den offenen Tag\nremainingCalories ist positiv: Der Tag ist noch offen. Verwende keine abgeschlossene Bewertung und keine Sprache, die den offenen Tag als abgeschlossen darstellt. Formuliere ausschließlich offen und vorausschauend. Gib in diesem Kontext keine Handlungsempfehlung und keinen CTA aus: recommendation, cta und ctaTarget müssen exakt null sein.'
      : null,
    context.nutrition?.remainingCalories != null && context.nutrition.remainingCalories < 0
      ? '## Zwingender Budget-Schutz\nremainingCalories ist negativ. Empfehle heute weder Essen noch Protein; recommendation und cta müssen null sein, sofern keine nicht-ernährungsbezogene Aktion zwingend ist.'
      : null,
    remainingProteinG == null
      ? '## Zwingender Protein-Daten-Schutz\nremainingProteinG ist null. Der Proteinstatus ist unbekannt, nicht null und nicht automatisch eine Lücke. Berechne keinen Gap aus today.protein oder targets.proteinG und gib keine Protein-Empfehlung aus. Wenn keine nicht-ernährungsbezogene Aktion zwingend ist, müssen die JSON-Felder recommendation, cta und ctaTarget wörtlich null sein. Jede andere Belegung dieser Felder wäre ungültig.'
      : remainingProteinG <= 20
      ? '## Zwingender Protein-Schutz\nremainingProteinG ist höchstens 20. Das Proteinziel ist nahezu erreicht. Empfehle heute weder zusätzliches Protein noch irgendeine weitere Mahlzeit oder einen Snack nur zum Ausschöpfen des verbleibenden Kalorienbudgets; der vorhandene Kalorienspielraum hebt diese Sperre nicht auf. Wenn keine nicht-ernährungsbezogene Aktion zwingend ist, müssen die JSON-Felder recommendation, cta und ctaTarget wörtlich null sein: {"recommendation": null, "cta": null, "ctaTarget": null}. Jede andere Belegung dieser Felder wäre ungültig.'
      : null,
  ].filter((guard): guard is string => guard !== null);
  const effectiveActivityBudgetGuard =
    intent === 'activity_focus'
    && context.specialActivity != null
    && remainingCalories != null
    && targets != null
    && targets.targetSource === 'special_activity_snapshot'
    && targets.baseCalories != null
    && targets.activityBonusCalories != null
      ? `## Verbindlicher Vertrag für das aktuelle effektive Aktivitätsziel
Die Aktivität und ihr serverseitig berechnetes effektives Tagesziel sind für diesen Output verbindlich. Nenne in title oder summary mindestens einen natürlichen Begriff für dieses Ziel: "Kalorienziel", "Tagesziel", "Energiebedarf" oder eindeutig bezogen "Ziel". Eine reine Aktivitätsbeschreibung ohne diese Zielvokabel ist ungültig. Beurteile die gegessenen Kalorien niemals isoliert, sondern nur im Verhältnis zum effektiven Ziel mit Aktivitätsbonus.
Wenn remainingProteinG höchstens 20 ist, ist der Protein-Lock aktiv: Liefere keine zusätzliche Proteinquelle, proteinreiche Mahlzeit, Mahlzeit, Snack oder sonstige protein- oder mahlzeitenbezogene Aktion. Ein möglicher recommendation- oder cta-Inhalt darf dann nur einen nicht-ernährungsbezogenen Aktivitäts-, Flüssigkeits- oder Erholungshinweis enthalten.`
      : null;
  const finalOutputGuard =
    intent === 'nutrition_guidance'
    && remainingCalories != null
    && remainingCalories > 0
    && remainingProteinG != null
    && remainingProteinG <= 20
      ? `## Letzte Ausgabekontrolle für diesen konkreten Fall
Der verbindliche Intent ist nutrition_guidance, remainingCalories ist positiv und remainingProteinG ist höchstens 20. Das Proteinziel ist damit nahezu erreicht. Setze in deinem JSON recommendation, cta und ctaTarget exakt auf null. Gib keine allgemeine Empfehlung und keinen CTA aus. Schreibe auch in title oder summary keine Handlung zum zusätzlichen Essen oder Protein; insbesondere sind "proteinreiche Mahlzeit", "proteinreich essen", Proteinshake, Magerquark, Skyr und Hüttenkäse im gesamten JSON verboten. Eine neutrale Einordnung wie "Das Proteinziel ist fast erreicht" ist erlaubt. Diese Sperre gilt trotz verbleibender Kalorien.`
      : null;
  const system = [
    DAILY_INSIGHT_SHARED_TONE,
    `## Verbindlicher Intent\n${intent}`,
    DAILY_INSIGHT_PROMPT_MODULES[intent],
    DAILY_INSIGHT_OUTPUT_CONTRACT,
    ...contextGuards,
    ...(effectiveActivityBudgetGuard === null ? [] : [effectiveActivityBudgetGuard]),
    ...(finalOutputGuard === null ? [] : [finalOutputGuard]),
  ].join('\n\n');
  const user = JSON.stringify({ intent, context });
  return { system, user };
}