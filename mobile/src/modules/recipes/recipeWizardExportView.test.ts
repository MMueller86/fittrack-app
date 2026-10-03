import { describe, expect, it } from 'vitest';
import type { RecipeIngredient } from '@fittrack/shared';
import type { MealParserPreviewItem } from '../../shared/api/aiApi';
import type {
  WizardExportDraft,
  WizardIngredient,
} from './recipeWizardTypes';
import {
  buildPendingRecipeExportDraft,
  buildConfirmedWizardExportRequest,
  getRecipeWizardHttpStatus,
  isRecipeRevisionConflict,
  validateWizardExportDraft,
} from './recipeWizardExportView';

const zeroNutrition = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

function makeIngredient(id = 'recipe-ingredient-1'): RecipeIngredient {
  return {
    id,
    displayName: 'Tomaten',
    inputMode: 'grams',
    inputAmount: 100,
    amountGrams: 100,
    unit: 'g',
    linkedProductId: 'food-1',
    linkedReusableItemId: null,
    isAiEstimate: false,
    category: 'food',
    nutritionPer100g: zeroNutrition,
    nutritionContribution: zeroNutrition,
  };
}

function makeWizardIngredient(overrides: Partial<WizardIngredient> = {}): WizardIngredient {
  const parserItem: MealParserPreviewItem = {
    rawText: '100 g Tomaten',
    displayName: 'Tomaten',
    status: 'matched',
    selectedProductId: 'food-1',
    selectedProductName: 'Tomaten',
    candidates: [],
    inputMode: 'grams',
    inputAmount: 100,
    amountGrams: 100,
    needsReview: false,
    warnings: [],
  };
  return {
    id: 'wizard-ingredient-1',
    analysisKey: 'tomato-key',
    parserItem,
    status: 'confirmed',
    userConfirmed: true,
    resolvedIngredient: makeIngredient(),
    ...overrides,
  };
}

function makeDraft(overrides: Partial<WizardExportDraft> = {}): WizardExportDraft {
  return {
    version: 1,
    teaser: 'Frischer Salat',
    totalTimeMinutes: '15',
    difficulty: 'Einfach',
    steps: [{ order: 1, description: 'Tomaten schneiden.' }],
    includedIngredientIds: [],
    includedIngredientKeys: ['tomato-key'],
    analysisIngredientKeys: ['tomato-key'],
    source: 'analysis',
    confirmed: false,
    ...overrides,
  };
}

describe('validateWizardExportDraft', () => {
  it('maps a selected stable analysis key to its single confirmed recipe ingredient ID', () => {
    const result = validateWizardExportDraft(makeDraft(), [makeWizardIngredient()]);

    expect(result.errors).toEqual([]);
    expect(result.exportView?.includedIngredientIds).toEqual(['recipe-ingredient-1']);
  });

  it.each([
    ['missing association', []],
    ['ambiguous association', [makeWizardIngredient(), makeWizardIngredient({ id: 'wizard-ingredient-2' })]],
    ['unconfirmed ingredient', [makeWizardIngredient({ userConfirmed: false })]],
    ['seasoning ingredient', [makeWizardIngredient({
      resolvedIngredient: { ...makeIngredient(), category: 'seasoning' },
    })]],
  ])('blocks a %s instead of persisting an analysis key as an ingredient ID', (_caseName, ingredients) => {
    const result = validateWizardExportDraft(makeDraft(), ingredients);

    expect(result.exportView).toBeNull();
    expect(result.ingredientResolution.unresolvedAnalysisKeys).toEqual(['tomato-key']);
    expect(result.errors).toContain('Bestätige oder entferne alle nicht eindeutig zugeordneten KI-Zutaten.');
  });

  it('blocks malformed or overlong export steps without truncating them', () => {
    const steps = Array.from({ length: 6 }, (_, index) => ({
      order: index + 1,
      description: `Schritt ${index + 1}`,
    }));
    const result = validateWizardExportDraft(makeDraft({ steps }), [makeWizardIngredient()]);

    expect(result.exportView).toBeNull();
    expect(result.errors).toContain('Es sind höchstens 5 Exportschritte erlaubt.');
    expect(result.ingredientResolution.includedIngredientIds).toEqual(['recipe-ingredient-1']);
  });

  it('uses existing recipe ingredient IDs for a prepared export view', () => {
    const result = validateWizardExportDraft(makeDraft({
      includedIngredientIds: ['recipe-ingredient-1'],
      includedIngredientKeys: [],
      analysisIngredientKeys: [],
      source: 'prepared',
    }), [makeWizardIngredient()]);

    expect(result.errors).toEqual([]);
    expect(result.exportView?.includedIngredientIds).toEqual(['recipe-ingredient-1']);
  });

  it('blocks the same recipe ingredient assigned to multiple AI keys', () => {
    const ingredients = [
      makeWizardIngredient(),
      makeWizardIngredient({
        id: 'wizard-ingredient-2',
        analysisKey: 'tomato-alias-key',
        resolvedIngredient: makeIngredient('recipe-ingredient-1'),
      }),
    ];
    const result = validateWizardExportDraft(makeDraft({
      includedIngredientKeys: ['tomato-key', 'tomato-alias-key'],
    }), ingredients);

    expect(result.exportView).toBeNull();
    expect(result.ingredientResolution.collidingAnalysisKeys).toEqual(['tomato-key', 'tomato-alias-key']);
  });
});

describe('buildPendingRecipeExportDraft', () => {
  it('serializes only suggestion text and uniquely resolved confirmed food IDs', () => {
    const draft = makeDraft({
      includedIngredientKeys: [
        'tomato-key',
        'unconfirmed-key',
        'seasoning-key',
        'collision-key-a',
        'collision-key-b',
      ],
      analysisIngredientKeys: [
        'tomato-key',
        'unconfirmed-key',
        'seasoning-key',
        'collision-key-a',
        'collision-key-b',
      ],
    });
    const ingredients = [
      makeWizardIngredient(),
      makeWizardIngredient({
        id: 'wizard-unconfirmed',
        analysisKey: 'unconfirmed-key',
        userConfirmed: false,
        resolvedIngredient: makeIngredient('recipe-ingredient-unconfirmed'),
      }),
      makeWizardIngredient({
        id: 'wizard-seasoning',
        analysisKey: 'seasoning-key',
        resolvedIngredient: { ...makeIngredient('recipe-ingredient-seasoning'), category: 'seasoning' },
      }),
      makeWizardIngredient({
        id: 'wizard-collision-a',
        analysisKey: 'collision-key-a',
        resolvedIngredient: makeIngredient('recipe-ingredient-collision'),
      }),
      makeWizardIngredient({
        id: 'wizard-collision-b',
        analysisKey: 'collision-key-b',
        resolvedIngredient: makeIngredient('recipe-ingredient-collision'),
      }),
    ];

    const pendingDraft = buildPendingRecipeExportDraft(draft, ingredients);

    expect(pendingDraft).toEqual({
      version: 1,
      teaser: 'Frischer Salat',
      totalTimeMinutes: 15,
      difficulty: 'Einfach',
      steps: [{ order: 1, description: 'Tomaten schneiden.' }],
      includedIngredientIds: ['recipe-ingredient-1'],
    });
    expect(JSON.parse(JSON.stringify(pendingDraft))).toEqual(pendingDraft);
  });

  it('keeps missing metadata nullable and does not create a pending draft for other sources', () => {
    expect(buildPendingRecipeExportDraft(
      makeDraft({ totalTimeMinutes: '', difficulty: '  ' }),
      [makeWizardIngredient()],
    )).toMatchObject({ totalTimeMinutes: null, difficulty: null });

    expect(buildPendingRecipeExportDraft(
      makeDraft({ source: 'prepared' }),
      [makeWizardIngredient()],
    )).toBeUndefined();
  });
});

describe('recipe wizard revision conflicts', () => {
  it('recognizes only the explicit server CAS response as a reload conflict', () => {
    const error = {
      response: { status: 412, data: { error: 'recipe_revision_conflict' } },
    };

    expect(getRecipeWizardHttpStatus(error)).toBe(412);
    expect(isRecipeRevisionConflict(error)).toBe(true);
    expect(getRecipeWizardHttpStatus({ response: { status: 428 } })).toBe(428);
    expect(isRecipeRevisionConflict({
      response: { status: 412, data: { error: 'another_error' } },
    })).toBe(false);
    expect(isRecipeRevisionConflict({ response: { status: 412 } })).toBe(false);
    expect(isRecipeRevisionConflict({ response: { status: 500 } })).toBe(false);
  });
});

describe('buildConfirmedWizardExportRequest', () => {
  it('does not create export fields until the user explicitly confirms the draft', () => {
    expect(buildConfirmedWizardExportRequest(makeDraft(), [makeWizardIngredient()])).toBeNull();
  });

  it('builds the exact request-only confirmation pair from a valid confirmed draft', () => {
    const draft = makeDraft({ confirmed: true });

    expect(buildConfirmedWizardExportRequest(draft, [makeWizardIngredient()])).toEqual({
      exportView: {
        version: 1,
        teaser: 'Frischer Salat',
        totalTimeMinutes: 15,
        difficulty: 'Einfach',
        steps: [{ order: 1, description: 'Tomaten schneiden.' }],
        includedIngredientIds: ['recipe-ingredient-1'],
      },
      exportViewAction: 'confirm',
    });
  });

  it('serializes only unique ingredient IDs and never includes local resolution data', () => {
    const request = buildConfirmedWizardExportRequest(
      makeDraft({ confirmed: true }),
      [makeWizardIngredient()],
    );

    expect(request).toEqual({
      exportView: {
        version: 1,
        teaser: 'Frischer Salat',
        totalTimeMinutes: 15,
        difficulty: 'Einfach',
        steps: [{ order: 1, description: 'Tomaten schneiden.' }],
        includedIngredientIds: ['recipe-ingredient-1'],
      },
      exportViewAction: 'confirm',
    });
    expect(request).not.toHaveProperty('ingredientResolutions');
    expect(request?.exportView).not.toHaveProperty('sourceEtag');
  });

  it('does not create export fields from an explicitly confirmed but invalid draft', () => {
    expect(buildConfirmedWizardExportRequest(
      makeDraft({ confirmed: true, totalTimeMinutes: '' }),
      [makeWizardIngredient()],
    )).toBeNull();
  });
});