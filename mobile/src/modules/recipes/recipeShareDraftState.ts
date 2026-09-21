import type { Recipe, RecipeImage, RecipeImageHeroCrop } from '@fittrack/shared';
import { TEMPORARY_RECIPE_RENDER_META } from '../../shared/api/recipeInstagramRenderContract';
import type {
  RecipeInstagramNutritionHighlight,
  RecipeInstagramPresentation,
  RecipeInstagramRecipeMeta,
  RecipeInstagramRenderOptions,
} from '../../shared/api/recipeInstagramRenderContract';
import { normalizeRecipeImageHeroCrop } from './recipeImageHeroCropMath';

export type RecipeShareRenderStatus = 'idle' | 'loading' | 'ready' | 'error';
export type RecipeShareRenderStage = 'initial' | 'final' | null;
export type RecipeShareAssetStatus = 'idle' | 'loading' | 'ready' | 'error';
export type RecipeShareStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface RecipeShareDraftState {
  recipeId: string;
  selectedTags: string[];
  nutritionHighlight: RecipeInstagramNutritionHighlight;
  recipeMeta: RecipeInstagramRecipeMeta;
  primaryImageId: string | null;
  cropImageUri: string | null;
  primaryImageCrop: RecipeImageHeroCrop;
  presentation: RecipeInstagramPresentation | null;
  previewBytes: ArrayBuffer | null;
  previewUri: string | null;
  renderStatus: RecipeShareRenderStatus;
  renderStage: RecipeShareRenderStage;
  assetStatus: RecipeShareAssetStatus;
  shareStatus: RecipeShareStatus;
  error: Error | null;
}

export interface RecipeShareDraftSeed {
  recipeId: string;
  selectedTags: string[];
  nutritionHighlight: RecipeInstagramNutritionHighlight;
}

export interface RecipeShareRenderApi {
  renderInstagramRecipe(
    recipeId: string,
    options: RecipeInstagramRenderOptions,
    signal?: AbortSignal,
  ): Promise<ArrayBuffer>;
}

export interface RecipeShareDraftControllerOptions {
  initialState: RecipeShareDraftState;
  renderApi: RecipeShareRenderApi;
  onStateChange: (state: RecipeShareDraftState) => void;
  createPreviewUri?: (
    png: ArrayBuffer,
    stage: Exclude<RecipeShareRenderStage, null>,
  ) => Promise<string | null> | string | null;
}

export interface RecipeShareDraftController {
  getState(): RecipeShareDraftState;
  setOptions(options: Pick<RecipeShareDraftSeed, 'selectedTags' | 'nutritionHighlight'>): void;
  startInitialPreview(): void;
  confirmCrop(crop: Partial<RecipeImageHeroCrop> | null | undefined): void;
  retryRender(): void;
  setAssetStatus(status: RecipeShareAssetStatus): void;
  setShareStatus(status: RecipeShareStatus): void;
  setPreviewUri(uri: string | null): void;
  reset(): void;
  dispose(): void;
}

export function selectServerPrimaryRecipeImage(
  images: readonly RecipeImage[],
): RecipeImage | null {
  return [...images].sort((left, right) => {
    const leftOrder = Number.isFinite(left.order) ? left.order : Number.POSITIVE_INFINITY;
    const rightOrder = Number.isFinite(right.order) ? right.order : Number.POSITIVE_INFINITY;
    return leftOrder - rightOrder || left.id.localeCompare(right.id);
  })[0] ?? null;
}

export function getServerPrimaryRecipeImageUri(
  recipe: Pick<Recipe, 'images'>,
): string | null {
  return selectServerPrimaryRecipeImage(recipe.images)?.url ?? null;
}

export function createRecipeShareDraftState(
  recipe: Pick<Recipe, 'images'>,
  seed: RecipeShareDraftSeed,
): RecipeShareDraftState {
  const primaryImage = selectServerPrimaryRecipeImage(recipe.images);

  return {
    recipeId: seed.recipeId,
    selectedTags: [...seed.selectedTags],
    nutritionHighlight: seed.nutritionHighlight,
    recipeMeta: { ...TEMPORARY_RECIPE_RENDER_META },
    primaryImageId: primaryImage?.id ?? null,
    cropImageUri: primaryImage?.url ?? null,
    primaryImageCrop: normalizeRecipeImageHeroCrop(primaryImage?.heroCrop),
    presentation: null,
    previewBytes: null,
    previewUri: null,
    renderStatus: 'idle',
    renderStage: null,
    assetStatus: 'idle',
    shareStatus: 'idle',
    error: null,
  };
}

export function toRecipeInstagramPresentation(
  crop: Partial<RecipeImageHeroCrop> | null | undefined,
): RecipeInstagramPresentation {
  const normalizedCrop = normalizeRecipeImageHeroCrop(crop);
  return {
    focusX: normalizedCrop.focusX,
    focusY: normalizedCrop.focusY,
    zoom: normalizedCrop.zoom,
  };
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Recipe share render failed');
}

export function createRecipeShareDraftController({
  initialState,
  renderApi,
  onStateChange,
  createPreviewUri,
}: RecipeShareDraftControllerOptions): RecipeShareDraftController {
  let state: RecipeShareDraftState = {
    ...initialState,
    selectedTags: [...initialState.selectedTags],
    recipeMeta: { ...initialState.recipeMeta },
    primaryImageCrop: { ...initialState.primaryImageCrop },
    presentation: initialState.presentation ? { ...initialState.presentation } : null,
  };
  let revision = 0;
  let abortController: AbortController | null = null;
  let finalRenderIssued = false;
  let disposed = false;

  const snapshot = (): RecipeShareDraftState => ({
    ...state,
    selectedTags: [...state.selectedTags],
    recipeMeta: { ...state.recipeMeta },
    primaryImageCrop: { ...state.primaryImageCrop },
    presentation: state.presentation ? { ...state.presentation } : null,
  });

  const emit = (changes: Partial<RecipeShareDraftState>) => {
    state = { ...state, ...changes };
    onStateChange(snapshot());
  };

  const invalidate = () => {
    revision += 1;
    abortController?.abort();
    abortController = null;
  };

  const buildOptions = (presentation?: RecipeInstagramPresentation): RecipeInstagramRenderOptions => ({
    selectedTags: [...state.selectedTags],
    nutritionHighlight: state.nutritionHighlight,
    recipeMeta: { ...state.recipeMeta },
    ...(presentation ? { presentation: { ...presentation } } : {}),
  });

  const requestRender = (
    stage: Exclude<RecipeShareRenderStage, null>,
    presentation?: RecipeInstagramPresentation,
  ) => {
    const requestRevision = revision;
    const controller = new AbortController();
    abortController = controller;
    const isCurrentRequest = () => (
      !disposed &&
      revision === requestRevision &&
      abortController === controller
    );

    void renderApi
      .renderInstagramRecipe(state.recipeId, buildOptions(presentation), controller.signal)
      .then(async (png) => {
        if (!isCurrentRequest()) return;
        const previewUri = createPreviewUri
          ? await createPreviewUri(png, stage)
          : null;
        if (!isCurrentRequest()) return;
        emit({
          previewBytes: png,
          previewUri,
          renderStatus: 'ready',
          renderStage: stage,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || !isCurrentRequest()) return;
        emit({ renderStatus: 'error', renderStage: stage, error: toError(error) });
      })
      .finally(() => {
        if (abortController === controller) {
          abortController = null;
        }
      });
  };

  const startInitialPreview = () => {
    if (disposed) return;
    finalRenderIssued = false;
    invalidate();
    emit({
      presentation: null,
      previewBytes: null,
      previewUri: null,
      renderStatus: 'loading',
      renderStage: 'initial',
      assetStatus: 'idle',
      shareStatus: 'idle',
      error: null,
    });
    requestRender('initial');
  };

  const confirmCrop = (crop: Partial<RecipeImageHeroCrop> | null | undefined) => {
    if (disposed || finalRenderIssued) return;
    finalRenderIssued = true;
    const presentation = toRecipeInstagramPresentation(crop);
    invalidate();
    emit({
      presentation,
      renderStatus: 'loading',
      renderStage: 'final',
      assetStatus: 'idle',
      shareStatus: 'idle',
      error: null,
    });
    requestRender('final', presentation);
  };

  const retryRender = () => {
    if (disposed) return;
    if (state.presentation) {
      finalRenderIssued = false;
      confirmCrop(state.presentation);
      return;
    }
    startInitialPreview();
  };

  const reset = () => {
    if (disposed) return;
    invalidate();
    finalRenderIssued = false;
    emit({
      presentation: null,
      previewBytes: null,
      previewUri: null,
      renderStatus: 'idle',
      renderStage: null,
      assetStatus: 'idle',
      shareStatus: 'idle',
      error: null,
    });
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    invalidate();
  };

  return {
    getState: snapshot,
    setOptions: ({ selectedTags, nutritionHighlight }) => {
      if (disposed) return;
      invalidate();
      finalRenderIssued = false;
      emit({
        selectedTags: [...selectedTags],
        nutritionHighlight,
        presentation: null,
        previewBytes: null,
        previewUri: null,
        renderStatus: 'idle',
        renderStage: null,
        assetStatus: 'idle',
        shareStatus: 'idle',
        error: null,
      });
    },
    startInitialPreview,
    confirmCrop,
    retryRender,
    setAssetStatus: (status) => {
      if (!disposed) emit({ assetStatus: status });
    },
    setShareStatus: (status) => {
      if (!disposed) emit({ shareStatus: status });
    },
    setPreviewUri: (uri) => {
      if (!disposed) emit({ previewUri: uri });
    },
    reset,
    dispose,
  };
}