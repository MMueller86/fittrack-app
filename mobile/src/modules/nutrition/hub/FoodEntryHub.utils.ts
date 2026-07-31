import type { UserFoodRelation, MealType } from '@fittrack/shared';

export function computeLastUsageText(item: UserFoodRelation): string | null {
  const { lastInputMode, lastInputAmount, nutritionPer100g, portion } = item;

  // Branch 1: history present
  if (lastInputAmount && nutritionPer100g) {
    if (lastInputMode === 'portion') {
      const portionGrams = portion?.weightGrams ?? 100;
      const grams = lastInputAmount * portionGrams;
      const kcal = Math.round((nutritionPer100g.calories / 100) * grams);
      const unitLabel = portion?.label ?? 'Portion';
      const countStr = lastInputAmount % 1 === 0
        ? String(lastInputAmount)
        : lastInputAmount.toFixed(1);
      return `Zuletzt: ${countStr} ${unitLabel} \u00b7 ${kcal} kcal`;
    }
    const kcal = Math.round((nutritionPer100g.calories / 100) * lastInputAmount);
    return `Zuletzt: ${Math.round(lastInputAmount)} g \u00b7 ${kcal} kcal`;
  }

  // Branch 1.5: history present but no nutrition — show amount only (no kcal)
  if (lastInputAmount) {
    if (lastInputMode === 'portion') {
      const unitLabel = portion?.label ?? 'Portion';
      const countStr = lastInputAmount % 1 === 0
        ? String(lastInputAmount)
        : lastInputAmount.toFixed(1);
      return `Zuletzt: ${countStr} ${unitLabel}`;
    }
    return `Zuletzt: ${Math.round(lastInputAmount)} g`;
  }

  // Branch 2: no history but nutrition available — show reference value
  if (nutritionPer100g) {
    const kcal = Math.round(nutritionPer100g.calories);
    return `100 g \u00b7 ${kcal} kcal`;
  }

  // Branch 3: no history, no nutrition — cannot compute calories
  if (portion?.weightGrams) {
    const label = portion.label ?? 'Portion';
    return `1 ${label} (${portion.weightGrams} g)`;
  }
  return 'Keine Nährwertdaten';
}

export function computeDirectAddLabel(
  item: UserFoodRelation,
  activeFilter: string,
): string | null {
  if (activeFilter !== 'fuerDich') return null;
  if (!item.nutritionPer100g) return null;
  const { preferredInputMode, preferredInputAmount } = item;
  if (!preferredInputAmount || preferredInputAmount <= 0) return null;
  if (preferredInputMode === 'portion') {
    const unitLabel = item.portion?.label ?? 'Portion';
    const count = preferredInputAmount % 1 === 0
      ? String(preferredInputAmount)
      : preferredInputAmount.toFixed(1);
    return `${count} ${unitLabel}`;
  }
  return `${Math.round(preferredInputAmount)} g`;
}

export function computeMacroText(item: UserFoodRelation): string | null {
  const n = item.nutritionPer100g;
  if (!n || n.calories == null) return null;
  const parts = [`${Math.round(n.calories)} kcal`];
  if (n.protein != null) parts.push(`EW ${Math.round(n.protein)} g`);
  if (n.carbs != null) parts.push(`KH ${Math.round(n.carbs)} g`);
  if (n.fat != null) parts.push(`F ${Math.round(n.fat)} g`);
  parts.push('je 100 g');
  return parts.join(' \u00b7 ');
}

// ---------------------------------------------------------------------------
// Relative date label for "Zuletzt verwendet" filter
// ---------------------------------------------------------------------------

export function relativeUsage(isoDate: string): string {
  const days = Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000);
  if (days === 0) return 'Heute verwendet';
  if (days === 1) return 'Gestern verwendet';
  if (days < 7) return `Vor ${days} Tagen verwendet`;
  if (days < 14) return 'Vor einer Woche verwendet';
  return `Vor ${Math.floor(days / 7)} Wochen verwendet`;
}

// ---------------------------------------------------------------------------
// MealType-filter sort helper
// ---------------------------------------------------------------------------

/**
 * Returns items that have at least one usageDates entry for the given mealType,
 * sorted descending by the count of such entries.
 */
export function sortByMealTypeUsage(items: UserFoodRelation[], mealType: MealType): UserFoodRelation[] {
  const count = (item: UserFoodRelation) =>
    (item.usageDates ?? []).filter(e => e.mealType === mealType).length;
  return [...items]
    .filter(item => count(item) > 0)
    .sort((a, b) => count(b) - count(a));
}


