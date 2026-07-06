// useFoodEntryHubStore — global Zustand store for FoodEntryHub.
// Any screen calls open() to show the hub. The hub itself subscribes.
// open() always resets state, even if the hub is already open.

import { create } from 'zustand';
import type { MealType } from '@fittrack/shared';
import { getSuggestedMealType } from './mealTimeRules';

export interface FoodEntryHubContext {
  /** If set, the entry will be added to this specific meal. */
  mealId?: string;
  /** ISO date string (YYYY-MM-DD). Defaults to today. */
  date: string;
  /** Pre-resolved meal type for the header subtitle. */
  mealType: MealType;
}

interface FoodEntryHubStore {
  isOpen: boolean;
  context: FoodEntryHubContext;
  /**
   * Callback invoked after a successful diary entry.
   * Callers use this to invalidate / reload their diary/home state.
   */
  onSuccess: (() => void) | null;

  /**
   * Opens the hub. Always resets internal hub state (even if already open).
   * If no date is provided, defaults to today.
   * If no mealType is provided, derives it from the current time.
   */
  open: (params?: {
    mealId?: string;
    date?: string;
    mealType?: MealType;
    onSuccess?: () => void;
  }) => void;

  /** Closes the hub and clears the context. */
  close: () => void;
}

const TODAY = () => new Date().toISOString().split('T')[0]!;

export const useFoodEntryHubStore = create<FoodEntryHubStore>((set) => ({
  isOpen: false,
  context: {
    date: TODAY(),
    mealType: getSuggestedMealType(),
  },
  onSuccess: null,

  open: (params) => {
    const date = params?.date ?? TODAY();
    const mealType = params?.mealType ?? getSuggestedMealType();
    set({
      isOpen: true,
      context: {
        mealId: params?.mealId,
        date,
        mealType,
      },
      onSuccess: params?.onSuccess ?? null,
    });
  },

  close: () => {
    set({ isOpen: false, onSuccess: null });
  },
}));
