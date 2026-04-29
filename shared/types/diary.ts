// Diary types — stub
// Will be populated in M4 (Nutrition Diary milestone)

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
