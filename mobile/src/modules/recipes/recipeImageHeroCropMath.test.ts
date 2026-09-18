import { describe, expect, it } from 'vitest';
import { DEFAULT_RECIPE_IMAGE_HERO_CROP } from '@fittrack/shared';
import {
  clampCropTranslation,
  getCropGeometry,
  getHeroCropForTransform,
  getMinimumCoverScale,
  getTransformForHeroCrop,
  normalizeRecipeImageHeroCrop,
} from './recipeImageHeroCropMath';

const frame = { width: 1080, height: 1015 };

describe('recipe image hero crop math', () => {
  it('uses the cover scale as the minimum zoom for portrait and landscape images', () => {
    const landscapeScale = getMinimumCoverScale({ width: 4000, height: 3000 }, frame);
    const portraitScale = getMinimumCoverScale({ width: 3000, height: 4000 }, frame);

    expect(4000 * landscapeScale).toBeGreaterThanOrEqual(frame.width);
    expect(3000 * landscapeScale).toBeGreaterThanOrEqual(frame.height);
    expect(3000 * portraitScale).toBeGreaterThanOrEqual(frame.width);
    expect(4000 * portraitScale).toBeGreaterThanOrEqual(frame.height);
  });

  it('clamps translation so every edge of the image still covers the frame', () => {
    const geometry = getCropGeometry({ width: 4000, height: 3000 }, frame, 1.5);
    const clamped = clampCropTranslation({ x: -100000, y: 100000 }, geometry);
    const left = geometry.centeredX + clamped.x;
    const top = geometry.centeredY + clamped.y;

    expect(left).toBeLessThanOrEqual(0);
    expect(left + geometry.renderedWidth).toBeGreaterThanOrEqual(frame.width);
    expect(top).toBeLessThanOrEqual(0);
    expect(top + geometry.renderedHeight).toBeGreaterThanOrEqual(frame.height);
  });

  it('restores the shared legacy default deterministically', () => {
    expect(normalizeRecipeImageHeroCrop()).toEqual(DEFAULT_RECIPE_IMAGE_HERO_CROP);
    expect(normalizeRecipeImageHeroCrop({ focusX: Number.NaN, focusY: Number.POSITIVE_INFINITY, zoom: 0 })).toEqual(
      DEFAULT_RECIPE_IMAGE_HERO_CROP,
    );
  });

  it('normalizes crop values to the shared contract', () => {
    expect(normalizeRecipeImageHeroCrop({ focusX: -1, focusY: 2, zoom: 0.5 })).toEqual({
      ...DEFAULT_RECIPE_IMAGE_HERO_CROP,
      focusX: 0,
      focusY: 1,
      zoom: 1,
    });
  });

  it('round-trips a representable crop through the rendered transform', () => {
    const crop = { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusX: 0.4, focusY: 0.67, zoom: 1.8 };
    const transform = getTransformForHeroCrop({ width: 4000, height: 4000 }, frame, crop);
    const restored = getHeroCropForTransform({ width: 4000, height: 4000 }, frame, transform);

    expect(restored.version).toBe(crop.version);
    expect(restored.frame).toBe(crop.frame);
    expect(restored.focusX).toBeCloseTo(crop.focusX, 12);
    expect(restored.focusY).toBeCloseTo(crop.focusY, 12);
    expect(restored.zoom).toBe(crop.zoom);
  });

  it('returns an effective clamped focus when a source dimension is fully visible', () => {
    const crop = { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusY: 0.2 };
    const transform = getTransformForHeroCrop({ width: 4000, height: 3000 }, frame, crop);
    const effectiveCrop = getHeroCropForTransform({ width: 4000, height: 3000 }, frame, transform, crop);

    expect(effectiveCrop.focusY).toBe(crop.focusY);
    expect(effectiveCrop.focusX).toBe(crop.focusX);
  });
});