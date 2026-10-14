// getDayHint — pure function zur Generierung des personalisierten Tageshinweises.
// Wird im HomeScreen unter der Begrüßung angezeigt.
// Separate Datei → vollständig unit-testbar ohne RN-Imports.

import type { MacroRanges, WorkoutType } from '@fittrack/shared';

export interface DayHintSummary {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface DayHintTargets {
  calories: number;
  macroRanges?: MacroRanges;
}

const WORKOUT_HINT_LABELS: Record<WorkoutType, string> = {
  gym: 'Gym-Tag',
  bouldering: 'Klettertag',
  running: 'Lauftag',
  cycling: 'Radtag',
  other: 'Trainingstag',
};

/**
 * Gibt einen einzeiligen Tageshinweis zurück.
 * Priorität:
 * 1. Kein Eintrag heute → Einstiegs-CTA
 * 2. Trainingstag → Trainingshinweis
 * 3. Mehr als 20 g bis zur unteren Protein-Zielgrenze → Protein-Hinweis
 * 4. Sonst → verbleibende Kalorien
 */
export function getDayHint(
  summary: DayHintSummary | null,
  targets: DayHintTargets | null,
  dayType: 'rest' | 'training' | null,
  workoutType: WorkoutType | null,
): string {
  // 1. Noch kein Eintrag heute
  if (!summary || summary.calories === 0) {
    return 'Starte mit deinem ersten Eintrag.';
  }

  // 2. Trainingstag → Trainingsart anzeigen
  if (dayType === 'training') {
    const label = workoutType ? WORKOUT_HINT_LABELS[workoutType] : 'Trainingstag';
    return `Heute ist dein ${label}.`;
  }

  // Ohne Targets: neutral
  if (!targets) {
    return 'Alles im Blick.';
  }

  // 3. Protein-Hinweis richtet sich nur nach der gerundeten unteren Bereichsgrenze.
  const proteinRange = targets.macroRanges?.proteinG;
  if (
    proteinRange
    && Number.isFinite(proteinRange.minG)
    && Number.isFinite(proteinRange.maxG)
    && proteinRange.minG >= 0
    && proteinRange.minG <= proteinRange.maxG
    && summary.protein < proteinRange.minG
  ) {
    const remaining = Math.round(proteinRange.minG - summary.protein);
    if (remaining > 20) {
      return `Bis zu deinem Protein-Zielbereich fehlen dir noch ${remaining} g.`;
    }
  }

  // 4. Verbleibende Kalorien
  const remaining = Math.max(0, Math.round(targets.calories - summary.calories));
  if (summary.calories > targets.calories) {
    const over = Math.round(summary.calories - targets.calories);
    return `${over} kcal über deinem Ziel.`;
  }
  return `Noch ${remaining} kcal verfügbar.`;
}
