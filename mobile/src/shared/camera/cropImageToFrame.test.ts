import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const saveAsync = vi.fn();
  const renderAsync = vi.fn();
  const context = { crop: vi.fn(), resize: vi.fn(), renderAsync, release: vi.fn() };
  const manipulate = vi.fn();
  const sourceImage = { width: 4000, height: 3000, release: vi.fn() };
  const outputImage = { saveAsync, release: vi.fn() };
  return { saveAsync, renderAsync, context, manipulate, sourceImage, outputImage };
});
vi.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: mocks.manipulate },
  SaveFormat: { JPEG: 'jpeg' },
}));

import { cropImageToFrame, getCropActions } from './cropImageToFrame';

describe('cropImageToFrame', () => {
  beforeEach(() => {
    mocks.manipulate.mockReset().mockReturnValue(mocks.context);
    mocks.context.crop.mockReset().mockReturnValue(mocks.context);
    mocks.context.resize.mockReset().mockReturnValue(mocks.context);
    mocks.context.release.mockReset();
    mocks.renderAsync.mockReset()
      .mockResolvedValueOnce(mocks.sourceImage)
      .mockResolvedValueOnce(mocks.outputImage);
    mocks.saveAsync.mockReset().mockResolvedValue({ uri: 'file://cropped.jpg' });
    mocks.sourceImage.release.mockReset();
    mocks.outputImage.release.mockReset();
  });

  it('rounds the crop rectangle into integer pixels inside the image', () => {
    const { crop } = getCropActions({ x: 10.7, y: 5.2, width: 5000, height: 100.4 }, { width: 4000, height: 3000 });

    expect(crop).toEqual({ originX: 10, originY: 5, width: 3990, height: 100 });
  });

  it('downsizes only when the longest edge exceeds the limit', () => {
    expect(getCropActions({ x: 0, y: 0, width: 4000, height: 3000 }, { width: 4000, height: 3000 }, 1600).resize)
      .toEqual({ width: 1600, height: 1200 });
    expect(getCropActions({ x: 0, y: 0, width: 1200, height: 900 }, { width: 4000, height: 3000 }, 1600).resize).toBeNull();
  });

  it('scales portrait images over the height so the longest edge equals maxEdge', () => {
    expect(getCropActions({ x: 0, y: 0, width: 3000, height: 4000 }, { width: 3000, height: 4000 }, 2000).resize)
      .toEqual({ width: 1500, height: 2000 });
  });

  it('never lets the longest edge exceed maxEdge after rounding', () => {
    for (const [width, height] of [[1999, 3001], [3001, 1999], [4001, 4000], [4000, 4001], [3333, 2501]]) {
      const { resize } = getCropActions({ x: 0, y: 0, width, height }, { width, height }, 2000);
      expect(resize).not.toBeNull();
      expect(Math.max(resize!.width, resize!.height)).toBe(2000);
    }
  });

  it('crops, resizes and encodes as JPEG', async () => {
    const result = await cropImageToFrame(
      'file://photo.jpg',
      4 / 3,
      { focusX: 0.5, focusY: 0.5, zoom: 1 },
      1600,
    );

    expect(mocks.manipulate).toHaveBeenCalledWith('file://photo.jpg');
    expect(mocks.manipulate).toHaveBeenCalledWith(mocks.sourceImage);
    expect(mocks.context.crop).toHaveBeenCalledWith({ originX: 0, originY: 0, width: 4000, height: 3000 });
    expect(mocks.context.resize).toHaveBeenCalledWith({ width: 1600, height: 1200 });
    expect(mocks.saveAsync).toHaveBeenCalledWith({ compress: 0.85, format: 'jpeg' });
    expect(result).toEqual({ uri: 'file://cropped.jpg', mime: 'image/jpeg' });
    expect(mocks.sourceImage.release).toHaveBeenCalledOnce();
    expect(mocks.outputImage.release).toHaveBeenCalledOnce();
  });

  it('skips resize when the crop fits within maxEdge', async () => {
    mocks.sourceImage.width = 1200;
    mocks.sourceImage.height = 900;
    await cropImageToFrame('file://photo.jpg', 4 / 3, { focusX: 0.5, focusY: 0.5, zoom: 1 }, 1600);

    expect(mocks.context.resize).not.toHaveBeenCalled();
  });

  it('calculates crop coordinates from the decoded image size when it differs from preview dimensions', async () => {
    mocks.sourceImage.width = 3000;
    mocks.sourceImage.height = 4000;

    await cropImageToFrame('file://photo.jpg', 4 / 3, { focusX: 0.5, focusY: 0.5, zoom: 1 }, 1600);

    expect(mocks.context.crop).toHaveBeenCalledWith({ originX: 0, originY: 875, width: 3000, height: 2250 });
    expect(mocks.context.resize).toHaveBeenCalledWith({ width: 1600, height: 1200 });
  });
});
