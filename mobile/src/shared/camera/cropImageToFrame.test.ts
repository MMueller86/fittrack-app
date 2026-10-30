import { beforeEach, describe, expect, it, vi } from 'vitest';

const manipulateAsync = vi.hoisted(() => vi.fn());
vi.mock('expo-image-manipulator', () => ({
  manipulateAsync,
  SaveFormat: { JPEG: 'jpeg' },
}));

import { cropImageToFrame, getCropActions } from './cropImageToFrame';

describe('cropImageToFrame', () => {
  beforeEach(() => {
    manipulateAsync.mockReset();
    manipulateAsync.mockResolvedValue({ uri: 'file://cropped.jpg' });
  });

  it('rounds the crop rectangle into integer pixels inside the image', () => {
    const { crop } = getCropActions({ x: 10.7, y: 5.2, width: 5000, height: 100.4 }, { width: 4000, height: 3000 });

    expect(crop).toEqual({ originX: 10, originY: 5, width: 3990, height: 100 });
  });

  it('downsizes only when the longest edge exceeds the limit', () => {
    expect(getCropActions({ x: 0, y: 0, width: 4000, height: 3000 }, { width: 4000, height: 3000 }, 1600).resizeWidth).toBe(1600);
    expect(getCropActions({ x: 0, y: 0, width: 1200, height: 900 }, { width: 4000, height: 3000 }, 1600).resizeWidth).toBeNull();
  });

  it('crops, resizes and encodes as JPEG', async () => {
    const result = await cropImageToFrame(
      'file://photo.jpg',
      { x: 0, y: 0, width: 4000, height: 3000 },
      { width: 4000, height: 3000 },
      1600,
    );

    expect(manipulateAsync).toHaveBeenCalledWith(
      'file://photo.jpg',
      [{ crop: { originX: 0, originY: 0, width: 4000, height: 3000 } }, { resize: { width: 1600 } }],
      { compress: 0.85, format: 'jpeg' },
    );
    expect(result).toEqual({ uri: 'file://cropped.jpg', mime: 'image/jpeg' });
  });
});
