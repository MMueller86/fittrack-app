// Diary types

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type MealItemSourceType = 'manual' | 'reusableItem' | 'openFoodFacts' | 'ai';

// --- Nutrition value containers ---

export interface NutritionValues {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
}

export interface PortionInfo {
  label: string;          // e.g. "1 slice", "1 cup"
  weightGrams?: number;   // grams per portion (if known)
  nutrition?: NutritionValues; // macros per portion (if known)
}

// Legacy alias — used by MealItem.macros (always complete: fiber required at diary level)
export interface MealItemMacros {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
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
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface DiaryDayResponse {
  meals: Meal[];
  summary: DaySummary;
}

// --- ReusableItem — extended model with Open Food Facts support ---

export type ReusableItemSourceType = 'manual' | 'openFoodFacts' | 'ai';
export type NutritionBasis = 'per100g' | 'perPortion' | 'both';

export interface OFFSourceRef {
  provider: 'openFoodFacts';
  barcode?: string;
  productId?: string;
}

export interface ReusableItem {
  id: string;
  userId: string;
  name: string;
  brand?: string;
  /** Whether nutritionPer100g, portion, or both are available */
  nutritionBasis: NutritionBasis;
  nutritionPer100g?: NutritionValues;
  portion?: PortionInfo;
  /** True when enough data exists for reliable macro calculation */
  isComplete: boolean;
  sourceType: ReusableItemSourceType;
  sourceRef?: OFFSourceRef;
  usageCount: number;
  createdAt: string;
}

// --- Food search result (unified view across user library + OFF) ---

export interface FoodSearchResult {
  id: string;
  source: 'library' | 'openFoodFacts';
  name: string;
  brand?: string;
  displayLabel: string; // e.g. "100g · 380 kcal" or "1 serving · 250 kcal"
  nutritionBasis: NutritionBasis;
  nutritionPer100g?: NutritionValues;
  portion?: PortionInfo;
  isComplete: boolean;
  sourceRef?: OFFSourceRef;
}

