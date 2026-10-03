import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_RECIPE_IMAGE_HERO_CROP } from '@fittrack/shared';
import type { Recipe, RecipeExportSuggestion, RecipeIngredient } from '@fittrack/shared';
import {
  buildRecipeWizardEditBootstrapState,
  buildWizardExportDraftFromPreparedSuggestion,
  buildWizardExportDraftFromSuggestion,
  loadRecipeWizardEditState,
} from './recipeWizardEditBootstrap';

vi.mock('expo-crypto', () => ({ randomUUID: vi.fn(() => 'step-uuid') }));

const zeroNutrition = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

function makeIngredient(overrides: Partial<RecipeIngredient> = {}): RecipeIngredient {
  return {
    id: 'ing-1',
    displayName: 'Tomaten',
    inputMode: 'grams',
    inputAmount: 200,
    amountGrams: 200,
    unit: 'g',
    linkedProductId: 'food-1',
    linkedReusableItemId: null,
    isAiEstimate: false,
    category: 'food',
    nutritionPer100g: { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2 },
    nutritionContribution: { calories: 36, protein: 1.8, carbs: 7.8, fat: 0.4, fiber: 2.4 },
    ...overrides,
  };
}

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'recipe-1',
    ownerUserId: 'user-1',
    name: 'Tomatensalat',
    description: 'Frisch',
    portions: 2,
    ingredients: [makeIngredient()],
    steps: [
      { order: 2, title: 'Servieren', description: 'Anrichten.' },
      { order: 1, description: 'Tomaten schneiden.' },
    ],
    images: [],
    nutritionTotal: zeroNutrition,
    nutritionPerPortion: zeroNutrition,
    visibility: 'private',
    sharedWithUserIds: [],
    tags: ['salat'],
    usageCount: 0,
    createdAt: '2026-08-12T00:00:00.000Z',
    updatedAt: '2026-08-12T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildRecipeWizardEditBootstrapState', () => {
  it.each([1, 50])('keeps valid persisted portions at %s', (portions) => {
    const state = buildRecipeWizardEditBootstrapState(makeRecipe({ portions }));

    expect(state.portions).toBe(portions);
  });

  it.each([0, 51, 2.5])('normalizes invalid persisted portions %s', (portions) => {
    const state = buildRecipeWizardEditBootstrapState(makeRecipe({ portions }));

    expect(state.portions).toBe(4);
  });

  it('maps persisted food ingredients to confirmed wizard ingredients and amount edits', () => {
    const state = buildRecipeWizardEditBootstrapState(makeRecipe());

    expect(state.ingredients).toHaveLength(1);
    expect(state.ingredients[0]).toMatchObject({
      id: 'ing-1',
      status: 'confirmed',
      userConfirmed: true,
      parserItem: {
        displayName: 'Tomaten',
        status: 'matched',
        selectedProductId: 'food-1',
        inputMode: 'grams',
        inputAmount: 200,
        amountGrams: 200,
      },
    });
    expect(state.ingredients[0]?.resolvedIngredient?.displayName).toBe('Tomaten');
    expect(state.amountEdits).toEqual({ 'ing-1': { mode: 'grams', value: '200' } });
  });

  it('keeps seasonings confirmed with their kitchen amount label', () => {
    const state = buildRecipeWizardEditBootstrapState(makeRecipe({
      ingredients: [makeIngredient({
        id: 'salt',
        displayName: 'Salz',
        inputAmount: null,
        amountGrams: null,
        amountLabel: '1 TL',
        linkedProductId: null,
        category: 'seasoning',
        nutritionPer100g: zeroNutrition,
        nutritionContribution: zeroNutrition,
      })],
    }));

    expect(state.ingredients[0]).toMatchObject({
      id: 'salt',
      status: 'seasoning',
      userConfirmed: true,
      parserItem: {
        rawText: '1 TL Salz',
        status: 'seasoning',
        kitchenAmountText: '1 TL',
      },
    });
    expect(state.amountEdits).toEqual({});
  });

  it('sorts persisted steps by order for the wizard step phase', () => {
    const state = buildRecipeWizardEditBootstrapState(makeRecipe());

    expect(state.steps).toEqual([
      { id: 'step-uuid', title: '', description: 'Tomaten schneiden.' },
      { id: 'step-uuid', title: 'Servieren', description: 'Anrichten.' },
    ]);
  });

  it('maps persisted recipe images to sorted editable image drafts', () => {
    const state = buildRecipeWizardEditBootstrapState(makeRecipe({
      images: [
        {
          id: 'image-2',
          blobName: 'u/r/image-2.jpg',
          order: 2,
          url: 'https://example.test/image-2.jpg',
          heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusX: 0.2, zoom: 1.4 },
        },
        { id: 'image-hidden', blobName: 'u/r/image-hidden.jpg', order: 3 },
        { id: 'image-1', blobName: 'u/r/image-1.jpg', order: 1, url: 'https://example.test/image-1.jpg' },
      ],
    }));

    expect(state.images).toEqual([
      {
        draftId: 'existing:image-1',
        source: 'existing',
        imageId: 'image-1',
        uri: 'https://example.test/image-1.jpg',
        order: 1,
        heroCrop: DEFAULT_RECIPE_IMAGE_HERO_CROP,
      },
      {
        draftId: 'existing:image-2',
        source: 'existing',
        imageId: 'image-2',
        uri: 'https://example.test/image-2.jpg',
        order: 2,
        heroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusX: 0.2, zoom: 1.4 },
      },
    ]);
  });

  it('keeps legacy export draft values explicit and avoids silent truncation on fallback', () => {
    const state = buildRecipeWizardEditBootstrapState(makeRecipe({
      ingredients: Array.from({ length: 25 }, (_, index) => makeIngredient({
        id: `ing-${index + 1}`,
        displayName: `Zutat ${index + 1}`,
        linkedProductId: null,
      })),
      steps: [
        { order: 1, description: 'Schritt 1' },
        { order: 2, description: 'Schritt 2' },
        { order: 3, description: 'Schritt 3' },
        { order: 4, description: 'Schritt 4' },
        { order: 5, description: 'Schritt 5' },
        { order: 6, description: 'Schritt 6' },
      ],
    }));

    expect(state.exportDraft).not.toBeNull();
    expect(state.exportDraft?.totalTimeMinutes).toBe('');
    expect(state.exportDraft?.difficulty).toBe('');
    expect(state.exportDraft?.steps).toHaveLength(6);
    expect(state.exportDraft?.includedIngredientIds).toEqual([]);
    expect(state.exportDraft?.includedIngredientKeys).toEqual([]);
    expect(state.exportDraft?.source).toBe('legacy');
    expect(state.exportDraft?.confirmed).toBe(false);
  });

  it('includes every legacy food ingredient by default when there are at most twenty', () => {
    const state = buildRecipeWizardEditBootstrapState(makeRecipe({
      ingredients: [
        makeIngredient({ id: 'food-1' }),
        makeIngredient({ id: 'food-2', displayName: 'Gurke' }),
        makeIngredient({ id: 'seasoning-1', displayName: 'Salz', category: 'seasoning' }),
      ],
    }));

    expect(state.exportDraft?.includedIngredientIds).toEqual(['food-1', 'food-2']);
  });

  it('loads a persisted export view for review without auto-confirming it', () => {
    const state = buildRecipeWizardEditBootstrapState(makeRecipe({
      exportView: {
        version: 1,
        teaser: 'Frischer Salat',
        totalTimeMinutes: 20,
        difficulty: 'Einfach',
        steps: [{ order: 1, description: 'Tomaten schneiden.' }],
        includedIngredientIds: ['ing-1'],
        sourceFingerprint: 'sha256:stored',
      },
    }));

    expect(state.exportDraft).toMatchObject({
      teaser: 'Frischer Salat',
      totalTimeMinutes: '20',
      difficulty: 'Einfach',
      steps: [{ order: 1, description: 'Tomaten schneiden.' }],
      includedIngredientIds: ['ing-1'],
      source: 'persisted',
      confirmed: false,
    });
  });

  it('keeps AI analysis keys separate from persistent recipe ingredient IDs', () => {
    const suggestion: RecipeExportSuggestion = {
      version: 1,
      teaser: 'Frischer Salat',
      totalTimeMinutes: 15,
      difficulty: 'Einfach',
      steps: [{ order: 1, description: 'Tomaten schneiden.' }],
      includedIngredientKeys: ['analysis-tomatoes'],
      sourceFingerprint: 'analysis-only',
    };

    const draft = buildWizardExportDraftFromSuggestion(suggestion, ['analysis-tomatoes']);

    expect(draft.includedIngredientKeys).toEqual(['analysis-tomatoes']);
    expect(draft.analysisIngredientKeys).toEqual(['analysis-tomatoes']);
    expect(draft.includedIngredientIds).toEqual([]);
    expect(draft.confirmed).toBe(false);
  });

  it('preserves saved IDs without carrying AI key mappings into V2 preparation', () => {
    const currentDraft = {
      version: 1 as const,
      teaser: 'Bisheriger Teaser',
      totalTimeMinutes: '12',
      difficulty: 'Einfach',
      steps: [{ order: 1, description: 'Vorhandener Schritt.' }],
      includedIngredientIds: ['saved-ingredient-1'],
      includedIngredientKeys: ['saved-analysis-key'],
      analysisIngredientKeys: ['saved-analysis-key'],
      source: 'persisted' as const,
      confirmed: false,
    };
    const draft = buildWizardExportDraftFromPreparedSuggestion({
      version: 1,
      teaser: 'Frischer Salat',
      totalTimeMinutes: null,
      difficulty: null,
      steps: [{ order: 1, description: 'Tomaten schneiden.' }],
    }, currentDraft);

    expect(draft).toMatchObject({
      totalTimeMinutes: '',
      difficulty: '',
      includedIngredientIds: ['saved-ingredient-1'],
      includedIngredientKeys: [],
      analysisIngredientKeys: [],
      source: 'prepared',
      confirmed: false,
    });
  });

  it('reloads the latest recipe revision into an unconfirmed review state', async () => {
    const latestRecipe = makeRecipe({
      exportView: {
        version: 1,
        teaser: 'Aktuelle Exportansicht',
        totalTimeMinutes: 35,
        difficulty: 'Mittel',
        steps: [{ order: 1, description: 'Aktuelle Schritte.' }],
        includedIngredientIds: ['ing-1'],
        sourceFingerprint: 'sha256:latest',
      },
    });
    const getRecipe = vi.fn(async () => latestRecipe);

    const loaded = await loadRecipeWizardEditState('recipe-1', getRecipe);

    expect(getRecipe).toHaveBeenCalledWith('recipe-1');
    expect(loaded.recipe).toBe(latestRecipe);
    expect(loaded.bootstrapState.exportDraft).toMatchObject({
      teaser: 'Aktuelle Exportansicht',
      source: 'persisted',
      confirmed: false,
    });
  });
});