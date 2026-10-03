// Recipe API — full CRUD + image upload + diary logging
import { apiClient } from './client';
import type {
  Meal,
  Recipe,
  RecipeExportStep,
  RecipeExportViewRequest,
  RecipeImage,
  RecipeImageHeroCrop,
  RecipeIngredient,
  RecipeStep,
  PrepareRecipeExportViewResponseV2,
} from '@fittrack/shared';
import type {
  RecipeInstagramNutritionHighlight,
  RecipeInstagramPresentation,
  RecipeInstagramRecipeMeta,
  RecipeInstagramRenderOptions,
  RecipeShareBundleOptions,
  RecipeShareBundleResponse,
} from './recipeInstagramRenderContract';

export { TEMPORARY_RECIPE_RENDER_META } from './recipeInstagramRenderContract';
export type {
  RecipeInstagramNutritionHighlight,
  RecipeInstagramPresentation,
  RecipeInstagramRecipeMeta,
  RecipeInstagramRenderOptions,
  RecipeShareBundleOptions,
  RecipeShareBundleResponse,
} from './recipeInstagramRenderContract';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecipeInputFields {
  name: string;
  description?: string;
  portions: number;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  tags: string[];
}

type NoExportViewConfirmation = {
  exportView?: never;
  exportViewAction?: never;
};

export type CreateRecipeInput = RecipeInputFields & (RecipeExportViewRequest | NoExportViewConfirmation);

export type UpdateRecipeInput = Partial<RecipeInputFields> & (RecipeExportViewRequest | NoExportViewConfirmation);

export type PrepareRecipeExportResponse = PrepareRecipeExportViewResponseV2;

export interface RecipeListResponse {
  recipes: Recipe[];
}

export interface LogRecipeInput {
  portions: number;
  mealId: string;
}

export interface ReorderRecipeImagesResponse {
  images: RecipeImage[];
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

  /** POST /api/recipes/:id/export-view/prepare — generate a strict V2 text suggestion without persisting */
  prepareExportView(recipeId: string): Promise<PrepareRecipeExportResponse> {
    return apiClient
      .post<PrepareRecipeExportResponse>(
        `/recipes/${recipeId}/export-view/prepare`,
        { contractVersion: 2 },
        { timeout: 90_000 },
      )
      .then((r) => {
        if (r.data.contractVersion !== 2) {
          throw new Error('Recipe export preparation response must use contract V2.');
        }
        return r.data;
      });
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
  uploadImage(
    recipeId: string,
    imageUri: string,
    mimeType: 'image/jpeg' | 'image/png',
    heroCrop?: RecipeImageHeroCrop,
  ): Promise<RecipeImage> {
    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      name: mimeType === 'image/png' ? 'recipe.png' : 'recipe.jpg',
      type: mimeType,
    } as unknown as Blob);
    if (heroCrop !== undefined) {
      formData.append('heroCrop', JSON.stringify(heroCrop));
    }

    return apiClient
      .post<RecipeImage>(`/recipes/${recipeId}/images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60_000,
      })
      .then((r) => r.data);
  },

  /** PUT /api/recipes/:id/images/:imageId/hero-crop — update crop metadata only */
  updateImageHeroCrop(
    recipeId: string,
    imageId: string,
    heroCrop: RecipeImageHeroCrop,
  ): Promise<RecipeImage> {
    return apiClient
      .put<RecipeImage>(`/recipes/${recipeId}/images/${imageId}/hero-crop`, { heroCrop })
      .then((r) => r.data);
  },

  /** DELETE /api/recipes/:id/images/:imageId — remove a single image */
  deleteImage(recipeId: string, imageId: string): Promise<void> {
    return apiClient
      .delete(`/recipes/${recipeId}/images/${imageId}`)
      .then(() => undefined);
  },

  /** PUT /api/recipes/:id/images/order — reorder all recipe images by ID permutation */
  reorderImages(recipeId: string, imageIds: string[]): Promise<ReorderRecipeImagesResponse> {
    return apiClient
      .put<ReorderRecipeImagesResponse>(`/recipes/${recipeId}/images/order`, { imageIds })
      .then((r) => r.data);
  },

  /** POST /api/recipes/:id/instagram-render — render one transient PNG preview. */
  renderInstagramRecipe(
    recipeId: string,
    options: RecipeInstagramRenderOptions,
    signal?: AbortSignal,
  ): Promise<ArrayBuffer> {
    return apiClient
      .post<ArrayBuffer>(`/recipes/${recipeId}/instagram-render`, options, {
        responseType: 'arraybuffer',
        timeout: 60_000,
        ...(signal ? { signal } : {}),
      })
      .then((r) => r.data);
  },

  /** POST /api/recipes/:id/share-bundle — render one atomic Instagram/detail PNG pair. */
  renderShareBundle(
    recipeId: string,
    options: RecipeShareBundleOptions,
    signal?: AbortSignal,
  ): Promise<RecipeShareBundleResponse> {
    return apiClient
      .post<RecipeShareBundleResponse>(`/recipes/${recipeId}/share-bundle`, options, {
        timeout: 60_000,
        ...(signal ? { signal } : {}),
      })
      .then((r) => r.data);
  },

  /**
   * POST /api/recipes/:id/log — log a recipe portion into the diary.
   * Returns the updated Meal object containing the new diary item.
   */
  log(recipeId: string, input: LogRecipeInput): Promise<Meal> {
    return apiClient.post<Meal>(`/recipes/${recipeId}/log`, input).then((r) => r.data);
  },
};
