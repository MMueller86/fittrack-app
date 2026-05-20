import { describe, it, expect } from 'vitest';
import { validateNutritionEstimate } from './nutritionValidator';

// Realistic baseline (chicken breast per 100g)
const CHICKEN = { calories: 165, protein: 31, carbs: 0, fat: 3.6 };

// ---------------------------------------------------------------------------
// Valid estimates
// ---------------------------------------------------------------------------

describe('validateNutritionEstimate — valid inputs', () => {
  it('accepts realistic chicken breast values', () => {
    const result = validateNutritionEstimate(CHICKEN);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts pure oil (fat=100, cal=900)', () => {
    const result = validateNutritionEstimate({ calories: 900, protein: 0, carbs: 0, fat: 100 });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts food at calorie boundary (exactly 900)', () => {
    const result = validateNutritionEstimate({ calories: 900, protein: 0, carbs: 0, fat: 100 });
    expect(result.valid).toBe(true);
  });

  it('accepts macro sum exactly at 100', () => {
    const result = validateNutritionEstimate({ calories: 400, protein: 25, carbs: 50, fat: 25 });
    expect(result.valid).toBe(true);
  });

  it('accepts macro sum within 5g tolerance (sum=103)', () => {
    const result = validateNutritionEstimate({ calories: 420, protein: 30, carbs: 50, fat: 23 });
    expect(result.valid).toBe(true);
  });

  it('accepts fiber when fiber <= carbs', () => {
    const result = validateNutritionEstimate({ calories: 340, protein: 10, carbs: 60, fat: 5, fiber: 8 });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts zero values (e.g. water)', () => {
    const result = validateNutritionEstimate({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Hard errors
// ---------------------------------------------------------------------------

describe('validateNutritionEstimate — hard errors', () => {
  it('rejects calories > 900', () => {
    const result = validateNutritionEstimate({ calories: 950, protein: 0, carbs: 0, fat: 100 });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('calories'))).toBe(true);
  });

  it('rejects protein > 100', () => {
    const result = validateNutritionEstimate({ calories: 400, protein: 110, carbs: 0, fat: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('protein'))).toBe(true);
  });

  it('rejects carbs > 100', () => {
    const result = validateNutritionEstimate({ calories: 400, protein: 0, carbs: 120, fat: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('carbs'))).toBe(true);
  });

  it('rejects fat > 100', () => {
    const result = validateNutritionEstimate({ calories: 900, protein: 0, carbs: 0, fat: 101 });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('fat'))).toBe(true);
  });

  it('rejects protein+carbs+fat sum > 105', () => {
    const result = validateNutritionEstimate({ calories: 600, protein: 40, carbs: 40, fat: 30 });
    // sum = 110 → rejected
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('protein + carbs + fat'))).toBe(true);
  });

  it('rejects negative calories', () => {
    const result = validateNutritionEstimate({ calories: -10, protein: 10, carbs: 10, fat: 5 });
    expect(result.valid).toBe(false);
  });

  it('rejects NaN calories', () => {
    const result = validateNutritionEstimate({ calories: NaN, protein: 10, carbs: 10, fat: 5 });
    expect(result.valid).toBe(false);
  });

  it('rejects fiber > carbs (fiber cannot exceed carbs)', () => {
    const result = validateNutritionEstimate({ calories: 200, protein: 10, carbs: 5, fat: 5, fiber: 10 });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('fiber'))).toBe(true);
  });

  it('rejects negative fiber', () => {
    const result = validateNutritionEstimate({ calories: 200, protein: 10, carbs: 20, fat: 5, fiber: -1 });
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Soft warnings
// ---------------------------------------------------------------------------

describe('validateNutritionEstimate — soft warnings', () => {
  it('warns when salt > 10', () => {
    const result = validateNutritionEstimate({ ...CHICKEN, salt: 15 });
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes('salt'))).toBe(true);
  });

  it('warns when fiber > 20', () => {
    const result = validateNutritionEstimate({ calories: 200, protein: 5, carbs: 50, fat: 2, fiber: 25 });
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes('fiber'))).toBe(true);
  });

  it('warns when calorie deviation exceeds 25% vs macro formula', () => {
    // Actual macros: 30g protein (120 kcal) + 20g carbs (80 kcal) + 5g fat (45 kcal) = ~245 kcal
    // Reported: 400 kcal — more than 25% off
    const result = validateNutritionEstimate({ calories: 400, protein: 30, carbs: 20, fat: 5 });
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes('deviate'))).toBe(true);
  });

  it('does not warn for acceptable calorie deviation (< 25%)', () => {
    // Chicken: estimated = 31*4 + 0*4 + 3.6*9 = 124+32.4 = 156.4 kcal, reported 165
    // deviation: |165-156| / 156 ≈ 5.7% → OK
    const result = validateNutritionEstimate(CHICKEN);
    expect(result.warnings.filter((w) => w.includes('deviate'))).toHaveLength(0);
  });
});
