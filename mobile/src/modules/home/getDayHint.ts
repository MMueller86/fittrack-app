// getDayHint — pure function zur Generierung des personalisierten Tageshinweises.
// Wird im HomeScreen unter der Begrüßung angezeigt.
// Separate Datei → vollständig unit-testbar ohne RN-Imports.

import type { WorkoutType } from '@fittrack/shared';

export interface DayHintSummary {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface DayHintTargets {
  calories: number;
  proteinG: number;
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
 * 3. Protein < 50 % des Ziels → Protein-Hinweis
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

  // 3. Protein unter 50 % des Ziels → Protein-Hinweis
  if (targets.proteinG > 0 && summary.protein < targets.proteinG * 0.5) {
    const remaining = Math.max(0, Math.round(targets.proteinG - summary.protein));
    return `Dir fehlen noch ${remaining} g Protein.`;
  }

  // 4. Verbleibende Kalorien
  const remaining = Math.max(0, Math.round(targets.calories - summary.calories));
  if (summary.calories > targets.calories) {
    const over = Math.round(summary.calories - targets.calories);
    return `${over} kcal über deinem Ziel.`;
  }
  return `Noch ${remaining} kcal verfügbar.`;
}
