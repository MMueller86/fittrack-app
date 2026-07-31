import { describe, it, expect } from 'vitest';
import { computeLastUsageText, computeMacroText, computeDirectAddLabel } from './FoodEntryHub.utils';
import type { UserFoodRelation } from '@fittrack/shared';

function makeItem(overrides: Partial<UserFoodRelation>): UserFoodRelation {
  return {
    id: 'test',
    userId: 'user1',
    foodRef: 'ref1',
    foodRefType: 'personal',
    displayName: 'Test',
    isFavorite: true,
    usageCount: 0,
    ...overrides,
  } as UserFoodRelation;
}

describe('computeLastUsageText', () => {
  it('returns reference value when lastInputAmount is absent but nutritionPer100g is present', () => {
    const item = makeItem({ nutritionPer100g: { calories: 200, protein: 10, carbs: 20, fat: 5 } });
    expect(computeLastUsageText(item)).toBe('100 g \u00b7 200 kcal');
  });

  it('Branch 2: shows 100g reference value with no usage history', () => {
    const item = makeItem({ nutritionPer100g: { calories: 350, protein: 20, carbs: 40, fat: 10 } });
    expect(computeLastUsageText(item)).toBe('100 g \u00b7 350 kcal');
  });

  it('Branch 3: returns "Keine Nährwertdaten" when no lastInputAmount, no nutritionPer100g, no portion', () => {
    const item = makeItem({});
    expect(computeLastUsageText(item)).toBe('Keine Nährwertdaten');
  });

  it('Branch 3: returns portion reference when no lastInputAmount, no nutritionPer100g, but portion present', () => {
    const item = makeItem({ portion: { label: 'Scheibe', weightGrams: 30 } });
    expect(computeLastUsageText(item)).toBe('1 Scheibe (30 g)');
  });

  it('Branch 1.5: history present, no nutrition, grams mode — shows amount only', () => {
    const item = makeItem({ lastInputAmount: 150, lastInputMode: 'grams' });
    expect(computeLastUsageText(item)).toBe('Zuletzt: 150 g');
  });

  it('Branch 1.5: history present, no nutrition, portion mode — shows count and label only', () => {
    const item = makeItem({
      lastInputAmount: 2,
      lastInputMode: 'portion',
      portion: { label: 'Scheibe', weightGrams: 30 },
    });
    expect(computeLastUsageText(item)).toBe('Zuletzt: 2 Scheibe');
  });

  it('computes grams mode: 150g at 120 kcal/100g → 180 kcal', () => {
    const item = makeItem({
      lastInputMode: 'grams',
      lastInputAmount: 150,
      nutritionPer100g: { calories: 120, protein: 10, carbs: 15, fat: 3 },
    });
    expect(computeLastUsageText(item)).toBe('Zuletzt: 150 g · 180 kcal');
  });

  it('computes portion mode: 2 portions at 50g each, 200 kcal/100g → 200 kcal', () => {
    const item = makeItem({
      lastInputMode: 'portion',
      lastInputAmount: 2,
      portion: { label: 'Portion', weightGrams: 50 },
      nutritionPer100g: { calories: 200, protein: 20, carbs: 10, fat: 5 },
    });
    expect(computeLastUsageText(item)).toBe('Zuletzt: 2 Portion \u00b7 200 kcal');
  });

  it('uses real portion label: portion.label = Scheibe', () => {
    const item = makeItem({
      lastInputMode: 'portion',
      lastInputAmount: 1,
      portion: { label: 'Scheibe', weightGrams: 30 },
      nutritionPer100g: { calories: 200, protein: 10, carbs: 20, fat: 5 },
    });
    expect(computeLastUsageText(item)).toBe('Zuletzt: 1 Scheibe \u00b7 60 kcal');
  });

  it('formats fractional portion count with 1 decimal', () => {
    const item = makeItem({
      lastInputMode: 'portion',
      lastInputAmount: 1.5,
      portion: { label: 'Portion', weightGrams: 100 },
      nutritionPer100g: { calories: 100, protein: 5, carbs: 10, fat: 2 },
    });
    expect(computeLastUsageText(item)).toBe('Zuletzt: 1.5 Portion \u00b7 150 kcal');
  });

  it('falls back to 100g portionGrams when portion is absent in portion mode', () => {
    const item = makeItem({
      lastInputMode: 'portion',
      lastInputAmount: 1,
      nutritionPer100g: { calories: 400, protein: 30, carbs: 40, fat: 10 },
    });
    expect(computeLastUsageText(item)).toBe('Zuletzt: 1 Portion · 400 kcal');
  });
});

describe('computeMacroText', () => {
  it('returns null when nutritionPer100g is absent', () => {
    expect(computeMacroText(makeItem({}))).toBeNull();
  });

  it('returns null when calories is absent', () => {
    expect(computeMacroText(makeItem({ nutritionPer100g: {} as any }))).toBeNull();
  });

  it('builds correct macro string', () => {
    const item = makeItem({
      nutritionPer100g: { calories: 250, protein: 12, carbs: 30, fat: 8 },
    });
    expect(computeMacroText(item)).toBe('250 kcal · EW 12 g · KH 30 g · F 8 g · je 100 g');
  });

  it('omits macro fields that are null/undefined', () => {
    const item = makeItem({
      nutritionPer100g: { calories: 100, protein: undefined as any, carbs: undefined as any, fat: undefined as any },
    });
    expect(computeMacroText(item)).toBe('100 kcal · je 100 g');
  });
});

describe('computeDirectAddLabel', () => {
  it('returns null when activeFilter is not fuerDich', () => {
    const item = makeItem({ preferredInputMode: 'grams', preferredInputAmount: 100 });
    expect(computeDirectAddLabel(item, 'favorites')).toBeNull();
  });

  it('returns null when preferredInputAmount is 0', () => {
    const item = makeItem({ preferredInputAmount: 0 });
    expect(computeDirectAddLabel(item, 'fuerDich')).toBeNull();
  });

  it('returns null when preferredInputAmount is undefined', () => {
    const item = makeItem({});
    expect(computeDirectAddLabel(item, 'fuerDich')).toBeNull();
  });

  it('returns null when nutritionPer100g is absent', () => {
    const item = makeItem({ preferredInputMode: 'grams', preferredInputAmount: 100 });
    expect(computeDirectAddLabel(item, 'fuerDich')).toBeNull();
  });

  it('portion mode with portion.label returns label as-is', () => {
    const item = makeItem({
      preferredInputMode: 'portion',
      preferredInputAmount: 2,
      portion: { label: 'Scheibe', weightGrams: 30 },
      nutritionPer100g: { calories: 200, protein: 10, carbs: 20, fat: 5 },
    });
    expect(computeDirectAddLabel(item, 'fuerDich')).toBe('2 Scheibe');
  });

  it('portion mode with no portion.label falls back to Portion', () => {
    const item = makeItem({
      preferredInputMode: 'portion',
      preferredInputAmount: 1,
      nutritionPer100g: { calories: 200, protein: 10, carbs: 20, fat: 5 },
    });
    expect(computeDirectAddLabel(item, 'fuerDich')).toBe('1 Portion');
  });

  it('portion mode with fractional amount shows one decimal', () => {
    const item = makeItem({
      preferredInputMode: 'portion',
      preferredInputAmount: 1.5,
      nutritionPer100g: { calories: 200, protein: 10, carbs: 20, fat: 5 },
    });
    expect(computeDirectAddLabel(item, 'fuerDich')).toBe('1.5 Portion');
  });

  it('grams mode returns rounded grams', () => {
    const item = makeItem({
      preferredInputMode: 'grams',
      preferredInputAmount: 150,
      nutritionPer100g: { calories: 200, protein: 10, carbs: 20, fat: 5 },
    });
    expect(computeDirectAddLabel(item, 'fuerDich')).toBe('150 g');
  });

  it('grams mode with fractional amount rounds result', () => {
    const item = makeItem({
      preferredInputMode: 'grams',
      preferredInputAmount: 182.3,
      nutritionPer100g: { calories: 200, protein: 10, carbs: 20, fat: 5 },
    });
    expect(computeDirectAddLabel(item, 'fuerDich')).toBe('182 g');
  });
});
