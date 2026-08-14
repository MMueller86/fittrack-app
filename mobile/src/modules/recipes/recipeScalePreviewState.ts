import type {
  Recipe,
  RecipeScalePreviewRequest,
  RecipeScalePreviewResponse,
  RecipeStep,
} from '@fittrack/shared';

export const RECIPE_SCALE_DEBOUNCE_MS = 400;

export type RecipeTextPreviewState = {
  status: 'original' | 'loading' | 'ready' | 'error';
  description: string | null;
  steps: RecipeStep[];
};

export type RecipeScalePreviewErrorNotice = {
  title: string;
  body: string;
};

interface RecipeScalePreviewStateOptions {
  getScreenRecipeId: () => string;
  getCurrentRecipe: () => Recipe | null;
  getTargetPortions: () => number;
  setTargetPortions: (value: number) => void;
  setTextPreview: (state: RecipeTextPreviewState) => void;
  setErrorNotice: (notice: RecipeScalePreviewErrorNotice | null) => void;
  previewRecipeScale: (
    request: RecipeScalePreviewRequest,
    signal: AbortSignal,
  ) => Promise<RecipeScalePreviewResponse>;
}

export interface RecipeScalePreviewController {
  invalidate(): void;
  resetForReload(currentRecipe: Recipe | null): void;
  restoreOriginalPreview(recipe: Recipe): void;
  requestScalePreview(nextTargetPortions: number, currentRecipe: Recipe): void;
  dispose(): void;
}

export function createOriginalTextPreview(recipe: Recipe): RecipeTextPreviewState {
  return {
    status: 'original',
    description: recipe.description ?? null,
    steps: recipe.steps,
  };
}

export function createRecipeScalePreviewController({
  getScreenRecipeId,
  getCurrentRecipe,
  getTargetPortions,
  setTargetPortions,
  setTextPreview,
  setErrorNotice,
  previewRecipeScale,
}: RecipeScalePreviewStateOptions): RecipeScalePreviewController {
  let revision = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let abortController: AbortController | null = null;
  let disposed = false;

  const invalidate = () => {
    revision += 1;
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    abortController?.abort();
    abortController = null;
  };

  const restoreOriginalPreview = (recipe: Recipe) => {
    setTargetPortions(recipe.portions);
    setTextPreview(createOriginalTextPreview(recipe));
  };

  const resetForReload = (currentRecipe: Recipe | null) => {
    invalidate();
    if (currentRecipe?.id === getScreenRecipeId()) {
      restoreOriginalPreview(currentRecipe);
    }
  };

  const requestScalePreview = (nextTargetPortions: number, currentRecipe: Recipe) => {
    invalidate();
    setErrorNotice(null);

    if (nextTargetPortions === currentRecipe.portions) {
      restoreOriginalPreview(currentRecipe);
      return;
    }

    setTextPreview({
      status: 'loading',
      description: null,
      steps: [],
    });

    const requestRevision = revision;
    const screenRecipeId = getScreenRecipeId();
    const requestRecipeId = currentRecipe.id;
    const requestUpdatedAt = currentRecipe.updatedAt;
    const isCurrentRequest = () => {
      const currentRecipeSnapshot = getCurrentRecipe();
      return (
        !disposed &&
        revision === requestRevision &&
        getTargetPortions() === nextTargetPortions &&
        currentRecipeSnapshot?.id === screenRecipeId &&
        currentRecipeSnapshot.id === requestRecipeId &&
        currentRecipeSnapshot.updatedAt === requestUpdatedAt
      );
    };

    const nextDebounceTimer = setTimeout(() => {
      if (debounceTimer === nextDebounceTimer) {
        debounceTimer = null;
      }
      if (!isCurrentRequest()) return;

      const controller = new AbortController();
      abortController = controller;

      void previewRecipeScale(
        { recipeId: screenRecipeId, targetPortions: nextTargetPortions },
        controller.signal,
      )
        .then((response) => {
          if (!isCurrentRequest()) return;
          if (response.targetPortions !== nextTargetPortions) {
            throw new Error('Recipe scale response target mismatch');
          }
          setTextPreview({
            status: 'ready',
            description: response.description,
            steps: response.steps,
          });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || !isCurrentRequest()) return;
          console.error('[RecipeDetail] Scale preview failed for id', screenRecipeId, error);
          setTextPreview({
            status: 'error',
            description: currentRecipe.description ?? null,
            steps: currentRecipe.steps,
          });
          setErrorNotice({
            title: 'Rezepttexte konnten nicht angepasst werden',
            body: 'Die Zutaten wurden angepasst. Die ursprüngliche Beschreibung und Zubereitung werden angezeigt.',
          });
        })
        .finally(() => {
          if (abortController === controller) {
            abortController = null;
          }
        });
    }, RECIPE_SCALE_DEBOUNCE_MS);

    debounceTimer = nextDebounceTimer;
  };

  const dispose = () => {
    disposed = true;
    invalidate();
  };

  return {
    invalidate,
    resetForReload,
    restoreOriginalPreview,
    requestScalePreview,
    dispose,
  };
}