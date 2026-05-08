import { describe, it, expect } from 'vitest';
import {
  resolveAmountGrams,
  scaleNutritionToGrams,
  calculateNutrition,
  NutritionCalculationError,
} from './nutritionCalculator';
import type { NutritionValues } from '../types/diary';

const PER_100G: NutritionValues = { calories: 400, protein: 20, carbs: 50, fat: 10, fiber: 5 };
const PER_100G_NO_FIBER: NutritionValues = { calories: 250, protein: 8, carbs: 30, fat: 9 };

// --- resolveAmountGrams ---

describe('resolveAmountGrams', () => {
  it('returns inputAmount unchanged for grams mode', () => {
    expect(resolveAmountGrams('grams', 150)).toBe(150);
  });

  it('multiplies inputAmount by portionWeightGrams for portion mode', () => {
    expect(resolveAmountGrams('portion', 2, 25)).toBe(50);
  });

  it('handles fractional portions — 0.5 × 420 g pizza', () => {
    expect(resolveAmountGrams('portion', 0.5, 420)).toBe(210);
  });

  it('returns 0 grams for 0 portions', () => {
    expect(resolveAmountGrams('portion', 0, 100)).toBe(0);
  });

  it('returns 0 grams for 0 input in grams mode', () => {
    expect(resolveAmountGrams('grams', 0)).toBe(0);
  });

  it('throws NutritionCalculationError when portion mode is used without portionWeightGrams', () => {
    expect(() => resolveAmountGrams('portion', 1)).toThrow(NutritionCalculationError);
  });
});

// --- scaleNutritionToGrams ---

describe('scaleNutritionToGrams', () => {
  it('returns full values for 100 g', () => {
    const result = scaleNutritionToGrams(PER_100G, 100);
    expect(result.calories).toBe(400);
    expect(result.protein).toBe(20);
    expect(result.carbs).toBe(50);
    expect(result.fat).toBe(10);
    expect(result.fiber).toBe(5);
  });

  it('scales to 50 g (half)', () => {
    const result = scaleNutritionToGrams(PER_100G, 50);
    expect(result.calories).toBe(200);
    expect(result.protein).toBe(10);
    expect(result.carbs).toBe(25);
    expect(result.fat).toBe(5);
    expect(result.fiber).toBe(2.5);
  });

  it('scales to 150 g', () => {
    const result = scaleNutritionToGrams(PER_100G, 150);
    expect(result.calories).toBe(600);
    expect(result.protein).toBe(30);
  });

  it('returns zeros for 0 g', () => {
    const result = scaleNutritionToGrams(PER_100G, 0);
    expect(result.calories).toBe(0);
    expect(result.protein).toBe(0);
  });

  it('rounds to 1 decimal to avoid floating-point noise', () => {
    const odd: NutritionValues = { calories: 333, protein: 11, carbs: 44, fat: 7, fiber: 3 };
    const result = scaleNutritionToGrams(odd, 33);
    // 333 × 0.33 = 109.89 → 109.9
    expect(result.calories).toBe(109.9);
  });

  it('omits fiber when not present in source', () => {
    const result = scaleNutritionToGrams(PER_100G_NO_FIBER, 100);
    expect(result.fiber).toBeUndefined();
  });

  it('includes fiber when present in source', () => {
    const result = scaleNutritionToGrams(PER_100G, 100);
    expect(result.fiber).toBe(5);
  });
});

// --- calculateNutrition ---

describe('calculateNutrition', () => {
  it('grams mode: 50 g Buttertoast', () => {
    const { amountGrams, calculatedNutrition } = calculateNutrition('grams', 50, PER_100G);
    expect(amountGrams).toBe(50);
    expect(calculatedNutrition.calories).toBe(200);
    expect(calculatedNutrition.protein).toBe(10);
  });

  it('portion mode: 2 portions Buttertoast (25 g each) → amountGrams = 50', () => {
    const { amountGrams, calculatedNutrition } = calculateNutrition('portion', 2, PER_100G, 25);
    expect(amountGrams).toBe(50);
    expect(calculatedNutrition.calories).toBe(200);
    expect(calculatedNutrition.protein).toBe(10);
  });

  it('portion mode: 0.5 portions Pizza (420 g each) → amountGrams = 210', () => {
    const { amountGrams, calculatedNutrition } = calculateNutrition('portion', 0.5, PER_100G, 420);
    expect(amountGrams).toBe(210);
    expect(calculatedNutrition.calories).toBe(840);
  });

  it('grams mode: fiber omitted when not in source', () => {
    const { calculatedNutrition } = calculateNutrition('grams', 100, PER_100G_NO_FIBER);
    expect(calculatedNutrition.fiber).toBeUndefined();
  });

  it('throws NutritionCalculationError for negative inputAmount', () => {
    expect(() => calculateNutrition('grams', -1, PER_100G)).toThrow(NutritionCalculationError);
  });

  it('throws NutritionCalculationError for NaN inputAmount', () => {
    expect(() => calculateNutrition('grams', NaN, PER_100G)).toThrow(NutritionCalculationError);
  });

  it('throws NutritionCalculationError in portion mode without portionWeightGrams', () => {
    expect(() => calculateNutrition('portion', 1, PER_100G)).toThrow(NutritionCalculationError);
  });
});
