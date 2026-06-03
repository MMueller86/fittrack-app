// Recipe API — full CRUD + image upload + diary logging
import { apiClient } from './client';
import type {
  Recipe,
  RecipeIngredient,
  RecipeStep,
} from '@fittrack/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateRecipeInput {
  name: string;
  description?: string;
  portions: number;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  tags: string[];
}

export type UpdateRecipeInput = Partial<CreateRecipeInput>;

export interface RecipeListResponse {
  recipes: Recipe[];
}

export interface LogRecipeInput {
  portions: number;
  mealId: string;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const recipeApi = {
  /** GET /api/recipes — list all recipes for the current user */
  list(): Promise<RecipeListResponse> {
    return apiClient.get<RecipeListResponse>('/recipes').then((r) => r.data);
  },

  /** GET /api/recipes/:id — get single recipe with SAS image URLs */
  get(id: string): Promise<Recipe> {
    return apiClient.get<Recipe>(`/recipes/${id}`).then((r) => r.data);
  },

  /** POST /api/recipes — create a new recipe */
  create(input: CreateRecipeInput): Promise<Recipe> {
    return apiClient.post<Recipe>('/recipes', input).then((r) => r.data);
  },

  /** PUT /api/recipes/:id — update a recipe */
  update(id: string, input: UpdateRecipeInput): Promise<Recipe> {
    return apiClient.put<Recipe>(`/recipes/${id}`, input).then((r) => r.data);
  },

  /** DELETE /api/recipes/:id — delete a recipe and all its images */
  delete(id: string): Promise<void> {
    return apiClient.delete(`/recipes/${id}`).then(() => undefined);
  },

  /**
   * POST /api/recipes/:id/images — upload a recipe image.
   * Sends as multipart/form-data with an `image` field.
   */
  uploadImage(recipeId: string, imageUri: string, mimeType: 'image/jpeg' | 'image/png'): Promise<Recipe> {
    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      name: mimeType === 'image/png' ? 'recipe.png' : 'recipe.jpg',
      type: mimeType,
    } as unknown as Blob);

    return apiClient
      .post<Recipe>(`/recipes/${recipeId}/images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60_000,
      })
      .then((r) => r.data);
  },

  /** DELETE /api/recipes/:id/images/:imageId — remove a single image */
  deleteImage(recipeId: string, imageId: string): Promise<Recipe> {
    return apiClient
      .delete<Recipe>(`/recipes/${recipeId}/images/${imageId}`)
      .then((r) => r.data);
  },

  /**
   * POST /api/recipes/:id/log — log a recipe portion into the diary.
   * Returns the updated Meal object containing the new diary item.
   */
  log(recipeId: string, input: LogRecipeInput): Promise<unknown> {
    return apiClient.post(`/recipes/${recipeId}/log`, input).then((r) => r.data);
  },
};
