export const RECIPE_IMAGE_HERO_CROP_VERSION = 1 as const;
export const RECIPE_IMAGE_HERO_CROP_FRAME = 'instagram-recipe-v1' as const;

export type RecipeImageHeroCropVersion = typeof RECIPE_IMAGE_HERO_CROP_VERSION;
export type RecipeImageHeroCropFrame = typeof RECIPE_IMAGE_HERO_CROP_FRAME;

export interface RecipeImageHeroCrop {
  version: RecipeImageHeroCropVersion;
  frame: RecipeImageHeroCropFrame;
  focusX: number;
  focusY: number;
  zoom: number;
}

export const DEFAULT_RECIPE_IMAGE_HERO_CROP = Object.freeze({
  version: RECIPE_IMAGE_HERO_CROP_VERSION,
  frame: RECIPE_IMAGE_HERO_CROP_FRAME,
  focusX: 0.5,
  focusY: 0.46,
  zoom: 1,
} as const) satisfies RecipeImageHeroCrop;