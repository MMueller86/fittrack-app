import { describe, expect, it } from 'vitest';
import type { UserFoodRelation } from '@fittrack/shared';
import { isRemoteImageUri } from '../../shared/components/foodProductSummaryUtils';
import { favoriteSummaryProps } from './favoriteFoodSummary';

const NUTRITION = { calories: 120, protein: 5, carbs: 20, fat: 2 };

function relation(overrides: Partial<UserFoodRelation>): UserFoodRelation {
  return {
    id: 'user-1:ref',
    userId: 'user-1',
    foodRef: 'ref',
    foodRefType: 'catalog',
    displayName: 'Haferflocken',
    isFavorite: true,
    lastUsedAt: null,
    usageCount: 0,
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('favoriteSummaryProps', () => {
  it('maps a catalog favorite with brand, OFF badge, nutrition and portion', () => {
    const portion = { label: '1 Scheibe', weightGrams: 30 };
    const props = favoriteSummaryProps(
      relation({
        displayBrand: 'Kölln',
        imageUrl: 'https://example.invalid/oats.jpg',
        nutritionPer100g: NUTRITION,
        portion,
        isComplete: true,
      }),
    );

    expect(props).toEqual({
      name: 'Haferflocken',
      brand: 'Kölln',
      imageUri: 'https://example.invalid/oats.jpg',
      badges: [{ label: 'OFF', tone: 'accent' }],
      incomplete: false,
      nutrition: NUTRITION,
      nutritionBasis: 'per100g',
      portion,
    });
  });

  it('keeps a catalog favorite without stored brand brandless instead of inventing one', () => {
    const props = favoriteSummaryProps(relation({ foodRefType: 'catalog', displayBrand: undefined }));

    expect(props.brand).toBeUndefined();
    expect(props.badges).toEqual([{ label: 'OFF', tone: 'accent' }]);
  });

  it('maps a personal food with the neutral Eigen badge and no brand fallback', () => {
    const props = favoriteSummaryProps(relation({ foodRefType: 'personal', nutritionPer100g: NUTRITION }));

    expect(props.badges).toEqual([{ label: 'Eigen', tone: 'neutral' }]);
    expect(props.brand).toBeUndefined();
  });

  it('maps owner and community recipes with the recipe brand fallback and Rezept badge', () => {
    const owner = favoriteSummaryProps(relation({ foodRefType: 'recipe', recipeAccess: 'owner', displayName: 'Suppe' }));
    const community = favoriteSummaryProps(
      relation({ foodRefType: 'recipe', recipeAccess: 'community', displayName: 'Curry' }),
    );
    const withBrand = favoriteSummaryProps(
      relation({ foodRefType: 'recipe', recipeAccess: 'owner', displayBrand: 'Oma' }),
    );

    expect(owner).toMatchObject({ name: 'Suppe', brand: 'Eigenes Rezept', badges: [{ label: 'Rezept', tone: 'neutral' }] });
    expect(community).toMatchObject({ name: 'Curry', brand: 'Community-Rezept' });
    expect(withBrand.brand).toBe('Oma');
  });

  it('shows an unavailable recipe without image, nutrition and own name', () => {
    const props = favoriteSummaryProps(
      relation({
        foodRefType: 'recipe',
        recipeAccess: undefined,
        displayName: 'Geheimes Rezept',
        displayBrand: 'Jemand',
        imageUrl: 'https://example.invalid/r.jpg',
        nutritionPer100g: NUTRITION,
      }),
    );

    expect(props.name).toBe('Rezept nicht verfügbar');
    expect(props.brand).toBeUndefined();
    expect(props.imageUri).toBeNull();
    expect(props.nutrition).toBeUndefined();
  });

  it('omits nutrition when the relation has none', () => {
    const props = favoriteSummaryProps(relation({}));

    expect(props.nutrition).toBeUndefined();
    expect(props.nutritionBasis).toBe('per100g');
  });

  it('flags incomplete only for isComplete === false', () => {
    expect(favoriteSummaryProps(relation({ isComplete: false })).incomplete).toBe(true);
    expect(favoriteSummaryProps(relation({ isComplete: true })).incomplete).toBe(false);
    expect(favoriteSummaryProps(relation({})).incomplete).toBe(false);
  });

  it('passes the image through so only remote URLs become a thumbnail', () => {
    const remote = favoriteSummaryProps(relation({ imageUrl: 'https://example.invalid/a.jpg' }));
    const blob = favoriteSummaryProps(relation({ imageUrl: 'user-1/item-1.jpg' }));
    const none = favoriteSummaryProps(relation({ imageUrl: null }));

    expect(isRemoteImageUri(remote.imageUri)).toBe(true);
    expect(isRemoteImageUri(blob.imageUri)).toBe(false);
    expect(isRemoteImageUri(none.imageUri)).toBe(false);
  });
});
