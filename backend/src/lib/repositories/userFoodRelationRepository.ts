// UserFoodRelation repository abstraction.
//
// Verwaltet die nutzerspezifische Beziehung zwischen Nutzer und Lebensmittel.
// Unabhängig von der Quelle (OFF-Katalog oder persönliche Bibliothek).

import { isCosmosConfigured } from '../cosmos';
import { CosmosUserFoodRelationRepository } from './cosmosUserFoodRelationRepository';
import type { UserFoodRelation, UpsertUserFoodRelationInput, FoodRefType, NutritionValues, PortionInfo } from '@fittrack/shared';

/** Running score alpha for EMA of preferredInputAmount */
export const EMA_ALPHA = 0.3;

export interface UserFoodRelationRepository {
  /**
   * Erstellt einen neuen Eintrag oder aktualisiert Anzeigeinformationen.
   * Setzt isFavorite, lastUsedAt und usageCount NICHT zurück.
   */
  upsert(userId: string, input: UpsertUserFoodRelationInput): Promise<UserFoodRelation>;

  /** Setzt isFavorite. Legt die Relation an wenn sie noch nicht existiert. */
  setFavorite(
    userId: string,
    foodRef: string,
    foodRefType: FoodRefType,
    displayName: string,
    displayBrand: string | undefined,
    isFavorite: boolean,
    imageUrl?: string,
    nutritionPer100g?: NutritionValues,
    portion?: PortionInfo | null,
  ): Promise<UserFoodRelation>;

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

  /** Gibt alle Einträge eines Nutzers für einen bestimmten foodRef zurück. */
  listByFoodRef(userId: string, foodRef: string): Promise<UserFoodRelation[]>;

  /**
   * Aktualisiert nutritionPer100g und portion in allen UserFoodRelations für einen foodRef.
   * Für denormalisierte Daten-Synchronisation nach einer Produktbearbeitung.
   */
  updateNutritionDenormalized(
    userId: string,
    foodRef: string,
    nutritionPer100g: NutritionValues,
    portion: PortionInfo | null,
  ): Promise<void>;
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
    const existing = this.store.get(this.key(userId, foodRef));
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
          id: `${userId}:${foodRef}`,
          userId,
          foodRef,
          foodRefType,
          displayName,
          displayBrand,
          isFavorite,
          ...(imageUrl ? { imageUrl } : {}),
          ...(nutritionPer100g ? { nutritionPer100g } : {}),
          ...(portion != null ? { portion } : {}),
          ...(isFavorite ? { favoritedAt: new Date().toISOString() } : {}),
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

    let relation: UserFoodRelation = existing
      ? {
          ...existing,
          lastUsedAt: now,
          usageCount: existing.usageCount + 1,
          displayName: input.displayName,
          displayBrand: input.displayBrand,
          ...(input.imageUrl != null ? { imageUrl: input.imageUrl } : {}),
          ...(input.lastInputMode !== undefined ? { lastInputMode: input.lastInputMode } : {}),
          ...(input.lastInputAmount !== undefined ? { lastInputAmount: input.lastInputAmount } : {}),
        }
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

    // usageDates — append today and trim to last 90 days
    const today = new Date().toISOString().substring(0, 10);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
    const existingDates = relation.usageDates ?? [];
    relation = { ...relation, usageDates: [...existingDates, today].filter(d => d >= ninetyDaysAgo) };

    // mealTypeCounts
    if (input.mealType) {
      const counts: Partial<Record<string, number>> = { ...(relation.mealTypeCounts ?? {}) };
      counts[input.mealType] = (counts[input.mealType] ?? 0) + 1;
      relation = { ...relation, mealTypeCounts: counts as UserFoodRelation['mealTypeCounts'] };
    }

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

    this.store.set(this.key(userId, input.foodRef), relation);
  }

  async getByFoodRef(userId: string, foodRef: string): Promise<UserFoodRelation | null> {
    return this.store.get(this.key(userId, foodRef)) ?? null;
  }

  async listByFoodRef(userId: string, foodRef: string): Promise<UserFoodRelation[]> {
    const entry = this.store.get(this.key(userId, foodRef));
    return entry ? [entry] : [];
  }

  async updateNutritionDenormalized(
    userId: string,
    foodRef: string,
    nutritionPer100g: NutritionValues,
    portion: PortionInfo | null,
  ): Promise<void> {
    const existing = this.store.get(this.key(userId, foodRef));
    if (existing) {
      this.store.set(this.key(userId, foodRef), { ...existing, nutritionPer100g, portion });
    }
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

export function __resetUserFoodRelationRepositoryForTests(): void {
  instance = undefined;
}
