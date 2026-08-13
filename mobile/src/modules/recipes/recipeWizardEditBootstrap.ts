import { randomUUID } from 'expo-crypto';
import type { Recipe, RecipeIngredient } from '@fittrack/shared';
import type { MealParserPreviewItem } from '../../shared/api/aiApi';
import {
  buildWizardImageDraftFromRecipeImage,
  type AmountEdit,
  type WizardImageDraft,
  type WizardIngredient,
  type WizardStepItem,
} from './recipeWizardTypes';

export interface RecipeWizardEditBootstrapState {
  ingredients: WizardIngredient[];
  amountEdits: Record<string, AmountEdit>;
  steps: WizardStepItem[];
  images: WizardImageDraft[];
}

export function buildParserItemFromRecipeIngredient(ingredient: RecipeIngredient): MealParserPreviewItem {
  const category = ingredient.category ?? 'food';
  return {
    rawText: ingredient.amountLabel
      ? `${ingredient.amountLabel} ${ingredient.displayName}`
      : ingredient.displayName,
    displayName: ingredient.displayName,
    status: category === 'seasoning' ? 'seasoning' : 'matched',
    category,
    selectedProductId: ingredient.linkedProductId,
    selectedProductName: ingredient.linkedProductId ? ingredient.displayName : null,
    candidates: [],
    inputMode: ingredient.inputMode,
    inputAmount: ingredient.inputAmount,
    amountGrams: ingredient.amountGrams,
    needsReview: false,
    warnings: [],
    kitchenAmountText: ingredient.amountLabel ?? null,
  };
}

export function buildWizardIngredientFromRecipeIngredient(ingredient: RecipeIngredient): WizardIngredient {
  const isSeasoning = (ingredient.category ?? 'food') === 'seasoning';
  return {
    id: ingredient.id,
    parserItem: buildParserItemFromRecipeIngredient(ingredient),
    status: isSeasoning ? 'seasoning' : 'confirmed',
    userConfirmed: true,
    resolvedIngredient: ingredient,
  };
}

export function buildAmountEditsFromIngredients(ingredients: RecipeIngredient[]): Record<string, AmountEdit> {
  const edits: Record<string, AmountEdit> = {};
  for (const ingredient of ingredients) {
    if (ingredient.inputAmount != null) {
      edits[ingredient.id] = {
        mode: ingredient.inputMode,
        value: String(ingredient.inputAmount),
      };
    }
  }
  return edits;
}

export function buildWizardStepsFromRecipe(recipe: Recipe): WizardStepItem[] {
  return [...recipe.steps]
    .sort((left, right) => left.order - right.order)
    .map((step) => ({
      id: randomUUID(),
      title: step.title ?? '',
      description: step.description,
    }));
}

export function buildRecipeWizardEditBootstrapState(recipe: Recipe): RecipeWizardEditBootstrapState {
  return {
    ingredients: recipe.ingredients.map(buildWizardIngredientFromRecipeIngredient),
    amountEdits: buildAmountEditsFromIngredients(recipe.ingredients),
    steps: buildWizardStepsFromRecipe(recipe),
    images: [...recipe.images]
      .sort((left, right) => left.order - right.order)
      .flatMap((image) => {
        const draft = buildWizardImageDraftFromRecipeImage(image);
        return draft ? [draft] : [];
      }),
  };
}