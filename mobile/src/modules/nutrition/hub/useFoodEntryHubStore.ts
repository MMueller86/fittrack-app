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
  /** If true, hub opens with search focused (keyboard open) — used from HomeScreen */
  autoFocusSearch: boolean;
  onSuccess: (() => void) | null;

  open: (params?: {
    mealId?: string;
    date?: string;
    mealType?: MealType;
    onSuccess?: () => void;
    /** Open hub directly in search mode (keyboard auto-opens) */
    autoFocusSearch?: boolean;
  }) => void;

  close: () => void;
}

const TODAY = () => new Date().toISOString().split('T')[0]!;

export const useFoodEntryHubStore = create<FoodEntryHubStore>((set) => ({
  isOpen: false,
  autoFocusSearch: false,
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
      autoFocusSearch: params?.autoFocusSearch ?? false,
      context: {
        mealId: params?.mealId,
        date,
        mealType,
      },
      onSuccess: params?.onSuccess ?? null,
    });
  },

  close: () => {
    set({ isOpen: false, autoFocusSearch: false, onSuccess: null });
  },
}));
