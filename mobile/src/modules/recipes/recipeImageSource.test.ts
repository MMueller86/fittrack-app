import { describe, expect, it } from 'vitest';
import {
  getRecipeHeroFrame,
  getRecipeImageSelection,
  RECIPE_HERO_ASPECT_RATIO,
} from './recipeImageSource';

describe('recipe image source helpers', () => {
  it('does not create a selection without an image URI', () => {
    expect(getRecipeImageSelection(undefined)).toBeNull();
    expect(getRecipeImageSelection({ uri: null })).toBeNull();
  });

  it('preserves the selected URI and normalizes the upload mime type', () => {
    expect(getRecipeImageSelection({ uri: 'file://recipe.png', mimeType: 'image/png' })).toEqual({
      uri: 'file://recipe.png',
      mime: 'image/png',
    });
    expect(getRecipeImageSelection({ uri: 'file://recipe.heic', mimeType: 'image/heic' })).toEqual({
      uri: 'file://recipe.heic',
      mime: 'image/jpeg',
    });
  });

  it('keeps the responsive hero frame at 1080:1015', () => {
    const frame = getRecipeHeroFrame(390, 844, 24, 34);

    expect(frame.height).toBeCloseTo(frame.width / RECIPE_HERO_ASPECT_RATIO, 8);
    expect(frame.left).toBeGreaterThanOrEqual(0);
    expect(frame.top).toBeGreaterThanOrEqual(0);
    expect(frame.left + frame.width).toBeLessThanOrEqual(390);
    expect(frame.top + frame.height).toBeLessThanOrEqual(844);
  });
});