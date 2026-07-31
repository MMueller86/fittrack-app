// Cosmos-backed implementation of UserFoodRelationRepository.
// Container: userFoodRelations, partition key: /userId

import type { UserFoodRelation, UpsertUserFoodRelationInput, FoodRefType, NutritionValues, PortionInfo } from '@fittrack/shared';
import { getCosmos } from '../cosmos';
import { EMA_ALPHA, type UserFoodRelationRepository } from './userFoodRelationRepository';

export class CosmosUserFoodRelationRepository implements UserFoodRelationRepository {

  private makeId(userId: string, foodRef: string): string {
    return `${userId}:${foodRef}`;
  }

  async upsert(userId: string, input: UpsertUserFoodRelationInput): Promise<UserFoodRelation> {
    const { containers } = await getCosmos();
    const id = this.makeId(userId, input.foodRef);
    const existing = await this.getByFoodRef(userId, input.foodRef);
    if (existing) {
      const updated: UserFoodRelation = {
        ...existing,
        displayName: input.displayName,
        displayBrand: input.displayBrand,
      };
      await containers.userFoodRelations.items.upsert(updated);
      return updated;
    }
    const relation: UserFoodRelation = {
      id,
      userId,
      foodRef: input.foodRef,
      foodRefType: input.foodRefType,
      displayName: input.displayName,
      displayBrand: input.displayBrand,
      isFavorite: false,
      lastUsedAt: null,
      usageCount: 0,
      createdAt: new Date().toISOString(),
    };
    await containers.userFoodRelations.items.upsert(relation);
    return relation;
  }

  async setFavorite(
    userId: string,
    foodRef: string,
    foodRefType: FoodRefType,
    displayName: string,
    displayBrand: string | undefined,
    isFavorite: boolean,
    imageUrl?: string,
    nutritionPer100g?: NutritionValues,
    portion?: PortionInfo | null,
  ): Promise<UserFoodRelation> {
    const { containers } = await getCosmos();
    const existing = await this.getByFoodRef(userId, foodRef);
    const id = this.makeId(userId, foodRef);
    const relation: UserFoodRelation = existing
      ? {
          ...existing,
          isFavorite,
          displayName,
          displayBrand,
          ...(imageUrl !== undefined ? { imageUrl } : {}),
          ...(nutritionPer100g !== undefined ? { nutritionPer100g } : {}),
          ...(portion !== undefined ? { portion } : {}),
          ...(isFavorite && !existing.favoritedAt ? { favoritedAt: new Date().toISOString() } : {}),
        }
      : {
          id,
          userId,
          foodRef,
          foodRefType,
          displayName,
          displayBrand,
          ...(imageUrl ? { imageUrl } : {}),
          ...(nutritionPer100g ? { nutritionPer100g } : {}),
          ...(portion != null ? { portion } : {}),
          ...(isFavorite ? { favoritedAt: new Date().toISOString() } : {}),
          isFavorite,
          lastUsedAt: null,
          usageCount: 0,
          createdAt: new Date().toISOString(),
        };
    await containers.userFoodRelations.items.upsert(relation);
    return relation;
  }

  async listFavorites(userId: string): Promise<UserFoodRelation[]> {
    const { containers } = await getCosmos();
    const { resources } = await containers.userFoodRelations.items
      .query<UserFoodRelation>(
        {
          query: 'SELECT * FROM c WHERE c.userId = @userId AND c.isFavorite = true ORDER BY c.displayName ASC',
          parameters: [{ name: '@userId', value: userId }],
        },
        { partitionKey: userId },
      )
      .fetchAll();
    return resources;
  }

  async listRecent(userId: string, limit = 10): Promise<UserFoodRelation[]> {
    const { containers } = await getCosmos();
    const { resources } = await containers.userFoodRelations.items
      .query<UserFoodRelation>(
        {
          query: `SELECT TOP ${limit} * FROM c WHERE c.userId = @userId AND c.lastUsedAt != null ORDER BY c.lastUsedAt DESC`,
          parameters: [{ name: '@userId', value: userId }],
        },
        { partitionKey: userId },
      )
      .fetchAll();
    return resources;
  }

  async recordUsage(userId: string, input: UpsertUserFoodRelationInput): Promise<void> {
    try {
      const { containers } = await getCosmos();
      const now = new Date().toISOString();
      const existing = await this.getByFoodRef(userId, input.foodRef);
      const id = this.makeId(userId, input.foodRef);

      // Fix C: drop mealTypeCounts from existing doc spread (self-cleaning)
      let relation: UserFoodRelation;
      if (existing) {
        const { mealTypeCounts: _dropped, ...existingWithoutLegacy } = existing as UserFoodRelation & { mealTypeCounts?: unknown };
        relation = {
          ...existingWithoutLegacy,
          lastUsedAt: now,
          usageCount: existing.usageCount + 1,
          displayName: input.displayName,
          displayBrand: input.displayBrand,
          // imageUrl aktualisieren wenn neu geliefert (überschreibt nie mit null wenn bereits gesetzt)
          ...(input.imageUrl != null ? { imageUrl: input.imageUrl } : {}),
          ...(input.lastInputMode !== undefined ? { lastInputMode: input.lastInputMode } : {}),
          ...(input.lastInputAmount !== undefined ? { lastInputAmount: input.lastInputAmount } : {}),
        };
      } else {
        // Fix A: new-document path includes lastInputMode and lastInputAmount
        relation = {
          id,
          userId,
          foodRef: input.foodRef,
          foodRefType: input.foodRefType,
          displayName: input.displayName,
          displayBrand: input.displayBrand,
          imageUrl: input.imageUrl ?? null,
          isFavorite: false,
          lastUsedAt: now,
          usageCount: 1,
          createdAt: now,
          ...(input.lastInputMode !== undefined ? { lastInputMode: input.lastInputMode } : {}),
          ...(input.lastInputAmount !== undefined ? { lastInputAmount: input.lastInputAmount } : {}),
        };
      }

      // Fix B: usageDates — append {date, mealType} entry, drop old string entries, trim to 90 days
      const today = new Date().toISOString().substring(0, 10);
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
      const existingEntries = (relation.usageDates ?? []).filter(
        (e): e is { date: string; mealType: import('@fittrack/shared').MealType } =>
          typeof e === 'object' && e !== null && 'date' in e,
      );
      const newEntry = { date: today, mealType: input.mealType ?? ('snack' as import('@fittrack/shared').MealType) };
      relation = {
        ...relation,
        usageDates: [...existingEntries, newEntry].filter(e => e.date >= ninetyDaysAgo),
      };

      // preferredInputMode via running score
      if (input.lastInputMode !== undefined) {
        const delta = input.lastInputMode === 'portion' ? 1 : -1;
        const currentScore = existing?.inputModeScore ?? 0;
        const newScore = Math.max(-10, Math.min(10, currentScore + delta));
        relation = { ...relation, inputModeScore: newScore, preferredInputMode: newScore > 0 ? 'portion' : 'grams' };
      }

      // preferredInputAmount via EMA
      if (input.lastInputAmount !== undefined) {
        const prev = existing?.preferredInputAmount;
        const incoming = input.lastInputAmount;
        const newAmount = prev === undefined
          ? incoming
          : EMA_ALPHA * incoming + (1 - EMA_ALPHA) * prev;
        relation = { ...relation, preferredInputAmount: newAmount };
      }

      await containers.userFoodRelations.items.upsert(relation);
    } catch (_err) {
      // Fire-and-forget — Fehler dürfen den Diary-Add nicht blockieren
    }
  }

  async getByFoodRef(userId: string, foodRef: string): Promise<UserFoodRelation | null> {
    const { containers } = await getCosmos();
    const id = this.makeId(userId, foodRef);
    try {
      const { resource } = await containers.userFoodRelations.item(id, userId).read<UserFoodRelation>();
      return resource ?? null;
    } catch {
      return null;
    }
  }

  async listFrequent(userId: string, limit = 10): Promise<UserFoodRelation[]> {
    const { containers } = await getCosmos();
    const { resources } = await containers.userFoodRelations.items
      .query<UserFoodRelation>(
        {
          query: `SELECT TOP ${limit} * FROM c WHERE c.userId = @userId AND c.usageCount > 0 ORDER BY c.usageCount DESC`,
          parameters: [{ name: '@userId', value: userId }],
        },
        { partitionKey: userId },
      )
      .fetchAll();
    return resources;
  }

  async listByFoodRef(userId: string, foodRef: string): Promise<UserFoodRelation[]> {
    const { containers } = await getCosmos();
    const { resources } = await containers.userFoodRelations.items
      .query<UserFoodRelation>(
        {
          query: 'SELECT * FROM c WHERE c.userId = @userId AND c.foodRef = @foodRef',
          parameters: [
            { name: '@userId', value: userId },
            { name: '@foodRef', value: foodRef },
          ],
        },
        { partitionKey: userId },
      )
      .fetchAll();
    return resources;
  }

  async updateNutritionDenormalized(
    userId: string,
    foodRef: string,
    nutritionPer100g: NutritionValues,
    portion: PortionInfo | null,
  ): Promise<void> {
    const { containers } = await getCosmos();
    const relations = await this.listByFoodRef(userId, foodRef);
    for (const relation of relations) {
      const updated: UserFoodRelation = { ...relation, nutritionPer100g, portion };
      await containers.userFoodRelations.items.upsert(updated);
    }
  }
}
