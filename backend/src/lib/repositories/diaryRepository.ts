// Diary repository abstraction.
//
// Provides a storage-agnostic interface for nutrition diary meals so HTTP
// handlers don't need to know whether data lives in memory or Cosmos DB.
//
// Selection rule:
//   - If COSMOS_ENDPOINT and COSMOS_KEY are set → CosmosDbDiaryRepository
//   - Otherwise → InMemoryDiaryRepository (lost on restart)

import { randomUUID } from 'node:crypto';
import type { Meal, MealItem, MealItemMacros, MealType, NutritionValues } from '@fittrack/shared';
import { isCosmosConfigured } from '../cosmos';
import { CosmosDiaryRepository } from './cosmosDiaryRepository';

export interface CreateMealInput {
  userId: string;
  date: string;       // YYYY-MM-DD
  type: MealType;
  name: string;
}

export interface AddItemInput {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  /** ID of the ReusableItem this entry was logged from — enables history updates */
  sourceId?: string;
  quantity?: number;
  unit?: string;
  isAiEstimate?: boolean;
  sourceType?: import('@fittrack/shared').MealItemSourceType;
  /** ID of the source recipe when sourceType === 'recipe' */
  recipeId?: string;
  /** Number of portions logged */
  recipePortions?: number;
}

export interface DaySummary {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface DiaryDayResult {
  meals: Meal[];
  summary: DaySummary;
}

export interface DiaryRepository {
  getDay(userId: string, date: string): Promise<DiaryDayResult>;
  createMeal(input: CreateMealInput): Promise<Meal>;
  addItem(userId: string, mealId: string, input: AddItemInput): Promise<Meal>;
  deleteItem(userId: string, mealId: string, itemId: string): Promise<Meal | null>;
  deleteMeal(userId: string, mealId: string): Promise<boolean>;
  /** Count all diary items that reference the given reusable item — used for delete warnings */
  countBySourceId(userId: string, sourceId: string): Promise<number>;
  /** Recalculate macros for all diary items referencing sourceId — returns number of updated items */
  updateMacrosBySourceId(
    userId: string,
    sourceId: string,
    newNutritionPer100g: NutritionValues,
    newPortionWeightGrams?: number,
  ): Promise<number>;
}

export function computeSummary(meals: Meal[]): DaySummary {
  const summary: DaySummary = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  for (const meal of meals) {
    for (const item of (meal.items ?? [])) {
      summary.calories += item.macros.calories;
      summary.protein += item.macros.protein;
      summary.carbs += item.macros.carbs;
      summary.fat += item.macros.fat;
      summary.fiber += item.macros.fiber;
    }
  }
  // Round to 1 decimal to avoid floating-point noise in responses.
  summary.calories = Math.round(summary.calories * 10) / 10;
  summary.protein = Math.round(summary.protein * 10) / 10;
  summary.carbs   = Math.round(summary.carbs * 10) / 10;
  summary.fat     = Math.round(summary.fat * 10) / 10;
  summary.fiber   = Math.round(summary.fiber * 10) / 10;
  return summary;
}
/**
 * Recalculate a single diary item's macros from updated product nutrition.
 * Handles both gram-based and portion-based items.
 */
export function recalcMacros(
  item: MealItem,
  newNutrition: NutritionValues,
  newPortionWeightGrams?: number,
): MealItemMacros {
  const grams =
    item.unit === 'portion' && newPortionWeightGrams != null
      ? item.quantity * newPortionWeightGrams
      : item.quantity;
  const scale = grams / 100;
  return {
    calories: Math.round(newNutrition.calories * scale * 10) / 10,
    protein:  Math.round((newNutrition.protein  ?? 0) * scale * 10) / 10,
    carbs:    Math.round((newNutrition.carbs    ?? 0) * scale * 10) / 10,
    fat:      Math.round((newNutrition.fat      ?? 0) * scale * 10) / 10,
    fiber:    Math.round((newNutrition.fiber    ?? 0) * scale * 10) / 10,
  };
}
class InMemoryDiaryRepository implements DiaryRepository {
  // key: `${userId}:${date}`
  private readonly mealsByDay = new Map<string, Meal[]>();

  private key(userId: string, date: string): string {
    return `${userId}:${date}`;
  }

  async getDay(userId: string, date: string): Promise<DiaryDayResult> {
    const meals = this.mealsByDay.get(this.key(userId, date)) ?? [];
    return { meals, summary: computeSummary(meals) };
  }

  async createMeal(input: CreateMealInput): Promise<Meal> {
    const meal: Meal = {
      id: randomUUID(),
      userId: input.userId,
      date: input.date,
      type: input.type,
      name: input.name,
      items: [],
      createdAt: new Date().toISOString(),
    };
    const k = this.key(input.userId, input.date);
    const list = this.mealsByDay.get(k) ?? [];
    list.push(meal);
    this.mealsByDay.set(k, list);
    return meal;
  }

  async addItem(userId: string, mealId: string, input: AddItemInput): Promise<Meal> {
    for (const [, meals] of this.mealsByDay) {
      const meal = meals.find((m) => m.id === mealId && m.userId === userId);
      if (!meal) continue;
      const item: MealItem = {
        id: randomUUID(),
        name: input.name,
        sourceType: input.sourceType ?? 'manual',
        ...(input.sourceId ? { sourceId: input.sourceId } : {}),
        ...(input.isAiEstimate ? { isAiEstimate: true } : {}),
        ...(input.recipeId ? { recipeId: input.recipeId } : {}),
        ...(input.recipePortions != null ? { recipePortions: input.recipePortions } : {}),
        quantity: input.quantity ?? 1,
        unit: input.unit ?? 'serving',
        macros: {
          calories: input.calories,
          protein: input.protein,
          carbs: input.carbs,
          fat: input.fat,
          fiber: input.fiber,
        },
      };
      meal.items.push(item);
      return meal;
    }
    throw new Error(`Meal ${mealId} not found`);
  }

  async deleteItem(userId: string, mealId: string, itemId: string): Promise<Meal | null> {
    for (const [, meals] of this.mealsByDay) {
      const meal = meals.find((m) => m.id === mealId && m.userId === userId);
      if (!meal) continue;
      const idx = meal.items.findIndex((i) => i.id === itemId);
      if (idx === -1) return null;
      meal.items.splice(idx, 1);
      return meal;
    }
    return null;
  }

  async deleteMeal(userId: string, mealId: string): Promise<boolean> {
    for (const [k, meals] of this.mealsByDay) {
      const idx = meals.findIndex((m) => m.id === mealId && m.userId === userId);
      if (idx === -1) continue;
      meals.splice(idx, 1);
      this.mealsByDay.set(k, meals);
      return true;
    }
    return false;
  }

  async countBySourceId(userId: string, sourceId: string): Promise<number> {
    let count = 0;
    for (const [, meals] of this.mealsByDay) {
      for (const meal of meals) {
        if (meal.userId !== userId) continue;
        count += (meal.items ?? []).filter((i) => i.sourceId === sourceId).length;
      }
    }
    return count;
  }

  async updateMacrosBySourceId(
    userId: string,
    sourceId: string,
    newNutritionPer100g: NutritionValues,
    newPortionWeightGrams?: number,
  ): Promise<number> {
    let count = 0;
    for (const [, meals] of this.mealsByDay) {
      for (const meal of meals) {
        if (meal.userId !== userId) continue;
        for (const item of meal.items ?? []) {
          if (item.sourceId !== sourceId) continue;
          item.macros = recalcMacros(item, newNutritionPer100g, newPortionWeightGrams);
          count++;
        }
      }
    }
    return count;
  }
}

let singleton: DiaryRepository | undefined;

export function getDiaryRepository(): DiaryRepository {
  if (!singleton) {
    singleton = isCosmosConfigured()
      ? new CosmosDiaryRepository()
      : new InMemoryDiaryRepository();
  }
  return singleton;
}

export function __resetDiaryRepositoryForTests(): void {
  singleton = undefined;
}
