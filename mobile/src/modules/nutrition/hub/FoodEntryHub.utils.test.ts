import { describe, it, expect } from 'vitest';
import type { UserFoodRelation } from '@fittrack/shared';
import {
  computeLastUsageText,
} from './FoodEntryHub.utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRelation(overrides: Partial<UserFoodRelation> = {}): UserFoodRelation {
  return {
    id: 'test-id',
    userId: 'user-1',
    foodRef: 'ref-1',
    foodRefType: 'personal',
    displayName: 'Test Item',
    isFavorite: true,
    lastUsedAt: null,
    usageCount: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeLastUsageText
// ---------------------------------------------------------------------------

describe('computeLastUsageText', () => {
  it('Branch 1 (grams): lastInputAmount + nutritionPer100g → shows grams and kcal', () => {
    const item = makeRelation({
      lastInputMode: 'grams',
      lastInputAmount: 150,
      nutritionPer100g: { calories: 200, protein: 10, carbs: 20, fat: 5 },
    });
    expect(computeLastUsageText(item)).toBe('Zuletzt: 150 g · 300 kcal');
  });

  it('Branch 1 (portion): lastInputAmount + nutritionPer100g + portion → shows count and kcal', () => {
    const item = makeRelation({
      lastInputMode: 'portion',
      lastInputAmount: 2,
      nutritionPer100g: { calories: 100, protein: 5, carbs: 10, fat: 2 },
      portion: { label: 'Scheibe', weightGrams: 30 },
    });
    // 2 portions × 30g = 60g → 60 kcal
    expect(computeLastUsageText(item)).toBe('Zuletzt: 2 Scheibe · 60 kcal');
  });

  it('Branch 1 (portion, fractional): fractional count formatted with one decimal', () => {
    const item = makeRelation({
      lastInputMode: 'portion',
      lastInputAmount: 1.5,
      nutritionPer100g: { calories: 100, protein: 5, carbs: 10, fat: 2 },
      portion: { label: 'Portion', weightGrams: 200 },
    });
    // 1.5 × 200g = 300g → 300 kcal
    expect(computeLastUsageText(item)).toBe('Zuletzt: 1.5 Portion · 300 kcal');
  });

  it('Branch 1.5 (grams, no nutrition): shows amount only', () => {
    const item = makeRelation({
      lastInputMode: 'grams',
      lastInputAmount: 100,
    });
    expect(computeLastUsageText(item)).toBe('Zuletzt: 100 g');
  });

  it('Branch 1.5 (portion, no nutrition): shows portion count only', () => {
    const item = makeRelation({
      lastInputMode: 'portion',
      lastInputAmount: 1,
      portion: { label: 'Becher', weightGrams: 150 },
    });
    expect(computeLastUsageText(item)).toBe('Zuletzt: 1 Becher');
  });

  it('Branch 2: no history, nutrition available → shows 100g reference', () => {
    const item = makeRelation({
      nutritionPer100g: { calories: 250, protein: 8, carbs: 30, fat: 10 },
    });
    expect(computeLastUsageText(item)).toBe('100 g · 250 kcal');
  });

  it('Branch 3 (portion fallback): no history, no nutrition, has portion → shows portion info', () => {
    const item = makeRelation({
      portion: { label: 'Kugel', weightGrams: 60 },
    });
    expect(computeLastUsageText(item)).toBe('1 Kugel (60 g)');
  });

  it('Branch 3 (last resort): no history, no nutrition, no portion → Keine Nährwertdaten', () => {
    const item = makeRelation();
    expect(computeLastUsageText(item)).toBe('Keine Nährwertdaten');
  });
});

