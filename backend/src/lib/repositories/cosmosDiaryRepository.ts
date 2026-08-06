// Cosmos-backed implementation of DiaryRepository.
// Container: nutritionDiaryMeals, partition key: /userId
//
// Each document IS a Meal (id = meal id, userId = partition key).
// Items are stored embedded inside the Meal document — this avoids
// cross-partition joins and keeps meal reads cheap.

import { randomUUID } from 'node:crypto';
import type { Meal, MealItem } from '@fittrack/shared';
import { getCosmos } from '../cosmos';
import type {
  AddItemInput,
  CreateMealInput,
  DiaryDayResult,
  DiaryRepository,
  UpdateItemInput,
} from './diaryRepository';
import { computeSummary, recalcMacros } from './diaryRepository';

export class CosmosDiaryRepository implements DiaryRepository {
  async getDay(userId: string, date: string): Promise<DiaryDayResult> {
    const { containers } = await getCosmos();
    const { resources } = await containers.nutritionDiaryMeals.items
      .query<Meal>(
        {
          query: 'SELECT * FROM c WHERE c.userId = @userId AND c.date = @date',
          parameters: [
            { name: '@userId', value: userId },
            { name: '@date', value: date },
          ],
        },
        { partitionKey: userId },
      )
      .fetchAll();
    return { meals: resources, summary: computeSummary(resources) };
  }

  async getMealById(userId: string, mealId: string): Promise<Meal | null> {
    const { containers } = await getCosmos();
    const { resource } = await containers.nutritionDiaryMeals
      .item(mealId, userId)
      .read<Meal>();
    return resource ?? null;
  }

  async createMeal(input: CreateMealInput): Promise<Meal> {
    const { containers } = await getCosmos();
    const meal: Meal = {
      id: randomUUID(),
      userId: input.userId,
      date: input.date,
      type: input.type,
      name: input.name,
      items: [],
      createdAt: new Date().toISOString(),
    };
    const { resource } = await containers.nutritionDiaryMeals.items.create<Meal>(meal);
    return resource ?? meal;
  }

  async addItem(userId: string, mealId: string, input: AddItemInput): Promise<Meal> {
    const { containers } = await getCosmos();
    const { resource: existing } = await containers.nutritionDiaryMeals
      .item(mealId, userId)
      .read<Meal>();
    if (!existing) throw new Error(`Meal ${mealId} not found`);

    const newItem: MealItem = {
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
    existing.items = [...(existing.items ?? []), newItem];

    const { resource: updated } = await containers.nutritionDiaryMeals
      .item(mealId, userId)
      .replace<Meal>(existing);
    return updated ?? existing;
  }

  async updateItem(userId: string, mealId: string, itemId: string, input: UpdateItemInput): Promise<Meal | null> {
    const { containers } = await getCosmos();
    const { resource: existing } = await containers.nutritionDiaryMeals
      .item(mealId, userId)
      .read<Meal>();
    if (!existing) return null;

    const item = existing.items.find((i) => i.id === itemId);
    if (!item) return null;

    item.quantity = input.quantity;
    item.unit = input.unit;
    item.macros = input.macros;

    const { resource: updated } = await containers.nutritionDiaryMeals
      .item(mealId, userId)
      .replace<Meal>(existing);
    return updated ?? existing;
  }

  async deleteItem(userId: string, mealId: string, itemId: string): Promise<Meal | null> {
    const { containers } = await getCosmos();
    const { resource: existing } = await containers.nutritionDiaryMeals
      .item(mealId, userId)
      .read<Meal>();
    if (!existing) return null;

    const before = existing.items.length;
    existing.items = existing.items.filter((i) => i.id !== itemId);
    if (existing.items.length === before) return null;

    const { resource: updated } = await containers.nutritionDiaryMeals
      .item(mealId, userId)
      .replace<Meal>(existing);
    return updated ?? existing;
  }

  async deleteMeal(userId: string, mealId: string): Promise<boolean> {
    const { containers } = await getCosmos();
    try {
      await containers.nutritionDiaryMeals.item(mealId, userId).delete();
      return true;
    } catch (e) {
      if (typeof e === 'object' && e !== null && 'code' in e && (e as { code?: number }).code === 404) {
        return false;
      }
      throw e;
    }
  }

  async countBySourceId(userId: string, sourceId: string): Promise<number> {
    const { containers } = await getCosmos();
    const { resources } = await containers.nutritionDiaryMeals.items
      .query<Meal>(
        {
          query: 'SELECT * FROM c WHERE c.userId = @userId AND EXISTS(SELECT VALUE i FROM i IN c.items WHERE i.sourceId = @sourceId)',
          parameters: [
            { name: '@userId', value: userId },
            { name: '@sourceId', value: sourceId },
          ],
        },
        { partitionKey: userId },
      )
      .fetchAll();
    return resources.reduce(
      (sum, meal) => sum + (meal.items ?? []).filter((i) => i.sourceId === sourceId).length,
      0,
    );
  }

  async updateMacrosBySourceId(
    userId: string,
    sourceId: string,
    newNutritionPer100g: import('@fittrack/shared').NutritionValues,
    newPortionWeightGrams?: number,
  ): Promise<number> {
    const { containers } = await getCosmos();
    const { resources } = await containers.nutritionDiaryMeals.items
      .query<Meal>(
        {
          query: 'SELECT * FROM c WHERE c.userId = @userId AND EXISTS(SELECT VALUE i FROM i IN c.items WHERE i.sourceId = @sourceId)',
          parameters: [
            { name: '@userId', value: userId },
            { name: '@sourceId', value: sourceId },
          ],
        },
        { partitionKey: userId },
      )
      .fetchAll();

    let count = 0;
    for (const meal of resources) {
      let changed = false;
      for (const item of meal.items ?? []) {
        if (item.sourceId !== sourceId) continue;
        item.macros = recalcMacros(item, newNutritionPer100g, newPortionWeightGrams);
        changed = true;
        count++;
      }
      if (changed) {
        await containers.nutritionDiaryMeals.item(meal.id, userId).replace<Meal>(meal);
      }
    }
    return count;
  }

  async listAllMeals(
    userId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<{ meals: Meal[]; cursor?: string }> {
    const { containers } = await getCosmos();
    const limit = Math.min(options?.limit ?? 50, 100);
    const iterator = containers.nutritionDiaryMeals.items.query<Meal>(
      {
        query: 'SELECT * FROM c WHERE c.userId = @userId ORDER BY c.date ASC',
        parameters: [{ name: '@userId', value: userId }],
      },
      {
        partitionKey: userId,
        maxItemCount: limit,
        ...(options?.cursor ? { continuationToken: options.cursor } : {}),
      },
    );
    const page = await iterator.fetchNext();
    return {
      meals: page.resources,
      cursor: page.hasMoreResults ? page.continuationToken : undefined,
    };
  }
}
