// Smoke test — verifies that the re-export from @fittrack/shared is reachable.
// Full logic tests live in shared/lib/nutritionCalculator.test.ts.
import { describe, it, expect } from 'vitest';
import { calculateNutrition } from '@fittrack/shared';

describe('nutritionUtils re-export', () => {
  it('calculateNutrition is exported and callable from shared', () => {
    const { amountGrams, calculatedNutrition } = calculateNutrition(
      'grams',
      100,
      { calories: 400, protein: 20, carbs: 50, fat: 10 },
    );
    expect(amountGrams).toBe(100);
    expect(calculatedNutrition.calories).toBe(400);
  });
});
