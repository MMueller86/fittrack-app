import { describe, it, expect, vi } from 'vitest';
import { applyAddMeal } from './diaryItemUtils';
import type { DiaryDayResponse, Meal, MealType } from '@fittrack/shared';

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
