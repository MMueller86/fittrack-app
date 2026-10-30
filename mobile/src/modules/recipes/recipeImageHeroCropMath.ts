import {
  DEFAULT_RECIPE_IMAGE_HERO_CROP,
  RECIPE_IMAGE_HERO_CROP_FRAME,
  RECIPE_IMAGE_HERO_CROP_VERSION,
  type RecipeImageHeroCrop,
} from '@fittrack/shared';
import {
  clampNormalized,
  getFocusForTransform,
  getTransformForFocus,
  type CropTransform,
  type FrameSize,
  type ImageSize,
} from '../../shared/camera/frameCropMath';

export {
  clampCropTranslation,
  clampNormalized,
  getCropGeometry,
  getMinimumCoverScale,
} from '../../shared/camera/frameCropMath';
export type {
  CropGeometry,
  CropTransform,
  CropTranslation,
  FrameSize as CropFrameDimensions,
  ImageSize as CropImageDimensions,
} from '../../shared/camera/frameCropMath';

export const RECIPE_HERO_RENDERER_SAFE_AREA_TOP_RATIO = 853 / 1015;

export function normalizeRecipeImageHeroCrop(
  crop?: Partial<RecipeImageHeroCrop> | null,
): RecipeImageHeroCrop {
  const focusX = clampNormalized(crop?.focusX ?? DEFAULT_RECIPE_IMAGE_HERO_CROP.focusX, DEFAULT_RECIPE_IMAGE_HERO_CROP.focusX);
  const focusY = clampNormalized(crop?.focusY ?? DEFAULT_RECIPE_IMAGE_HERO_CROP.focusY, DEFAULT_RECIPE_IMAGE_HERO_CROP.focusY);
  const zoom = Math.max(
    1,
    crop?.zoom !== undefined && Number.isFinite(crop.zoom) ? crop.zoom : DEFAULT_RECIPE_IMAGE_HERO_CROP.zoom,
  );

  return {
    version: RECIPE_IMAGE_HERO_CROP_VERSION,
    frame: RECIPE_IMAGE_HERO_CROP_FRAME,
    focusX,
    focusY,
    zoom,
  };
}

export function getTransformForHeroCrop(
  image: ImageSize,
  frame: FrameSize,
  crop?: Partial<RecipeImageHeroCrop> | null,
): CropTransform {
  const { focusX, focusY, zoom } = normalizeRecipeImageHeroCrop(crop);
  return getTransformForFocus(image, frame, { focusX, focusY, zoom });
}

export function getHeroCropForTransform(
  image: ImageSize,
  frame: FrameSize,
  transform: CropTransform,
  fallbackCrop?: Partial<RecipeImageHeroCrop> | null,
): RecipeImageHeroCrop {
  return normalizeRecipeImageHeroCrop(
    getFocusForTransform(image, frame, transform, normalizeRecipeImageHeroCrop(fallbackCrop)),
  );
}
