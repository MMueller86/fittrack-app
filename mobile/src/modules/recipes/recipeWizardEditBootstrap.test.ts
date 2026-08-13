import { describe, expect, it, vi } from 'vitest';
import type { Recipe, RecipeIngredient } from '@fittrack/shared';
import { buildRecipeWizardEditBootstrapState } from './recipeWizardEditBootstrap';

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
        { id: 'image-2', blobName: 'u/r/image-2.jpg', order: 2, url: 'https://example.test/image-2.jpg' },
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
      },
      {
        draftId: 'existing:image-2',
        source: 'existing',
        imageId: 'image-2',
        uri: 'https://example.test/image-2.jpg',
        order: 2,
      },
    ]);
  });
});