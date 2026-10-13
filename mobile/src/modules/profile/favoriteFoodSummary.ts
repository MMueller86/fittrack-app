// Mapping UserFoodRelation → FoodProductSummary-Props für die Favoritenansicht (rein, ohne Request).

import type { UserFoodRelation } from '@fittrack/shared';
import type { FoodProductBadge, FoodProductSummaryProps } from '../../shared/components/FoodProductSummary';
import { isUnavailableRecipeRelation } from '../nutrition/hub/RelationRow.utils';

export const UNAVAILABLE_RECIPE_NAME = 'Rezept nicht verfügbar';

// Gleiche Vokabeln wie resultBadges im Search Hub.
const ORIGIN_BADGES: Record<UserFoodRelation['foodRefType'], FoodProductBadge> = {
  catalog: { label: 'OFF', tone: 'accent' },
  personal: { label: 'Eigen', tone: 'neutral' },
  recipe: { label: 'Rezept', tone: 'neutral' },
};

function recipeBrandFallback(relation: UserFoodRelation): string | undefined {
  if (relation.foodRefType !== 'recipe') return undefined;
  return relation.recipeAccess === 'community' ? 'Community-Rezept' : 'Eigenes Rezept';
}

export function favoriteSummaryProps(relation: UserFoodRelation): FoodProductSummaryProps {
  const badges = [ORIGIN_BADGES[relation.foodRefType]];

  if (isUnavailableRecipeRelation(relation)) {
    return { name: UNAVAILABLE_RECIPE_NAME, imageUri: null, badges, nutritionBasis: 'per100g' };
  }

  return {
    name: relation.displayName,
    brand: relation.displayBrand ?? recipeBrandFallback(relation),
    imageUri: relation.imageUrl,
    badges,
    incomplete: relation.isComplete === false,
    nutrition: relation.nutritionPer100g,
    nutritionBasis: 'per100g',
    portion: relation.portion,
  };
}
