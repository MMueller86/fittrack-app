import { describe, it, expect, vi } from 'vitest';
import {
  applyAddMeal,
  getDiaryItemSelectionKey,
  getDiaryMealSelectionState,
  normalizeDiaryItemSelection,
  toggleDiaryItemSelection,
  toggleDiaryMealSelection,
} from './diaryItemUtils';
import type { DiaryDayResponse, Meal, MealItem, MealType } from '@fittrack/shared';

const mealLabels: Record<MealType, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snack',
  preworkout: 'Pre-Workout',
  postworkout: 'Post-Workout',
};

function makePrev(tempId: string): DiaryDayResponse {
  return {
    meals: [
      {
        id: tempId,
        userId: '',
        date: '2024-01-01',
        type: 'lunch' as MealType,
        name: 'Mittagessen',
        items: [],
        createdAt: '',
      } as Meal,
      {
        id: 'real-1',
        userId: '',
        date: '2024-01-01',
        type: 'breakfast' as MealType,
        name: 'Frühstück',
        items: [],
        createdAt: '',
      } as Meal,
    ],
    summary: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  };
}

function makeSelectionMeal(id: string, itemIds: string[]): Meal {
  return {
    id,
    items: itemIds.map((itemId) => ({ id: itemId } as MealItem)),
  } as Meal;
}

describe('diary item selection', () => {
  it('keeps item references unique across meals', () => {
    const breakfastItem = { mealId: 'breakfast', itemId: 'shared-item-id' };
    const lunchItem = { mealId: 'lunch', itemId: 'shared-item-id' };
    const breakfastKey = getDiaryItemSelectionKey(breakfastItem);
    const lunchKey = getDiaryItemSelectionKey(lunchItem);

    expect(breakfastKey).not.toBe(lunchKey);
    const selected = toggleDiaryItemSelection(new Set(), breakfastItem);
    expect(selected).toEqual(new Set([breakfastKey]));
    expect(toggleDiaryItemSelection(selected, breakfastItem)).toEqual(new Set());
  });

  it('selects all from a partial meal and clears only that meal when fully selected', () => {
    const breakfast = makeSelectionMeal('breakfast', ['item-1', 'item-2']);
    const lunchItem = { mealId: 'lunch', itemId: 'item-1' };
    const initial = new Set([
      getDiaryItemSelectionKey({ mealId: breakfast.id, itemId: 'item-1' }),
      getDiaryItemSelectionKey(lunchItem),
    ]);

    expect(getDiaryMealSelectionState(breakfast, initial)).toBe('partial');
    const fullySelected = toggleDiaryMealSelection(initial, breakfast);
    expect(getDiaryMealSelectionState(breakfast, fullySelected)).toBe('all');
    expect(fullySelected.has(getDiaryItemSelectionKey(lunchItem))).toBe(true);

    const cleared = toggleDiaryMealSelection(fullySelected, breakfast);
    expect(getDiaryMealSelectionState(breakfast, cleared)).toBe('none');
    expect(cleared).toEqual(new Set([getDiaryItemSelectionKey(lunchItem)]));
  });

  it('does not select empty meals and reports their state as none', () => {
    const breakfast = makeSelectionMeal('breakfast', ['item-1', 'item-2']);
    const emptySnack = makeSelectionMeal('snack', []);
    const partial = toggleDiaryItemSelection(new Set(), { mealId: breakfast.id, itemId: 'item-1' });

    expect(getDiaryMealSelectionState(breakfast, partial)).toBe('partial');
    expect(getDiaryMealSelectionState(emptySnack, partial)).toBe('none');
    expect(toggleDiaryMealSelection(partial, emptySnack)).toEqual(partial);
  });

  it('removes references that no longer exist after a diary refresh', () => {
    const breakfast = makeSelectionMeal('breakfast', ['still-here']);
    const selection = new Set([
      getDiaryItemSelectionKey({ mealId: 'breakfast', itemId: 'still-here' }),
      getDiaryItemSelectionKey({ mealId: 'breakfast', itemId: 'removed-item' }),
      getDiaryItemSelectionKey({ mealId: 'removed-meal', itemId: 'removed-item' }),
    ]);

    expect(normalizeDiaryItemSelection(selection, [breakfast])).toEqual(
      new Set([getDiaryItemSelectionKey({ mealId: 'breakfast', itemId: 'still-here' })]),
    );
  });
});

describe('applyAddMeal', () => {
  it('createMeal fails → rollback + snackbar, loadDay not called', async () => {
    const tempId = 'temp-lunch-123';
    const createMeal = vi.fn().mockRejectedValue(new Error('network error'));
    const loadDay = vi.fn();
    const setData = vi.fn();
    const showSnackbar = vi.fn();

    await applyAddMeal({
      type: 'lunch',
      date: '2024-01-01',
      tempId,
      setData,
      showSnackbar,
      loadDay,
      createMeal,
      mealLabels,
    });

    expect(setData).toHaveBeenCalledOnce();
    const updater = setData.mock.calls[0][0] as (prev: DiaryDayResponse | null) => DiaryDayResponse | null;
    const result = updater(makePrev(tempId)) as DiaryDayResponse;
    expect(result.meals.every((m) => m.id !== tempId)).toBe(true);
    expect(result.meals.some((m) => m.id === 'real-1')).toBe(true);

    expect(showSnackbar).toHaveBeenCalledWith({ message: 'Mahlzeit konnte nicht angelegt werden.' });
    expect(loadDay).not.toHaveBeenCalled();
  });

  it('createMeal OK, loadDay returns false → remove temp + pull-to-refresh snackbar', async () => {
    const tempId = 'temp-lunch-456';
    const createMeal = vi.fn().mockResolvedValue(undefined);
    const loadDay = vi.fn().mockResolvedValue(false);
    const setData = vi.fn();
    const showSnackbar = vi.fn();

    await applyAddMeal({
      type: 'lunch',
      date: '2024-01-01',
      tempId,
      setData,
      showSnackbar,
      loadDay,
      createMeal,
      mealLabels,
    });

    expect(setData).toHaveBeenCalledOnce();
    const updater = setData.mock.calls[0][0] as (prev: DiaryDayResponse | null) => DiaryDayResponse | null;
    const result = updater(makePrev(tempId)) as DiaryDayResponse;
    expect(result.meals.every((m) => m.id !== tempId)).toBe(true);
    expect(result.meals.some((m) => m.id === 'real-1')).toBe(true);

    expect(showSnackbar).toHaveBeenCalledWith({
      message: 'Ansicht konnte nicht aktualisiert werden. Bitte einmal nach unten ziehen.',
    });
  });

  it('Both succeed → no rollback, no snackbar', async () => {
    const tempId = 'temp-lunch-789';
    const createMeal = vi.fn().mockResolvedValue(undefined);
    const loadDay = vi.fn().mockResolvedValue(true);
    const setData = vi.fn();
    const showSnackbar = vi.fn();

    await applyAddMeal({
      type: 'lunch',
      date: '2024-01-01',
      tempId,
      setData,
      showSnackbar,
      loadDay,
      createMeal,
      mealLabels,
    });

    expect(setData).not.toHaveBeenCalled();
    expect(showSnackbar).not.toHaveBeenCalled();
  });
});
