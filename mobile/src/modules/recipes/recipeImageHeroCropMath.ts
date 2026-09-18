import {
  DEFAULT_RECIPE_IMAGE_HERO_CROP,
  RECIPE_IMAGE_HERO_CROP_FRAME,
  RECIPE_IMAGE_HERO_CROP_VERSION,
  type RecipeImageHeroCrop,
} from '@fittrack/shared';

export interface CropImageDimensions {
  width: number;
  height: number;
}

export interface CropFrameDimensions {
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

export const RECIPE_HERO_RENDERER_SAFE_AREA_TOP_RATIO = 853 / 1015;

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

export function normalizeRecipeImageHeroCrop(
  crop?: Partial<RecipeImageHeroCrop> | null,
): RecipeImageHeroCrop {
  const focusX = clampNormalized(crop?.focusX ?? DEFAULT_RECIPE_IMAGE_HERO_CROP.focusX, DEFAULT_RECIPE_IMAGE_HERO_CROP.focusX);
  const focusY = clampNormalized(crop?.focusY ?? DEFAULT_RECIPE_IMAGE_HERO_CROP.focusY, DEFAULT_RECIPE_IMAGE_HERO_CROP.focusY);
  const zoom = Math.max(
    1,
    finiteOr(crop?.zoom, DEFAULT_RECIPE_IMAGE_HERO_CROP.zoom),
  );

  return {
    version: RECIPE_IMAGE_HERO_CROP_VERSION,
    frame: RECIPE_IMAGE_HERO_CROP_FRAME,
    focusX,
    focusY,
    zoom,
  };
}

export function getMinimumCoverScale(
  image: CropImageDimensions,
  frame: CropFrameDimensions,
): number {
  'worklet';
  const imageWidth = positiveFinite(image.width, MIN_DIMENSION);
  const imageHeight = positiveFinite(image.height, MIN_DIMENSION);
  const frameWidth = positiveFinite(frame.width, MIN_DIMENSION);
  const frameHeight = positiveFinite(frame.height, MIN_DIMENSION);

  return Math.max(frameWidth / imageWidth, frameHeight / imageHeight);
}

export function getCropGeometry(
  image: CropImageDimensions,
  frame: CropFrameDimensions,
  zoom: number,
): CropGeometry {
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

export function getTransformForHeroCrop(
  image: CropImageDimensions,
  frame: CropFrameDimensions,
  crop?: Partial<RecipeImageHeroCrop> | null,
): CropTransform {
  const normalizedCrop = normalizeRecipeImageHeroCrop(crop);
  const geometry = getCropGeometry(image, frame, normalizedCrop.zoom);
  const imageWidth = positiveFinite(image.width, MIN_DIMENSION);
  const imageHeight = positiveFinite(image.height, MIN_DIMENSION);
  const frameWidth = positiveFinite(frame.width, MIN_DIMENSION);
  const frameHeight = positiveFinite(frame.height, MIN_DIMENSION);
  const horizontalOverflow = Math.max(0, imageWidth * geometry.scale - frameWidth);
  const verticalOverflow = Math.max(0, imageHeight * geometry.scale - frameHeight);
  const desiredLeft = -normalizedCrop.focusX * horizontalOverflow;
  const desiredTop = -normalizedCrop.focusY * verticalOverflow;
  const clampedTranslation = clampCropTranslation(
    {
      x: desiredLeft - geometry.centeredX,
      y: desiredTop - geometry.centeredY,
    },
    geometry,
  );

  return {
    zoom: normalizedCrop.zoom,
    ...clampedTranslation,
  };
}

export function getHeroCropForTransform(
  image: CropImageDimensions,
  frame: CropFrameDimensions,
  transform: CropTransform,
  fallbackCrop?: Partial<RecipeImageHeroCrop> | null,
): RecipeImageHeroCrop {
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
  const fallback = normalizeRecipeImageHeroCrop(fallbackCrop);
  const focusX = horizontalOverflow > MIN_DIMENSION
    ? -left / horizontalOverflow
    : fallback.focusX;
  const focusY = verticalOverflow > MIN_DIMENSION
    ? -top / verticalOverflow
    : fallback.focusY;

  return normalizeRecipeImageHeroCrop({
    focusX,
    focusY,
    zoom: normalizedZoom,
  });
}