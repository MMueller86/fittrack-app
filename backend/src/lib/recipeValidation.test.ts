import { describe, expect, it } from 'vitest';
import type { Recipe, RecipeExportViewInput } from '@fittrack/shared';
import { RecipeExportViewInputSchema, validateRecipeExportIngredients } from './recipeValidation';
import {
  computeRecipeSourceFingerprint,
  createRecipeExportView,
  getRecipeExportViewStatus,
} from './repositories/recipeExport';

const ingredient = {
  id: 'ingredient-1',
  displayName: 'Kartoffeln',
  inputMode: 'grams' as const,
  inputAmount: 500,
  amountGrams: 500,
  unit: 'g',
  linkedProductId: null,
  linkedReusableItemId: null,
  isAiEstimate: false,
  nutritionPer100g: { calories: 77, protein: 2, carbs: 17, fat: 0.1, fiber: 2.2 },
  nutritionContribution: { calories: 385, protein: 10, carbs: 85, fat: 0.5, fiber: 11 },
};

const source: Pick<Recipe, 'name' | 'description' | 'portions' | 'ingredients' | 'steps' | 'tags' | 'nutritionPerPortion'> = {
  name: 'Ofenkartoffeln',
  description: 'Knusprig aus dem Ofen',
  portions: 2,
  ingredients: [ingredient],
  steps: [{ order: 1, description: 'Kartoffeln backen.' }],
  tags: ['Schnell'],
  nutritionPerPortion: { calories: 200, protein: 5, carbs: 40, fat: 2, fiber: 5 },
};

const exportViewInput: RecipeExportViewInput = {
  version: 1,
  teaser: 'Knusprige Kartoffeln',
  totalTimeMinutes: 35,
  difficulty: 'Einfach',
  steps: [{ order: 1, description: 'Kartoffeln backen.' }],
  includedIngredientIds: ['ingredient-1'],
};

describe('recipe export validation', () => {
  it('accepts the client input but rejects a client fingerprint', () => {
    const parsed = RecipeExportViewInputSchema.safeParse(exportViewInput);
    expect(RecipeExportViewInputSchema.safeParse(exportViewInput).success).toBe(true);
    expect(RecipeExportViewInputSchema.safeParse({
      ...exportViewInput,
      sourceFingerprint: 'sha256:client-owned',
    }).success).toBe(false);
  });

  it('requires ordered steps and bounded export fields', () => {
    expect(RecipeExportViewInputSchema.safeParse({
      ...exportViewInput,
      steps: [
        { order: 2, description: 'Zweiter Schritt.' },
        { order: 1, description: 'Erster Schritt.' },
      ],
    }).success).toBe(false);
    expect(RecipeExportViewInputSchema.safeParse({
      ...exportViewInput,
      teaser: 'x'.repeat(97),
    }).success).toBe(false);
  });

  it('rejects missing and seasoning ingredient references', () => {
    expect(validateRecipeExportIngredients({
      ...exportViewInput,
      includedIngredientIds: ['missing'],
    }, [ingredient])).toContain('Unknown included ingredient');

    expect(validateRecipeExportIngredients({
      ...exportViewInput,
      includedIngredientIds: ['seasoning-1'],
    }, [{
      ...ingredient,
      id: 'seasoning-1',
      category: 'seasoning' as const,
      amountGrams: null,
      inputAmount: null,
    }])).toContain('Seasoning ingredients');
  });

  it('rejects an included ingredient ID that occurs more than once in the recipe', () => {
    expect(validateRecipeExportIngredients(exportViewInput, [
      ingredient,
      { ...ingredient, displayName: 'Doppelte Kartoffeln' },
    ])).toContain('exactly once');
  });

  it('computes a stable server fingerprint and derives stale status', () => {
    const fingerprint = computeRecipeSourceFingerprint(source);
    expect(fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);

    const persisted = createRecipeExportView(exportViewInput, source);
    const recipe = { ...source, id: 'recipe-1', ownerUserId: 'user-1', images: [],
      nutritionTotal: source.nutritionPerPortion, visibility: 'private' as const,
      sharedWithUserIds: [], usageCount: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01',
      exportView: persisted } satisfies Recipe;

    expect(getRecipeExportViewStatus(recipe)).toBe('current');
    expect(getRecipeExportViewStatus({ ...recipe, name: 'Andere Kartoffeln' })).toBe('stale');
    expect(getRecipeExportViewStatus({ ...recipe, exportView: undefined })).toBeUndefined();
  });
});