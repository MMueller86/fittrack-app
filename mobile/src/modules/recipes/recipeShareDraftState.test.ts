import { describe, expect, it, vi } from 'vitest';
import type { Recipe } from '@fittrack/shared';
import {
  createRecipeShareDraftController,
  createRecipeShareDraftState,
  getServerPrimaryRecipeImageUri,
} from './recipeShareDraftState';
import type { RecipeShareDraftState } from './recipeShareDraftState';
import type {
  RecipeShareBundleOptions,
  RecipeShareBundleResponse,
} from '../../shared/api/recipeInstagramRenderContract';

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'recipe-1',
    ownerUserId: 'user-1',
    name: 'Pasta',
    portions: 2,
    ingredients: [],
    steps: [],
    images: [],
    nutritionTotal: { calories: 400, protein: 20, carbs: 40, fat: 10, fiber: 5 },
    nutritionPerPortion: { calories: 200, protein: 10, carbs: 20, fat: 5, fiber: 2.5 },
    visibility: 'private',
    sharedWithUserIds: [],
    tags: ['Schnell', 'Salat'],
    usageCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function deferred<T>() {
  let resolvePromise!: (value: T) => void;
  let rejectPromise!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

type DeferredBundle = {
  promise: Promise<RecipeShareBundleResponse>;
  resolve: (value: RecipeShareBundleResponse) => void;
  reject: (reason?: unknown) => void;
};

function createPngHeaderBytes(marker: number): ArrayBuffer {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  bytes[12] = marker;
  bytes[18] = 4;
  bytes[19] = 56;
  bytes[22] = 5;
  bytes[23] = 70;
  return bytes.buffer;
}

function encodeBase64(bytes: ArrayBuffer): string {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function makeBundle(
  recipeId = 'recipe-1',
  instagramBytes = createPngHeaderBytes(1),
  detailBytes = createPngHeaderBytes(2),
): RecipeShareBundleResponse {
  return {
    recipeId,
    instagram: { mimeType: 'image/png', size: instagramBytes.byteLength, data: encodeBase64(instagramBytes) },
    detail: { mimeType: 'image/png', size: detailBytes.byteLength, data: encodeBase64(detailBytes) },
  };
}

function createHarness() {
  const recipe = makeRecipe({
    images: [
      { id: 'carousel-image', blobName: 'carousel.png', order: 2, url: 'https://example.test/carousel.png' },
      { id: 'primary-image', blobName: 'primary.png', order: 1, url: 'https://example.test/primary.png' },
    ],
  });
  let state: RecipeShareDraftState = createRecipeShareDraftState(recipe, {
    recipeId: recipe.id,
    selectedTags: ['Schnell'],
    nutritionHighlight: null,
  });
  const requests: Array<{
    recipeId: string;
    options: RecipeShareBundleOptions;
    signal: AbortSignal | undefined;
  }> = [];
  const renderRequests: DeferredBundle[] = [];
  const renderShareBundle = vi.fn(
    (recipeId: string, options: RecipeShareBundleOptions, signal?: AbortSignal) => {
      requests.push({ recipeId, options, signal });
      const request = deferred<RecipeShareBundleResponse>();
      renderRequests.push(request);
      return request.promise;
    },
  );
  const createPreviewUri = vi.fn(async (png: ArrayBuffer, asset: 'instagram' | 'detail') => (
    `memory:${asset}:${new Uint8Array(png)[12] ?? 0}`
  ));
  const cleanupPreviewUri = vi.fn(async (_uri: string) => undefined);
  const controller = createRecipeShareDraftController({
    initialState: state,
    renderApi: { renderShareBundle },
    createPreviewUri,
    cleanupPreviewUri,
    onStateChange: (nextState) => {
      state = nextState;
    },
  });

  return {
    recipe,
    controller,
    renderShareBundle,
    createPreviewUri,
    cleanupPreviewUri,
    requests,
    renderRequests,
    get state() { return state; },
  };
}

describe('recipeShareDraftState', () => {
  it('selects the server primary image independently from carousel order', () => {
    const recipe = makeRecipe({
      images: [
        { id: 'visible-first', blobName: 'visible.png', order: 2, url: 'https://example.test/visible.png' },
        { id: 'server-primary', blobName: 'primary.png', order: 1, url: 'https://example.test/primary.png' },
      ],
    });

    expect(getServerPrimaryRecipeImageUri(recipe)).toBe('https://example.test/primary.png');
    expect(createRecipeShareDraftState(recipe, {
      recipeId: recipe.id,
      selectedTags: [],
      nutritionHighlight: null,
    })).toMatchObject({
      primaryImageId: 'server-primary',
      cropImageUri: 'https://example.test/primary.png',
      instagramUri: null,
      detailUri: null,
    });
  });

  it('requests one bundle and commits both validated preview files atomically', async () => {
    const harness = createHarness();
    harness.controller.startInitialPreview();

    expect(harness.requests[0]).toMatchObject({
      recipeId: 'recipe-1',
      options: {
        imageId: 'primary-image',
        selectedTags: ['Schnell'],
        nutritionHighlight: null,
      },
    });
    expect(harness.requests[0]?.options).not.toHaveProperty('presentation');
    expect(harness.requests[0]?.options).not.toHaveProperty('recipeMeta');
    expect(harness.requests[0]?.options).not.toHaveProperty('title');
    expect(harness.requests[0]?.options).not.toHaveProperty('nutrition');

    harness.renderRequests[0]?.resolve(makeBundle());
    await vi.waitFor(() => expect(harness.state.renderStatus).toBe('ready'));

    expect(harness.renderShareBundle).toHaveBeenCalledTimes(1);
    expect(harness.state).toMatchObject({
      renderStage: 'initial',
      instagramUri: 'memory:instagram:1',
      detailUri: 'memory:detail:2',
      instagramBytes: createPngHeaderBytes(1),
      detailBytes: createPngHeaderBytes(2),
    });
    expect(harness.state.instagramUri).not.toBe(harness.state.detailUri);
  });

  it('serializes a nullable transient exportViewDraft under the exact request property', () => {
    const harness = createHarness();
    const exportViewDraft = {
      version: 1 as const,
      teaser: 'Frisch und schnell',
      totalTimeMinutes: null,
      difficulty: null,
      steps: [{ order: 1, description: 'Tomaten schneiden.' }],
      includedIngredientIds: [],
    };

    harness.controller.setOptions({
      selectedTags: ['Schnell'],
      nutritionHighlight: null,
      exportViewDraft,
    });
    harness.controller.startInitialPreview();

    expect(harness.requests[0]?.options).toEqual({
      imageId: 'primary-image',
      selectedTags: ['Schnell'],
      nutritionHighlight: null,
      exportViewDraft,
    });
    expect(harness.requests[0]?.options).not.toHaveProperty('exportDraft');
    expect(harness.state.exportViewDraft).toEqual(exportViewDraft);
  });

  it('invalidates an older bundle when its transient export draft changes and retries the latest draft', async () => {
    const harness = createHarness();
    const firstDraft = {
      version: 1 as const,
      teaser: 'Alter Entwurf',
      totalTimeMinutes: null,
      difficulty: null,
      steps: [{ order: 1, description: 'Tomaten schneiden.' }],
      includedIngredientIds: [],
    };
    const latestDraft = { ...firstDraft, teaser: 'Aktueller Entwurf' };

    harness.controller.setOptions({
      selectedTags: ['Schnell'],
      nutritionHighlight: null,
      exportViewDraft: firstDraft,
    });
    harness.controller.startInitialPreview();
    const staleSignal = harness.requests[0]?.signal;

    harness.controller.setOptions({
      selectedTags: ['Schnell'],
      nutritionHighlight: null,
      exportViewDraft: latestDraft,
    });
    harness.controller.startInitialPreview();

    expect(staleSignal?.aborted).toBe(true);
    expect(harness.requests[1]?.options.exportViewDraft).toEqual(latestDraft);
    harness.renderRequests[0]?.resolve(makeBundle());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(harness.createPreviewUri).not.toHaveBeenCalled();

    harness.renderRequests[1]?.reject(new Error('render failed'));
    await vi.waitFor(() => expect(harness.state.renderStatus).toBe('error'));
    harness.controller.retryRender();

    expect(harness.requests[2]?.options.exportViewDraft).toEqual(latestDraft);
    harness.renderRequests[2]?.resolve(makeBundle(
      'recipe-1',
      createPngHeaderBytes(3),
      createPngHeaderBytes(4),
    ));
    await vi.waitFor(() => expect(harness.state.renderStatus).toBe('ready'));
    expect(harness.state.exportViewDraft).toEqual(latestDraft);
  });

  it('renders one final bundle after crop confirmation with a full presentation', async () => {
    const harness = createHarness();
    harness.controller.startInitialPreview();
    harness.renderRequests[0]?.resolve(makeBundle());
    await vi.waitFor(() => expect(harness.state.renderStatus).toBe('ready'));

    harness.controller.confirmCrop({ focusX: 0.2, focusY: 0.7, zoom: 1.4 });
    harness.controller.confirmCrop({ focusX: 0.8, focusY: 0.1, zoom: 2 });

    expect(harness.requests).toHaveLength(2);
    expect(harness.requests[1]?.options).toEqual({
      imageId: 'primary-image',
      selectedTags: ['Schnell'],
      nutritionHighlight: null,
      presentation: { focusX: 0.2, focusY: 0.7, zoom: 1.4 },
    });
    expect(harness.requests[1]?.options).not.toHaveProperty('recipeMeta');
  });

  it('allows a later crop adjustment after the previous final bundle completes', async () => {
    const harness = createHarness();
    harness.controller.startInitialPreview();
    harness.renderRequests[0]?.resolve(makeBundle());
    await vi.waitFor(() => expect(harness.state.renderStatus).toBe('ready'));

    harness.controller.confirmCrop({ focusX: 0.2, focusY: 0.7, zoom: 1.4 });
    harness.renderRequests[1]?.resolve(makeBundle(
      'recipe-1',
      createPngHeaderBytes(3),
      createPngHeaderBytes(4),
    ));
    await vi.waitFor(() => expect(harness.state.renderStatus).toBe('ready'));

    harness.controller.confirmCrop({ focusX: 0.8, focusY: 0.1, zoom: 2 });

    expect(harness.requests).toHaveLength(3);
    expect(harness.requests[2]?.options.presentation).toEqual({
      focusX: 0.8,
      focusY: 0.1,
      zoom: 2,
    });
  });

  it('aborts superseded work and ignores late responses after replacement or disposal', async () => {
    const harness = createHarness();
    harness.controller.startInitialPreview();
    const initialSignal = harness.requests[0]?.signal;
    harness.controller.confirmCrop({ focusX: 0.2, focusY: 0.7, zoom: 1.4 });

    expect(initialSignal?.aborted).toBe(true);
    harness.renderRequests[0]?.resolve(makeBundle());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(harness.state.renderStage).toBe('final');
    expect(harness.state.renderStatus).toBe('loading');
    expect(harness.createPreviewUri).not.toHaveBeenCalled();

    harness.controller.dispose();
    const finalSignal = harness.requests[1]?.signal;
    expect(finalSignal?.aborted).toBe(true);
    harness.renderRequests[1]?.resolve(makeBundle());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(harness.state.renderStatus).toBe('loading');
    expect(harness.createPreviewUri).not.toHaveBeenCalled();
  });

  it('preserves the last complete pair when a replacement bundle fails', async () => {
    const harness = createHarness();
    harness.controller.startInitialPreview();
    harness.renderRequests[0]?.resolve(makeBundle());
    await vi.waitFor(() => expect(harness.state.renderStatus).toBe('ready'));
    const lastValidPair = {
      instagramBytes: harness.state.instagramBytes,
      detailBytes: harness.state.detailBytes,
      instagramUri: harness.state.instagramUri,
      detailUri: harness.state.detailUri,
    };

    harness.controller.confirmCrop({ focusX: 0.2, focusY: 0.7, zoom: 1.4 });
    harness.renderRequests[1]?.reject(new Error('render failed'));
    await vi.waitFor(() => expect(harness.state.renderStatus).toBe('error'));

    expect(harness.state.renderStatus).toBe('error');
    expect(harness.state.renderStage).toBe('final');
    expect(harness.state.error?.message).toBe('render failed');
    expect(harness.state.recipeId).toBe('recipe-1');
    expect(harness.state.cropImageUri).toBe('https://example.test/primary.png');
    expect(harness.state).toMatchObject(lastValidPair);
  });

  it('keeps the complete pair and crop visible during a confirmed export replacement render', async () => {
    const harness = createHarness();
    harness.controller.startInitialPreview();
    harness.renderRequests[0]?.resolve(makeBundle());
    await vi.waitFor(() => expect(harness.state.renderStatus).toBe('ready'));
    harness.controller.confirmCrop({ focusX: 0.2, focusY: 0.7, zoom: 1.4 });
    harness.renderRequests[1]?.resolve(makeBundle(
      'recipe-1',
      createPngHeaderBytes(3),
      createPngHeaderBytes(4),
    ));
    await vi.waitFor(() => expect(harness.state.renderStatus).toBe('ready'));
    const lastCompletePair = {
      instagramUri: harness.state.instagramUri,
      detailUri: harness.state.detailUri,
    };

    harness.controller.startInitialPreview(true);

    expect(harness.requests).toHaveLength(3);
    expect(harness.requests[2]?.options.presentation).toEqual({
      focusX: 0.2,
      focusY: 0.7,
      zoom: 1.4,
    });
    expect(harness.state.renderStatus).toBe('loading');
    expect(harness.state).toMatchObject(lastCompletePair);

    harness.renderRequests[2]?.reject(new Error('replacement failed'));
    await vi.waitFor(() => expect(harness.state.renderStatus).toBe('error'));

    expect(harness.state).toMatchObject(lastCompletePair);
    expect(harness.state.presentation).toEqual({ focusX: 0.2, focusY: 0.7, zoom: 1.4 });
  });

  it('retries a failed final bundle and replaces the pair only after both files are ready', async () => {
    const harness = createHarness();
    harness.controller.startInitialPreview();
    harness.renderRequests[0]?.resolve(makeBundle());
    await vi.waitFor(() => expect(harness.state.renderStatus).toBe('ready'));
    const previousInstagramUri = harness.state.instagramUri;
    const previousDetailUri = harness.state.detailUri;
    const crop = { focusX: 0.2, focusY: 0.7, zoom: 1.4 };

    harness.controller.confirmCrop(crop);
    harness.renderRequests[1]?.reject(new Error('render failed'));
    await vi.waitFor(() => expect(harness.state.renderStatus).toBe('error'));
    harness.controller.retryRender();

    expect(harness.requests).toHaveLength(3);
    expect(harness.requests[2]?.options.presentation).toEqual(crop);
    expect(harness.state.renderStatus).toBe('loading');
    expect(harness.state.instagramUri).toBe(previousInstagramUri);
    expect(harness.state.detailUri).toBe(previousDetailUri);

    harness.renderRequests[2]?.resolve(makeBundle(
      'recipe-1',
      createPngHeaderBytes(3),
      createPngHeaderBytes(4),
    ));
    await vi.waitFor(() => expect(harness.state.renderStatus).toBe('ready'));

    expect(harness.state.instagramUri).toBe('memory:instagram:3');
    expect(harness.state.detailUri).toBe('memory:detail:4');
    expect(harness.state.instagramUri).not.toBe(previousInstagramUri);
    expect(harness.state.detailUri).not.toBe(previousDetailUri);
  });

  it.each([
    ['missing detail asset', (bundle: RecipeShareBundleResponse) => ({ ...bundle, detail: undefined })],
    ['wrong declared size', (bundle: RecipeShareBundleResponse) => ({
      ...bundle,
      detail: { ...bundle.detail, size: bundle.detail.size + 1 },
    })],
    ['wrong dimensions', (bundle: RecipeShareBundleResponse) => ({
      ...bundle,
      detail: {
        ...bundle.detail,
        data: encodeBase64(new Uint8Array(24).buffer),
        size: 24,
      },
    })],
    ['duplicate image data', (bundle: RecipeShareBundleResponse) => ({ ...bundle, detail: bundle.instagram })],
  ])('does not mark a bundle ready with %s', async (_caseName, makeInvalidBundle) => {
    const harness = createHarness();
    harness.controller.startInitialPreview();
    const invalidBundle = makeInvalidBundle(makeBundle());
    harness.renderRequests[0]?.resolve(invalidBundle as RecipeShareBundleResponse);
    await vi.waitFor(() => expect(harness.state.renderStatus).toBe('error'));

    expect(harness.state.instagramUri).toBeNull();
    expect(harness.state.detailUri).toBeNull();
    expect(harness.createPreviewUri).not.toHaveBeenCalled();
  });

  it('rejects duplicate local URIs and cleans up the uncommitted files', async () => {
    const harness = createHarness();
    harness.createPreviewUri.mockImplementation(async () => 'memory:duplicate');
    harness.controller.startInitialPreview();
    harness.renderRequests[0]?.resolve(makeBundle());
    await vi.waitFor(() => expect(harness.state.renderStatus).toBe('error'));

    expect(harness.state.instagramUri).toBeNull();
    expect(harness.state.detailUri).toBeNull();
    expect(harness.cleanupPreviewUri).toHaveBeenCalledTimes(1);
    expect(harness.cleanupPreviewUri).toHaveBeenCalledWith('memory:duplicate');
  });

  it('cleans a partial local write and keeps the previous pair when the second file fails', async () => {
    const harness = createHarness();
    harness.controller.startInitialPreview();
    harness.renderRequests[0]?.resolve(makeBundle());
    await vi.waitFor(() => expect(harness.state.renderStatus).toBe('ready'));
    const previousInstagramUri = harness.state.instagramUri;
    const previousDetailUri = harness.state.detailUri;

    harness.createPreviewUri
      .mockImplementationOnce(async () => 'memory:replacement-instagram')
      .mockImplementationOnce(async () => { throw new Error('file write failed'); });
    harness.controller.confirmCrop({ focusX: 0.2, focusY: 0.7, zoom: 1.4 });
    harness.renderRequests[1]?.resolve(makeBundle('recipe-1', createPngHeaderBytes(3), createPngHeaderBytes(4)));
    await vi.waitFor(() => expect(harness.state.renderStatus).toBe('error'));

    expect(harness.state.instagramUri).toBe(previousInstagramUri);
    expect(harness.state.detailUri).toBe(previousDetailUri);
    expect(harness.cleanupPreviewUri).toHaveBeenCalledWith('memory:replacement-instagram');
  });

  it('keeps a completed pair visible but not ready while options are changed', async () => {
    const harness = createHarness();
    harness.controller.startInitialPreview();
    harness.renderRequests[0]?.resolve(makeBundle());
    await vi.waitFor(() => expect(harness.state.renderStatus).toBe('ready'));

    harness.controller.setOptions({ selectedTags: [], nutritionHighlight: 'high-protein' });

    expect(harness.state.renderStatus).toBe('idle');
    expect(harness.state.instagramBytes).not.toBeNull();
    expect(harness.state.detailBytes).not.toBeNull();
    expect(harness.state.instagramUri).toBe('memory:instagram:1');
    expect(harness.state.detailUri).toBe('memory:detail:2');
  });
});