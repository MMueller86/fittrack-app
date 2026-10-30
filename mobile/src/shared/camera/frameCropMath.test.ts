import { describe, expect, it } from 'vitest';
import {
  getCaptureFrame,
  getCropForSourceRect,
  getPreviewSourceRect,
  getSourceRectForCrop,
} from './frameCropMath';
import { FRAME_PRESETS } from './framePresets';

describe('frame crop math', () => {
  it('builds a centered frame with the requested aspect ratio for every preset', () => {
    for (const { aspectRatio } of Object.values(FRAME_PRESETS)) {
      const frame = getCaptureFrame(aspectRatio, 390, 844, 24, 34);

      expect(frame.width / frame.height).toBeCloseTo(aspectRatio, 8);
      expect(frame.left).toBeGreaterThanOrEqual(0);
      expect(frame.top).toBeGreaterThanOrEqual(0);
      expect(frame.left + frame.width).toBeLessThanOrEqual(390);
      expect(frame.top + frame.height).toBeLessThanOrEqual(844);
    }
  });

  it('maps a frame on a cover-scaled preview to the matching source pixels', () => {
    // 3000x4000 portrait photo on a 400x800 preview: scale 0.2, horizontal overflow cropped.
    const viewport = { width: 400, height: 800 };
    const frame = { left: 20, top: 100, width: 360, height: 270 };
    const rect = getPreviewSourceRect({ width: 3000, height: 4000 }, viewport, frame);

    expect(rect.width / rect.height).toBeCloseTo(frame.width / frame.height, 8);
    expect(rect.width).toBeCloseTo(360 / 0.2, 6);
    expect(rect.x).toBeCloseTo((20 + 100) / 0.2, 6);
    expect(rect.y).toBeCloseTo(100 / 0.2, 6);
    expect(rect.x + rect.width).toBeLessThanOrEqual(3000);
    expect(rect.y + rect.height).toBeLessThanOrEqual(4000);
  });

  it('never returns a rectangle outside the photo', () => {
    const rect = getPreviewSourceRect(
      { width: 4000, height: 3000 },
      { width: 400, height: 800 },
      { left: 0, top: 790, width: 400, height: 300 },
    );

    expect(rect.y + rect.height).toBeLessThanOrEqual(3000);
    expect(rect.y).toBeGreaterThanOrEqual(0);
  });

  it('round-trips a source rectangle through the normalized crop', () => {
    const image = { width: 4000, height: 3000 };
    const aspectRatio = 3 / 4;
    const crop = { focusX: 0.3, focusY: 0.6, zoom: 1.7 };
    const rect = getSourceRectForCrop(image, aspectRatio, crop);
    const restored = getCropForSourceRect(image, aspectRatio, rect);

    expect(rect.width / rect.height).toBeCloseTo(aspectRatio, 8);
    expect(restored.focusX).toBeCloseTo(crop.focusX, 8);
    expect(restored.focusY).toBeCloseTo(crop.focusY, 8);
    expect(restored.zoom).toBeCloseTo(crop.zoom, 8);
  });

  it('uses the full cover rectangle at zoom 1', () => {
    const rect = getSourceRectForCrop({ width: 4000, height: 3000 }, 4 / 3, { focusX: 0.5, focusY: 0.5, zoom: 1 });

    expect(rect.width).toBeCloseTo(4000, 6);
    expect(rect.height).toBeCloseTo(3000, 6);
  });
});
