import { describe, expect, it } from 'vitest';
import {
  formatMacroAmount,
  getActivityBonusTrackValues,
  getMacroRangeHatchSegments,
  getMacroTrackGeometry,
  MACRO_TRACK_HEIGHT,
  MACRO_TRACK_REFERENCE_POSITION,
  MACRO_TRACK_VIEWBOX_WIDTH,
} from './dayNutritionTrackGeometry';

describe('getMacroTrackGeometry', () => {
  it('places the protein and carbohydrate hatch from the minimum through the shared 100% position', () => {
    const geometry = getMacroTrackGeometry(60, { minG: 75, maxG: 120 });

    expect(geometry.fillRatio).toBeCloseTo(1 / 3);
    expect(geometry.rangePosition?.start).toBeCloseTo(75 / 120 / 1.5);
    expect(geometry.rangePosition?.end).toBe(MACRO_TRACK_REFERENCE_POSITION);
    expect(geometry.referencePosition).toBe(MACRO_TRACK_REFERENCE_POSITION);

    const segments = getMacroRangeHatchSegments(geometry.rangePosition!);
    expect(segments.length).toBeGreaterThan(0);
    expect(segments.every((segment) => (
      segment.x1 >= geometry.rangePosition!.start * MACRO_TRACK_VIEWBOX_WIDTH
      && segment.x2 <= geometry.rangePosition!.end * MACRO_TRACK_VIEWBOX_WIDTH
      && segment.y1 >= 0
      && segment.y1 <= MACRO_TRACK_HEIGHT
      && segment.y2 >= 0
      && segment.y2 <= MACRO_TRACK_HEIGHT
    ))).toBe(true);
  });

  it('aligns a fixed target marker with the range maximum', () => {
    const range = getMacroTrackGeometry(90, { minG: 60, maxG: 120 });
    const fixed = getMacroTrackGeometry(90, 120);

    expect(range.rangePosition?.end).toBe(fixed.referencePosition);
    expect(fixed.referencePosition).toBe(2 / 3);
    expect(fixed.rangePosition).toBeNull();
  });

  it('keeps zero intake at zero fill while retaining valid target geometry', () => {
    const range = getMacroTrackGeometry(0, { minG: 50, maxG: 100 });
    const fixed = getMacroTrackGeometry(0, 100);

    expect(range.fillRatio).toBe(0);
    expect(range.rangePosition).toEqual({ start: 1 / 3, end: 2 / 3 });
    expect(fixed.fillRatio).toBe(0);
    expect(fixed.referencePosition).toBe(2 / 3);
    expect(getMacroTrackGeometry(0, 0)).toEqual({
      fillRatio: 0,
      referencePosition: null,
      rangePosition: null,
    });
  });

  it('continues linearly beyond 100% and clamps only the rendered fill at the track end', () => {
    expect(getMacroTrackGeometry(120, 100).fillRatio).toBeCloseTo(0.8);
    expect(getMacroTrackGeometry(200, 100).fillRatio).toBe(1);
    expect(formatMacroAmount(200)).toBe('200');
    expect(formatMacroAmount(12.75)).toBe('12,75');
  });
});

describe('getActivityBonusTrackValues', () => {
  it('keeps a positive bonus row visible with zero consumed calories', () => {
    expect(getActivityBonusTrackValues(0, 2_000, 500)).toEqual({
      valueKcal: 0,
      targetKcal: 500,
      fillRatio: 0,
    });
  });

  it('uses its own 100% bonus scale and preserves kcal values above the render limit', () => {
    expect(getActivityBonusTrackValues(2_250, 2_000, 500)).toEqual({
      valueKcal: 250,
      targetKcal: 500,
      fillRatio: 0.5,
    });
    expect(getActivityBonusTrackValues(2_800, 2_000, 500)).toEqual({
      valueKcal: 800,
      targetKcal: 500,
      fillRatio: 1,
    });
  });
});