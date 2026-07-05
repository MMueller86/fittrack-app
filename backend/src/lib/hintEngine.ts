// Nutrition Hint Engine -- rule-based hint evaluation.
//
// Pure function, no side effects, no I/O.
// Called from the diary GET handler after context is assembled.
//
// Architecture: declarative rule array -- each rule is an object with a condition
// and text. evaluateHint() iterates top-to-bottom, first matching uncooled rule wins.
//
// Priority order (top -> first match wins):
//   Priority 1 -- Warning / Orientation (no cooldown, unless noted)
//   Priority 2 -- Day context (1-day cooldown)
//   Priority 3 -- Positive feedback (2-day cooldown)
//   Priority 4 -- Motivational fallback (30-day cooldown, cyclic)

import type { Meal } from '../../../shared/types/diary';
import type { FoodCategory } from '../../../shared/types/foodCategory';
import type { HintContext, HintId, HintResult, HintState, HintCategory } from '../../../shared/types/hint';

// ---------------------------------------------------------------------------
// Motivational hint pool (cyclic, 10 entries indexed M0-M9)
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
  H21: 2,
  H22: 1,
  H25: 2,
  H26: 1,
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

/** Returns total macros for a single meal type (sums all items). */
function mealMacros(meals: Meal[], type: string): { calories: number; protein: number } {
  const meal = meals.find((m) => m.type === type && m.items.length > 0);
  if (!meal) return { calories: 0, protein: 0 };
  return meal.items.reduce(
    (acc, item) => ({ calories: acc.calories + item.macros.calories, protein: acc.protein + item.macros.protein }),
    { calories: 0, protein: 0 },
  );
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

// ---------------------------------------------------------------------------
// Rule definition -- declarative, ordered by priority
// ---------------------------------------------------------------------------

/** Internal context enriched with pre-computed values for rule conditions. */
interface RuleCtx {
  meals: Meal[];
  mealCount: number;
  hasBreakfast: boolean;
  hasLunch: boolean;
  hasDinner: boolean;
  hasSnack: boolean;
  calPct: number;
  proteinPct: number;
  fiberPct: number;
  remainingCalPct: number;
  categories: Set<FoodCategory>;
  anyHasCategoryData: boolean;
  breakfastCalories: number;
  breakfastProtein: number;
  dayType: 'rest' | 'training';
  currentHour: number;
  bmr: number | undefined;
  weightKg: number | undefined;
  recentDaysCaloriesPct: number[];
  rawCalories: number;
  rawProtein: number;
  rawTargetProteinG: number;
  /** True when ≥30% of today's total calories come from protein. */
  isHighProteinCalShare: boolean;
}

type RuleText = string | ((ctx: RuleCtx) => string);

interface RuleDef {
  id: HintId;
  category: HintCategory;
  emoji: string;
  text: RuleText;
  condition: (ctx: RuleCtx) => boolean;
}

const RULES: RuleDef[] = [
  // ── Priority 1: Warning / Orientation ──────────────────────────────────────

  // H1: No meals at all
  {
    id: 'H1',
    category: 'orientation',
    emoji: '🍽️',
    text: 'Du hast heute noch keine Mahlzeit dokumentiert. Starte mit deinem ersten Eintrag.',
    condition: ({ mealCount }) => mealCount === 0,
  },

  // H2: No breakfast, time-gated 08:00-12:59
  {
    id: 'H2',
    category: 'orientation',
    emoji: '🍳',
    text: 'Wie sieht dein Start in den Tag aus?',
    condition: ({ hasBreakfast, currentHour }) => !hasBreakfast && currentHour >= 8 && currentHour < 13,
  },

  // H26: 3 consecutive days over 115% -- highest warning level [1-day cooldown]
  {
    id: 'H26',
    category: 'orientation',
    emoji: '🚨',
    text: 'Drei Tage in Folge über dem Ziel – jetzt ist ein guter Moment, bewusst gegenzusteuern. Nicht mit Verzicht, sondern mit Fokus auf die nächsten Mahlzeiten.',
    condition: ({ recentDaysCaloriesPct }) =>
      recentDaysCaloriesPct.length >= 3 && recentDaysCaloriesPct.slice(0, 3).every((p) => p > 115),
  },

  // H25: 2 of the last 3 days over 115% [2-day cooldown]
  {
    id: 'H25',
    category: 'orientation',
    emoji: '📈',
    text: 'Du liegst seit ein paar Tagen über deinem Kalorienziel. Ein bewusster Blick auf morgen kann helfen, die Bilanz wieder auszugleichen.',
    condition: ({ recentDaysCaloriesPct }) =>
      recentDaysCaloriesPct.length >= 2 &&
      recentDaysCaloriesPct.slice(0, 3).filter((p) => p > 115).length >= 2,
  },

  // H27: Under basal metabolic rate -- only after dinner is logged
  {
    id: 'H27',
    category: 'orientation',
    emoji: '⚠️',
    text: 'Deine Kalorienzufuhr liegt heute unter deinem Grundumsatz – das ist auf Dauer nicht ratsam. Dein Körper braucht diese Energie für lebenswichtige Funktionen.',
    condition: ({ hasDinner, rawCalories, bmr }) =>
      hasDinner && bmr !== undefined && rawCalories > 0 && rawCalories < bmr * 0.9,
  },

  // H28: Protein < 1.5g/kg body weight -- only after dinner is logged [dynamic text]
  // Gate: does NOT fire when protein-cal share is already ≥30%
  {
    id: 'H28',
    category: 'orientation',
    emoji: '💪',
    text: ({ rawProtein, weightKg }) => {
      const target = weightKg !== undefined ? Math.round(weightKg * 1.5) : null;
      const targetStr = target !== null ? ` Bei dir sind das ${target} g.` : '';
      return `Dein Proteinziel ist heute nicht erreicht – kein Problem für einen Tag. Achte aber darauf, dauerhaft mindestens 1,5 g je kg Körpergewicht zu treffen.${targetStr}`;
    },
    condition: ({ hasDinner, rawProtein, weightKg, isHighProteinCalShare }) =>
      hasDinner && weightKg !== undefined && rawProtein > 0 && rawProtein < weightKg * 1.5 && !isHighProteinCalShare,
  },

  // H18: High-protein breakfast (≥30% of breakfast calories from protein)
  // Time-gated: only before 12h AND no lunch logged yet
  {
    id: 'H18',
    category: 'positive',
    emoji: '💪',
    text: 'Starker Start – dein Frühstück ist bereits proteinreich. Eine gute Basis für den Tag.',
    condition: ({ hasBreakfast, hasLunch, breakfastCalories, breakfastProtein, currentHour }) =>
      hasBreakfast &&
      !hasLunch &&
      currentHour < 12 &&
      breakfastCalories > 0 &&
      (breakfastProtein * 4) / breakfastCalories >= 0.3,
  },

  // H19: Good calorie pace -- morning (time-gated)
  {
    id: 'H19',
    category: 'positive',
    emoji: '☀️',
    text: 'Gut getaktet für den Vormittag – du liegst auf Kurs, um dein Tagesziel zu erreichen.',
    condition: ({ mealCount, calPct, currentHour }) =>
      mealCount >= 1 && calPct >= 15 && calPct <= 40 && currentHour < 13,
  },

  // H20: Good calorie pace -- midday (time-gated)
  {
    id: 'H20',
    category: 'positive',
    emoji: '🌤️',
    text: 'Zur Mittagszeit liegst du gut auf Kurs – halte diese Pace und du triffst dein Tagesziel.',
    condition: ({ mealCount, calPct, currentHour }) =>
      mealCount >= 2 && calPct >= 35 && calPct <= 65 && currentHour >= 12 && currentHour < 16,
  },

  // H3: Protein < 25% of daily target (only after 2+ meals)
  // Gate: does NOT fire when protein-cal share is already ≥30%
  {
    id: 'H3',
    category: 'orientation',
    emoji: '💪',
    text: 'Bei deiner nächsten Mahlzeit darf es gerne etwas proteinreicher werden.',
    condition: ({ proteinPct, mealCount, isHighProteinCalShare }) =>
      proteinPct < 25 && mealCount >= 2 && !isHighProteinCalShare,
  },

  // H4: Protein < 35% with 3+ meals
  // Gate: does NOT fire when protein-cal share is already ≥30%
  {
    id: 'H4',
    category: 'orientation',
    emoji: '🥩',
    text: 'Etwas Eiweiß würde deine bisherigen Mahlzeiten gut ergänzen.',
    condition: ({ proteinPct, mealCount, isHighProteinCalShare }) =>
      proteinPct < 35 && mealCount >= 3 && !isHighProteinCalShare,
  },

  // H5: Fiber < 40% of daily target (only after 2+ meals)
  {
    id: 'H5',
    category: 'orientation',
    emoji: '🥦',
    text: 'Etwas Gemüse oder Vollkorn würde deinen Tag gut ergänzen.',
    condition: ({ fiberPct, mealCount }) => fiberPct < 40 && mealCount >= 2,
  },

  // H24: Over calorie target (motivating tone)
  {
    id: 'H24',
    category: 'orientation',
    emoji: '📊',
    text: 'Heute liegst du über deinem Kalorienziel – das passiert. Einzelne Tage machen keinen Unterschied, was zählt ist die Konstanz über die Woche.',
    condition: ({ calPct, mealCount, currentHour }) =>
      calPct > 115 && (mealCount >= 3 || currentHour >= 15),
  },

  // H23: Significantly under calorie target in the evening
  {
    id: 'H23',
    category: 'orientation',
    emoji: '⚠️',
    text: 'Heute bist du deutlich unter deinem Kalorienziel. Falls du noch Hunger hast, wäre jetzt ein guter Moment für eine weitere Mahlzeit.',
    condition: ({ calPct, currentHour, mealCount }) =>
      currentHour >= 18 && calPct < 70 && mealCount >= 2,
  },

  // H6: All main meals present, no snack, remaining calories > 20%
  {
    id: 'H6',
    category: 'orientation',
    emoji: '🍎',
    text: 'Heute wäre noch Platz für einen kleinen Snack.',
    condition: ({ hasBreakfast, hasLunch, hasDinner, hasSnack, remainingCalPct }) =>
      hasBreakfast && hasLunch && hasDinner && !hasSnack && remainingCalPct > 20,
  },

  // H7: No dinner yet, time-gated from 17:00
  {
    id: 'H7',
    category: 'orientation',
    emoji: '🌙',
    text: 'Dein Abendessen fehlt noch.',
    condition: ({ hasDinner, hasBreakfast, hasLunch, currentHour }) =>
      !hasDinner && (hasBreakfast || hasLunch) && currentHour >= 17,
  },

  // H8: Training day, protein not yet reached (2+ meals or after 15:00)
  // Gate: does NOT fire when protein-cal share is already ≥30%
  {
    id: 'H8',
    category: 'orientation',
    emoji: '💪',
    text: 'Nach deinem Training lohnt sich heute noch eine proteinreiche Mahlzeit.',
    condition: ({ dayType, proteinPct, mealCount, currentHour, isHighProteinCalShare }) =>
      dayType === 'training' && proteinPct < 95 && (mealCount >= 2 || currentHour >= 15) && !isHighProteinCalShare,
  },

  // H12: High variety ≥5 food categories
  {
    id: 'H12',
    category: 'orientation',
    emoji: '🌈',
    text: 'Heute ist bereits eine schöne Vielfalt an Lebensmitteln dabei.',
    condition: ({ anyHasCategoryData, categories }) => anyHasCategoryData && categories.size >= 5,
  },

  // H9: No fruit AND no vegetable (only after 2+ meals)
  {
    id: 'H9',
    category: 'orientation',
    emoji: '🌾',
    text: 'Etwas Obst oder Gemüse würde deinen heutigen Tag noch abrunden.',
    condition: ({ anyHasCategoryData, categories, mealCount }) =>
      anyHasCategoryData &&
      !categories.has('Fruits') &&
      !categories.has('Vegetables') &&
      mealCount >= 2,
  },

  // H10: At least one fruit present
  {
    id: 'H10',
    category: 'orientation',
    emoji: '🍓',
    text: 'Schön, dass heute Obst auf deinem Speiseplan steht.',
    condition: ({ categories }) => categories.has('Fruits'),
  },

  // H11: At least one vegetable present
  {
    id: 'H11',
    category: 'orientation',
    emoji: '🥦',
    text: 'Heute ist bereits ordentlich Gemüse dabei.',
    condition: ({ categories }) => categories.has('Vegetables'),
  },

  // ── Priority 2: Day context [1-day cooldown] ────────────────────────────────

  // H22: Evening calorie target hit (positive close to day)
  {
    id: 'H22',
    category: 'daycontext',
    emoji: '🌙',
    text: 'Ein stimmiger Abschluss – du liegst heute sehr nah an deinem Kalorienziel.',
    condition: ({ hasDinner, calPct, currentHour }) =>
      currentHour >= 19 && calPct >= 85 && calPct <= 110 && hasDinner,
  },

  // H13: Rest day
  {
    id: 'H13',
    category: 'daycontext',
    emoji: '😴',
    text: 'Heute steht Regeneration im Mittelpunkt.',
    condition: ({ dayType }) => dayType === 'rest',
  },

  // ── Priority 3: Positive feedback [2-day cooldown] ─────────────────────────

  // H21: Great fiber intake
  {
    id: 'H21',
    category: 'positive',
    emoji: '🌿',
    text: 'Deine Ballaststoffzufuhr ist heute bereits sehr gut – das unterstützt Sättigung und Verdauung.',
    condition: ({ fiberPct }) => fiberPct >= 80,
  },

  // H16: All macros within ±10% of targets
  {
    id: 'H16',
    category: 'positive',
    emoji: '⚖️',
    text: 'Deine Makroverteilung wirkt heute bereits sehr ausgewogen.',
    condition: ({ mealCount }) => {
      if (mealCount === 0) return false;
      return false; // handled separately below (needs summary reference)
    },
  },

  // H15: Protein target reached
  {
    id: 'H15',
    category: 'positive',
    emoji: '💪',
    text: 'Dein Proteinziel hast du heute bereits erreicht.',
    condition: ({ proteinPct }) => proteinPct >= 95,
  },

  // H17: Training day + protein reached
  {
    id: 'H17',
    category: 'positive',
    emoji: '🏋️',
    text: 'Training und Ernährung ergänzen sich heute optimal.',
    condition: ({ dayType, proteinPct }) => dayType === 'training' && proteinPct >= 95,
  },
];

// ---------------------------------------------------------------------------
// Motivational fallback (cyclic rotation)
// ---------------------------------------------------------------------------

function nextMotivationHint(
  motivationIndex: number,
  cooldownHistory: Partial<Record<HintId, string>>,
  today: string,
): { hint: HintResult; nextIndex: number } {
  const total = MOTIVATION_HINTS.length;
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

  // Pre-compute all values needed by rule conditions
  const mealCount = meals.filter((m) => m.items.length > 0).length;
  const calPct = pct(summary.calories, targets.calories);
  const proteinPct = pct(summary.protein, targets.proteinG);
  const fiberPct = pct(summary.fiber ?? 0, targets.fiberG);
  const remainingCalPct = 100 - calPct;

  const hasBreakfast = hasMealType(meals, 'breakfast');
  const hasLunch = hasMealType(meals, 'lunch');
  const hasDinner = hasMealType(meals, 'dinner');
  const hasSnack = hasMealType(meals, 'snack');

  const categories = categoriesPresent(meals);
  const anyHasCategoryData = hasCategoryData(meals);

  const breakfast = mealMacros(meals, 'breakfast');

  // isHighProteinCalShare: true when ≥30% of today's total calories come from protein
  const isHighProteinCalShare =
    summary.calories > 0 && (summary.protein * 4) / summary.calories >= 0.3;

  const ruleCtx: RuleCtx = {
    meals,
    mealCount,
    hasBreakfast,
    hasLunch,
    hasDinner,
    hasSnack,
    calPct,
    proteinPct,
    fiberPct,
    remainingCalPct,
    categories,
    anyHasCategoryData,
    breakfastCalories: breakfast.calories,
    breakfastProtein: breakfast.protein,
    dayType,
    currentHour,
    bmr: context.bmr,
    weightKg: context.weightKg,
    recentDaysCaloriesPct: context.recentDaysCaloriesPct ?? [],
    rawCalories: summary.calories,
    rawProtein: summary.protein,
    rawTargetProteinG: targets.proteinG,
    isHighProteinCalShare,
  };

  let hint: HintResult | null = null;
  let nextMotivationIndex = motivationIndex;

  for (const rule of RULES) {
    if (hint) break;

    // H16 special case: needs fat/carbs from summary, not available in RuleCtx
    if (rule.id === 'H16') {
      if (mealCount > 0) {
        const proteinOk = targets.proteinG > 0 && Math.abs(proteinPct - 100) <= 10;
        const fatOk = targets.fatG > 0 && Math.abs(pct(summary.fat, targets.fatG) - 100) <= 10;
        const carbsOk = targets.carbsG > 0 && Math.abs(pct(summary.carbs, targets.carbsG) - 100) <= 10;
        if (proteinOk && fatOk && carbsOk && !isCooledDown('H16', cooldownHistory, today)) {
          hint = makeHint('H16', rule.text as string, rule.emoji, rule.category);
        }
      }
      continue;
    }

    if (!rule.condition(ruleCtx)) continue;

    const hasCooldown = COOLDOWN_DAYS[rule.id] !== undefined;
    if (hasCooldown && isCooledDown(rule.id, cooldownHistory, today)) continue;

    const text = typeof rule.text === 'function' ? rule.text(ruleCtx) : rule.text;
    hint = makeHint(rule.id, text, rule.emoji, rule.category);
  }

  // Motivational fallback
  if (!hint) {
    const result = nextMotivationHint(motivationIndex, cooldownHistory, today);
    hint = result.hint;
    nextMotivationIndex = result.nextIndex;
  }

  // Build updated state
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
