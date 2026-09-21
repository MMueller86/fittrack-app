import { describe, expect, it } from 'vitest';
import type { Recipe } from '@fittrack/shared';

import { DEFAULT_RECIPE_IMAGE_HERO_CROP } from '../../../../shared/types/recipeImageHeroCrop';
import { adaptRecipeToRenderInput } from './recipeAdapter';

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
});