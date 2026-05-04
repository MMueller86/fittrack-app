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
} from './diaryRepository';
import { computeSummary } from './diaryRepository';

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
      sourceType: 'manual',
      quantity: input.quantity ?? 1,
      unit: input.unit ?? 'serving',
      macros: {
        calories: input.calories,
        proteinG: input.proteinG,
        carbsG: input.carbsG,
        fatG: input.fatG,
        fiberG: input.fiberG,
      },
    };
    existing.items = [...(existing.items ?? []), newItem];

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
}
