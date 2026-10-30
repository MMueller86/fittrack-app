import { getCaptureFrame } from '../../shared/camera/frameCropMath';
import { FRAME_PRESETS } from '../../shared/camera/framePresets';

export const RECIPE_HERO_ASPECT_RATIO: number = FRAME_PRESETS.recipeHero.aspectRatio;

export interface RecipeImageSelection {
  uri: string;
  mime: 'image/jpeg' | 'image/png';
}

export interface RecipeImageAssetLike {
  uri?: string | null;
  mimeType?: string | null;
}

export interface RecipeHeroFrame {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function getRecipeImageSelection(
  asset: RecipeImageAssetLike | null | undefined,
): RecipeImageSelection | null {
  if (!asset?.uri) return null;
  return {
    uri: asset.uri,
    mime: asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg',
  };
}

export function getRecipeHeroFrame(
  viewportWidth: number,
  viewportHeight: number,
  topInset: number,
  bottomInset: number,
): RecipeHeroFrame {
  return getCaptureFrame(RECIPE_HERO_ASPECT_RATIO, viewportWidth, viewportHeight, topInset, bottomInset);
}