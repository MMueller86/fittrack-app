import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';
import { CROPPED_PHOTO_JPEG_QUALITY } from './framePresets';
import { getSourceRectForCrop, type FrameCrop, type ImageSize, type SourceRect } from './frameCropMath';

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
  aspectRatio: number,
  crop: FrameCrop,
  maxEdge?: number,
): Promise<CroppedPhoto> {
  const sourceContext = ImageManipulator.manipulate(uri);
  let sourceImage: ImageRef;
  try {
    sourceImage = await sourceContext.renderAsync();
  } finally {
    sourceContext.release();
  }

  try {
    const image: ImageSize = { width: sourceImage.width, height: sourceImage.height };
    const sourceRect = getSourceRectForCrop(image, aspectRatio, crop);
    const { crop: cropAction, resize } = getCropActions(sourceRect, image, maxEdge);
    const context = ImageManipulator.manipulate(sourceImage).crop(cropAction);
    try {
      if (resize) context.resize(resize);
      const rendered = await context.renderAsync();
      try {
        const result = await rendered.saveAsync({ compress: CROPPED_PHOTO_JPEG_QUALITY, format: SaveFormat.JPEG });
        return { uri: result.uri, mime: 'image/jpeg' };
      } finally {
        rendered.release();
      }
    } finally {
      context.release();
    }
  } finally {
    sourceImage.release();
  }
}
