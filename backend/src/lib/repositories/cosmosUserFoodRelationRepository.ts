// Cosmos-backed implementation of UserFoodRelationRepository.
// Container: userFoodRelations, partition key: /userId

import type { UserFoodRelation, UpsertUserFoodRelationInput, FoodRefType } from '@fittrack/shared';
import { getCosmos } from '../cosmos';
import type { UserFoodRelationRepository } from './userFoodRelationRepository';

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
  ): Promise<UserFoodRelation> {
    const { containers } = await getCosmos();
    const existing = await this.getByFoodRef(userId, foodRef);
    const id = this.makeId(userId, foodRef);
    const relation: UserFoodRelation = existing
      ? { ...existing, isFavorite, displayName, displayBrand, ...(imageUrl !== undefined ? { imageUrl } : {}) }
      : {
          id,
          userId,
          foodRef,
          foodRefType,
          displayName,
          displayBrand,
          ...(imageUrl ? { imageUrl } : {}),
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
      const relation: UserFoodRelation = existing
        ? {
            ...existing,
            lastUsedAt: now,
            usageCount: existing.usageCount + 1,
            displayName: input.displayName,
            displayBrand: input.displayBrand,
            // imageUrl aktualisieren wenn neu geliefert (überschreibt nie mit null wenn bereits gesetzt)
            ...(input.imageUrl != null ? { imageUrl: input.imageUrl } : {}),
            ...(input.lastInputMode !== undefined ? { lastInputMode: input.lastInputMode } : {}),
            ...(input.lastInputAmount !== undefined ? { lastInputAmount: input.lastInputAmount } : {}),
          }
        : {
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
          };
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
}
