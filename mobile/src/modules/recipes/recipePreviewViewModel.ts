import type {
  RecipeIngredient,
  RecipeIngredientCategory,
} from '@fittrack/shared';

export interface RecipePreviewIngredientItem {
  ingredient: RecipeIngredient;
  amountLabel: string | null;
}

export interface RecipePreviewIngredientGroup {
  category: RecipeIngredientCategory;
  title: 'Hauptzutaten' | 'Gewürze & Kräuter';
  ingredients: RecipePreviewIngredientItem[];
}

export interface RecipePreviewViewModel {
  groups: RecipePreviewIngredientGroup[];
}

const PREVIEW_GROUPS: ReadonlyArray<Pick<RecipePreviewIngredientGroup, 'category' | 'title'>> = [
  { category: 'food', title: 'Hauptzutaten' },
  { category: 'seasoning', title: 'Gewürze & Kräuter' },
];

function formatAmount(value: number | null, unit: string): string | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  const formattedValue = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(1)));
  const normalizedUnit = unit.trim();
  return normalizedUnit.length > 0 ? `${formattedValue} ${normalizedUnit}` : formattedValue;
}

export function formatRecipeIngredientAmount(ingredient: RecipeIngredient): string | null {
  const amountLabel = ingredient.amountLabel?.trim();
  if (ingredient.category === 'seasoning') {
    if (amountLabel) return amountLabel;
    return formatAmount(ingredient.amountGrams, 'g');
  }

  if (ingredient.inputAmount != null && ingredient.inputAmount > 0) {
    return formatAmount(ingredient.inputAmount, ingredient.unit);
  }
  return formatAmount(ingredient.amountGrams, 'g');
}

export function buildRecipePreviewViewModel(
  ingredients: RecipeIngredient[],
): RecipePreviewViewModel {
  return {
    groups: PREVIEW_GROUPS.map(({ category, title }) => ({
      category,
      title,
      ingredients: ingredients
        .filter((ingredient) => (ingredient.category === 'seasoning' ? 'seasoning' : 'food') === category)
        .map((ingredient) => ({
          ingredient,
          amountLabel: formatRecipeIngredientAmount(ingredient),
        })),
    })),
  };
}