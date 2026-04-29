// Recipe types — stub
// Will be populated in M5 (Recipe Management milestone)

export interface RecipeIngredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  macros: {
    calories: number;
    proteinG: number;
    fatG: number;
    carbsG: number;
    fiberG: number;
  };
}

export interface PerPortionNutrition {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number;
}

export interface Recipe {
  id: string;
  userId: string;
  name: string;
  description?: string;
  servings: number;
  perPortionNutrition?: PerPortionNutrition; // set after AI analysis is confirmed
  ingredients: RecipeIngredient[];
  tags: string[];
  imagePath?: string; // Blob Storage path
  createdAt: string;
  updatedAt: string;
}
