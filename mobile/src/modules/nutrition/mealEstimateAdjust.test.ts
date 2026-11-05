import { describe, expect, it } from 'vitest';
import type { AiMealEstimatePreview } from '@fittrack/shared';
import { applyMealEstimateAdjustments } from './mealEstimateAdjust';

const base: AiMealEstimatePreview = {
  mealName: 'Haferbrei',
  mealEstimate: { calories: 400, protein: 20, carbs: 60, fat: 10, fiber: 8 },
  components: ['Haferflocken'],
  componentItems: [{ name: 'Haferflocken', estimatedGrams: 100, calories: 400 }],
  estimatedTotalGrams: 100,
  promptVersion: 'v2-test',
  contextDetected: null,
  portionConfidence: 'high',
  photoUsed: false,
  assumptions: [],
  warnings: [],
};

function adjustments(
  overrides: Partial<Parameters<typeof applyMealEstimateAdjustments>[1]> = {},
): Parameters<typeof applyMealEstimateAdjustments>[1] {
  return { portionSteps: 0, macroOffsets: {}, typedOverrides: {}, ...overrides };
}

describe('applyMealEstimateAdjustments', () => {
  it('scales all meal values and component weights additively and reversibly', () => {
    const increased = applyMealEstimateAdjustments(base, adjustments({ portionSteps: 1 }));
    expect(increased).toEqual({
      mealEstimate: { calories: 420, protein: 21, carbs: 63, fat: 11, fiber: 8 },
      estimatedTotalGrams: 105,
      componentItems: [{ name: 'Haferflocken', estimatedGrams: 105, calories: 420 }],
    });

    expect(applyMealEstimateAdjustments(base, adjustments({ portionSteps: 0 }))).toEqual({
      mealEstimate: base.mealEstimate,
      estimatedTotalGrams: 100,
      componentItems: base.componentItems,
    });
    expect(applyMealEstimateAdjustments(base, adjustments({ portionSteps: 99 })).mealEstimate.calories)
      .toBe(600);
    const minimumPortion = applyMealEstimateAdjustments(base, adjustments({ portionSteps: -10 }));
    expect(minimumPortion.mealEstimate.calories).toBe(200);
    expect(minimumPortion.estimatedTotalGrams).toBe(50);
    expect(minimumPortion.componentItems?.[0]?.estimatedGrams).toBe(50);
    expect(minimumPortion.componentItems?.[0]?.calories).toBe(200);
  });

  it('applies macro Atwater deltas, leaves fiber kcal-neutral, and never goes below zero', () => {
    const result = applyMealEstimateAdjustments(base, adjustments({
      macroOffsets: { protein: 1, fat: -1, fiber: 1 },
    }));
    expect(result.mealEstimate).toEqual({
      calories: 395,
      protein: 21,
      carbs: 60,
      fat: 9,
      fiber: 9,
    });

    const reducedToZero = applyMealEstimateAdjustments(base, adjustments({
      macroOffsets: { protein: -100, carbs: -100, fat: -100, fiber: -100 },
    }));
    expect(reducedToZero.mealEstimate).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  });

  it('uses valid typed overrides after step adjustments and preserves V1 omissions', () => {
    const result = applyMealEstimateAdjustments(
      { mealEstimate: base.mealEstimate },
      adjustments({
        macroOffsets: { protein: 1 },
        typedOverrides: { calories: 250, protein: 18, fiber: -1 },
      }),
    );
    expect(result).toEqual({
      mealEstimate: { calories: 250, protein: 18, carbs: 60, fat: 10, fiber: 8 },
    });
  });
});