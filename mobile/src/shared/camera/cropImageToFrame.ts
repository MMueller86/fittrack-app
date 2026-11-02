import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
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
  let resize: { width: number; height: number } | null = null;
  if (maxEdge && longestEdge > maxEdge) {
    const scale = maxEdge / longestEdge;
    // The longest edge is set to maxEdge exactly; the other edge is rounded and never exceeds it.
    resize = width >= height
      ? { width: maxEdge, height: Math.max(1, Math.round(height * scale)) }
      : { width: Math.max(1, Math.round(width * scale)), height: maxEdge };
  }

  return { crop: { originX, originY, width, height }, resize };
}

/** Crops the exact source rectangle, downsizes to maxEdge and re-encodes as JPEG. */
export async function cropImageToFrame(
  uri: string,
  rect: SourceRect,
  image: ImageSize,
  maxEdge?: number,
): Promise<CroppedPhoto> {
  const { crop, resize } = getCropActions(rect, image, maxEdge);
  const context = ImageManipulator.manipulate(uri).crop(crop);
  const rendered = await (resize ? context.resize(resize) : context).renderAsync();
  const result = await rendered.saveAsync({ compress: CROPPED_PHOTO_JPEG_QUALITY, format: SaveFormat.JPEG });
  return { uri: result.uri, mime: 'image/jpeg' };
}
