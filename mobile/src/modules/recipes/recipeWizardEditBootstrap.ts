import { randomUUID } from 'expo-crypto';
import type {
  PrepareRecipeExportViewSuggestionV2,
  Recipe,
  RecipeExportStep,
  RecipeExportSuggestion,
  RecipeIngredient,
} from '@fittrack/shared';
import { RECIPE_EXPORT_MAX_INGREDIENTS } from '../../../../shared/types/recipeExport';
import type { MealParserPreviewItem } from '../../shared/api/aiApi';
import {
  buildWizardImageDraftFromRecipeImage,
  type AmountEdit,
  type WizardExportDraft,
  type WizardImageDraft,
  type WizardIngredient,
  type WizardStepItem,
} from './recipeWizardTypes';
import { normalizeRecipeWizardPortions } from './recipeWizardPortions';

export interface RecipeWizardEditBootstrapState {
  portions: number;
  ingredients: WizardIngredient[];
  amountEdits: Record<string, AmountEdit>;
  steps: WizardStepItem[];
  images: WizardImageDraft[];
  exportDraft: WizardExportDraft | null;
}

export interface LoadedRecipeWizardEditState {
  recipe: Recipe;
  bootstrapState: RecipeWizardEditBootstrapState;
}

export function buildWizardExportDraftFromRecipe(recipe: Recipe): WizardExportDraft | null {
  const exportView = recipe.exportView;
  const fallbackIngredientIds = recipe.ingredients
    .filter((ingredient) => (ingredient.category ?? 'food') !== 'seasoning')
    .map((ingredient) => ingredient.id);
  const fallbackSteps = [...recipe.steps].sort((left, right) => left.order - right.order).map((step, index) => ({
    order: index + 1,
    description: step.description,
  }));

  return {
    version: 1,
    teaser: exportView?.teaser ?? (recipe.description?.trim() || recipe.name),
    totalTimeMinutes: exportView ? String(exportView.totalTimeMinutes) : '',
    difficulty: exportView?.difficulty ?? '',
    steps: exportView
      ? exportView.steps.map((step) => ({ ...step }))
      : fallbackSteps,
    includedIngredientIds: exportView
      ? [...exportView.includedIngredientIds]
      : fallbackIngredientIds.length <= RECIPE_EXPORT_MAX_INGREDIENTS ? fallbackIngredientIds : [],
    includedIngredientKeys: [],
    analysisIngredientKeys: [],
    source: exportView ? 'persisted' : 'legacy',
    confirmed: false,
  };
}

export function buildWizardExportDraftFromSuggestion(
  suggestion: RecipeExportSuggestion,
  analysisIngredientKeys: string[],
): WizardExportDraft {
  return {
    version: 1,
    teaser: suggestion.teaser,
    totalTimeMinutes: suggestion.totalTimeMinutes == null ? '' : String(suggestion.totalTimeMinutes),
    difficulty: suggestion.difficulty ?? '',
    steps: suggestion.steps.map((step) => ({
      order: step.order,
      description: step.description,
    })),
    includedIngredientIds: [],
    includedIngredientKeys: [...suggestion.includedIngredientKeys],
    analysisIngredientKeys: [...analysisIngredientKeys],
    source: 'analysis',
    confirmed: false,
  };
}

export function buildManualWizardExportDraft(
  teaser: string,
  steps: RecipeExportStep[],
  analysisIngredientKeys: string[],
): WizardExportDraft {
  return {
    version: 1,
    teaser,
    totalTimeMinutes: '',
    difficulty: '',
    steps: steps.map((step) => ({ ...step })),
    includedIngredientIds: [],
    includedIngredientKeys: [],
    analysisIngredientKeys: [...analysisIngredientKeys],
    source: 'manual',
    confirmed: false,
  };
}

export function buildWizardExportDraftFromPreparedSuggestion(
  suggestion: PrepareRecipeExportViewSuggestionV2,
  currentDraft: WizardExportDraft | null = null,
): WizardExportDraft {
  return {
    version: 1,
    teaser: suggestion.teaser,
    totalTimeMinutes: suggestion.totalTimeMinutes == null ? '' : String(suggestion.totalTimeMinutes),
    difficulty: suggestion.difficulty ?? '',
    steps: suggestion.steps.map((step) => ({ ...step })),
    includedIngredientIds: currentDraft?.includedIngredientIds ?? [],
    includedIngredientKeys: [],
    analysisIngredientKeys: [],
    source: 'prepared',
    confirmed: false,
  };
}

export function buildParserItemFromRecipeIngredient(ingredient: RecipeIngredient): MealParserPreviewItem {
  const category = ingredient.category ?? 'food';
  const linkedFoodId = ingredient.linkedProductId ?? ingredient.linkedReusableItemId;
  return {
    rawText: ingredient.amountLabel
      ? `${ingredient.amountLabel} ${ingredient.displayName}`
      : ingredient.displayName,
    displayName: ingredient.displayName,
    status: category === 'seasoning' ? 'seasoning' : 'matched',
    category,
    selectedProductId: linkedFoodId,
    selectedProductName: linkedFoodId ? ingredient.displayName : null,
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
    portions: normalizeRecipeWizardPortions(recipe.portions),
    ingredients: recipe.ingredients.map(buildWizardIngredientFromRecipeIngredient),
    amountEdits: buildAmountEditsFromIngredients(recipe.ingredients),
    steps: buildWizardStepsFromRecipe(recipe),
    images: [...recipe.images]
      .sort((left, right) => left.order - right.order)
      .flatMap((image) => {
        const draft = buildWizardImageDraftFromRecipeImage(image);
        return draft ? [draft] : [];
      }),
    exportDraft: buildWizardExportDraftFromRecipe(recipe),
  };
}

export async function loadRecipeWizardEditState(
  recipeId: string,
  getRecipe: (id: string) => Promise<Recipe>,
): Promise<LoadedRecipeWizardEditState> {
  const recipe = await getRecipe(recipeId);
  return {
    recipe,
    bootstrapState: buildRecipeWizardEditBootstrapState(recipe),
  };
}