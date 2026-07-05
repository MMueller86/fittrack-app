// Nutrition Hint Engine — rule-based hint evaluation.
//
// Pure function, no side effects, no I/O.
// Called from the diary GET handler after context is assembled.
//
// Rule priority (top → first match wins):
//   Priority 1 — Orientation (no cooldown)
//   Priority 2 — Day context (1-day cooldown)
//   Priority 3 — Positive feedback (2-day cooldown)
//   Priority 4 — Motivational fallback (30-day cooldown, cyclic)

import type { Meal, DaySummary } from '../../../shared/types/diary';
import type { DayTargets } from '../../../shared/types/nutrition';
import type { FoodCategory } from '../../../shared/types/foodCategory';
import type { HintContext, HintId, HintResult, HintState, HintCategory } from '../../../shared/types/hint';

// ---------------------------------------------------------------------------
// Motivational hint pool (cyclic, 10 entries indexed M0–M9)
// ---------------------------------------------------------------------------

const MOTIVATION_HINTS: Array<{ id: HintId; text: string; emoji: string }> = [
  { id: 'M0', text: 'Konstanz schlägt Perfektion.', emoji: '🌱' },
  { id: 'M1', text: 'Jeder dokumentierte Tag bringt mehr Übersicht.', emoji: '🎯' },
  { id: 'M2', text: 'Kleine Gewohnheiten machen langfristig den Unterschied.', emoji: '📈' },
  { id: 'M3', text: 'Gute Entscheidungen beginnen mit guten Informationen.', emoji: '💡' },
  { id: 'M4', text: 'Jede Mahlzeit erzählt ein Stück deines Fortschritts.', emoji: '🌟' },
  { id: 'M5', text: 'Ein guter Tag entsteht aus vielen kleinen Entscheidungen.', emoji: '🚀' },
  { id: 'M6', text: 'Bewusst essen beginnt mit bewusstem Dokumentieren.', emoji: '🍽️' },
  { id: 'M7', text: 'Schritt für Schritt entsteht ein vollständiges Bild deiner Ernährung.', emoji: '📚' },
  { id: 'M8', text: 'Dranbleiben ist wichtiger als perfekt zu sein.', emoji: '💪' },
  { id: 'M9', text: 'Ein Glas Wasser zwischendurch tut oft gut.', emoji: '💧' },
];

// ---------------------------------------------------------------------------
// Cooldown durations (in days)
// ---------------------------------------------------------------------------

const COOLDOWN_DAYS: Partial<Record<HintId, number>> = {
  H13: 1,
  H15: 2,
  H16: 2,
  H17: 2,
  M0: 30, M1: 30, M2: 30, M3: 30, M4: 30,
  M5: 30, M6: 30, M7: 30, M8: 30, M9: 30,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pct(actual: number, target: number): number {
  if (target <= 0) return 100;
  return (actual / target) * 100;
}

function hasMealType(meals: Meal[], type: string): boolean {
  return meals.some((m) => m.type === type && m.items.length > 0);
}

function categoriesPresent(meals: Meal[]): Set<FoodCategory> {
  const cats = new Set<FoodCategory>();
  for (const meal of meals) {
    for (const item of meal.items) {
      if (item.category) cats.add(item.category);
    }
  }
  return cats;
}

function hasCategoryData(meals: Meal[]): boolean {
  return meals.some((m) => m.items.some((i) => i.category != null));
}

function isCooledDown(id: HintId, cooldownHistory: Partial<Record<HintId, string>>, today: string): boolean {
  const days = COOLDOWN_DAYS[id];
  if (!days) return false;
  const lastShown = cooldownHistory[id];
  if (!lastShown) return false;
  const last = new Date(lastShown);
  const now = new Date(today);
  const diffDays = Math.floor((now.getTime() - last.getTime()) / 86_400_000);
  return diffDays < days;
}

function makeHint(id: HintId, text: string, emoji: string, category: HintCategory): HintResult {
  return { id, text, emoji, category };
}

function tryHint(
  id: HintId,
  text: string,
  emoji: string,
  category: HintCategory,
  cooldownHistory: Partial<Record<HintId, string>>,
  today: string,
): HintResult | null {
  if (isCooledDown(id, cooldownHistory, today)) return null;
  return makeHint(id, text, emoji, category);
}

// ---------------------------------------------------------------------------
// Motivational fallback (cyclic rotation)
// ---------------------------------------------------------------------------

function nextMotivationHint(
  motivationIndex: number,
  cooldownHistory: Partial<Record<HintId, string>>,
  today: string,
): { hint: HintResult; nextIndex: number } {
  const total = MOTIVATION_HINTS.length;
  // Try each slot starting from motivationIndex, wrap around
  for (let offset = 0; offset < total; offset++) {
    const idx = (motivationIndex + offset) % total;
    const candidate = MOTIVATION_HINTS[idx];
    if (!isCooledDown(candidate.id, cooldownHistory, today)) {
      return {
        hint: makeHint(candidate.id, candidate.text, candidate.emoji, 'motivation'),
        nextIndex: (idx + 1) % total,
      };
    }
  }
  // All cooled down — force-show current index anyway (edge case: first 30 days)
  const fallback = MOTIVATION_HINTS[motivationIndex % total];
  return {
    hint: makeHint(fallback.id, fallback.text, fallback.emoji, 'motivation'),
    nextIndex: (motivationIndex + 1) % total,
  };
}

// ---------------------------------------------------------------------------
// Main evaluation function
// ---------------------------------------------------------------------------

export interface EvaluateHintResult {
  hint: HintResult;
  updatedState: HintState;
}

export function evaluateHint(context: HintContext, state: HintState | null): EvaluateHintResult {
  const { summary, targets, dayType, currentHour } = context;
  // Guard: Cosmos documents written before items array existed may omit the field.
  const meals: Meal[] = context.meals.map((m) => ({ ...m, items: m.items ?? [] }));
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const cooldownHistory: Partial<Record<HintId, string>> = state?.cooldownHistory ?? {};
  const motivationIndex: number = state?.motivationIndex ?? 0;

  const mealCount = meals.filter((m) => m.items.length > 0).length;
  const proteinPct = pct(summary.protein, targets.proteinG);
  const fiberPct = pct(summary.fiber, targets.fiberG);
  const calPct = pct(summary.calories, targets.calories);
  const remainingCalPct = 100 - calPct;

  const hasBreakfast = hasMealType(meals, 'breakfast');
  const hasLunch = hasMealType(meals, 'lunch');
  const hasDinner = hasMealType(meals, 'dinner');
  const hasSnack = hasMealType(meals, 'snack');

  const categories = categoriesPresent(meals);
  const anyHasCategoryData = hasCategoryData(meals);

  let hint: HintResult | null = null;
  let nextMotivationIndex = motivationIndex;

  // --- Priority 1: Orientation (no cooldown) ---

  // H1: No meals logged at all
  if (!hint && mealCount === 0) {
    hint = makeHint('H1', 'Du hast heute noch keine Mahlzeit dokumentiert. Starte mit deinem ersten Eintrag.', '🍽️', 'orientation');
  }

  // H2: No breakfast, time-gated 08:00–13:00
  if (!hint && !hasBreakfast && currentHour >= 8 && currentHour < 13) {
    hint = makeHint('H2', 'Wie sieht dein Start in den Tag aus?', '🍳', 'orientation');
  }

  // H3: Protein < 25% of daily target
  if (!hint && proteinPct < 25) {
    hint = makeHint('H3', 'Bei deiner nächsten Mahlzeit darf es gerne etwas proteinreicher werden.', '💪', 'orientation');
  }

  // H4: Protein < 50% AND at least 2 meals present
  if (!hint && proteinPct < 50 && mealCount >= 2) {
    hint = makeHint('H4', 'Etwas Eiweiß würde deine bisherigen Mahlzeiten gut ergänzen.', '🥩', 'orientation');
  }

  // H5: Fiber < 40% of daily target
  if (!hint && fiberPct < 40) {
    hint = makeHint('H5', 'Etwas Gemüse oder Vollkorn würde deinen Tag gut ergänzen.', '🥦', 'orientation');
  }

  // H6: All main meals present, no snack, remaining calories > 20%
  if (!hint && hasBreakfast && hasLunch && hasDinner && !hasSnack && remainingCalPct > 20) {
    hint = makeHint('H6', 'Heute wäre noch Platz für einen kleinen Snack.', '🍎', 'orientation');
  }

  // H7: No dinner, some other meal present, time-gated from 17:00
  if (!hint && !hasDinner && (hasBreakfast || hasLunch) && currentHour >= 17) {
    hint = makeHint('H7', 'Dein Abendessen fehlt noch.', '🌙', 'orientation');
  }

  // H8: Training day, protein not yet reached
  if (!hint && dayType === 'training' && proteinPct < 95) {
    hint = makeHint('H8', 'Nach deinem Training lohnt sich heute noch eine proteinreiche Mahlzeit.', '💪', 'orientation');
  }

  // H12: High variety (≥5 different food categories) — before H9/H10/H11
  if (!hint && anyHasCategoryData && categories.size >= 5) {
    hint = makeHint('H12', 'Heute ist bereits eine schöne Vielfalt an Lebensmitteln dabei.', '🌈', 'orientation');
  }

  // H9: No fruit AND no vegetable present (only when category data exists)
  if (!hint && anyHasCategoryData && !categories.has('Fruits') && !categories.has('Vegetables')) {
    hint = makeHint('H9', 'Etwas Obst oder Gemüse würde deinen heutigen Tag noch abrunden.', '🌾', 'orientation');
  }

  // H10: At least one fruit present
  if (!hint && categories.has('Fruits')) {
    hint = makeHint('H10', 'Schön, dass heute Obst auf deinem Speiseplan steht.', '🍓', 'orientation');
  }

  // H11: At least one vegetable present
  if (!hint && categories.has('Vegetables')) {
    hint = makeHint('H11', 'Heute ist bereits ordentlich Gemüse dabei.', '🥦', 'orientation');
  }

  // --- Priority 2: Day context (1-day cooldown) ---

  // H13: Rest day
  if (!hint && dayType === 'rest') {
    hint = tryHint('H13', 'Heute steht Regeneration im Mittelpunkt.', '😴', 'daycontext', cooldownHistory, today);
  }

  // --- Priority 3: Positive feedback (2-day cooldown) ---

  // H16: All macros (protein, fat, carbs) within ±10% of targets
  if (!hint) {
    const proteinOk = targets.proteinG > 0 && Math.abs(proteinPct - 100) <= 10;
    const fatOk = targets.fatG > 0 && Math.abs(pct(summary.fat, targets.fatG) - 100) <= 10;
    const carbsOk = targets.carbsG > 0 && Math.abs(pct(summary.carbs, targets.carbsG) - 100) <= 10;
    if (proteinOk && fatOk && carbsOk) {
      hint = tryHint('H16', 'Deine Makroverteilung wirkt heute bereits sehr ausgewogen.', '⚖️', 'positive', cooldownHistory, today);
    }
  }

  // H15: Protein target reached (≥95%)
  if (!hint && proteinPct >= 95) {
    hint = tryHint('H15', 'Dein Proteinziel hast du heute bereits erreicht.', '💪', 'positive', cooldownHistory, today);
  }

  // H17: Training day AND protein reached — stronger signal, evaluated after H16
  if (!hint && dayType === 'training' && proteinPct >= 95) {
    hint = tryHint('H17', 'Training und Ernährung ergänzen sich heute optimal.', '🏋️', 'positive', cooldownHistory, today);
  }

  // --- Priority 4: Motivational fallback ---

  if (!hint) {
    const result = nextMotivationHint(motivationIndex, cooldownHistory, today);
    hint = result.hint;
    nextMotivationIndex = result.nextIndex;
  }

  // ---------------------------------------------------------------------------
  // Build updated state
  // ---------------------------------------------------------------------------

  const newCooldownHistory: Partial<Record<HintId, string>> = { ...cooldownHistory };
  const cooldownDays = COOLDOWN_DAYS[hint.id];
  if (cooldownDays) {
    newCooldownHistory[hint.id] = today;
  }

  const updatedState: HintState = {
    id: 'hintState',
    userId: state?.userId ?? '',
    _docType: 'hintState',
    lastHintId: hint.id,
    lastHintDate: today,
    lastHintGeneratedAt: new Date().toISOString(),
    cooldownHistory: newCooldownHistory,
    motivationIndex: nextMotivationIndex,
  };

  return { hint, updatedState };
}
