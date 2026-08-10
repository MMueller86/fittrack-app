// useFoodEntryHubStore — global Zustand store for FoodEntryHub.
// Any screen calls open() to show the hub. The hub itself subscribes.
// open() always resets state, even if the hub is already open.

import { create } from 'zustand';
import type { FoodSearchResult, MealType } from '@fittrack/shared';
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
  /** If set, hub opens directly into this subflow */
  initialSubflow: 'barcode' | 'ai' | null;
  /** If true, hub closes automatically after a subflow saves (HomeScreen use case) */
  autoCloseOnSave: boolean;
  onSuccess: (() => void) | null;
  /** Pixel offset from screen top where the sheet's top edge should be pinned (HomeScreen use case) */
  topInset: number;
  /** Recipe mode: pre-populate search field on open */
  initialQuery: string;
  /** Recipe mode: pre-fill amount in QuantityView */
  prefillAmount: { mode: 'grams' | 'portion'; amount: number } | null;
  /** Recipe mode: when set, hub calls back instead of saving to diary */
  onSelectIngredient: ((product: FoodSearchResult, mode: 'grams' | 'portion', amount: number) => void) | null;

  open: (params?: {
    mealId?: string;
    date?: string;
    mealType?: MealType;
    onSuccess?: () => void;
    /** Open hub directly in search mode (keyboard auto-opens) */
    autoFocusSearch?: boolean;
    /** Open hub directly in a subflow */
    initialSubflow?: 'barcode' | 'ai';
    /** Close hub automatically after save (HomeScreen use case) */
    autoCloseOnSave?: boolean;
    /** Pin sheet top to this pixel offset (safeAreaTop + header height) — HomeScreen only */
    topInset?: number;
    /** Recipe mode: pre-populate search field on open */
    initialQuery?: string;
    /** Recipe mode: pre-fill amount in QuantityView */
    prefillAmount?: { mode: 'grams' | 'portion'; amount: number } | null;
    /** Recipe mode: when set, hub calls back instead of saving to diary */
    onSelectIngredient?: (product: FoodSearchResult, mode: 'grams' | 'portion', amount: number) => void;
  }) => void;

  close: () => void;
}

const TODAY = () => new Date().toISOString().split('T')[0]!;

export const useFoodEntryHubStore = create<FoodEntryHubStore>((set) => ({
  isOpen: false,
  autoFocusSearch: false,
  initialSubflow: null,
  autoCloseOnSave: false,
  topInset: 0,
  initialQuery: '',
  prefillAmount: null,
  onSelectIngredient: null,
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
      initialSubflow: params?.initialSubflow ?? null,
      autoCloseOnSave: params?.autoCloseOnSave ?? false,
      topInset: params?.topInset ?? 0,
      initialQuery: params?.initialQuery ?? '',
      prefillAmount: params?.prefillAmount ?? null,
      onSelectIngredient: params?.onSelectIngredient ?? null,
      context: {
        mealId: params?.mealId,
        date,
        mealType,
      },
      onSuccess: params?.onSuccess ?? null,
    });
  },

  close: () => {
    set({ isOpen: false, autoFocusSearch: false, initialSubflow: null, autoCloseOnSave: false, topInset: 0, onSuccess: null, initialQuery: '', prefillAmount: null, onSelectIngredient: null });
  },
}));
