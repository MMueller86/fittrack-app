import { describe, expect, it, vi } from 'vitest';
import type { MealType, RecipeNutrition } from '@fittrack/shared';
import {
  LOGGABLE_MEAL_TYPES,
  parsePositiveDecimal,
  resolvePortionInput,
  selectMealForType,
  scaleNutritionByPortions,
  selectCanonicalMeal,
  submitRecipeLog,
  type MealSelection,
} from './recipeLoggingViewModel';

const nutrition: RecipeNutrition = {
  calories: 420,
  protein: 31.5,
  carbs: 48,
  fat: 12,
  fiber: 7,
};

function meal(id: string, type: MealType, createdAt?: string): MealSelection {
  return createdAt === undefined ? { id, type } : { id, type, createdAt };
}

describe('LOGGABLE_MEAL_TYPES', () => {
  it('contains each diary meal type exactly once', () => {
    expect(LOGGABLE_MEAL_TYPES).toEqual([
      'breakfast',
      'preworkout',
      'lunch',
      'dinner',
      'postworkout',
      'snack',
    ]);
  });
});

describe('resolvePortionInput', () => {
  it('accepts positive finite numbers and comma decimals', () => {
    expect(resolvePortionInput(1.5)).toBe(1.5);
    expect(parsePositiveDecimal('1,5')).toBe(1.5);
  });

  it.each(['', '0', '-1', 'abc', '1abc', '1,2.3'])('rejects invalid decimal input %j', (value) => {
    expect(parsePositiveDecimal(value)).toBeNull();
  });

  it('rejects non-positive and non-finite numeric input', () => {
    expect(resolvePortionInput(0)).toBeNull();
    expect(resolvePortionInput(-1)).toBeNull();
    expect(resolvePortionInput(Number.NaN)).toBeNull();
    expect(resolvePortionInput(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('scaleNutritionByPortions', () => {
  it('scales every recipe nutrition value without rounding', () => {
    expect(scaleNutritionByPortions(nutrition, 1.5)).toEqual({
      calories: 630,
      protein: 47.25,
      carbs: 72,
      fat: 18,
      fiber: 10.5,
    });
  });

  it('returns zero nutrition for zero portions', () => {
    expect(scaleNutritionByPortions(nutrition, 0)).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
    });
  });
});

describe('selectCanonicalMeal', () => {
  it('keeps a currently selected meal when it is still available', () => {
    const meals = [meal('dinner-1', 'dinner'), meal('breakfast-1', 'breakfast')];

    expect(selectCanonicalMeal(meals, 'dinner-1')).toBe(meals[0]);
  });

  it('chooses the first meal in canonical meal-type order', () => {
    const meals = [meal('snack-1', 'snack'), meal('lunch-1', 'lunch'), meal('breakfast-1', 'breakfast')];

    expect(selectCanonicalMeal(meals)).toBe(meals[2]);
  });

  it('keeps pre-workout before lunch in the canonical order', () => {
    const meals = [meal('lunch-1', 'lunch'), meal('preworkout-1', 'preworkout'), meal('snack-1', 'snack')];

    expect(selectCanonicalMeal(meals)).toBe(meals[1]);
  });

  it('falls back to the canonical meal when the previous selection disappeared', () => {
    const meals = [meal('dinner-1', 'dinner'), meal('lunch-1', 'lunch')];

    expect(selectCanonicalMeal(meals, 'missing')).toBe(meals[1]);
  });

  it('returns null when there are no meals', () => {
    expect(selectCanonicalMeal([])).toBeNull();
  });
});

describe('selectMealForType', () => {
  it('selects the oldest valid meal of the requested type', () => {
    const meals = [
      meal('lunch-newest', 'lunch', '2026-08-13T12:00:00.000Z'),
      meal('dinner-1', 'dinner', '2026-08-13T08:00:00.000Z'),
      meal('lunch-oldest', 'lunch', '2026-08-13T06:00:00.000Z'),
    ];

    expect(selectMealForType(meals, 'lunch')).toBe(meals[2]);
  });

  it('uses the lexicographically smallest ID for equal timestamps', () => {
    const meals = [
      meal('lunch-z', 'lunch', '2026-08-13T06:00:00.000Z'),
      meal('lunch-a', 'lunch', '2026-08-13T06:00:00.000Z'),
    ];

    expect(selectMealForType(meals, 'lunch')).toBe(meals[1]);
  });

  it('prefers a valid timestamp over invalid or missing timestamps', () => {
    const meals = [
      meal('lunch-invalid', 'lunch', 'not-a-timestamp'),
      meal('lunch-valid', 'lunch', '2026-08-13T06:00:00.000Z'),
      meal('lunch-missing', 'lunch'),
    ];

    expect(selectMealForType(meals, 'lunch')).toBe(meals[1]);
  });

  it('uses the lexicographically smallest ID when timestamps are invalid or missing', () => {
    const meals = [
      meal('lunch-z', 'lunch', 'not-a-timestamp'),
      meal('lunch-c', 'lunch'),
      meal('lunch-a', 'lunch', ''),
    ];

    expect(selectMealForType(meals, 'lunch')).toBe(meals[2]);
  });

  it('returns null when the requested type does not exist', () => {
    expect(selectMealForType([meal('dinner-1', 'dinner')], 'breakfast')).toBeNull();
  });
});

describe('submitRecipeLog', () => {
  const input = {
    date: '2026-08-13',
    recipeId: 'recipe-1',
    mealType: 'lunch' as const,
    portions: 1.5,
  };

  it('logs into an existing canonical meal without creating another meal', async () => {
    const existingMeal = meal('meal-oldest', 'lunch', '2026-08-13T06:00:00.000Z');
    const getDiary = vi.fn().mockResolvedValue({ meals: [existingMeal] });
    const createMeal = vi.fn();
    const logRecipe = vi.fn().mockResolvedValue({ id: 'logged' });

    const submission = await submitRecipeLog(input, { getDiary, createMeal, logRecipe });

    expect(createMeal).not.toHaveBeenCalled();
    expect(logRecipe).toHaveBeenCalledWith('recipe-1', { portions: 1.5, mealId: 'meal-oldest' });
    expect(submission.meal).toBe(existingMeal);
  });

  it('creates exactly one meal when the selected type is missing', async () => {
    const createdMeal = meal('meal-created', 'lunch', '2026-08-13T06:00:00.000Z');
    const getDiary = vi.fn().mockResolvedValue({ meals: [meal('dinner-1', 'dinner')] });
    const createMeal = vi.fn().mockResolvedValue({ meal: createdMeal });
    const logRecipe = vi.fn().mockResolvedValue({ id: 'logged' });

    await submitRecipeLog(input, { getDiary, createMeal, logRecipe });

    expect(createMeal).toHaveBeenCalledTimes(1);
    expect(createMeal).toHaveBeenCalledWith('2026-08-13', 'lunch');
    expect(logRecipe).toHaveBeenCalledWith('recipe-1', { portions: 1.5, mealId: 'meal-created' });
  });

  it('does not reload the diary, create a meal, or log when portions are invalid', async () => {
    const getDiary = vi.fn();
    const createMeal = vi.fn();
    const logRecipe = vi.fn();

    await expect(submitRecipeLog({ ...input, portions: '1abc' }, { getDiary, createMeal, logRecipe }))
      .rejects.toThrow('Invalid recipe portions');

    expect(getDiary).not.toHaveBeenCalled();
    expect(createMeal).not.toHaveBeenCalled();
    expect(logRecipe).not.toHaveBeenCalled();
  });
});