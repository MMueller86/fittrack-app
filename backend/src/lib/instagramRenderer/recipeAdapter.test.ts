import { describe, expect, it } from 'vitest';
import type { Recipe } from '@fittrack/shared';

import { DEFAULT_RECIPE_IMAGE_HERO_CROP } from '../../../../shared/types/recipeImageHeroCrop';
import {
  adaptRecipeToDetailsTemplateInput,
  adaptRecipeToRenderInput,
  RecipeDetailsAdapterError,
} from './recipeAdapter';

const recipe = {
  id: 'recipe-1',
  ownerUserId: 'user-1',
  name: 'Server recipe',
  portions: 4,
  ingredients: [],
  steps: [],
  images: [],
  nutritionTotal: { calories: 800, protein: 100, carbs: 80, fat: 20, fiber: 10 },
  nutritionPerPortion: { calories: 200.25, protein: 25.5, carbs: 20.75, fat: 5.125, fiber: 2.5 },
  visibility: 'private',
  sharedWithUserIds: [],
  tags: ['Schnell', 'Salat'],
  usageCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} satisfies Recipe;

const detailsRecipe = {
  ...recipe,
  ingredients: [
    {
      id: 'food-1',
      displayName: 'Eier',
      inputMode: 'portion',
      inputAmount: 2,
      amountGrams: 100,
      unit: 'Stück',
      linkedProductId: null,
      linkedReusableItemId: null,
      isAiEstimate: false,
      nutritionPer100g: { calories: 140, protein: 12, carbs: 1, fat: 10, fiber: 0 },
      nutritionContribution: { calories: 140, protein: 12, carbs: 1, fat: 10, fiber: 0 },
    },
    {
      id: 'seasoning-1',
      displayName: 'Salz',
      inputMode: 'grams',
      inputAmount: null,
      amountGrams: null,
      unit: 'nach Geschmack',
      linkedProductId: null,
      linkedReusableItemId: null,
      isAiEstimate: false,
      category: 'seasoning',
      amountLabel: 'nach Geschmack',
      nutritionPer100g: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      nutritionContribution: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    },
    {
      id: 'food-2',
      displayName: 'Magerquark',
      inputMode: 'grams',
      inputAmount: null,
      amountGrams: 125.5,
      unit: 'g',
      linkedProductId: null,
      linkedReusableItemId: null,
      isAiEstimate: false,
      nutritionPer100g: { calories: 70, protein: 12, carbs: 4, fat: 0, fiber: 0 },
      nutritionContribution: { calories: 87.5, protein: 15, carbs: 5, fat: 0, fiber: 0 },
    },
  ],
  steps: [{ order: 1, description: 'Salz unterrühren.' }],
  exportView: {
    version: 1,
    teaser: 'Proteinreicher Start in den Tag.',
    totalTimeMinutes: 25,
    difficulty: 'Einfach',
    steps: [{ order: 1, description: 'Salz unterrühren.' }],
    includedIngredientIds: ['food-1', 'seasoning-1', 'food-2'],
    sourceFingerprint: 'sha256:test',
  },
} satisfies Recipe;

describe('adaptRecipeToRenderInput', () => {
  it('uses the deterministic legacy crop default and server-owned recipe values', () => {
    const input = adaptRecipeToRenderInput(recipe, Buffer.from('image'), {});

    expect(input).toMatchObject({
      image: { buffer: Buffer.from('image') },
      presentation: { focusX: 0.5, focusY: 0.46, zoom: 1 },
      title: 'Server recipe',
      tags: [
        { id: 'Schnell', label: 'Schnell' },
        { id: 'Salat', label: 'Salat' },
      ],
      nutritionHighlight: null,
      nutrition: { calories: 200.25, protein: 25.5, carbs: 20.75, fat: 5.125 },
    });
    expect(input).not.toHaveProperty('recipeMeta');
  });

  it('uses the stored crop and merges partial request overrides field by field', () => {
    const storedHeroCrop = {
      ...DEFAULT_RECIPE_IMAGE_HERO_CROP,
      focusX: 0.18,
      focusY: 0.73,
      zoom: 1.4,
    };

    const input = adaptRecipeToRenderInput(recipe, Buffer.from('image'), {
      storedHeroCrop,
      presentation: { focusY: 0.2 },
    });

    expect(input.presentation).toEqual({ focusX: 0.18, focusY: 0.2, zoom: 1.4 });
  });

  it('takes portions from the recipe and preserves request-level metadata', () => {
    const input = adaptRecipeToRenderInput(recipe, Buffer.from('image'), {
      presentation: { focusY: 0.2 },
      selectedTags: ['Salat', 'Schnell'],
      nutritionHighlight: 'high-protein',
      recipeMeta: { totalTimeMinutes: 25, difficulty: 'Einfach' },
    });

    expect(input.presentation).toEqual({ focusX: 0.5, focusY: 0.2, zoom: 1 });
    expect(input.tags).toEqual([
      { id: 'Schnell', label: 'Schnell' },
      { id: 'Salat', label: 'Salat' },
    ]);
    expect(input.nutritionHighlight).toBe('high-protein');
    expect(input.recipeMeta).toEqual({
      totalTimeMinutes: 25,
      difficulty: 'Einfach',
      portions: 4,
    });
  });

  it('preserves null request-only Instagram metadata while using stored portions', () => {
    const input = adaptRecipeToRenderInput(recipe, Buffer.from('image'), {
      recipeMeta: { totalTimeMinutes: null, difficulty: null },
    });

    expect(input.recipeMeta).toEqual({ totalTimeMinutes: null, difficulty: null, portions: 4 });
  });

  it('builds the details input from the confirmed export view and server ingredient data', () => {
    const input = adaptRecipeToDetailsTemplateInput(detailsRecipe, Buffer.from('image'), {
      storedHeroCrop: { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusX: 0.2 },
      presentation: { zoom: 1.3 },
      nutritionHighlight: 'high-protein',
    });

    expect(input).toMatchObject({
      image: { buffer: Buffer.from('image') },
      presentation: { focusX: 0.2, focusY: 0.46, zoom: 1.3 },
      title: 'Server recipe',
      description: 'Proteinreicher Start in den Tag.',
      totalTimeMinutes: 25,
      difficulty: 'Einfach',
      portions: 4,
      highlight: 'high-protein',
      ingredients: [
        { amount: '2 Stück', name: 'Eier' },
        { amount: '125.5 g', name: 'Magerquark' },
      ],
      steps: ['Salz unterrühren.'],
    });
  });

  it('builds the details input from a request-only draft with null metadata', () => {
    const input = adaptRecipeToDetailsTemplateInput(detailsRecipe, Buffer.from('image'), {
      exportViewDraft: {
        version: 1,
        teaser: 'Request-only teaser.',
        totalTimeMinutes: null,
        difficulty: null,
        steps: [{ order: 1, description: 'Request-only step.' }],
        includedIngredientIds: ['food-2'],
      },
    });

    expect(input).toMatchObject({
      description: 'Request-only teaser.',
      totalTimeMinutes: null,
      difficulty: null,
      ingredients: [{ amount: '125.5 g', name: 'Magerquark' }],
      steps: ['Request-only step.'],
    });
  });

  it('requires a confirmed export view instead of inventing detail data', () => {
    expect(() => adaptRecipeToDetailsTemplateInput(recipe, Buffer.from('image'))).toThrowError(
      expect.objectContaining({ code: 'MISSING_EXPORT_VIEW', field: 'exportView' } satisfies Partial<RecipeDetailsAdapterError>),
    );
  });
});