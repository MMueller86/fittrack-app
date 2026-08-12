import { describe, it, expect, vi } from 'vitest';
import { calculateRecipeNutrition } from '@fittrack/shared';
import type {
  AiFoodEstimatePreview,
  FoodSearchResult,
  NutritionLabelScanResult,
} from '@fittrack/shared';
import type { MealParserPreviewItem } from '../../shared/api/aiApi';
import {
  buildFromProduct,
  buildFromAiEstimate,
  buildFromScan,
  buildIngFromCandidate,
  buildIngFromAiEstimate,
  buildWizardIngredientFromAiEstimate,
  buildIngFromSeasoning,
} from './ingredientBuilders';

vi.mock('expo-crypto', () => ({ randomUUID: () => 'test-uuid' }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProduct(overrides: Partial<FoodSearchResult> = {}): FoodSearchResult {
  return {
    id: 'prod-1',
    source: 'library',
    name: 'Chicken breast',
    displayLabel: '100g · 165 kcal',
    nutritionBasis: 'per100g',
    nutritionPer100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 },
    isComplete: true,
    ...overrides,
  };
}

function makeParserItem(overrides: Partial<MealParserPreviewItem> = {}): MealParserPreviewItem {
  return {
    rawText: '150g chicken',
    displayName: 'Chicken breast',
    status: 'matched',
    selectedProductId: 'prod-1',
    selectedProductName: 'Chicken breast',
    candidates: [],
    inputMode: 'grams',
    inputAmount: 150,
    amountGrams: 150,
    needsReview: false,
    warnings: [],
    ...overrides,
  };
}

function makeAiEstimate(overrides: Partial<AiFoodEstimatePreview> = {}): AiFoodEstimatePreview {
  return {
    displayName: 'Chicken breast',
    estimatedNutritionPer100g: {
      per: '100g',
      calories: 165,
      protein: 31,
      carbs: 0,
      fat: 3.6,
      fiber: 0,
    },
    estimatedPortion: null,
    category: 'protein',
    sourceProduct: null,
    searchTerms: [],
    confidence: 0.9,
    warnings: [],
    ...overrides,
  };
}

function makeScan(overrides: Partial<NutritionLabelScanResult> = {}): NutritionLabelScanResult {
  return {
    productName: 'Oat milk',
    brand: null,
    baseUnit: '100g',
    servingSize: null,
    nutrition: {
      calories: 46,
      protein: 1,
      carbs: 6.6,
      fat: 1.5,
      sugar: null,
      saturatedFat: null,
      fiber: 0.8,
      salt: null,
    },
    ocrConfidence: 0.95,
    aiConfidence: 0.9,
    warnings: [],
    rawOcrText: '',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildFromProduct — gram mode (AC-7)
// ---------------------------------------------------------------------------

describe('buildFromProduct — gram mode', () => {
  it('sets amountGrams equal to the entered value', () => {
    const ing = buildFromProduct(makeProduct(), 'grams', 150);
    expect(ing.amountGrams).toBe(150);
    expect(ing.inputMode).toBe('grams');
    expect(ing.inputAmount).toBe(150);
    expect(ing.unit).toBe('g');
  });

  it('derives nutritionContribution from amountGrams / 100 × nutritionPer100g', () => {
    const ing = buildFromProduct(makeProduct(), 'grams', 150);
    // 150 / 100 = 1.5
    expect(ing.nutritionContribution.calories).toBe(Math.round(165 * 1.5 * 10) / 10); // 247.5
    expect(ing.nutritionContribution.protein).toBe(Math.round(31 * 1.5 * 10) / 10);   // 46.5
    expect(ing.nutritionContribution.carbs).toBe(0);
    expect(ing.nutritionContribution.fat).toBe(Math.round(3.6 * 1.5 * 10) / 10);      // 5.4
    expect(ing.nutritionContribution.fiber).toBe(0);
  });

  it('sets linkedProductId and isAiEstimate correctly', () => {
    const ing = buildFromProduct(makeProduct(), 'grams', 100);
    expect(ing.linkedProductId).toBe('prod-1');
    expect(ing.isAiEstimate).toBe(false);
    expect(ing.category).toBe('food');
  });
});

// ---------------------------------------------------------------------------
// buildFromProduct — portion mode (AC-8)
// ---------------------------------------------------------------------------

describe('buildFromProduct — portion mode', () => {
  const productWithPortion = makeProduct({
    portion: { label: 'Scheibe', weightGrams: 30 },
  });

  it('sets amountGrams = portions × portionWeightGrams', () => {
    const ing = buildFromProduct(productWithPortion, 'portion', 2);
    expect(ing.amountGrams).toBe(60);
    expect(ing.inputMode).toBe('portion');
    expect(ing.inputAmount).toBe(2);
    expect(ing.unit).toBe('Scheibe');
  });

  it('derives nutritionContribution from the resolved amountGrams', () => {
    const ing = buildFromProduct(productWithPortion, 'portion', 2);
    // amountGrams = 60; scale = 0.6
    expect(ing.nutritionContribution.calories).toBe(Math.round(165 * 0.6 * 10) / 10); // 99
    expect(ing.nutritionContribution.protein).toBe(Math.round(31 * 0.6 * 10) / 10);   // 18.6
  });

  it('stores portion metadata on the ingredient', () => {
    const ing = buildFromProduct(productWithPortion, 'portion', 1);
    expect(ing.portionWeightGrams).toBe(30);
    expect(ing.portionLabel).toBe('Scheibe');
  });
});

// ---------------------------------------------------------------------------
// buildFromProduct — gram-only fallback (product has no portion data)
// ---------------------------------------------------------------------------

describe('buildFromProduct — no portion data', () => {
  it('falls back to gram mode even when mode="portion" is passed', () => {
    // Product without portion — mode='portion' should use amount as grams
    const ing = buildFromProduct(makeProduct({ portion: undefined }), 'portion', 80);
    expect(ing.amountGrams).toBe(80);
    expect(ing.portionWeightGrams).toBeUndefined();
    expect(ing.portionLabel).toBeUndefined();
  });

  it('unit falls back to label from the mode parameter in portion mode with no portion data', () => {
    const ing = buildFromProduct(makeProduct({ portion: undefined }), 'portion', 80);
    // inputMode is still 'portion' as passed, but hasPortion is false so unit is 'Portion' via portionLabel fallback
    // Actually: mode='portion', hasPortion=false → amountGrams=amount, unit = portionLabel ?? 'Portion'
    // portionLabel is not set (hasPortion=false) so: unit = portionLabel ?? 'Portion' = undefined ?? 'Portion' = 'Portion'
    expect(ing.unit).toBe('Portion');
  });
});

// ---------------------------------------------------------------------------
// buildFromProduct — isComplete: false guard (product with no nutritionPer100g)
// ---------------------------------------------------------------------------

describe('buildFromProduct — isComplete: false guard', () => {
  it('produces zero nutritionContribution when nutritionPer100g is missing', () => {
    const incompleteProduct = makeProduct({ nutritionPer100g: undefined, isComplete: false });
    const ing = buildFromProduct(incompleteProduct, 'grams', 100);
    expect(ing.nutritionContribution.calories).toBe(0);
    expect(ing.nutritionContribution.protein).toBe(0);
    expect(ing.nutritionContribution.carbs).toBe(0);
    expect(ing.nutritionContribution.fat).toBe(0);
    expect(ing.nutritionContribution.fiber).toBe(0);
  });

  it('stores zero nutritionPer100g when source is missing', () => {
    const incompleteProduct = makeProduct({ nutritionPer100g: undefined, isComplete: false });
    const ing = buildFromProduct(incompleteProduct, 'grams', 100);
    expect(ing.nutritionPer100g).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  });
});

// ---------------------------------------------------------------------------
// buildFromAiEstimate
// ---------------------------------------------------------------------------

describe('buildFromAiEstimate', () => {
  const n = { calories: 200, protein: 10, carbs: 25, fat: 6, fiber: 3 };

  it('scales nutritionContribution correctly for 200g', () => {
    const ing = buildFromAiEstimate('Porridge', 200, n);
    expect(ing.amountGrams).toBe(200);
    expect(ing.nutritionContribution.calories).toBe(Math.round(200 * 2 * 10) / 10); // 400
    expect(ing.nutritionContribution.protein).toBe(Math.round(10 * 2 * 10) / 10);   // 20
    expect(ing.nutritionContribution.fiber).toBe(Math.round(3 * 2 * 10) / 10);      // 6
  });

  it('sets isAiEstimate=true and inputMode=grams', () => {
    const ing = buildFromAiEstimate('Porridge', 100, n);
    expect(ing.isAiEstimate).toBe(true);
    expect(ing.inputMode).toBe('grams');
    expect(ing.unit).toBe('g');
    expect(ing.linkedProductId).toBeNull();
    expect(ing.category).toBe('food');
  });
});

// ---------------------------------------------------------------------------
// buildFromScan
// ---------------------------------------------------------------------------

describe('buildFromScan', () => {
  it('derives nutritionContribution from scan nutrition × amountGrams', () => {
    const ing = buildFromScan('Oat milk', 250, makeScan());
    // scale = 2.5
    expect(ing.amountGrams).toBe(250);
    expect(ing.category).toBe('food');
    expect(ing.nutritionContribution.calories).toBe(Math.round(46 * 2.5 * 10) / 10);  // 115
    expect(ing.nutritionContribution.fiber).toBe(Math.round(0.8 * 2.5 * 10) / 10);    // 2
  });

  it('defaults null nutrition fields to 0', () => {
    const scanWithNulls = makeScan({
      nutrition: {
        calories: 100, protein: null, carbs: null, fat: 5,
        sugar: null, saturatedFat: null, fiber: null, salt: null,
      },
    });
    const ing = buildFromScan('Unknown', 100, scanWithNulls);
    expect(ing.nutritionPer100g.protein).toBe(0);
    expect(ing.nutritionPer100g.carbs).toBe(0);
    expect(ing.nutritionPer100g.fiber).toBe(0);
    expect(ing.nutritionContribution.calories).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// buildIngFromCandidate — gram mode
// ---------------------------------------------------------------------------

describe('buildIngFromCandidate — gram mode', () => {
  const item = makeParserItem({ inputMode: 'grams', inputAmount: 150, amountGrams: 150 });

  it('sets amountGrams from item.amountGrams and derives nutritionContribution', () => {
    const product = makeProduct();
    const ing = buildIngFromCandidate('ing-id', item, product);
    expect(ing.amountGrams).toBe(150);
    expect(ing.inputMode).toBe('grams');
    expect(ing.category).toBe('food');
    expect(ing.nutritionContribution.calories).toBe(Math.round(165 * 1.5 * 10) / 10); // 247.5
    expect(ing.nutritionContribution.protein).toBe(Math.round(31 * 1.5 * 10) / 10);   // 46.5
  });

  it('falls back to inputAmount when item.amountGrams is null', () => {
    const itemNoGrams = makeParserItem({ inputMode: 'grams', inputAmount: 200, amountGrams: null });
    const ing = buildIngFromCandidate('ing-id', itemNoGrams, makeProduct());
    expect(ing.amountGrams).toBe(200);
  });

  it('uses gram mode when product has no portion data', () => {
    const itemPortion = makeParserItem({ inputMode: 'portion', inputAmount: 2, amountGrams: null });
    const noPortion = makeProduct({ portion: undefined });
    const ing = buildIngFromCandidate('ing-id', itemPortion, noPortion);
    expect(ing.inputMode).toBe('grams');
  });

  it('preserves the provided id', () => {
    const ing = buildIngFromCandidate('custom-id', item, makeProduct());
    expect(ing.id).toBe('custom-id');
  });
});

// ---------------------------------------------------------------------------
// buildIngFromCandidate — portion mode
// ---------------------------------------------------------------------------

describe('buildIngFromCandidate — portion mode', () => {
  const productWithPortion = makeProduct({
    portion: { label: 'Stück', weightGrams: 50 },
  });

  it('resolves amountGrams = inputAmount × portionWeightGrams', () => {
    const item = makeParserItem({ inputMode: 'portion', inputAmount: 3, amountGrams: null });
    const ing = buildIngFromCandidate('ing-id', item, productWithPortion);
    expect(ing.amountGrams).toBe(150);
    expect(ing.inputMode).toBe('portion');
    expect(ing.unit).toBe('Stück');
  });

  it('derives nutritionContribution from resolved amountGrams', () => {
    const item = makeParserItem({ inputMode: 'portion', inputAmount: 3, amountGrams: null });
    const ing = buildIngFromCandidate('ing-id', item, productWithPortion);
    // amountGrams = 150, scale = 1.5
    expect(ing.nutritionContribution.calories).toBe(Math.round(165 * 1.5 * 10) / 10); // 247.5
  });

  it('defaults inputAmount to 1 when item.inputAmount is null and product has portions', () => {
    const item = makeParserItem({ inputMode: 'portion', inputAmount: null, amountGrams: null });
    const ing = buildIngFromCandidate('ing-id', item, productWithPortion);
    expect(ing.inputAmount).toBe(1);
    expect(ing.amountGrams).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// buildIngFromAiEstimate
// ---------------------------------------------------------------------------

describe('buildIngFromAiEstimate', () => {
  it('uses item.amountGrams for calculation', () => {
    const item = makeParserItem({ inputMode: 'grams', inputAmount: 120, amountGrams: 120 });
    const ing = buildIngFromAiEstimate('ing-id', item, makeAiEstimate());
    expect(ing.amountGrams).toBe(120);
    expect(ing.nutritionContribution.calories).toBe(Math.round(165 * 1.2 * 10) / 10); // 198
  });

  it('falls back to inputAmount then 100 when amountGrams is null', () => {
    const itemNoGrams = makeParserItem({ inputMode: 'grams', inputAmount: 80, amountGrams: null });
    const ing = buildIngFromAiEstimate('ing-id', itemNoGrams, makeAiEstimate());
    expect(ing.amountGrams).toBe(80);
  });

  it('defaults fiber to 0 when estimate has no fiber', () => {
    const estimateNoFiber = makeAiEstimate({
      estimatedNutritionPer100g: { per: '100g', calories: 200, protein: 10, carbs: 20, fat: 8 },
    });
    const ing = buildIngFromAiEstimate('ing-id', makeParserItem(), estimateNoFiber);
    expect(ing.nutritionPer100g.fiber).toBe(0);
    expect(ing.nutritionContribution.fiber).toBe(0);
  });

  it('sets isAiEstimate=true', () => {
    const ing = buildIngFromAiEstimate('ing-id', makeParserItem(), makeAiEstimate());
    expect(ing.isAiEstimate).toBe(true);
    expect(ing.category).toBe('food');
  });

  it('marks a wizard AI estimate as explicitly confirmed', () => {
    const state = buildWizardIngredientFromAiEstimate('ing-id', makeParserItem(), makeAiEstimate());
    expect(state.status).toBe('confirmed');
    expect(state.userConfirmed).toBe(true);
    expect(state.resolvedIngredient.isAiEstimate).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildIngFromSeasoning
// ---------------------------------------------------------------------------

describe('buildIngFromSeasoning', () => {
  it('produces zero nutrition contribution', () => {
    const item = makeParserItem({ displayName: 'Salt', amountGrams: 5, kitchenAmountText: '1 TL' });
    const ing = buildIngFromSeasoning('ing-id', item);
    expect(ing.nutritionContribution).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
    expect(ing.nutritionPer100g).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
    expect(ing.category).toBe('seasoning');
    expect(ing.amountLabel).toBe('1 TL');
  });

  it('preserves an indeterminate amount as null', () => {
    const itemNoGrams = makeParserItem({ amountGrams: null });
    const ing = buildIngFromSeasoning('ing-id', itemNoGrams);
    expect(ing.inputAmount).toBeNull();
    expect(ing.amountGrams).toBeNull();
    expect(ing.amountLabel).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Cross-check: nutritionContribution ≈ calculateRecipeNutrition([ing], 1).nutritionTotal (AC-12)
// ---------------------------------------------------------------------------

describe('cross-check: builder nutritionContribution matches calculateRecipeNutrition', () => {
  it('buildFromProduct gram mode', () => {
    const ing = buildFromProduct(makeProduct(), 'grams', 150);
    const { nutritionTotal } = calculateRecipeNutrition([ing], 1);
    expect(nutritionTotal.calories).toBe(ing.nutritionContribution.calories);
    expect(nutritionTotal.protein).toBe(ing.nutritionContribution.protein);
    expect(nutritionTotal.carbs).toBe(ing.nutritionContribution.carbs);
    expect(nutritionTotal.fat).toBe(ing.nutritionContribution.fat);
    expect(nutritionTotal.fiber).toBe(ing.nutritionContribution.fiber);
  });

  it('buildFromProduct portion mode', () => {
    const ing = buildFromProduct(
      makeProduct({ portion: { label: 'Scheibe', weightGrams: 30 } }),
      'portion',
      3,
    );
    const { nutritionTotal } = calculateRecipeNutrition([ing], 1);
    expect(nutritionTotal.calories).toBe(ing.nutritionContribution.calories);
    expect(nutritionTotal.protein).toBe(ing.nutritionContribution.protein);
  });

  it('buildFromAiEstimate', () => {
    const n = { calories: 350, protein: 12, carbs: 55, fat: 9, fiber: 4 };
    const ing = buildFromAiEstimate('Granola', 80, n);
    const { nutritionTotal } = calculateRecipeNutrition([ing], 1);
    expect(nutritionTotal.calories).toBe(ing.nutritionContribution.calories);
    expect(nutritionTotal.protein).toBe(ing.nutritionContribution.protein);
  });

  it('buildIngFromCandidate gram mode', () => {
    const item = makeParserItem({ inputMode: 'grams', inputAmount: 200, amountGrams: 200 });
    const ing = buildIngFromCandidate('ing-id', item, makeProduct());
    const { nutritionTotal } = calculateRecipeNutrition([ing], 1);
    expect(nutritionTotal.calories).toBe(ing.nutritionContribution.calories);
    expect(nutritionTotal.protein).toBe(ing.nutritionContribution.protein);
  });

  it('buildIngFromCandidate portion mode', () => {
    const item = makeParserItem({ inputMode: 'portion', inputAmount: 2, amountGrams: null });
    const ing = buildIngFromCandidate(
      'ing-id',
      item,
      makeProduct({ portion: { label: 'Stück', weightGrams: 50 } }),
    );
    const { nutritionTotal } = calculateRecipeNutrition([ing], 1);
    expect(nutritionTotal.calories).toBe(ing.nutritionContribution.calories);
  });

  it('perPortion = total / servings for a 4-portion recipe', () => {
    const ing = buildFromProduct(makeProduct(), 'grams', 400);
    const { nutritionTotal, nutritionPerPortion } = calculateRecipeNutrition([ing], 4);
    expect(nutritionPerPortion.calories).toBe(Math.round((nutritionTotal.calories / 4) * 10) / 10);
  });
});
