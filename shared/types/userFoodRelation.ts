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

export type FoodRefType = 'catalog' | 'personal';

export interface UserFoodRelation {
  /** userId + ":" + foodRef — zusammengesetzter Primärschlüssel */
  id: string;
  /** Partition Key */
  userId: string;
  /**
   * Opake Referenz auf das Lebensmittel.
   * - OFF-Katalog: "openFoodFacts:<barcode>"
   * - ReusableItem: UUID
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
}

/** Input zum Anlegen oder Aktualisieren einer UserFoodRelation (upsert-Semantik) */
export interface UpsertUserFoodRelationInput {
  foodRef: string;
  foodRefType: FoodRefType;
  displayName: string;
  displayBrand?: string;
  /** Letzter Eingabemodus — wird bei recordUsage gespeichert */
  lastInputMode?: 'grams' | 'portion';
  /** Letzte Eingabemenge — wird bei recordUsage gespeichert */
  lastInputAmount?: number;
}
