import type { AiMealEstimateRefine } from '@fittrack/shared';

export interface MealEstimateEvalFixture {
  id: string;
  description: string;
  input: { text: string; refine?: AiMealEstimateRefine };
  expectedCaloriesDirection?: 'larger' | 'smaller';
  expectedPortionConfidence?: 'high' | 'medium' | 'low';
  /** Whether a usual but unmentioned ingredient must (present: components or assumptions) or must not (absent: components) appear. */
  implicitAddition?: { pattern: RegExp; present: boolean };
  calorieReference?: {
    minKcal: number;
    maxKcal: number;
    source: string;
    reviewStatus: 'validated';
  };
}

const previousEstimate: AiMealEstimateRefine['previous'] = {
  mealName: 'Schnitzel mit Pommes und Mayo',
  estimatedTotalGrams: 425,
  mealEstimate: { calories: 1150, protein: 42, carbs: 105, fat: 58, fiber: 8 },
  componentItems: [
    { name: 'Schnitzel', estimatedGrams: 180, calories: 420 },
    { name: 'Pommes', estimatedGrams: 220, calories: 540 },
    { name: 'Mayo', estimatedGrams: 25, calories: 190 },
  ],
};

// DV-1 provides no independently validated calorie ranges in this work package.
// No owned, independently labeled, rights-cleared photo/text fixtures are available;
// these text-only fixtures do not verify photo classification or image contribution.
export const MEAL_ESTIMATE_EVAL_FIXTURES: MealEstimateEvalFixture[] = [
  {
    id: 'plain-meal-typical-portion-v4',
    description: 'Rates a familiar meal without a stated amount as medium confidence',
    input: { text: 'Schnitzel mit Pommes und Mayo' },
    expectedPortionConfidence: 'medium',
  },
  {
    id: 'explicit-portion-high-v4',
    description: 'Rates an explicitly stated portion as high confidence',
    input: { text: '1 Glas Milch (200 ml)' },
    expectedPortionConfidence: 'high',
  },
  {
    id: 'ambiguous-portion-low-v4',
    description: 'Rates an unidentifiable, unquantified meal as low confidence',
    input: { text: 'Irgendetwas gegessen' },
    expectedPortionConfidence: 'low',
  },
  {
    id: 'refined-meal-larger-v4',
    description: 'Applies a larger-portion hint to a complete previous estimate',
    input: {
      text: 'Schnitzel mit Pommes und Mayo',
      refine: {
        previous: previousEstimate,
        hints: ['larger'],
      },
    },
    expectedCaloriesDirection: 'larger',
  },
  {
    id: 'refined-meal-smaller-v4',
    description: 'Applies a smaller-portion hint to a complete previous estimate',
    input: {
      text: 'Schnitzel mit Pommes und Mayo',
      refine: {
        previous: previousEstimate,
        hints: ['smaller'],
        note: 'Weniger Mayo',
      },
    },
    expectedCaloriesDirection: 'smaller',
  },
  // Derivation: product decision of 2026-11-04 - usual preparation (spread on rolls, frying fat) counts even if
  // not named or visible, unless the user excludes it or the dish does not usually have it.
  {
    id: 'implicit-spread-on-roll-v6',
    description: 'Adds the usual spread to a roll with cheese although it is not mentioned',
    input: { text: 'Brötchen mit Camembert' },
    implicitAddition: { pattern: /butter|margarine|aufstrich|streichfett/iu, present: true },
  },
  {
    id: 'explicit-exclusion-of-spread-v6',
    description: 'Omits the spread when the user excludes it',
    input: { text: 'Brötchen mit Camembert, ohne Butter' },
    implicitAddition: { pattern: /butter|margarine|aufstrich|streichfett/iu, present: false },
  },
  {
    id: 'whole-fruit-without-implicit-fat-v6',
    description: 'Does not add fats or spreads to a whole fruit',
    input: { text: 'Ein Apfel' },
    implicitAddition: { pattern: /butter|margarine|aufstrich|streichfett|öl\b|bratfett/iu, present: false },
  },
];