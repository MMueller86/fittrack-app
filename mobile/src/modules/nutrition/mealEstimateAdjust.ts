import type {
  AiMealEstimateComponent,
  AiMealEstimateNutrition,
  AiMealEstimatePreview,
} from '@fittrack/shared';

export type MealEstimateMacro = 'protein' | 'carbs' | 'fat' | 'fiber';

export interface MealEstimateAdjustments {
  portionSteps: number;
  macroOffsets: Partial<Record<MealEstimateMacro, number>>;
  typedOverrides: Partial<AiMealEstimateNutrition>;
}

export interface AdjustedMealEstimate {
  mealEstimate: AiMealEstimateNutrition;
  estimatedTotalGrams?: number;
  componentItems?: AiMealEstimateComponent[];
}

type MealEstimateBase = Pick<AiMealEstimatePreview, 'mealEstimate'>
  & Partial<Pick<AiMealEstimatePreview, 'estimatedTotalGrams' | 'componentItems'>>;

const MACROS: readonly MealEstimateMacro[] = ['protein', 'carbs', 'fat', 'fiber'];

function finiteOverride(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function applyMealEstimateAdjustments(
  base: MealEstimateBase,
  adjustments: MealEstimateAdjustments,
): AdjustedMealEstimate {
  const portionSteps = Math.max(-10, Math.min(10, Math.trunc(adjustments.portionSteps)));
  const portionFactor = 1 + portionSteps * 0.05;
  const mealEstimate: AiMealEstimateNutrition = {
    calories: base.mealEstimate.calories * portionFactor,
    protein: base.mealEstimate.protein * portionFactor,
    carbs: base.mealEstimate.carbs * portionFactor,
    fat: base.mealEstimate.fat * portionFactor,
    fiber: base.mealEstimate.fiber * portionFactor,
  };

  let atwaterDelta = 0;
  for (const macro of MACROS) {
    const offsetSteps = Math.trunc(adjustments.macroOffsets[macro] ?? 0);
    if (offsetSteps === 0) continue;

    const beforeOffset = mealEstimate[macro];
    const stepGrams = Math.max(0.5, base.mealEstimate[macro] * 0.05);
    mealEstimate[macro] = Math.max(0, beforeOffset + offsetSteps * stepGrams);
    const delta = mealEstimate[macro] - beforeOffset;
    if (macro === 'protein' || macro === 'carbs') atwaterDelta += delta * 4;
    if (macro === 'fat') atwaterDelta += delta * 9;
  }

  mealEstimate.calories = Math.max(0, mealEstimate.calories + atwaterDelta);
  for (const nutrient of ['calories', ...MACROS] as const) {
    const override = finiteOverride(adjustments.typedOverrides[nutrient]);
    if (override !== undefined) mealEstimate[nutrient] = override;
  }

  return {
    mealEstimate,
    ...(base.estimatedTotalGrams === undefined
      ? {}
      : { estimatedTotalGrams: base.estimatedTotalGrams * portionFactor }),
    ...(base.componentItems === undefined
      ? {}
      : {
          componentItems: base.componentItems.map((item) => ({
            ...item,
            estimatedGrams: item.estimatedGrams * portionFactor,
            calories: item.calories * portionFactor,
          })),
        }),
  };
}