import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { CROPPED_PHOTO_JPEG_QUALITY } from './framePresets';
import type { ImageSize, SourceRect } from './frameCropMath';

export interface CroppedPhoto {
  uri: string;
  mime: 'image/jpeg';
}

export function getCropActions(rect: SourceRect, image: ImageSize, maxEdge?: number) {
  const originX = Math.max(0, Math.min(image.width - 1, Math.floor(rect.x)));
  const originY = Math.max(0, Math.min(image.height - 1, Math.floor(rect.y)));
  const width = Math.max(1, Math.min(image.width - originX, Math.round(rect.width)));
  const height = Math.max(1, Math.min(image.height - originY, Math.round(rect.height)));
  const longestEdge = Math.max(width, height);
  const resizeWidth = maxEdge && longestEdge > maxEdge
    ? Math.round(width * (maxEdge / longestEdge))
    : null;

  return { crop: { originX, originY, width, height }, resizeWidth };
}

/** Crops the exact source rectangle, downsizes to maxEdge and re-encodes as JPEG. */
export async function cropImageToFrame(
  uri: string,
  rect: SourceRect,
  image: ImageSize,
  maxEdge?: number,
): Promise<CroppedPhoto> {
  const { crop, resizeWidth } = getCropActions(rect, image, maxEdge);
  const result = await manipulateAsync(
    uri,
    resizeWidth ? [{ crop }, { resize: { width: resizeWidth } }] : [{ crop }],
    { compress: CROPPED_PHOTO_JPEG_QUALITY, format: SaveFormat.JPEG },
  );
  return { uri: result.uri, mime: 'image/jpeg' };
}
