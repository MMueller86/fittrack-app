import type { RecipeIngredient, RecipeNutritionSource } from '@fittrack/shared';
import { getReusableItemsRepository, type ReusableItemsRepository } from './reusableItemsRepository';
import { getFoodProductRepository, type FoodProductRepository } from './foodProductRepository';

export class RecipeProvenanceError extends Error {
  constructor() {
    super('Contradictory recipe ingredient provenance');
    this.name = 'RecipeProvenanceError';
  }
}

const sources = new Set<RecipeNutritionSource>(['openFoodFacts', 'manual', 'ai', 'label-scan', 'unknown']);

export function effectiveIngredientNutritionSource(ingredient: RecipeIngredient): RecipeNutritionSource {
  if (ingredient.isAiEstimate === true) return 'ai';
  return sources.has(ingredient.nutritionSource!) ? ingredient.nutritionSource! : 'unknown';
}

function sameNutritionOrigin(first: RecipeIngredient, second: RecipeIngredient): boolean {
  return first.linkedProductId === second.linkedProductId &&
    first.linkedReusableItemId === second.linkedReusableItemId &&
    first.isAiEstimate === second.isAiEstimate &&
    (second.nutritionSource === undefined || first.nutritionSource === second.nutritionSource) &&
    (['calories', 'protein', 'carbs', 'fat', 'fiber'] as const)
      .every((key) => first.nutritionPer100g[key] === second.nutritionPer100g[key]);
}

export async function resolveRecipeIngredientProvenance(
  userId: string,
  ingredients: RecipeIngredient[],
  previous: RecipeIngredient[] = [],
  repositories: {
    reusableItems: Pick<ReusableItemsRepository, 'getById'>;
    products: Pick<FoodProductRepository, 'getById'>;
  } = { reusableItems: getReusableItemsRepository(), products: getFoodProductRepository() },
): Promise<RecipeIngredient[]> {
  const resolved: RecipeIngredient[] = [];
  for (const ingredient of ingredients) {
    const old = previous.filter((entry) => entry.id === ingredient.id);
    if (old.length === 1 && old[0].isAiEstimate === true &&
        ingredient.isAiEstimate !== true && sameNutritionOrigin(old[0], { ...ingredient, isAiEstimate: old[0].isAiEstimate })) {
      throw new RecipeProvenanceError();
    }
    if (old.length === 1 && sameNutritionOrigin(old[0], ingredient)) {
      const nutritionSource = effectiveIngredientNutritionSource(old[0]);
      resolved.push({ ...ingredient, nutritionSource, isAiEstimate: nutritionSource === 'ai' });
      continue;
    }
    const declared = ingredient.nutritionSource;
    if (declared !== undefined && !sources.has(declared)) throw new RecipeProvenanceError();
    if (ingredient.linkedReusableItemId && ingredient.linkedProductId) throw new RecipeProvenanceError();
    let source: RecipeNutritionSource = 'unknown';
    const linkedId = ingredient.linkedReusableItemId ?? ingredient.linkedProductId;
    if (linkedId) {
      const personal = await repositories.reusableItems.getById(userId, linkedId);
      if (personal && personal.userId === userId && sources.has(personal.sourceType)) {
        source = personal.sourceType;
      } else if (!ingredient.linkedReusableItemId) {
        const product = await repositories.products.getById(linkedId);
        if (product?.source === 'openFoodFacts') source = 'openFoodFacts';
      }
    } else if (ingredient.isAiEstimate === true) {
      source = 'ai';
    } else if (declared === 'manual' || declared === 'label-scan') {
      source = declared;
    }
    if (declared !== undefined && declared !== 'unknown' && declared !== source) throw new RecipeProvenanceError();
    if ((source === 'ai') !== (ingredient.isAiEstimate === true)) throw new RecipeProvenanceError();
    resolved.push({ ...ingredient, nutritionSource: source });
  }
  return structuredClone(resolved);
}