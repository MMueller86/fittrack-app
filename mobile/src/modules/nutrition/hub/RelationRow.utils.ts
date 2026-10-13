import type { MealType, UpsertUserFoodRelationInput, UserFoodRelation } from '@fittrack/shared';
import { addLocalDays, getLocalIsoDate } from '../../../shared/date/localDate';
import { isRemoteImageUri } from '../../../shared/components/foodProductSummaryUtils';

export function isUnavailableRecipeRelation(
  relation: Pick<UserFoodRelation, 'foodRefType' | 'recipeAccess'>,
): boolean {
  return relation.foodRefType === 'recipe'
    && relation.recipeAccess !== 'owner'
    && relation.recipeAccess !== 'community';
}

export function canToggleFavorite(
  relation: Pick<UserFoodRelation, 'foodRefType' | 'recipeAccess'>,
  isFavorite: boolean,
): boolean {
  return !isUnavailableRecipeRelation(relation) || isFavorite;
}

export function buildRelationFavoriteInput(relation: UserFoodRelation): UpsertUserFoodRelationInput {
  return {
    foodRef: relation.foodRef,
    foodRefType: relation.foodRefType,
    displayName: relation.displayName,
    displayBrand: relation.displayBrand,
    // Blob-Pfade eigener Produkte sind keine URL; das Backend lehnt sie ab (z.string().url()).
    imageUrl: isRemoteImageUri(relation.imageUrl) ? relation.imageUrl : null,
    nutritionPer100g: relation.nutritionPer100g,
    portion: relation.portion,
  };
}

export function thumbnailBorderWidth(
  usageDates?: Array<{ date: string; mealType: MealType }>,
  todayDate: string = getLocalIsoDate(),
): 0 | 1 | 2 | 3 {
  if (!usageDates || usageDates.length === 0) return 0;
  const cutoff = addLocalDays(todayDate, -30);
  const count = usageDates.filter(e => e.date >= cutoff && e.date <= todayDate).length;
  if (count === 0) return 0;
  if (count <= 3) return 1;
  if (count <= 9) return 2;
  return 3;
}
