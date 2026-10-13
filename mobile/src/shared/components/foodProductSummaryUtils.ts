// Reine Hilfsfunktionen für FoodProductSummary (Thumbnail-Fallback, Nährwertzeile).

import type { NutritionBasis, NutritionValues, PortionInfo } from '@fittrack/shared';

// UX-Pattern: Produkt-Thumbnail 52 pt (docs/kb/product/05-ux-patterns.md).
export const FOOD_THUMBNAIL_SIZE = 52;

export function thumbnailLetter(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

// Eigene Produkte liefern teils nur einen Blob-Pfad statt einer URL — das ergibt keinen ladbaren Bild-URI.
export function isRemoteImageUri(uri?: string | null): uri is string {
  return typeof uri === 'string' && /^https?:\/\//i.test(uri);
}

export interface NutritionLineInput {
  nutrition?: NutritionValues;
  nutritionBasis: NutritionBasis;
  portion?: PortionInfo | null;
  isAiEstimate?: boolean;
}

// "251 kcal · EW 8 g · KH 43 g · F 3 g · je 100 g" — null, wenn keine Kaloriendaten vorliegen.
export function buildNutritionLine({
  nutrition,
  nutritionBasis,
  portion,
  isAiEstimate,
}: NutritionLineInput): string | null {
  if (!nutrition || nutrition.calories == null) return null;

  const parts: string[] = [`${Math.round(nutrition.calories)} kcal`];
  if (nutrition.protein != null) parts.push(`EW ${Math.round(nutrition.protein)} g`);
  if (nutrition.carbs != null) parts.push(`KH ${Math.round(nutrition.carbs)} g`);
  if (nutrition.fat != null) parts.push(`F ${Math.round(nutrition.fat)} g`);

  if (!isAiEstimate || portion) {
    if (nutritionBasis === 'per100g' || nutritionBasis === 'both') {
      parts.push('je 100 g');
    } else if (nutritionBasis === 'perPortion' && portion) {
      parts.push(
        portion.weightGrams
          ? `pro ${portion.label} (${Math.round(portion.weightGrams)} g)`
          : `pro ${portion.label}`,
      );
    }
  }

  return parts.join(' \u00b7 ');
}
