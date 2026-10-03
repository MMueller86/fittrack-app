import { createHash } from 'node:crypto';
import type {
  Recipe,
  RecipeExportView,
  RecipeExportViewInput,
  RecipeExportViewStatus,
  RecipeIngredient,
} from '@fittrack/shared';

export interface RecipeFingerprintSource {
  name: Recipe['name'];
  description?: Recipe['description'];
  portions: Recipe['portions'];
  ingredients: Recipe['ingredients'];
  steps: Recipe['steps'];
  tags: Recipe['tags'];
  nutritionPerPortion: Recipe['nutritionPerPortion'];
}

function sortForCanonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForCanonicalJson);
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortForCanonicalJson((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

function canonicalJson(value: unknown): string {
  const serialized = JSON.stringify(sortForCanonicalJson(value));
  if (serialized === undefined) throw new Error('Cannot canonicalize undefined JSON');
  return serialized;
}

function nutritionFingerprintValue(value: RecipeFingerprintSource['nutritionPerPortion']) {
  return {
    calories: value.calories,
    protein: value.protein,
    carbs: value.carbs,
    fat: value.fat,
    fiber: value.fiber,
  };
}

function ingredientFingerprintValue(ingredient: RecipeIngredient) {
  return {
    id: ingredient.id,
    displayName: ingredient.displayName,
    category: ingredient.category ?? 'food',
    inputMode: ingredient.inputMode,
    inputAmount: ingredient.inputAmount,
    amountGrams: ingredient.amountGrams,
    unit: ingredient.unit,
    amountLabel: ingredient.amountLabel ?? null,
    linkedProductId: ingredient.linkedProductId,
    linkedReusableItemId: ingredient.linkedReusableItemId,
    isAiEstimate: ingredient.isAiEstimate,
    portionWeightGrams: ingredient.portionWeightGrams ?? null,
    portionLabel: ingredient.portionLabel ?? null,
    nutritionPer100g: nutritionFingerprintValue(ingredient.nutritionPer100g),
    nutritionContribution: nutritionFingerprintValue(ingredient.nutritionContribution),
  };
}

function fingerprintSourceValue(source: RecipeFingerprintSource) {
  return {
    name: source.name,
    description: source.description ?? null,
    portions: source.portions,
    steps: source.steps.map((step) => ({
      order: step.order,
      title: step.title ?? null,
      description: step.description,
    })),
    ingredients: source.ingredients.map(ingredientFingerprintValue),
    tags: source.tags,
    nutritionPerPortion: nutritionFingerprintValue(source.nutritionPerPortion),
  };
}

export function computeRecipeSourceFingerprint(source: RecipeFingerprintSource): string {
  return `sha256:${createHash('sha256').update(canonicalJson(fingerprintSourceValue(source)), 'utf8').digest('hex')}`;
}

export function getRecipeExportViewStatus(
  recipe: Pick<Recipe, keyof RecipeFingerprintSource | 'exportView'>,
): RecipeExportViewStatus | undefined {
  if (!recipe.exportView) return undefined;
  return recipe.exportView.sourceFingerprint === computeRecipeSourceFingerprint(recipe)
    ? 'current'
    : 'stale';
}

export function withRecipeExportViewStatus(recipe: Recipe): Recipe {
  const status = getRecipeExportViewStatus(recipe);
  if (!status) return recipe;
  return { ...recipe, exportViewStatus: status };
}

export function createRecipeExportView(
  exportView: RecipeExportViewInput,
  source: RecipeFingerprintSource,
): RecipeExportView {
  return {
    ...exportView,
    sourceFingerprint: computeRecipeSourceFingerprint(source),
  };
}