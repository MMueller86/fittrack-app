// UserFoodRelation repository abstraction.
//
// Verwaltet die nutzerspezifische Beziehung zwischen Nutzer und Lebensmittel.
// Unabhängig von der Quelle (OFF-Katalog oder persönliche Bibliothek).

import { isCosmosConfigured } from '../cosmos';
import { CosmosUserFoodRelationRepository } from './cosmosUserFoodRelationRepository';
import type { UserFoodRelation, UpsertUserFoodRelationInput, FoodRefType } from '@fittrack/shared';

export interface UserFoodRelationRepository {
  /**
   * Erstellt einen neuen Eintrag oder aktualisiert Anzeigeinformationen.
   * Setzt isFavorite, lastUsedAt und usageCount NICHT zurück.
   */
  upsert(userId: string, input: UpsertUserFoodRelationInput): Promise<UserFoodRelation>;

  /** Setzt isFavorite. Legt die Relation an wenn sie noch nicht existiert. */
  setFavorite(userId: string, foodRef: string, foodRefType: FoodRefType, displayName: string, displayBrand: string | undefined, isFavorite: boolean): Promise<UserFoodRelation>;

  /** Gibt alle Favoriten zurück (isFavorite=true), sortiert nach displayName. */
  listFavorites(userId: string): Promise<UserFoodRelation[]>;

  /**
   * Gibt die zuletzt verwendeten Einträge zurück, sortiert nach lastUsedAt DESC.
   * @param limit Maximalanzahl — Standard 10.
   */
  listRecent(userId: string, limit?: number): Promise<UserFoodRelation[]>;

  /**
   * Gibt die häufigsten Einträge zurück, sortiert nach usageCount DESC.
   * Nur Einträge mit usageCount > 0 werden berücksichtigt.
   * @param limit Maximalanzahl — Standard 10.
   */
  listFrequent(userId: string, limit?: number): Promise<UserFoodRelation[]>;

  /**
   * Zeichnet eine Verwendung auf: lastUsedAt = jetzt, usageCount++.
   * Legt die Relation an wenn sie noch nicht existiert.
   * Fire-and-forget sicher — Fehler werden intern geloggt.
   */
  recordUsage(userId: string, input: UpsertUserFoodRelationInput): Promise<void>;

  /** Gibt einen Eintrag anhand von userId + foodRef zurück. */
  getByFoodRef(userId: string, foodRef: string): Promise<UserFoodRelation | null>;
}

// ---------------------------------------------------------------------------
// In-Memory-Implementierung (für lokale Entwicklung ohne Cosmos)
// ---------------------------------------------------------------------------

class InMemoryUserFoodRelationRepository implements UserFoodRelationRepository {
  private readonly store = new Map<string, UserFoodRelation>();

  private key(userId: string, foodRef: string): string {
    return `${userId}:${foodRef}`;
  }

  async upsert(userId: string, input: UpsertUserFoodRelationInput): Promise<UserFoodRelation> {
    const existing = this.store.get(this.key(userId, input.foodRef));
    const relation: UserFoodRelation = existing
      ? { ...existing, displayName: input.displayName, displayBrand: input.displayBrand }
      : {
          id: `${userId}:${input.foodRef}`,
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
    this.store.set(this.key(userId, input.foodRef), relation);
    return relation;
  }

  async setFavorite(userId: string, foodRef: string, foodRefType: FoodRefType, displayName: string, displayBrand: string | undefined, isFavorite: boolean): Promise<UserFoodRelation> {
    const existing = this.store.get(this.key(userId, foodRef));
    const relation: UserFoodRelation = existing
      ? { ...existing, isFavorite }
      : {
          id: `${userId}:${foodRef}`,
          userId,
          foodRef,
          foodRefType,
          displayName,
          displayBrand,
          isFavorite,
          lastUsedAt: null,
          usageCount: 0,
          createdAt: new Date().toISOString(),
        };
    this.store.set(this.key(userId, foodRef), relation);
    return relation;
  }

  async listFavorites(userId: string): Promise<UserFoodRelation[]> {
    return [...this.store.values()]
      .filter((r) => r.userId === userId && r.isFavorite)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  async listRecent(userId: string, limit = 10): Promise<UserFoodRelation[]> {
    return [...this.store.values()]
      .filter((r) => r.userId === userId && r.lastUsedAt !== null)
      .sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? ''))
      .slice(0, limit);
  }

  async listFrequent(userId: string, limit = 10): Promise<UserFoodRelation[]> {
    return [...this.store.values()]
      .filter((r) => r.userId === userId && r.usageCount > 0)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }

  async recordUsage(userId: string, input: UpsertUserFoodRelationInput): Promise<void> {
    const existing = this.store.get(this.key(userId, input.foodRef));
    const now = new Date().toISOString();
    const relation: UserFoodRelation = existing
      ? { ...existing, lastUsedAt: now, usageCount: existing.usageCount + 1 }
      : {
          id: `${userId}:${input.foodRef}`,
          userId,
          foodRef: input.foodRef,
          foodRefType: input.foodRefType,
          displayName: input.displayName,
          displayBrand: input.displayBrand,
          isFavorite: false,
          lastUsedAt: now,
          usageCount: 1,
          createdAt: now,
        };
    this.store.set(this.key(userId, input.foodRef), relation);
  }

  async getByFoodRef(userId: string, foodRef: string): Promise<UserFoodRelation | null> {
    return this.store.get(this.key(userId, foodRef)) ?? null;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let instance: UserFoodRelationRepository | undefined;

export function getUserFoodRelationRepository(): UserFoodRelationRepository {
  if (!instance) {
    instance = isCosmosConfigured()
      ? new CosmosUserFoodRelationRepository()
      : new InMemoryUserFoodRelationRepository();
  }
  return instance;
}
