import type { NutritionValues, PortionInfo, MealType } from './diary';

// UserFoodRelation — nutzerspezifische Beziehung zwischen einem Nutzer und einem Lebensmittel.
//
// Ist unabhängig davon, ob das Lebensmittel aus dem OFF-Katalog (FoodProduct) oder
// aus der persönlichen Bibliothek (ReusableItem) stammt.
// Diese Entität ist die einzige Quelle der Wahrheit für:
//   - Favoriten
//   - zuletzt verwendet (lastUsedAt)
//   - Nutzungshäufigkeit (usageCount)
//
// Cosmos: container "userFoodRelations", partition key /userId

export type FoodRefType = 'catalog' | 'personal' | 'recipe';

export interface UserFoodRelation {
  /** userId + ":" + foodRef — zusammengesetzter Primärschlüssel */
  id: string;
  /** Partition Key */
  userId: string;
  /**
   * Opake Referenz auf das Lebensmittel.
   * - OFF-Katalog: "openFoodFacts:<barcode>"
   * - ReusableItem: UUID
   * - Rezept: UUID
   */
  foodRef: string;
  /**
   * Typ der Referenz — wird nur für den Detail-Lookup benötigt,
   * nie für Sortier- oder Filterabfragen.
   */
  foodRefType: FoodRefType;
  /** Denormalisierter Anzeigename (für schnelles Rendering ohne Join) */
  displayName: string;
  /** Denormalisierter Markenname (optional) */
  displayBrand?: string;
  /** Denormalisiertes Produktbild (URL, für Favoriten-Chips ohne extra Lookup) */
  imageUrl?: string | null;
  /** True wenn der Nutzer dieses Lebensmittel als Favorit markiert hat */
  isFavorite: boolean;
  /** ISO-Timestamp der letzten Verwendung im Tagebuch. Null = noch nie verwendet. */
  lastUsedAt: string | null;
  /** Anzahl der Verwendungen im Tagebuch */
  usageCount: number;
  /** Letzter Eingabemodus (Gramm oder Portion) — für UX-Vorbelegen */
  lastInputMode?: 'grams' | 'portion';
  /** Letzte Eingabemenge — für UX-Vorbelegen */
  lastInputAmount?: number;
  /** ISO-Timestamp der Ersterstellung dieses Eintrags */
  createdAt: string;
  /**
   * ISO-8601 timestamp when the user first marked this item as a Quick Entry favourite.
   * Set on the isFavorite: false → true transition only. Never overwritten.
   * Used by the Quick Entry relevance engine for novelty scoring.
   */
  favoritedAt?: string;
  /** Denormalized nutrition per 100g — enables instant QuantityView without a search call */
  nutritionPer100g?: NutritionValues;
  /** Denormalized portion info */
  portion?: PortionInfo | null;
  /** True wenn Nährwertdaten vollständig vorhanden sind */
  isComplete?: boolean;
  /**
   * Preferred input mode — updated via running score on each recordUsage call.
   * Score +1 for 'portion', -1 for 'grams', clamped to [-10, +10].
   * Score > 0 → 'portion'; score <= 0 → 'grams'.
   */
  preferredInputMode?: 'grams' | 'portion';
  /**
   * Structured usage date entries for this item.
   * Each entry records the date (YYYY-MM-DD) and meal type of a diary addition.
   * Trimmed to entries within the last 90 days on every recordUsage call.
   * Old string entries are discarded on read (self-cleaning migration).
   */
  usageDates?: Array<{ date: string; mealType: MealType }>;
  /**
   * Preferred input amount — EMA-updated (alpha = EMA_ALPHA constant = 0.3).
   * Grams when preferredInputMode='grams'; portion count when 'portion'.
   */
  preferredInputAmount?: number;
  /** Internal: running score for input mode tracking. Not exposed as business logic. */
  inputModeScore?: number;
}

/** Input zum Anlegen oder Aktualisieren einer UserFoodRelation (upsert-Semantik) */
export interface UpsertUserFoodRelationInput {
  foodRef: string;
  foodRefType: FoodRefType;
  displayName: string;
  displayBrand?: string;
  /** Produktbild-URL — wird denormalisiert gespeichert für Favoriten-Chips */
  imageUrl?: string | null;
  /** Letzter Eingabemodus — wird bei recordUsage gespeichert */
  lastInputMode?: 'grams' | 'portion';
  /** Letzte Eingabemenge — wird bei recordUsage gespeichert */
  lastInputAmount?: number;
  /** Denormalized nutrition per 100g */
  nutritionPer100g?: NutritionValues;
  /** Denormalized portion info */
  portion?: PortionInfo | null;
  /** Meal type of the diary entry being recorded — stored in usageDates entries */
  mealType?: MealType;
}

/** @deprecated Use GET /api/favorites?context=MealType with backend scoring instead. */
export interface QuickEntryGroupedResponse {
  /** Favorites with no mealTypeCounts (or all zero) — shown above tab strip */
  ungrouped: UserFoodRelation[];
  /** Per-meal-type groups — only populated when total favorites > 10 */
  groups: {
    mealType: MealType;
    label: string;
    entries: UserFoodRelation[];
  }[];
  /** Flat list of all favorites — used for ≤10 flat display mode */
  all: UserFoodRelation[];
}
