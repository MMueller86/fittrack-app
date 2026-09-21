import { describe, expect, it, vi } from 'vitest';
import type { Recipe } from '@fittrack/shared';
import {
  createRecipeShareDraftController,
  createRecipeShareDraftState,
  getServerPrimaryRecipeImageUri,
} from './recipeShareDraftState';
import type { RecipeShareDraftState } from './recipeShareDraftState';
import { TEMPORARY_RECIPE_RENDER_META } from '../../shared/api/recipeInstagramRenderContract';
import type { RecipeInstagramRenderOptions } from '../../shared/api/recipeInstagramRenderContract';

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

type DeferredBuffer = {
  promise: Promise<ArrayBuffer>;
  resolve: (value: ArrayBuffer) => void;
  reject: (reason?: unknown) => void;
};

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
    options: RecipeInstagramRenderOptions;
    signal: AbortSignal | undefined;
  }> = [];
  const renderRequests: DeferredBuffer[] = [];
  const renderInstagramRecipe = vi.fn(
    (recipeId: string, options: RecipeInstagramRenderOptions, signal?: AbortSignal) => {
      requests.push({ recipeId, options, signal });
      const request = deferred<ArrayBuffer>();
      renderRequests.push(request);
      return request.promise;
    },
  );
  const controller = createRecipeShareDraftController({
    initialState: state,
    renderApi: { renderInstagramRecipe },
    createPreviewUri: (png) => `memory:${new Uint8Array(png)[0] ?? 0}`,
    onStateChange: (nextState) => {
      state = nextState;
    },
  });

  return {
    recipe,
    controller,
    renderInstagramRecipe,
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
    });
  });

  it('sends the initial preview without presentation or client recipe data', async () => {
    const harness = createHarness();
    harness.controller.startInitialPreview();

    expect(harness.requests[0]).toMatchObject({
      recipeId: 'recipe-1',
      options: {
        selectedTags: ['Schnell'],
        nutritionHighlight: null,
        recipeMeta: TEMPORARY_RECIPE_RENDER_META,
      },
    });
    expect(harness.requests[0]?.options).not.toHaveProperty('presentation');
    expect(harness.requests[0]?.options).not.toHaveProperty('title');
    expect(harness.requests[0]?.options).not.toHaveProperty('imageId');

    harness.renderRequests[0]?.resolve(new Uint8Array([1, 2, 3]).buffer);
    await Promise.resolve();
    await Promise.resolve();

    expect(harness.state.renderStatus).toBe('ready');
    expect(harness.state.renderStage).toBe('initial');
    expect(harness.state.previewUri).toBe('memory:1');
  });

  it('renders exactly once after crop confirmation with a full normalized presentation', async () => {
    const harness = createHarness();
    harness.controller.startInitialPreview();
    harness.renderRequests[0]?.resolve(new ArrayBuffer(1));
    await Promise.resolve();
    await Promise.resolve();

    harness.controller.confirmCrop({ focusX: 0.2, focusY: 0.7, zoom: 1.4 });
    harness.controller.confirmCrop({ focusX: 0.8, focusY: 0.1, zoom: 2 });

    expect(harness.requests).toHaveLength(2);
    expect(harness.requests[1]?.options).toEqual({
      selectedTags: ['Schnell'],
      nutritionHighlight: null,
      recipeMeta: TEMPORARY_RECIPE_RENDER_META,
      presentation: { focusX: 0.2, focusY: 0.7, zoom: 1.4 },
    });
    expect(harness.requests[1]?.options).not.toHaveProperty('imageId');
  });

  it('aborts and ignores stale renders and cleans up on dispose', async () => {
    const harness = createHarness();
    harness.controller.startInitialPreview();
    const initialSignal = harness.requests[0]?.signal;
    harness.controller.confirmCrop({ focusX: 0.2, focusY: 0.7, zoom: 1.4 });

    expect(initialSignal?.aborted).toBe(true);
    harness.renderRequests[0]?.resolve(new Uint8Array([1]).buffer);
    await Promise.resolve();
    await Promise.resolve();
    expect(harness.state.renderStage).toBe('final');
    expect(harness.state.renderStatus).toBe('loading');

    harness.controller.dispose();
    const finalSignal = harness.requests[1]?.signal;
    expect(finalSignal?.aborted).toBe(true);
    harness.renderRequests[1]?.resolve(new Uint8Array([2]).buffer);
    await Promise.resolve();
    await Promise.resolve();
    expect(harness.state.renderStatus).toBe('loading');
  });

  it('exposes a recoverable render error without mutating the recipe source', async () => {
    const harness = createHarness();
    harness.controller.startInitialPreview();
    harness.renderRequests[0]?.reject(new Error('render failed'));
    await Promise.resolve();
    await Promise.resolve();

    expect(harness.state.renderStatus).toBe('error');
    expect(harness.state.renderStage).toBe('initial');
    expect(harness.state.error?.message).toBe('render failed');
    expect(harness.state.recipeId).toBe('recipe-1');
    expect(harness.state.cropImageUri).toBe('https://example.test/primary.png');
  });

  it('invalidates an old preview when options change', async () => {
    const harness = createHarness();
    harness.controller.startInitialPreview();
    harness.renderRequests[0]?.resolve(new Uint8Array([1]).buffer);
    await Promise.resolve();
    await Promise.resolve();
    expect(harness.state.previewUri).toBe('memory:1');

    harness.controller.setOptions({ selectedTags: [], nutritionHighlight: 'high-protein' });

    expect(harness.state.renderStatus).toBe('idle');
    expect(harness.state.previewBytes).toBeNull();
    expect(harness.state.previewUri).toBeNull();
  });
});