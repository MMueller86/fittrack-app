// Diary repository abstraction.
//
// Provides a storage-agnostic interface for nutrition diary meals so HTTP
// handlers don't need to know whether data lives in memory or Cosmos DB.
//
// Selection rule:
//   - If COSMOS_ENDPOINT and COSMOS_KEY are set → CosmosDbDiaryRepository
//   - Otherwise → InMemoryDiaryRepository (lost on restart)

import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import type {
  DiaryBulkDeleteRequest,
  DiaryBulkDeleteResponse,
  DiaryBulkCopyRequest,
  DiaryBulkCopyResponse,
  DiaryBulkMoveRequest,
  DiaryBulkMoveResponse,
  DiaryItemReference,
  Meal,
  MealItem,
  MealItemMacros,
  MealType,
  NutritionValues,
} from '@fittrack/shared';
import { isCosmosConfigured } from '../cosmos';
import { CosmosDiaryRepository } from './cosmosDiaryRepository';

const MAX_DIARY_BULK_BATCH_OPERATIONS = 100;
const MAX_DIARY_BULK_BATCH_BYTES = 2 * 1024 * 1024;

export type DiaryBulkMutationErrorCode =
  | 'invalid_diary_bulk_request'
  | 'diary_bulk_reference_not_found'
  | 'diary_bulk_conflict'
  | 'diary_bulk_operation_limit_exceeded';

export class DiaryBulkMutationError extends Error {
  constructor(readonly code: DiaryBulkMutationErrorCode) {
    super(code);
    this.name = 'DiaryBulkMutationError';
  }
}

export function groupDiaryItemReferences(
  references: DiaryItemReference[],
): Map<string, Set<string>> {
  if (!Array.isArray(references) || references.length === 0) {
    throw new DiaryBulkMutationError('invalid_diary_bulk_request');
  }

  const grouped = new Map<string, Set<string>>();
  const seen = new Set<string>();
  for (const reference of references) {
    if (
      typeof reference?.mealId !== 'string' || reference.mealId.trim().length === 0 ||
      typeof reference.itemId !== 'string' || reference.itemId.trim().length === 0
    ) {
      throw new DiaryBulkMutationError('invalid_diary_bulk_request');
    }

    const key = JSON.stringify([reference.mealId, reference.itemId]);
    if (seen.has(key)) throw new DiaryBulkMutationError('invalid_diary_bulk_request');
    seen.add(key);

    const itemIds = grouped.get(reference.mealId) ?? new Set<string>();
    itemIds.add(reference.itemId);
    grouped.set(reference.mealId, itemIds);
  }
  return grouped;
}

export function resolveDiaryBulkSourceMeals(
  userId: string,
  sourceDate: string,
  groupedReferences: Map<string, Set<string>>,
  mealsById: Map<string, Meal>,
): Map<string, Meal> {
  const sourceMeals = new Map<string, Meal>();
  for (const [mealId, itemIds] of groupedReferences) {
    const meal = mealsById.get(mealId);
    if (!meal || meal.userId !== userId || meal.date !== sourceDate) {
      throw new DiaryBulkMutationError('diary_bulk_reference_not_found');
    }
    const existingIds = new Set((meal.items ?? []).map((item) => item.id));
    if ([...itemIds].some((itemId) => !existingIds.has(itemId))) {
      throw new DiaryBulkMutationError('diary_bulk_reference_not_found');
    }
    sourceMeals.set(mealId, meal);
  }
  return sourceMeals;
}

export function assertDiaryBulkBatchLimits(operations: readonly unknown[]): void {
  const serialized = JSON.stringify(operations);
  if (
    operations.length > MAX_DIARY_BULK_BATCH_OPERATIONS ||
    Buffer.byteLength(serialized ?? '', 'utf8') > MAX_DIARY_BULK_BATCH_BYTES
  ) {
    throw new DiaryBulkMutationError('diary_bulk_operation_limit_exceeded');
  }
}

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

export interface UpdateItemInput {
  /** Updated macros (pre-calculated by handler) */
  macros: MealItemMacros;
  /** Updated quantity value (grams or portions depending on unit) */
  quantity: number;
  /** Updated unit string */
  unit: string;
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
  /** Fetch a single meal by id (across all days) — returns null if not found */
  getMealById(userId: string, mealId: string): Promise<Meal | null>;
  createMeal(input: CreateMealInput): Promise<Meal>;
  addItem(userId: string, mealId: string, input: AddItemInput): Promise<Meal>;
  updateItem(userId: string, mealId: string, itemId: string, input: UpdateItemInput): Promise<Meal | null>;
  deleteItem(userId: string, mealId: string, itemId: string): Promise<Meal | null>;
  deleteMeal(userId: string, mealId: string): Promise<boolean>;
  bulkDeleteItems(userId: string, request: DiaryBulkDeleteRequest): Promise<DiaryBulkDeleteResponse>;
  bulkMoveItems(userId: string, request: DiaryBulkMoveRequest): Promise<DiaryBulkMoveResponse>;
  bulkCopyItems(userId: string, request: DiaryBulkCopyRequest): Promise<DiaryBulkCopyResponse>;
  /** Count all diary items that reference the given reusable item — used for delete warnings */
  countBySourceId(userId: string, sourceId: string): Promise<number>;
  /** Recalculate macros for all diary items referencing sourceId — returns number of updated items */
  updateMacrosBySourceId(
    userId: string,
    sourceId: string,
    newNutritionPer100g: NutritionValues,
    newPortionWeightGrams?: number,
  ): Promise<number>;
  /** Paginated list of all meals for a user, sorted by date ascending — used for Health Connect export */
  listAllMeals(
    userId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<{ meals: Meal[]; cursor?: string }>;
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

  async getMealById(userId: string, mealId: string): Promise<Meal | null> {
    for (const [, meals] of this.mealsByDay) {
      const meal = meals.find((m) => m.id === mealId && m.userId === userId);
      if (meal) return meal;
    }
    return null;
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

  async updateItem(userId: string, mealId: string, itemId: string, input: UpdateItemInput): Promise<Meal | null> {
    for (const [, meals] of this.mealsByDay) {
      const meal = meals.find((m) => m.id === mealId && m.userId === userId);
      if (!meal) continue;
      const item = meal.items.find((i) => i.id === itemId);
      if (!item) return null;
      item.quantity = input.quantity;
      item.unit = input.unit;
      item.macros = input.macros;
      return meal;
    }
    return null;
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

  async bulkDeleteItems(
    userId: string,
    request: DiaryBulkDeleteRequest,
  ): Promise<DiaryBulkDeleteResponse> {
    const groupedReferences = groupDiaryItemReferences(request.items);
    const mealsById = new Map<string, Meal>();
    for (const meals of this.mealsByDay.values()) {
      for (const meal of meals) {
        if (meal.userId === userId) mealsById.set(meal.id, meal);
      }
    }
    const sourceMeals = resolveDiaryBulkSourceMeals(
      userId,
      request.sourceDate,
      groupedReferences,
      mealsById,
    );

    const updatedMeals = new Map<string, Meal>();
    for (const [mealId, meal] of sourceMeals) {
      const itemIds = groupedReferences.get(mealId)!;
      updatedMeals.set(mealId, {
        ...meal,
        items: (meal.items ?? []).filter((item) => !itemIds.has(item.id)),
      });
    }
    const operations = [...updatedMeals.values()].map((meal) => ({
      operationType: 'Replace',
      id: meal.id,
      resourceBody: meal,
    }));
    assertDiaryBulkBatchLimits(operations);

    const dayKey = this.key(userId, request.sourceDate);
    const currentMeals = this.mealsByDay.get(dayKey) ?? [];
    this.mealsByDay.set(dayKey, currentMeals.map((meal) => updatedMeals.get(meal.id) ?? meal));
    return {
      deletedCount: request.items.length,
      deletedItemIds: request.items.map((reference) => reference.itemId),
    };
  }

  async bulkMoveItems(
    userId: string,
    request: DiaryBulkMoveRequest,
  ): Promise<DiaryBulkMoveResponse> {
    const groupedReferences = groupDiaryItemReferences(request.items);
    const mealsById = new Map<string, Meal>();
    for (const meals of this.mealsByDay.values()) {
      for (const meal of meals) {
        if (meal.userId === userId) mealsById.set(meal.id, meal);
      }
    }
    const sourceMeals = resolveDiaryBulkSourceMeals(
      userId,
      request.sourceDate,
      groupedReferences,
      mealsById,
    );

    let targetMeal: Meal;
    let isNewTarget = false;
    if ('mealId' in request.target && typeof request.target.mealId === 'string') {
      if (sourceMeals.has(request.target.mealId)) {
        throw new DiaryBulkMutationError('invalid_diary_bulk_request');
      }
      const existingTarget = mealsById.get(request.target.mealId);
      if (!existingTarget || existingTarget.date !== request.sourceDate) {
        throw new DiaryBulkMutationError('diary_bulk_reference_not_found');
      }
      targetMeal = existingTarget;
    } else if ('newMealType' in request.target && request.target.newMealType) {
      const type = request.target.newMealType;
      targetMeal = {
        id: randomUUID(),
        userId,
        date: request.sourceDate,
        type,
        name: type.charAt(0).toUpperCase() + type.slice(1),
        items: [],
        createdAt: new Date().toISOString(),
      };
      isNewTarget = true;
    } else {
      throw new DiaryBulkMutationError('invalid_diary_bulk_request');
    }

    const movedItems = request.items.map((reference) => {
      const meal = sourceMeals.get(reference.mealId)!;
      const item = (meal.items ?? []).find((candidate) => candidate.id === reference.itemId)!;
      return { ...structuredClone(item), id: randomUUID() };
    });
    const updatedSources = new Map<string, Meal>();
    for (const [mealId, meal] of sourceMeals) {
      const itemIds = groupedReferences.get(mealId)!;
      updatedSources.set(mealId, {
        ...meal,
        items: (meal.items ?? []).filter((item) => !itemIds.has(item.id)),
      });
    }
    const updatedTarget: Meal = { ...targetMeal, items: [...(targetMeal.items ?? []), ...movedItems] };
    const operations = [
      ...[...updatedSources.values()].map((meal) => ({
        operationType: 'Replace',
        id: meal.id,
        resourceBody: meal,
      })),
      isNewTarget
        ? { operationType: 'Create', resourceBody: updatedTarget }
        : { operationType: 'Replace', id: updatedTarget.id, resourceBody: updatedTarget },
    ];
    assertDiaryBulkBatchLimits(operations);

    const dayKey = this.key(userId, request.sourceDate);
    const currentMeals = this.mealsByDay.get(dayKey) ?? [];
    const changedMeals = new Map(updatedSources);
    if (!isNewTarget) changedMeals.set(updatedTarget.id, updatedTarget);
    const nextMeals = currentMeals.map((meal) => changedMeals.get(meal.id) ?? meal);
    this.mealsByDay.set(dayKey, isNewTarget ? [...nextMeals, updatedTarget] : nextMeals);

    return {
      movedCount: movedItems.length,
      removedItemIds: request.items.map((reference) => reference.itemId),
      targetMeal: updatedTarget,
    };
  }

  async bulkCopyItems(
    userId: string,
    request: DiaryBulkCopyRequest,
  ): Promise<DiaryBulkCopyResponse> {
    const groupedReferences = groupDiaryItemReferences(request.items);
    const mealsById = new Map<string, Meal>();
    for (const meals of this.mealsByDay.values()) {
      for (const meal of meals) {
        if (meal.userId === userId) mealsById.set(meal.id, meal);
      }
    }
    const sourceMeals = resolveDiaryBulkSourceMeals(
      userId,
      request.sourceDate,
      groupedReferences,
      mealsById,
    );

    let targetMeal: Meal;
    let isNewTarget = false;
    if ('mealId' in request.target && typeof request.target.mealId === 'string') {
      const existingTarget = mealsById.get(request.target.mealId);
      if (!existingTarget || existingTarget.date !== request.targetDate) {
        throw new DiaryBulkMutationError('diary_bulk_reference_not_found');
      }
      targetMeal = existingTarget;
    } else if ('newMealType' in request.target && request.target.newMealType) {
      const type = request.target.newMealType;
      targetMeal = {
        id: randomUUID(),
        userId,
        date: request.targetDate,
        type,
        name: type.charAt(0).toUpperCase() + type.slice(1),
        items: [],
        createdAt: new Date().toISOString(),
      };
      isNewTarget = true;
    } else {
      throw new DiaryBulkMutationError('invalid_diary_bulk_request');
    }

    const copiedItems = request.items.map((reference) => {
      const meal = sourceMeals.get(reference.mealId)!;
      const item = (meal.items ?? []).find((candidate) => candidate.id === reference.itemId)!;
      return { ...structuredClone(item), id: randomUUID() };
    });
    const updatedTarget: Meal = { ...targetMeal, items: [...(targetMeal.items ?? []), ...copiedItems] };
    const operations = [isNewTarget
      ? { operationType: 'Create', resourceBody: updatedTarget }
      : { operationType: 'Replace', id: updatedTarget.id, resourceBody: updatedTarget }];
    assertDiaryBulkBatchLimits(operations);

    const targetDayKey = this.key(userId, request.targetDate);
    const currentTargetMeals = this.mealsByDay.get(targetDayKey) ?? [];
    this.mealsByDay.set(
      targetDayKey,
      isNewTarget
        ? [...currentTargetMeals, updatedTarget]
        : currentTargetMeals.map((meal) => meal.id === updatedTarget.id ? updatedTarget : meal),
    );

    return { copiedCount: copiedItems.length, targetMeal: updatedTarget };
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

  async listAllMeals(
    userId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<{ meals: Meal[]; cursor?: string }> {
    const limit = Math.min(options?.limit ?? 50, 100);
    const offset = options?.cursor ? parseInt(options.cursor, 10) : 0;
    const all = [...this.mealsByDay.values()]
      .flat()
      .filter((m) => m.userId === userId)
      .sort((a, b) => a.date.localeCompare(b.date));
    const page = all.slice(offset, offset + limit);
    const nextOffset = offset + limit;
    return {
      meals: page,
      cursor: nextOffset < all.length ? String(nextOffset) : undefined,
    };
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
