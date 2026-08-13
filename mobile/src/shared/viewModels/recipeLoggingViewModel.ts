import type { Meal, MealType, RecipeNutrition } from '@fittrack/shared';

export type MealSelection = Pick<Meal, 'id' | 'type'> & Partial<Pick<Meal, 'createdAt'>>;
export type PortionInput = string | number;

export const LOGGABLE_MEAL_TYPES: readonly MealType[] = [
  'breakfast',
  'preworkout',
  'lunch',
  'dinner',
  'postworkout',
  'snack',
];

const POSITIVE_DECIMAL_PATTERN = /^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/;

export function scaleNutritionByPortions(
  nutritionPerPortion: RecipeNutrition,
  portions: number,
): RecipeNutrition {
  return {
    calories: nutritionPerPortion.calories * portions,
    protein: nutritionPerPortion.protein * portions,
    carbs: nutritionPerPortion.carbs * portions,
    fat: nutritionPerPortion.fat * portions,
    fiber: nutritionPerPortion.fiber * portions,
  };
}

export function parsePositiveDecimal(value: string): number | null {
  if (!POSITIVE_DECIMAL_PATTERN.test(value)) return null;

  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function resolvePortionInput(value: PortionInput): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  return parsePositiveDecimal(value);
}

function parseCreatedAt(value: string | undefined): number | null {
  if (!value) return null;

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function compareMealAge(left: MealSelection, right: MealSelection): number {
  const leftTimestamp = parseCreatedAt(left.createdAt);
  const rightTimestamp = parseCreatedAt(right.createdAt);

  if (leftTimestamp !== null && rightTimestamp !== null && leftTimestamp !== rightTimestamp) {
    return leftTimestamp - rightTimestamp;
  }

  if (leftTimestamp !== null && rightTimestamp === null) return -1;
  if (leftTimestamp === null && rightTimestamp !== null) return 1;
  if (left.id === right.id) return 0;
  return left.id < right.id ? -1 : 1;
}

export function selectCanonicalMeal<T extends MealSelection>(
  meals: readonly T[],
  selectedMealId: string | null = null,
): T | null {
  const selectedMeal = selectedMealId == null
    ? null
    : meals.find((meal) => meal.id === selectedMealId) ?? null;

  if (selectedMeal) return selectedMeal;

  return meals.reduce<T | null>((canonicalMeal, meal) => {
    if (!canonicalMeal) return meal;

    const mealOrder = LOGGABLE_MEAL_TYPES.indexOf(meal.type);
    const canonicalOrder = LOGGABLE_MEAL_TYPES.indexOf(canonicalMeal.type);
    return mealOrder < canonicalOrder ? meal : canonicalMeal;
  }, null);
}

export function selectMealForType<T extends MealSelection>(
  meals: readonly T[],
  mealType: MealType,
): T | null {
  return meals
    .filter((meal) => meal.type === mealType)
    .reduce<T | null>((selectedMeal, meal) => {
      if (!selectedMeal || compareMealAge(meal, selectedMeal) < 0) return meal;
      return selectedMeal;
    }, null);
}

export interface SubmitRecipeLogInput {
  date: string;
  recipeId: string;
  mealType: MealType;
  portions: PortionInput;
}

export async function submitRecipeLog<
  TMeal extends MealSelection,
  TDiary extends { meals: readonly TMeal[] },
  TLogResult,
>(
  input: SubmitRecipeLogInput,
  dependencies: {
    getDiary: (date: string) => Promise<TDiary>;
    createMeal: (date: string, mealType: MealType) => Promise<{ meal: TMeal }>;
    logRecipe: (recipeId: string, request: { portions: number; mealId: string }) => Promise<TLogResult>;
  },
): Promise<{ diary: TDiary; meal: TMeal; result: TLogResult; portions: number }> {
  const portions = resolvePortionInput(input.portions);
  if (portions === null) {
    throw new Error('Invalid recipe portions');
  }

  const diary = await dependencies.getDiary(input.date);
  const existingMeal = selectMealForType(diary.meals, input.mealType);
  const meal = existingMeal
    ?? (await dependencies.createMeal(input.date, input.mealType)).meal;
  const result = await dependencies.logRecipe(input.recipeId, {
    portions,
    mealId: meal.id,
  });

  return { diary, meal, result, portions };
}