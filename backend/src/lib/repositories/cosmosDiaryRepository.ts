// Cosmos-backed implementation of DiaryRepository.
// Container: nutritionDiaryMeals, partition key: /userId
//
// Each document IS a Meal (id = meal id, userId = partition key).
// Items are stored embedded inside the Meal document — this avoids
// cross-partition joins and keeps meal reads cheap.

import { randomUUID } from 'node:crypto';
import type { OperationInput } from '@azure/cosmos';
import type {
  DiaryBulkDeleteRequest,
  DiaryBulkDeleteResponse,
  DiaryBulkCopyRequest,
  DiaryBulkCopyResponse,
  DiaryBulkMoveRequest,
  DiaryBulkMoveResponse,
  Meal,
  MealItem,
} from '@fittrack/shared';
import { getCosmos } from '../cosmos';
import type {
  AddItemInput,
  CreateMealInput,
  DiaryBulkMutationErrorCode,
  DiaryDayResult,
  DiaryRepository,
  UpdateItemInput,
} from './diaryRepository';
import {
  assertDiaryBulkBatchLimits,
  computeSummary,
  DiaryBulkMutationError,
  groupDiaryItemReferences,
  recalcMacros,
  resolveDiaryBulkSourceMeals,
} from './diaryRepository';

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

  async bulkDeleteItems(
    userId: string,
    request: DiaryBulkDeleteRequest,
  ): Promise<DiaryBulkDeleteResponse> {
    const { containers } = await getCosmos();
    const container = containers.nutritionDiaryMeals;
    const groupedReferences = groupDiaryItemReferences(request.items);
    const mealRecords = await Promise.all([...groupedReferences.keys()].map(async (mealId) => {
      const record = await this.readBulkMeal(container, userId, mealId);
      return [mealId, record] as const;
    }));
    const recordsById = new Map<string, { meal: Meal; etag: string }>();
    for (const [mealId, record] of mealRecords) {
      if (record) recordsById.set(mealId, record);
    }
    const mealsById = new Map([...recordsById].map(([mealId, record]) => [mealId, record.meal]));
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
    const operations: OperationInput[] = [...updatedMeals.values()].map((meal) => ({
      operationType: 'Replace',
      id: meal.id,
      resourceBody: meal,
      ifMatch: recordsById.get(meal.id)!.etag,
    } as unknown as OperationInput));
    assertDiaryBulkBatchLimits(operations);
    await this.executeBulkBatch(container, userId, operations);

    return {
      deletedCount: request.items.length,
      deletedItemIds: request.items.map((reference) => reference.itemId),
    };
  }

  async bulkMoveItems(
    userId: string,
    request: DiaryBulkMoveRequest,
  ): Promise<DiaryBulkMoveResponse> {
    const { containers } = await getCosmos();
    const container = containers.nutritionDiaryMeals;
    const groupedReferences = groupDiaryItemReferences(request.items);
    const sourceMealIds = [...groupedReferences.keys()];
    const targetMealId = 'mealId' in request.target ? request.target.mealId : undefined;
    const newMealType = 'newMealType' in request.target ? request.target.newMealType : undefined;
    if (Boolean(targetMealId) === Boolean(newMealType)) {
      throw new DiaryBulkMutationError('invalid_diary_bulk_request');
    }
    if (targetMealId && groupedReferences.has(targetMealId)) {
      throw new DiaryBulkMutationError('invalid_diary_bulk_request');
    }

    const mealIdsToRead = [...sourceMealIds, ...(targetMealId ? [targetMealId] : [])];
    const mealRecords = await Promise.all(mealIdsToRead.map(async (mealId) => {
      const record = await this.readBulkMeal(container, userId, mealId);
      return [mealId, record] as const;
    }));
    const recordsById = new Map<string, { meal: Meal; etag: string }>();
    for (const [mealId, record] of mealRecords) {
      if (record) recordsById.set(mealId, record);
    }
    const mealsById = new Map([...recordsById].map(([mealId, record]) => [mealId, record.meal]));
    const sourceMeals = resolveDiaryBulkSourceMeals(
      userId,
      request.sourceDate,
      groupedReferences,
      mealsById,
    );

    let targetMeal: Meal;
    let isNewTarget = false;
    if (targetMealId) {
      const targetRecord = recordsById.get(targetMealId);
      if (!targetRecord || targetRecord.meal.date !== request.sourceDate) {
        throw new DiaryBulkMutationError('diary_bulk_reference_not_found');
      }
      targetMeal = targetRecord.meal;
    } else if (newMealType) {
      targetMeal = {
        id: randomUUID(),
        userId,
        date: request.sourceDate,
        type: newMealType,
        name: newMealType.charAt(0).toUpperCase() + newMealType.slice(1),
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
    const operations: OperationInput[] = [];
    for (const meal of updatedSources.values()) {
      operations.push({
        operationType: 'Replace',
        id: meal.id,
        resourceBody: meal,
        ifMatch: recordsById.get(meal.id)!.etag,
      } as unknown as OperationInput);
    }
    if (isNewTarget) {
      operations.push({
        operationType: 'Create',
        resourceBody: updatedTarget,
      } as unknown as OperationInput);
    } else {
      operations.push({
        operationType: 'Replace',
        id: updatedTarget.id,
        resourceBody: updatedTarget,
        ifMatch: recordsById.get(updatedTarget.id)!.etag,
      } as unknown as OperationInput);
    }
    assertDiaryBulkBatchLimits(operations);
    await this.executeBulkBatch(container, userId, operations);

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
    const { containers } = await getCosmos();
    const container = containers.nutritionDiaryMeals;
    const groupedReferences = groupDiaryItemReferences(request.items);
    const targetMealId = 'mealId' in request.target ? request.target.mealId : undefined;
    const newMealType = 'newMealType' in request.target ? request.target.newMealType : undefined;
    if (Boolean(targetMealId) === Boolean(newMealType)) {
      throw new DiaryBulkMutationError('invalid_diary_bulk_request');
    }

    const mealIdsToRead = [...new Set([
      ...groupedReferences.keys(),
      ...(targetMealId ? [targetMealId] : []),
    ])];
    const mealRecords = await Promise.all(mealIdsToRead.map(async (mealId) => {
      const record = await this.readBulkMeal(container, userId, mealId);
      return [mealId, record] as const;
    }));
    const recordsById = new Map<string, { meal: Meal; etag: string }>();
    for (const [mealId, record] of mealRecords) {
      if (record) recordsById.set(mealId, record);
    }
    const mealsById = new Map([...recordsById].map(([mealId, record]) => [mealId, record.meal]));
    const sourceMeals = resolveDiaryBulkSourceMeals(
      userId,
      request.sourceDate,
      groupedReferences,
      mealsById,
    );

    let targetMeal: Meal;
    let targetEtag: string | undefined;
    let isNewTarget = false;
    if (targetMealId) {
      const targetRecord = recordsById.get(targetMealId);
      if (!targetRecord || targetRecord.meal.date !== request.targetDate) {
        throw new DiaryBulkMutationError('diary_bulk_reference_not_found');
      }
      targetMeal = targetRecord.meal;
      targetEtag = targetRecord.etag;
    } else if (newMealType) {
      targetMeal = {
        id: randomUUID(),
        userId,
        date: request.targetDate,
        type: newMealType,
        name: newMealType.charAt(0).toUpperCase() + newMealType.slice(1),
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
    const operations: OperationInput[] = isNewTarget
      ? [{ operationType: 'Create', resourceBody: updatedTarget } as unknown as OperationInput]
      : [{
          operationType: 'Replace',
          id: updatedTarget.id,
          resourceBody: updatedTarget,
          ifMatch: targetEtag,
        } as unknown as OperationInput];
    assertDiaryBulkBatchLimits(operations);
    await this.executeBulkBatch(container, userId, operations);

    return { copiedCount: copiedItems.length, targetMeal: updatedTarget };
  }

  private async readBulkMeal(
    container: Awaited<ReturnType<typeof getCosmos>>['containers']['nutritionDiaryMeals'],
    userId: string,
    mealId: string,
  ): Promise<{ meal: Meal; etag: string } | null> {
    try {
      const response = await container.item(mealId, userId).read<Meal>();
      if (!response.resource) return null;
      if (!response.etag) throw new Error('Cosmos diary meal read returned no ETag');
      return { meal: response.resource, etag: response.etag };
    } catch (error) {
      if (cosmosStatusCode(error) === 404) return null;
      throw error;
    }
  }

  private async executeBulkBatch(
    container: Awaited<ReturnType<typeof getCosmos>>['containers']['nutritionDiaryMeals'],
    userId: string,
    operations: OperationInput[],
  ): Promise<void> {
    const response = await container.items.batch(operations, userId);
    const operationResults = response.result ?? [];
    const responseCode = response.code ?? 500;
    const operationStatusCodes = operationResults.map((operation) => operation.statusCode);
    const statusCodes = [responseCode, ...operationStatusCodes];
    const failed = operationResults.find((operation) => operation.statusCode < 200 || operation.statusCode >= 300);
    if (!failed && responseCode < 400) return;

    const statusCode = failed?.statusCode ?? responseCode;
    if (statusCodes.includes(409) || statusCodes.includes(412)) {
      throw new DiaryBulkMutationError('diary_bulk_conflict');
    }
    if (statusCodes.includes(413)) {
      throw new DiaryBulkMutationError('diary_bulk_operation_limit_exceeded');
    }
    if (statusCodes.includes(404)) throw new DiaryBulkMutationError('diary_bulk_reference_not_found');
    throw new Error(`Cosmos diary bulk batch failed with status ${statusCode}`);
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

function cosmosStatusCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  if ('code' in error && typeof error.code === 'number') return error.code;
  if ('statusCode' in error && typeof error.statusCode === 'number') return error.statusCode;
  return undefined;
}
