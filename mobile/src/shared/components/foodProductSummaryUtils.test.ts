import { describe, expect, it } from 'vitest';
import {
  FOOD_THUMBNAIL_SIZE,
  buildNutritionLine,
  isRemoteImageUri,
  thumbnailLetter,
} from './foodProductSummaryUtils';

describe('foodProductSummaryUtils', () => {
  it('uses the 52 pt UX-pattern thumbnail size', () => {
    expect(FOOD_THUMBNAIL_SIZE).toBe(52);
  });

  it('derives the avatar letter from the first character, falling back to "?"', () => {
    expect(thumbnailLetter('  haferflocken')).toBe('H');
    expect(thumbnailLetter('   ')).toBe('?');
  });

  it('accepts only http(s) URLs as image URIs (blob paths fall back to the avatar)', () => {
    expect(isRemoteImageUri('https://example.invalid/a.jpg')).toBe(true);
    expect(isRemoteImageUri('http://example.invalid/a.jpg')).toBe(true);
    expect(isRemoteImageUri('user-1/item-1.jpg')).toBe(false);
    expect(isRemoteImageUri(null)).toBe(false);
    expect(isRemoteImageUri(undefined)).toBe(false);
  });

  describe('buildNutritionLine', () => {
    const nutrition = { calories: 250.6, protein: 8.2, carbs: 43.4, fat: 3.1 };

    it('lists kcal and macros with the per-100 g reference', () => {
      expect(buildNutritionLine({ nutrition, nutritionBasis: 'per100g' })).toBe(
        '251 kcal \u00b7 EW 8 g \u00b7 KH 43 g \u00b7 F 3 g \u00b7 je 100 g',
      );
    });

    it('omits macros that are missing', () => {
      expect(buildNutritionLine({ nutrition: { calories: 90 } as typeof nutrition, nutritionBasis: 'both' })).toBe(
        '90 kcal \u00b7 je 100 g',
      );
    });

    it('references the portion for per-portion nutrition', () => {
      expect(
        buildNutritionLine({
          nutrition,
          nutritionBasis: 'perPortion',
          portion: { label: 'Scheibe', weightGrams: 30 },
        }),
      ).toBe('251 kcal \u00b7 EW 8 g \u00b7 KH 43 g \u00b7 F 3 g \u00b7 pro Scheibe (30 g)');
    });

    it('hides the reference for AI estimates without portion', () => {
      expect(buildNutritionLine({ nutrition, nutritionBasis: 'per100g', isAiEstimate: true })).toBe(
        '251 kcal \u00b7 EW 8 g \u00b7 KH 43 g \u00b7 F 3 g',
      );
    });

    it('returns null without calorie data', () => {
      expect(buildNutritionLine({ nutritionBasis: 'per100g' })).toBeNull();
      expect(buildNutritionLine({ nutrition: {} as typeof nutrition, nutritionBasis: 'per100g' })).toBeNull();
    });
  });
});
