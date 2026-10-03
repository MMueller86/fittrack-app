import { describe, expect, it, vi } from 'vitest';
import type { Recipe, RecipeExportViewInput, RecipeIngredient } from '@fittrack/shared';
import type { WizardExportDraft } from './recipeWizardTypes';
import {
  buildRecipeShareExportDraftFromPending,
  buildRecipeShareExportDraftFromPreparation,
  buildRecipeShareExportDraftFromStored,
  isSameRecipeExportView,
  validateRecipeShareExportDraft,
} from './recipeShareExportView';
import type { PendingRecipeExportDraft } from './recipeWizardExportView';

vi.mock('expo-crypto', () => ({ randomUUID: () => 'test-uuid' }));

const zeroNutrition = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

function makeIngredient(id: string, category: 'food' | 'seasoning' = 'food'): RecipeIngredient {
  return {
    id,
    displayName: id,
    inputMode: 'grams',
    inputAmount: 100,
    amountGrams: 100,
    unit: 'g',
    linkedProductId: null,
    linkedReusableItemId: null,
    isAiEstimate: false,
    category,
    nutritionPer100g: zeroNutrition,
    nutritionContribution: zeroNutrition,
  };
}

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'recipe-1',
    ownerUserId: 'user-1',
    name: 'Tomatensalat',
    description: 'Tomaten schneiden.',
    portions: 2,
    ingredients: [makeIngredient('food-1'), makeIngredient('spice-1', 'seasoning')],
    steps: [{ order: 1, description: 'Tomaten schneiden.' }],
    images: [],
    nutritionTotal: zeroNutrition,
    nutritionPerPortion: zeroNutrition,
    visibility: 'private',
    sharedWithUserIds: [],
    tags: [],
    usageCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeView(overrides: Partial<RecipeExportViewInput> = {}): RecipeExportViewInput {
  return {
    version: 1,
    teaser: 'Frisch und schnell',
    totalTimeMinutes: 15,
    difficulty: 'Einfach',
    steps: [{ order: 1, description: 'Tomaten schneiden.' }],
    includedIngredientIds: ['food-1'],
    ...overrides,
  };
}

function makeShareDraft(overrides: Partial<WizardExportDraft> = {}): WizardExportDraft {
  return {
    version: 1,
    teaser: 'x',
    totalTimeMinutes: '15',
    difficulty: 'Einfach',
    steps: [{ order: 1, description: 'x' }],
    includedIngredientIds: ['food-1'],
    includedIngredientKeys: [],
    analysisIngredientKeys: [],
    source: 'persisted',
    confirmed: false,
    ...overrides,
  };
}

function makeFoodIngredients(count: number): RecipeIngredient[] {
  return Array.from({ length: count }, (_, index) => makeIngredient(`food-${index + 1}`));
}

function makePending(overrides: Partial<PendingRecipeExportDraft> = {}): PendingRecipeExportDraft {
  return {
    version: 1,
    teaser: 'Frisch und schnell',
    totalTimeMinutes: null,
    difficulty: null,
    steps: [{ order: 7, description: 'Tomaten schneiden.' }],
    includedIngredientIds: ['food-1'],
    ...overrides,
  };
}

describe('recipeShareExportView', () => {
  it('keeps pending analyzer metadata blank and carries only resolved saved ingredient IDs', () => {
    const draft = buildRecipeShareExportDraftFromPending(makePending());

    expect(draft).toMatchObject({
      totalTimeMinutes: '',
      difficulty: '',
      steps: [{ order: 1, description: 'Tomaten schneiden.' }],
      includedIngredientIds: ['food-1'],
      includedIngredientKeys: [],
      analysisIngredientKeys: [],
      confirmed: false,
    });
  });

  it('reuses a stale stored view and does not treat its status as a preparation gate', () => {
    const recipe = makeRecipe({
      exportView: { ...makeView(), sourceFingerprint: 'sha256:old' },
      exportViewStatus: 'stale',
    });

    expect(buildRecipeShareExportDraftFromStored(recipe)).toMatchObject({
      teaser: 'Frisch und schnell',
      includedIngredientIds: ['food-1'],
      source: 'persisted',
    });
  });

  it('uses the established legacy ingredient default for prepared drafts', () => {
    const suggestion = {
      version: 1 as const,
      teaser: 'Vorbereitete Texte',
      totalTimeMinutes: null,
      difficulty: null,
      steps: [{ order: 1, description: 'Tomaten schneiden.' }],
    };

    expect(buildRecipeShareExportDraftFromPreparation(makeRecipe(), suggestion))
      .toMatchObject({
        teaser: 'Vorbereitete Texte',
        totalTimeMinutes: '',
        difficulty: '',
        includedIngredientIds: ['food-1'],
        source: 'prepared',
      });

    const manyIngredients = Array.from({ length: 21 }, (_, index) => makeIngredient(`food-${index}`));
    expect(buildRecipeShareExportDraftFromPreparation(
      makeRecipe({ ingredients: manyIngredients }),
      suggestion,
    ).includedIngredientIds).toEqual([]);
  });

  it('validates the share draft against saved non-seasoning ingredient IDs', () => {
    const recipe = makeRecipe();
    const validDraft = buildRecipeShareExportDraftFromPending(makePending({
      totalTimeMinutes: 1,
      difficulty: 'Einfach',
    }));

    expect(validateRecipeShareExportDraft(validDraft, recipe).errors).toEqual([]);
    expect(validateRecipeShareExportDraft({
      ...validDraft,
      includedIngredientIds: ['spice-1'],
      difficulty: 'Einfach\nSchwer',
    }, recipe).errors).toEqual([
      'Bitte gib eine Schwierigkeit in einer Zeile an.',
      'Prüfe die ausgewählten Zutaten und ihre Bestätigung.',
    ]);
    expect(validateRecipeShareExportDraft({
      ...validDraft,
      totalTimeMinutes: '',
    }, recipe).errors).toContain('Bitte gib eine ganze Zubereitungszeit zwischen 1 und 10080 Minuten an.');
  });

  it('compares client fields without sending or depending on the server fingerprint', () => {
    const recipe = makeRecipe({
      exportView: { ...makeView(), sourceFingerprint: 'sha256:server-owned' },
    });

    expect(isSameRecipeExportView(recipe.exportView, makeView())).toBe(true);
    expect(isSameRecipeExportView(recipe.exportView, makeView({ teaser: 'Geändert' }))).toBe(false);
  });
});

describe('recipe share export validation boundaries', () => {
  it('allows nullable preparation metadata in the transient bundle but rejects an incomplete confirmation', () => {
    const validation = validateRecipeShareExportDraft(makeShareDraft({
      totalTimeMinutes: '',
      difficulty: '',
    }), makeRecipe());

    expect(validation.bundleDraft).toEqual({
      version: 1,
      teaser: 'x',
      totalTimeMinutes: null,
      difficulty: null,
      steps: [{ order: 1, description: 'x' }],
      includedIngredientIds: ['food-1'],
    });
    expect(validation.previewErrors).toEqual([]);
    expect(validation.exportView).toBeNull();
    expect(validation.saveErrors).toEqual([
      'Bitte gib eine ganze Zubereitungszeit zwischen 1 und 10080 Minuten an.',
      'Bitte gib eine Schwierigkeit in einer Zeile an.',
    ]);
  });

  it.each([
    ['trimmed minimum', ' x ', 'x'],
    ['trimmed maximum', `${'x'.repeat(96)}  `, 'x'.repeat(96)],
  ])('accepts a teaser at the %s boundary', (_boundary, teaser, expected) => {
    const validation = validateRecipeShareExportDraft(makeShareDraft({ teaser }), makeRecipe());

    expect(validation.errors).toEqual([]);
    expect(validation.exportView?.teaser).toBe(expected);
  });

  it.each([
    ['empty after trimming', '  ', 'Bitte gib einen Teaser ein.'],
    ['over 96 characters', 'x'.repeat(97), 'Der Teaser darf höchstens 96 Zeichen umfassen.'],
  ])('rejects a teaser that is %s', (_boundary, teaser, expectedError) => {
    const validation = validateRecipeShareExportDraft(makeShareDraft({ teaser }), makeRecipe());

    expect(validation.exportView).toBeNull();
    expect(validation.errors).toContain(expectedError);
  });

  it.each([
    ['minimum', '1', 1],
    ['maximum', '10080', 10080],
  ])('accepts an integer time at the %s boundary', (_boundary, totalTimeMinutes, expected) => {
    const validation = validateRecipeShareExportDraft(
      makeShareDraft({ totalTimeMinutes }),
      makeRecipe(),
    );

    expect(validation.errors).toEqual([]);
    expect(validation.exportView?.totalTimeMinutes).toBe(expected);
  });

  it.each([
    ['zero', '0'],
    ['above the maximum', '10081'],
    ['non-integer', '1.5'],
  ])('rejects a %s time value', (_boundary, totalTimeMinutes) => {
    const validation = validateRecipeShareExportDraft(
      makeShareDraft({ totalTimeMinutes }),
      makeRecipe(),
    );

    expect(validation.exportView).toBeNull();
    expect(validation.errors).toContain(
      'Bitte gib eine ganze Zubereitungszeit zwischen 1 und 10080 Minuten an.',
    );
  });

  it('accepts one and five export steps', () => {
    const oneStep = validateRecipeShareExportDraft(makeShareDraft(), makeRecipe());
    const fiveSteps = validateRecipeShareExportDraft(makeShareDraft({
      steps: Array.from({ length: 5 }, (_, index) => ({
        order: index + 1,
        description: `Schritt ${index + 1}`,
      })),
    }), makeRecipe());

    expect(oneStep.errors).toEqual([]);
    expect(fiveSteps.errors).toEqual([]);
    expect(fiveSteps.exportView?.steps.map((step) => step.order)).toEqual([1, 2, 3, 4, 5]);
  });

  it.each([
    [0, 'Die Exportansicht benötigt mindestens einen Zubereitungsschritt.'],
    [6, 'Es sind höchstens 5 Exportschritte erlaubt.'],
  ])('rejects %s export steps', (count, expectedError) => {
    const validation = validateRecipeShareExportDraft(makeShareDraft({
      steps: Array.from({ length: count }, (_, index) => ({
        order: index + 1,
        description: `Schritt ${index + 1}`,
      })),
    }), makeRecipe());

    expect(validation.exportView).toBeNull();
    expect(validation.errors).toContain(expectedError);
  });

  it.each([
    ['a non-empty trimmed step', ' Schritt ', 'Schritt'],
    ['a 90-character step', 'x'.repeat(90), 'x'.repeat(90)],
  ])('accepts %s', (_boundary, description, expected) => {
    const validation = validateRecipeShareExportDraft(makeShareDraft({
      steps: [{ order: 1, description }],
    }), makeRecipe());

    expect(validation.errors).toEqual([]);
    expect(validation.exportView?.steps[0]?.description).toBe(expected);
  });

  it.each([
    ['an empty step', '  ', 'Exportschritt 1 darf nicht leer sein.'],
    ['a 91-character step', 'x'.repeat(91), 'Exportschritt 1 darf höchstens 90 Zeichen umfassen.'],
  ])('rejects %s', (_boundary, description, expectedError) => {
    const validation = validateRecipeShareExportDraft(makeShareDraft({
      steps: [{ order: 1, description }],
    }), makeRecipe());

    expect(validation.exportView).toBeNull();
    expect(validation.errors).toContain(expectedError);
  });

  it('accepts 20 unique included ingredient IDs and rejects more than 20', () => {
    const twentyIngredients = makeFoodIngredients(20);
    const twentyIds = twentyIngredients.map((ingredient) => ingredient.id);
    const accepted = validateRecipeShareExportDraft(
      makeShareDraft({ includedIngredientIds: twentyIds }),
      makeRecipe({ ingredients: twentyIngredients }),
    );
    const twentyOneIngredients = makeFoodIngredients(21);
    const rejected = validateRecipeShareExportDraft(
      makeShareDraft({
        includedIngredientIds: twentyOneIngredients.map((ingredient) => ingredient.id),
      }),
      makeRecipe({ ingredients: twentyOneIngredients }),
    );

    expect(accepted.errors).toEqual([]);
    expect(accepted.exportView?.includedIngredientIds).toHaveLength(20);
    expect(rejected.exportView).toBeNull();
    expect(rejected.errors).toContain('Es können höchstens 20 Zutaten ausgewählt werden.');
  });

  it.each([
    ['duplicate', ['food-1', 'food-1'], makeRecipe()],
    ['unknown', ['unknown-food'], makeRecipe()],
    ['seasoning', ['spice-1'], makeRecipe()],
  ])('rejects %s included ingredient IDs', (_caseName, includedIngredientIds, recipe) => {
    const validation = validateRecipeShareExportDraft(
      makeShareDraft({ includedIngredientIds }),
      recipe,
    );

    expect(validation.exportView).toBeNull();
    expect(validation.errors).toContain('Prüfe die ausgewählten Zutaten und ihre Bestätigung.');
  });
});