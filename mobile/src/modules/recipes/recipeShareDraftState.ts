import type {
  Recipe,
  RecipeImage,
  RecipeImageHeroCrop,
  RecipeShareBundleExportDraft,
} from '@fittrack/shared';
import type {
  RecipeInstagramNutritionHighlight,
  RecipeInstagramPresentation,
  RecipeShareBundleOptions,
  RecipeShareBundleResponse,
} from '../../shared/api/recipeInstagramRenderContract';
import { normalizeRecipeImageHeroCrop } from './recipeImageHeroCropMath';

export type RecipeShareRenderStatus = 'idle' | 'loading' | 'ready' | 'error';
export type RecipeShareRenderStage = 'initial' | 'final' | null;
export type RecipeShareBundleAsset = 'instagram' | 'detail';
export type RecipeShareAssetStatus = 'idle' | 'loading' | 'ready' | 'error';
export type RecipeShareStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface RecipeShareDraftState {
  recipeId: string;
  selectedTags: string[];
  nutritionHighlight: RecipeInstagramNutritionHighlight;
  primaryImageId: string | null;
  cropImageUri: string | null;
  primaryImageCrop: RecipeImageHeroCrop;
  presentation: RecipeInstagramPresentation | null;
  exportViewDraft: RecipeShareBundleExportDraft | null;
  instagramBytes: ArrayBuffer | null;
  detailBytes: ArrayBuffer | null;
  instagramUri: string | null;
  detailUri: string | null;
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
  renderShareBundle(
    recipeId: string,
    options: RecipeShareBundleOptions,
    signal?: AbortSignal,
  ): Promise<RecipeShareBundleResponse>;
}

export interface RecipeShareDraftControllerOptions {
  initialState: RecipeShareDraftState;
  renderApi: RecipeShareRenderApi;
  onStateChange: (state: RecipeShareDraftState) => void;
  createPreviewUri?: (
    png: ArrayBuffer,
    asset: RecipeShareBundleAsset,
    stage: Exclude<RecipeShareRenderStage, null>,
  ) => Promise<string | null> | string | null;
  cleanupPreviewUri?: (uri: string) => Promise<void> | void;
}

export interface RecipeShareDraftController {
  getState(): RecipeShareDraftState;
  setOptions(options: Pick<RecipeShareDraftSeed, 'selectedTags' | 'nutritionHighlight'> & {
    exportViewDraft?: RecipeShareBundleExportDraft | null;
  }): void;
  startInitialPreview(preserveExistingPair?: boolean): void;
  confirmCrop(crop: Partial<RecipeImageHeroCrop> | null | undefined): void;
  retryRender(): void;
  setAssetStatus(status: RecipeShareAssetStatus): void;
  setShareStatus(status: RecipeShareStatus): void;
  reset(): void;
  dispose(): void;
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const SHARE_IMAGE_WIDTH = 1080;
const SHARE_IMAGE_HEIGHT = 1350;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function cloneRecipeShareBundleExportDraft(
  draft: RecipeShareBundleExportDraft,
): RecipeShareBundleExportDraft {
  return {
    ...draft,
    steps: draft.steps.map((step) => ({ ...step })),
    includedIngredientIds: [...draft.includedIngredientIds],
  };
}

function decodePngAsset(value: unknown, assetName: RecipeShareBundleAsset): ArrayBuffer {
  if (!isRecord(value)) throw new Error(`Missing ${assetName} image in recipe share bundle.`);
  const mimeType = value['mimeType'];
  const size = value['size'];
  const data = value['data'];
  if (
    mimeType !== 'image/png'
    || typeof size !== 'number'
    || !Number.isSafeInteger(size)
    || size <= 0
  ) {
    throw new Error(`Invalid ${assetName} image metadata in recipe share bundle.`);
  }
  if (
    typeof data !== 'string'
    || data.length === 0
    || data.length % 4 !== 0
    || !BASE64_PATTERN.test(data)
  ) {
    throw new Error(`Invalid ${assetName} PNG data in recipe share bundle.`);
  }

  const decoded = atob(data);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  if (bytes.byteLength !== size) {
    throw new Error(`Invalid ${assetName} PNG size in recipe share bundle.`);
  }
  if (bytes.byteLength < 24 || !PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    throw new Error(`Invalid ${assetName} PNG signature in recipe share bundle.`);
  }

  const pngHeader = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    pngHeader.getUint32(16, false) !== SHARE_IMAGE_WIDTH
    || pngHeader.getUint32(20, false) !== SHARE_IMAGE_HEIGHT
  ) {
    throw new Error(`Invalid ${assetName} PNG dimensions in recipe share bundle.`);
  }
  return bytes.buffer;
}

function areIdenticalBuffers(left: ArrayBuffer, right: ArrayBuffer): boolean {
  if (left.byteLength !== right.byteLength) return false;
  const leftBytes = new Uint8Array(left);
  const rightBytes = new Uint8Array(right);
  return leftBytes.every((byte, index) => byte === rightBytes[index]);
}

function decodeShareBundle(value: unknown, expectedRecipeId: string) {
  if (!isRecord(value) || value['recipeId'] !== expectedRecipeId) {
    throw new Error('Recipe share bundle does not match the active recipe.');
  }
  const instagramBytes = decodePngAsset(value['instagram'], 'instagram');
  const detailBytes = decodePngAsset(value['detail'], 'detail');
  if (areIdenticalBuffers(instagramBytes, detailBytes)) {
    throw new Error('Recipe share bundle contains duplicate images.');
  }
  return { instagramBytes, detailBytes };
}

export function hasDistinctRecipeShareUris(
  instagramUri: string | null,
  detailUri: string | null,
): boolean {
  return Boolean(
    instagramUri
    && instagramUri.trim().length > 0
    && detailUri
    && detailUri.trim().length > 0
    && instagramUri !== detailUri,
  );
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
    primaryImageId: primaryImage?.id ?? null,
    cropImageUri: primaryImage?.url ?? null,
    primaryImageCrop: normalizeRecipeImageHeroCrop(primaryImage?.heroCrop),
    presentation: null,
    exportViewDraft: null,
    instagramBytes: null,
    detailBytes: null,
    instagramUri: null,
    detailUri: null,
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
  cleanupPreviewUri,
}: RecipeShareDraftControllerOptions): RecipeShareDraftController {
  let state: RecipeShareDraftState = {
    ...initialState,
    selectedTags: [...initialState.selectedTags],
    primaryImageCrop: { ...initialState.primaryImageCrop },
    presentation: initialState.presentation ? { ...initialState.presentation } : null,
    exportViewDraft: initialState.exportViewDraft
      ? cloneRecipeShareBundleExportDraft(initialState.exportViewDraft)
      : null,
  };
  let revision = 0;
  let abortController: AbortController | null = null;
  let finalRenderIssued = false;
  let disposed = false;

  const snapshot = (): RecipeShareDraftState => ({
    ...state,
    selectedTags: [...state.selectedTags],
    primaryImageCrop: { ...state.primaryImageCrop },
    presentation: state.presentation ? { ...state.presentation } : null,
    exportViewDraft: state.exportViewDraft
      ? cloneRecipeShareBundleExportDraft(state.exportViewDraft)
      : null,
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

  const buildOptions = (presentation?: RecipeInstagramPresentation): RecipeShareBundleOptions => ({
    ...(state.primaryImageId ? { imageId: state.primaryImageId } : {}),
    selectedTags: [...state.selectedTags],
    nutritionHighlight: state.nutritionHighlight,
    ...(state.exportViewDraft
      ? { exportViewDraft: cloneRecipeShareBundleExportDraft(state.exportViewDraft) }
      : {}),
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
      .renderShareBundle(state.recipeId, buildOptions(presentation), controller.signal)
      .then(async (bundle) => {
        if (!isCurrentRequest()) return;
        const { instagramBytes, detailBytes } = decodeShareBundle(bundle, state.recipeId);
        const createdUris = new Set<string>();
        const cleanupCreatedUris = async () => {
          if (!cleanupPreviewUri) return;
          await Promise.all([...createdUris].map(async (uri) => {
            try {
              await cleanupPreviewUri(uri);
            } catch {
              return;
            }
          }));
        };
        const createUri = async (
          png: ArrayBuffer,
          asset: RecipeShareBundleAsset,
        ): Promise<string> => {
          const uri = await createPreviewUri?.(png, asset, stage);
          if (typeof uri !== 'string' || uri.trim().length === 0) {
            throw new Error(`Could not create the ${asset} preview file.`);
          }
          createdUris.add(uri);
          return uri;
        };

        try {
          const instagramUri = await createUri(instagramBytes, 'instagram');
          if (!isCurrentRequest()) {
            await cleanupCreatedUris();
            return;
          }
          const detailUri = await createUri(detailBytes, 'detail');
          if (!hasDistinctRecipeShareUris(instagramUri, detailUri)) {
            throw new Error('Recipe share bundle did not create two distinct preview files.');
          }
          if (!isCurrentRequest()) {
            await cleanupCreatedUris();
            return;
          }
          emit({
            instagramBytes,
            detailBytes,
            instagramUri,
            detailUri,
            renderStatus: 'ready',
            renderStage: stage,
            error: null,
          });
        } catch (error: unknown) {
          await cleanupCreatedUris();
          throw error;
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || !isCurrentRequest()) return;
        emit({ renderStatus: 'error', renderStage: stage, error: toError(error) });
      })
      .finally(() => {
        if (stage === 'final' && isCurrentRequest()) {
          finalRenderIssued = false;
        }
        if (abortController === controller) {
          abortController = null;
        }
      });
  };

  const startInitialPreview = (preserveExistingPair = false) => {
    if (disposed) return;
    finalRenderIssued = false;
    invalidate();
    const keepPair = preserveExistingPair
      && Boolean(state.instagramBytes)
      && Boolean(state.detailBytes)
      && hasDistinctRecipeShareUris(state.instagramUri, state.detailUri);
    const presentation = keepPair && state.presentation ? { ...state.presentation } : null;
    emit({
      ...(!keepPair ? {
        presentation: null,
        instagramBytes: null,
        detailBytes: null,
        instagramUri: null,
        detailUri: null,
      } : {}),
      renderStatus: 'loading',
      renderStage: 'initial',
      assetStatus: 'idle',
      shareStatus: 'idle',
      error: null,
    });
    requestRender('initial', presentation ?? undefined);
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
    startInitialPreview(hasDistinctRecipeShareUris(state.instagramUri, state.detailUri));
  };

  const reset = () => {
    if (disposed) return;
    invalidate();
    finalRenderIssued = false;
    emit({
      presentation: null,
      instagramBytes: null,
      detailBytes: null,
      instagramUri: null,
      detailUri: null,
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
    setOptions: (options) => {
      if (disposed) return;
      invalidate();
      finalRenderIssued = false;
      const changes: Partial<RecipeShareDraftState> = {
        selectedTags: [...options.selectedTags],
        nutritionHighlight: options.nutritionHighlight,
        renderStatus: 'idle',
        renderStage: null,
        assetStatus: 'idle',
        shareStatus: 'idle',
        error: null,
      };
      if ('exportViewDraft' in options) {
        changes.exportViewDraft = options.exportViewDraft
          ? cloneRecipeShareBundleExportDraft(options.exportViewDraft)
          : null;
      }
      emit(changes);
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
    reset,
    dispose,
  };
}