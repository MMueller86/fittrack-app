import { describe, it, expect } from 'vitest';
import {
  calculateFromGrams,
  calculateFromPortions,
  calculate,
  NutritionCalculationError,
} from './nutritionCalculator';
import type { NutritionValues } from '@fittrack/shared';

const PER_100G: NutritionValues = { calories: 400, protein: 20, carbs: 50, fat: 10, fiber: 5 };
const PORTION_NUTRITION: NutritionValues = { calories: 200, protein: 15, carbs: 25, fat: 5, fiber: 2 };

describe('calculateFromGrams', () => {
  it('calculates macros proportionally for 100g', () => {
    const result = calculateFromGrams(100, PER_100G);
    expect(result.calories).toBe(400);
    expect(result.protein).toBe(20);
    expect(result.carbs).toBe(50);
    expect(result.fat).toBe(10);
    expect(result.fiber).toBe(5);
  });

  it('calculates macros for 50g (half portion)', () => {
    const result = calculateFromGrams(50, PER_100G);
    expect(result.calories).toBe(200);
    expect(result.protein).toBe(10);
    expect(result.carbs).toBe(25);
    expect(result.fat).toBe(5);
    expect(result.fiber).toBe(2.5);
  });

  it('calculates macros for 150g', () => {
    const result = calculateFromGrams(150, PER_100G);
    expect(result.calories).toBe(600);
    expect(result.protein).toBe(30);
  });

  it('returns zero macros for 0g', () => {
    const result = calculateFromGrams(0, PER_100G);
    expect(result.calories).toBe(0);
    expect(result.protein).toBe(0);
  });

  it('rounds to 1 decimal to avoid floating-point noise', () => {
    const fractional: NutritionValues = { calories: 333, protein: 11, carbs: 44, fat: 7, fiber: 3 };
    const result = calculateFromGrams(100, fractional);
    // Values should be 1-decimal rounded
    expect(result.calories).toBe(333);
    const result33 = calculateFromGrams(33, fractional);
    expect(result33.calories).toBe(109.9); // 333 * 0.33 = 109.89 → 109.9
  });

  it('handles missing fiber (defaults to 0)', () => {
    const noFiber: NutritionValues = { calories: 100, protein: 5, carbs: 10, fat: 3 };
    const result = calculateFromGrams(100, noFiber);
    expect(result.fiber).toBe(0);
  });

  it('throws for negative grams', () => {
    expect(() => calculateFromGrams(-10, PER_100G)).toThrow(NutritionCalculationError);
  });

  it('throws for NaN grams', () => {
    expect(() => calculateFromGrams(NaN, PER_100G)).toThrow(NutritionCalculationError);
  });
});

describe('calculateFromPortions', () => {
  it('calculates macros for 1 portion', () => {
    const result = calculateFromPortions(1, PORTION_NUTRITION);
    expect(result.calories).toBe(200);
    expect(result.protein).toBe(15);
    expect(result.carbs).toBe(25);
    expect(result.fat).toBe(5);
    expect(result.fiber).toBe(2);
  });

  it('calculates macros for 2 portions', () => {
    const result = calculateFromPortions(2, PORTION_NUTRITION);
    expect(result.calories).toBe(400);
    expect(result.protein).toBe(30);
  });

  it('calculates macros for fractional portions (0.5)', () => {
    const result = calculateFromPortions(0.5, PORTION_NUTRITION);
    expect(result.calories).toBe(100);
    expect(result.protein).toBe(7.5);
  });

  it('returns zero macros for 0 portions', () => {
    const result = calculateFromPortions(0, PORTION_NUTRITION);
    expect(result.calories).toBe(0);
  });

  it('throws for negative portions', () => {
    expect(() => calculateFromPortions(-1, PORTION_NUTRITION)).toThrow(NutritionCalculationError);
  });
});

describe('calculate (unified)', () => {
  it('delegates to grams when quantityMode is grams', () => {
    const result = calculate({ quantityMode: 'grams', quantity: 200, nutritionPer100g: PER_100G });
    expect(result.calories).toBe(800);
  });

  it('delegates to portions when quantityMode is portions', () => {
    const result = calculate({
      quantityMode: 'portions', quantity: 1.5, portionNutrition: PORTION_NUTRITION,
    });
    expect(result.calories).toBe(300);
  });

  it('throws NutritionCalculationError when grams mode lacks nutritionPer100g', () => {
    expect(() => calculate({ quantityMode: 'grams', quantity: 100 })).toThrow(NutritionCalculationError);
  });

  it('throws NutritionCalculationError when portions mode lacks portionNutrition', () => {
    expect(() => calculate({ quantityMode: 'portions', quantity: 1 })).toThrow(NutritionCalculationError);
  });

  it('throws NutritionCalculationError for grams when only portionNutrition is available', () => {
    expect(() =>
      calculate({ quantityMode: 'grams', quantity: 100, portionNutrition: PORTION_NUTRITION }),
    ).toThrow(NutritionCalculationError);
  });

  it('throws NutritionCalculationError for portions when only per100g is available', () => {
    expect(() =>
      calculate({ quantityMode: 'portions', quantity: 1, nutritionPer100g: PER_100G }),
    ).toThrow(NutritionCalculationError);
  });
});
