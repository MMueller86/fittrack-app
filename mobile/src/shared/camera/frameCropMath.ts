import { spacing } from '../../app/theme';

export interface ImageSize {
  width: number;
  height: number;
}

export interface FrameSize {
  width: number;
  height: number;
}

export interface FrameRect extends FrameSize {
  left: number;
  top: number;
}

export interface SourceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropTranslation {
  x: number;
  y: number;
}

export interface CropTransform extends CropTranslation {
  zoom: number;
}

/** Normalized crop: focus in 0..1 on the overflow axes, zoom >= 1 relative to cover scale. */
export interface FrameCrop {
  focusX: number;
  focusY: number;
  zoom: number;
}

export interface CropGeometry {
  minimumScale: number;
  scale: number;
  renderedWidth: number;
  renderedHeight: number;
  centeredX: number;
  centeredY: number;
  minTranslateX: number;
  maxTranslateX: number;
  minTranslateY: number;
  maxTranslateY: number;
}

const MIN_DIMENSION = 0.0001;

function positiveFinite(value: number, fallback: number): number {
  'worklet';
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function finiteOr(value: number | undefined, fallback: number): number {
  'worklet';
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

export function clampNormalized(value: number, fallback: number): number {
  const finiteValue = finiteOr(value, fallback);
  return Math.max(0, Math.min(1, finiteValue));
}

export function getMinimumCoverScale(image: ImageSize, frame: FrameSize): number {
  'worklet';
  const imageWidth = positiveFinite(image.width, MIN_DIMENSION);
  const imageHeight = positiveFinite(image.height, MIN_DIMENSION);
  const frameWidth = positiveFinite(frame.width, MIN_DIMENSION);
  const frameHeight = positiveFinite(frame.height, MIN_DIMENSION);

  return Math.max(frameWidth / imageWidth, frameHeight / imageHeight);
}

export function getCropGeometry(image: ImageSize, frame: FrameSize, zoom: number): CropGeometry {
  'worklet';
  const imageWidth = positiveFinite(image.width, MIN_DIMENSION);
  const imageHeight = positiveFinite(image.height, MIN_DIMENSION);
  const frameWidth = positiveFinite(frame.width, MIN_DIMENSION);
  const frameHeight = positiveFinite(frame.height, MIN_DIMENSION);
  const minimumScale = getMinimumCoverScale(
    { width: imageWidth, height: imageHeight },
    { width: frameWidth, height: frameHeight },
  );
  const normalizedZoom = Math.max(1, finiteOr(zoom, 1));
  const scale = minimumScale * normalizedZoom;
  const renderedWidth = imageWidth * scale;
  const renderedHeight = imageHeight * scale;
  const centeredX = (frameWidth - renderedWidth) / 2;
  const centeredY = (frameHeight - renderedHeight) / 2;

  return {
    minimumScale,
    scale,
    renderedWidth,
    renderedHeight,
    centeredX,
    centeredY,
    minTranslateX: frameWidth - renderedWidth - centeredX,
    maxTranslateX: -centeredX,
    minTranslateY: frameHeight - renderedHeight - centeredY,
    maxTranslateY: -centeredY,
  };
}

export function clampCropTranslation(
  translation: CropTranslation,
  geometry: CropGeometry,
): CropTranslation {
  return {
    x: Math.max(geometry.minTranslateX, Math.min(geometry.maxTranslateX, finiteOr(translation.x, 0))),
    y: Math.max(geometry.minTranslateY, Math.min(geometry.maxTranslateY, finiteOr(translation.y, 0))),
  };
}

export function getTransformForFocus(
  image: ImageSize,
  frame: FrameSize,
  crop: FrameCrop,
): CropTransform {
  const geometry = getCropGeometry(image, frame, crop.zoom);
  const imageWidth = positiveFinite(image.width, MIN_DIMENSION);
  const imageHeight = positiveFinite(image.height, MIN_DIMENSION);
  const frameWidth = positiveFinite(frame.width, MIN_DIMENSION);
  const frameHeight = positiveFinite(frame.height, MIN_DIMENSION);
  const horizontalOverflow = Math.max(0, imageWidth * geometry.scale - frameWidth);
  const verticalOverflow = Math.max(0, imageHeight * geometry.scale - frameHeight);
  const clampedTranslation = clampCropTranslation(
    {
      x: -crop.focusX * horizontalOverflow - geometry.centeredX,
      y: -crop.focusY * verticalOverflow - geometry.centeredY,
    },
    geometry,
  );

  return { zoom: Math.max(1, crop.zoom), ...clampedTranslation };
}

export function getFocusForTransform(
  image: ImageSize,
  frame: FrameSize,
  transform: CropTransform,
  fallback: Pick<FrameCrop, 'focusX' | 'focusY'>,
): FrameCrop {
  const normalizedZoom = Math.max(1, finiteOr(transform.zoom, 1));
  const geometry = getCropGeometry(image, frame, normalizedZoom);
  const clampedTranslation = clampCropTranslation(transform, geometry);
  const imageWidth = positiveFinite(image.width, MIN_DIMENSION);
  const imageHeight = positiveFinite(image.height, MIN_DIMENSION);
  const frameWidth = positiveFinite(frame.width, MIN_DIMENSION);
  const frameHeight = positiveFinite(frame.height, MIN_DIMENSION);
  const left = geometry.centeredX + clampedTranslation.x;
  const top = geometry.centeredY + clampedTranslation.y;
  const horizontalOverflow = Math.max(0, imageWidth * geometry.scale - frameWidth);
  const verticalOverflow = Math.max(0, imageHeight * geometry.scale - frameHeight);

  return {
    focusX: clampNormalized(
      horizontalOverflow > MIN_DIMENSION ? -left / horizontalOverflow : fallback.focusX,
      fallback.focusX,
    ),
    focusY: clampNormalized(
      verticalOverflow > MIN_DIMENSION ? -top / verticalOverflow : fallback.focusY,
      fallback.focusY,
    ),
    zoom: normalizedZoom,
  };
}

/** Source-pixel rectangle that a crop shows inside a frame with the given aspect ratio. */
export function getSourceRectForCrop(
  image: ImageSize,
  aspectRatio: number,
  crop: FrameCrop,
): SourceRect {
  const frame = { width: aspectRatio, height: 1 };
  const geometry = getCropGeometry(image, frame, crop.zoom);
  const width = Math.min(image.width, frame.width / geometry.scale);
  const height = Math.min(image.height, frame.height / geometry.scale);
  return {
    x: clampNormalized(crop.focusX, 0.5) * (image.width - width),
    y: clampNormalized(crop.focusY, 0.5) * (image.height - height),
    width,
    height,
  };
}

/** Inverse of getSourceRectForCrop; the rect must have the frame's aspect ratio. */
export function getCropForSourceRect(image: ImageSize, aspectRatio: number, rect: SourceRect): FrameCrop {
  const minimumScale = getMinimumCoverScale(image, { width: aspectRatio, height: 1 });
  const scale = aspectRatio / positiveFinite(rect.width, MIN_DIMENSION);
  const overflowX = image.width - rect.width;
  const overflowY = image.height - rect.height;
  return {
    focusX: overflowX > MIN_DIMENSION ? clampNormalized(rect.x / overflowX, 0.5) : 0.5,
    focusY: overflowY > MIN_DIMENSION ? clampNormalized(rect.y / overflowY, 0.5) : 0.5,
    zoom: Math.max(1, scale / minimumScale),
  };
}

/** Maps a frame on a cover-scaled camera preview to the captured photo's pixel rectangle. */
export function getPreviewSourceRect(
  photo: ImageSize,
  viewport: FrameSize,
  frame: FrameRect,
): SourceRect {
  const scale = Math.max(viewport.width / photo.width, viewport.height / photo.height);
  const offsetX = (photo.width * scale - viewport.width) / 2;
  const offsetY = (photo.height * scale - viewport.height) / 2;
  const width = Math.min(photo.width, frame.width / scale);
  const height = Math.min(photo.height, frame.height / scale);
  return {
    x: Math.max(0, Math.min(photo.width - width, (frame.left + offsetX) / scale)),
    y: Math.max(0, Math.min(photo.height - height, (frame.top + offsetY) / scale)),
    width,
    height,
  };
}

/** Largest frame with the given aspect ratio that fits between the camera/editor chrome. */
export function getCaptureFrame(
  aspectRatio: number,
  viewportWidth: number,
  viewportHeight: number,
  topInset: number,
  bottomInset: number,
): FrameRect {
  const topReserve = topInset + spacing.xxl * 2;
  const bottomReserve = bottomInset + spacing.xxl * 3;
  const availableHeight = Math.max(0, viewportHeight - topReserve - bottomReserve);
  const availableWidth = Math.max(0, viewportWidth - spacing.xl);
  const width = Math.min(availableWidth, availableHeight * aspectRatio);
  const height = width / aspectRatio;

  return {
    left: (viewportWidth - width) / 2,
    top: topReserve + Math.max(0, (availableHeight - height) / 2),
    width,
    height,
  };
}
