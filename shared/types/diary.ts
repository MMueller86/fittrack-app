// Diary types

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type MealItemSourceType = 'manual' | 'reusableItem' | 'recipe';

export interface MealItemMacros {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number;
}

export interface MealItem {
  id: string;
  name: string;
  sourceType: MealItemSourceType;
  sourceId?: string;
  quantity: number;
  unit: string;
  macros: MealItemMacros; // snapshot at time of logging
}

export interface Meal {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  type: MealType;
  name: string;
  items: MealItem[];
  createdAt: string;
}

export interface DaySummary {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}

export interface DiaryDayResponse {
  meals: Meal[];
  summary: DaySummary;
}

// ReusableItem — a named food template for the diary item picker.
// Distinct from MealItem (which is an immutable snapshot inside a Meal).
export interface ReusableItem {
  id: string;
  userId: string;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  usageCount: number;
  createdAt: string;
}
