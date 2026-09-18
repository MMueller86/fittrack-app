import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RECIPE_IMAGE_HERO_CROP,
  RECIPE_IMAGE_HERO_CROP_FRAME,
  RECIPE_IMAGE_HERO_CROP_VERSION,
} from '../../../shared/types/recipeImageHeroCrop';
import { RecipeImageHeroCropSchema } from './recipes';

describe('RecipeImageHeroCropSchema', () => {
  it('accepts the versioned contract and central legacy default', () => {
    const parsed = RecipeImageHeroCropSchema.safeParse(DEFAULT_RECIPE_IMAGE_HERO_CROP);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({
        version: RECIPE_IMAGE_HERO_CROP_VERSION,
        frame: RECIPE_IMAGE_HERO_CROP_FRAME,
        focusX: 0.5,
        focusY: 0.46,
        zoom: 1,
      });
    }
  });

  it.each([
    ['version', { version: 2 }],
    ['frame', { frame: 'custom-frame' }],
    ['focusX below range', { focusX: -0.01 }],
    ['focusX above range', { focusX: 1.01 }],
    ['focusY below range', { focusY: -0.01 }],
    ['focusY above range', { focusY: 1.01 }],
    ['zoom below minimum', { zoom: 0.99 }],
    ['non-finite focus', { focusX: Number.NaN }],
    ['non-finite zoom', { zoom: Number.POSITIVE_INFINITY }],
  ])('rejects %s', (_caseName, override) => {
    const result = RecipeImageHeroCropSchema.safeParse({
      ...DEFAULT_RECIPE_IMAGE_HERO_CROP,
      ...override,
    });

    expect(result.success).toBe(false);
  });

  it('rejects arbitrary client dimensions and unknown fields', () => {
    const result = RecipeImageHeroCropSchema.safeParse({
      ...DEFAULT_RECIPE_IMAGE_HERO_CROP,
      width: 1080,
      height: 1015,
      aspectRatio: 1080 / 1015,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.code === 'unrecognized_keys')).toBe(true);
    }
  });
});