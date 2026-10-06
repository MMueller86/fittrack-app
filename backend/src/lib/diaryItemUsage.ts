import type { FoodRefType, Meal, MealItem } from '@fittrack/shared';

import { resolveRecipeForRead } from './communityRecipes';
import { getRecipesRepository } from './repositories/recipesRepository';
import { getReusableItemsRepository } from './repositories/reusableItemsRepository';
import { getUserFoodRelationRepository } from './repositories/userFoodRelationRepository';

async function bestEffort(operation: () => Promise<unknown>): Promise<void> {
  try {
    await operation();
  } catch {}
}

function getInputPreference(item: MealItem): { lastInputMode?: 'grams' | 'portion'; lastInputAmount?: number } {
  if (!Number.isFinite(item.quantity) || item.quantity <= 0) return {};

  const unit = item.unit.trim().toLowerCase();
  if (unit === 'portion' || unit === 'portions' || unit === 'portionen') {
    return { lastInputMode: 'portion', lastInputAmount: item.quantity };
  }
  if (unit === 'g' || unit === 'gram' || unit === 'grams') {
    return { lastInputMode: 'grams', lastInputAmount: item.quantity };
  }
  return {};
}

async function recordCopiedItemUsage(userId: string, item: MealItem, targetMeal: Meal): Promise<void> {
  const recipeId = item.recipeId;
  if (recipeId) {
    await bestEffort(() => getUserFoodRelationRepository().recordUsage(userId, {
      foodRef: recipeId,
      foodRefType: 'recipe',
      displayName: item.name,
      mealType: targetMeal.type,
      usageDate: targetMeal.date,
    }));

    try {
      const resolved = await resolveRecipeForRead(userId, recipeId);
      if (resolved.recipe) {
        await bestEffort(() => getRecipesRepository().incrementUsage(resolved.ownerUserId, recipeId));
      }
    } catch {}
    return;
  }

  const sourceId = item.sourceId;
  if (!sourceId) return;

  const foodRefType: FoodRefType = sourceId.startsWith('openFoodFacts:') ? 'catalog' : 'personal';
  const inputPreference = getInputPreference(item);
  await bestEffort(() => getUserFoodRelationRepository().recordUsage(userId, {
    foodRef: sourceId,
    foodRefType,
    displayName: item.name,
    mealType: targetMeal.type,
    usageDate: targetMeal.date,
    ...inputPreference,
  }));

  if (foodRefType === 'personal') {
    await bestEffort(async () => {
      const reusableItem = await getReusableItemsRepository().getById(userId, sourceId);
      if (reusableItem?.nutritionPer100g) {
        await getReusableItemsRepository().incrementUsageCount(userId, sourceId);
      }
    });
  }
}

export async function recordCopiedDiaryItemUsages(
  userId: string,
  copiedItems: MealItem[],
  targetMeal: Meal,
): Promise<void> {
  for (const item of copiedItems) {
    try {
      await recordCopiedItemUsage(userId, item, targetMeal);
    } catch {}
  }
}