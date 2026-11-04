// diaryItemUtils — helpers for diary-item selection and meal creation.

import type { DiaryDayResponse, Meal, MealItem, MealType } from '@fittrack/shared';

type DiaryItemQuantity = Pick<
  MealItem,
  'quantity' | 'sourceType' | 'unit' | 'aiMealEstimateWeightGrams'
>;

const PORTION_UNITS = new Set(['portion', 'portions', 'portionen']);

export function isDiaryItemPortionBased(item: Pick<DiaryItemQuantity, 'sourceType' | 'unit'>): boolean {
  return item.sourceType === 'recipe'
    || item.sourceType === 'ai-meal-estimate'
    || PORTION_UNITS.has(item.unit.trim().toLowerCase());
}

export function formatDiaryItemAmount(item: DiaryItemQuantity): string {
  if (isDiaryItemPortionBased(item)) {
    const portionLabel = `${item.quantity} Portion${item.quantity === 1 ? '' : 'en'}`;
    const weight = item.aiMealEstimateWeightGrams;
    if (item.sourceType === 'ai-meal-estimate' && weight != null && Number.isFinite(weight)) {
      return `${portionLabel} · ca. ${Math.round(item.quantity * weight)} g`;
    }
    return portionLabel;
  }

  return `${Math.round(item.quantity)} g`;
}

export function formatDiaryItemComponents(
  item: Pick<MealItem, 'sourceType' | 'aiMealEstimateItems' | 'aiMealEstimateComponents'>,
): string | undefined {
  if (item.sourceType !== 'ai-meal-estimate') return undefined;

  const componentNames = item.aiMealEstimateItems?.map(({ name }) => name)
    ?? item.aiMealEstimateComponents
    ?? [];
  const names = componentNames.map((name) => name.trim()).filter(Boolean);
  return names.length > 0 ? names.join(' · ') : undefined;
}

export function getDiaryItemAiBadgeLabel(
  item: Pick<MealItem, 'sourceType' | 'aiMealEstimatePhotoUsed'>,
): string | undefined {
  if (item.sourceType !== 'ai-meal-estimate') return undefined;
  return item.aiMealEstimatePhotoUsed ? '📷 KI-Schätzung' : '✨ KI-Schätzung';
}

export interface DiaryItemReference {
  mealId: string;
  itemId: string;
}

export type DiaryMealSelectionState = 'none' | 'partial' | 'all';

export function getDiaryItemSelectionKey(reference: DiaryItemReference): string {
  return JSON.stringify([reference.mealId, reference.itemId]);
}

export function toggleDiaryItemSelection(
  selection: ReadonlySet<string>,
  reference: DiaryItemReference,
): Set<string> {
  const next = new Set(selection);
  const key = getDiaryItemSelectionKey(reference);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  return next;
}

export function getDiaryMealSelectionState(
  meal: Pick<Meal, 'id' | 'items'>,
  selection: ReadonlySet<string>,
): DiaryMealSelectionState {
  const itemKeys = new Set(
    (meal.items ?? []).map((item) => getDiaryItemSelectionKey({ mealId: meal.id, itemId: item.id })),
  );
  if (itemKeys.size === 0) return 'none';

  const selectedCount = [...itemKeys].filter((key) => selection.has(key)).length;
  if (selectedCount === 0) return 'none';
  return selectedCount === itemKeys.size ? 'all' : 'partial';
}

export function toggleDiaryMealSelection(
  selection: ReadonlySet<string>,
  meal: Pick<Meal, 'id' | 'items'>,
): Set<string> {
  const next = new Set(selection);
  const itemKeys = new Set(
    (meal.items ?? []).map((item) => getDiaryItemSelectionKey({ mealId: meal.id, itemId: item.id })),
  );
  if (itemKeys.size === 0) return next;

  const shouldClear = [...itemKeys].every((key) => next.has(key));
  for (const key of itemKeys) {
    if (shouldClear) {
      next.delete(key);
    } else {
      next.add(key);
    }
  }
  return next;
}

export function normalizeDiaryItemSelection(
  selection: ReadonlySet<string>,
  meals: readonly Pick<Meal, 'id' | 'items'>[],
): Set<string> {
  const existingKeys = new Set(
    meals.flatMap((meal) =>
      (meal.items ?? []).map((item) => getDiaryItemSelectionKey({ mealId: meal.id, itemId: item.id })),
    ),
  );
  return new Set([...selection].filter((key) => existingKeys.has(key)));
}

export async function applyAddMeal(params: {
  type: MealType;
  date: string;
  tempId: string;
  setData: (updater: (prev: DiaryDayResponse | null) => DiaryDayResponse | null) => void;
  showSnackbar: (opts: { message: string }) => void;
  loadDay: (date: string) => Promise<boolean>;
  createMeal: (date: string, type: MealType) => Promise<unknown>;
  mealLabels: Record<MealType, string>;
}): Promise<void> {
  const { type, date, tempId, setData, showSnackbar, loadDay, createMeal } = params;

  try {
    await createMeal(date, type);
  } catch {
    setData((prev) =>
      prev ? { ...prev, meals: prev.meals.filter((m) => m.id !== tempId) } : prev,
    );
    showSnackbar({ message: 'Mahlzeit konnte nicht angelegt werden.' });
    return;
  }

  const synced = await loadDay(date);
  if (!synced) {
    setData((prev) =>
      prev ? { ...prev, meals: prev.meals.filter((m) => m.id !== tempId) } : prev,
    );
    showSnackbar({ message: 'Ansicht konnte nicht aktualisiert werden. Bitte einmal nach unten ziehen.' });
  }
}
