import { spacing } from '../../app/theme';

export const RECIPE_HERO_ASPECT_RATIO = 1080 / 1015;

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
  const topReserve = topInset + spacing.xxl * 2;
  const bottomReserve = bottomInset + spacing.xxl * 3;
  const availableHeight = Math.max(0, viewportHeight - topReserve - bottomReserve);
  const availableWidth = Math.max(0, viewportWidth - spacing.xl);
  const width = Math.min(availableWidth, availableHeight * RECIPE_HERO_ASPECT_RATIO);
  const height = width / RECIPE_HERO_ASPECT_RATIO;

  return {
    left: (viewportWidth - width) / 2,
    top: topReserve + Math.max(0, (availableHeight - height) / 2),
    width,
    height,
  };
}