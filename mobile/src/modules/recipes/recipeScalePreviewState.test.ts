import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Recipe,
  RecipeScalePreviewRequest,
  RecipeScalePreviewResponse,
} from '@fittrack/shared';
import {
  createOriginalTextPreview,
  createRecipeScalePreviewController,
  RECIPE_SCALE_DEBOUNCE_MS,
  type RecipeScalePreviewController,
  type RecipeScalePreviewErrorNotice,
  type RecipeTextPreviewState,
} from './recipeScalePreviewState';

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'recipe-1',
    ownerUserId: 'user-1',
    name: 'Pasta',
    description: 'Originalbeschreibung',
    portions: 2,
    ingredients: [],
    steps: [{ order: 1, description: 'Originalschritt' }],
    images: [],
    nutritionTotal: { calories: 400, protein: 20, carbs: 40, fat: 10, fiber: 5 },
    nutritionPerPortion: { calories: 200, protein: 10, carbs: 20, fat: 5, fiber: 2.5 },
    visibility: 'private',
    sharedWithUserIds: [],
    tags: [],
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

function makeResponse(targetPortions: number, description: string): RecipeScalePreviewResponse {
  return {
    targetPortions,
    description,
    steps: [{ order: 1, description: `${description} Schritt` }],
  };
}

function createHarness(initialRecipe = makeRecipe()) {
  let currentRecipe: Recipe | null = initialRecipe;
  let targetPortions = initialRecipe.portions;
  let textPreview: RecipeTextPreviewState = createOriginalTextPreview(initialRecipe);
  let errorNotice: RecipeScalePreviewErrorNotice | null = null;
  const requests: Array<{ request: RecipeScalePreviewRequest; signal: AbortSignal }> = [];
  const previewRecipeScale = vi.fn<
    (request: RecipeScalePreviewRequest, signal: AbortSignal) => Promise<RecipeScalePreviewResponse>
  >(
    (request: RecipeScalePreviewRequest): Promise<RecipeScalePreviewResponse> =>
      Promise.resolve(makeResponse(request.targetPortions, 'KI-Text')),
  );
  const trackedPreviewRecipeScale = (
    request: RecipeScalePreviewRequest,
    signal: AbortSignal,
  ): Promise<RecipeScalePreviewResponse> => {
    requests.push({ request, signal });
    return previewRecipeScale(request, signal);
  };
  const controller: RecipeScalePreviewController = createRecipeScalePreviewController({
    getScreenRecipeId: () => 'recipe-1',
    getCurrentRecipe: () => currentRecipe,
    getTargetPortions: () => targetPortions,
    setTargetPortions: (value) => { targetPortions = value; },
    setTextPreview: (state) => { textPreview = state; },
    setErrorNotice: (notice) => { errorNotice = notice; },
    previewRecipeScale: trackedPreviewRecipeScale,
  });

  return {
    controller,
    get currentRecipe() { return currentRecipe; },
    set currentRecipe(value: Recipe | null) { currentRecipe = value; },
    get targetPortions() { return targetPortions; },
    set targetPortions(value: number) { targetPortions = value; },
    get textPreview() { return textPreview; },
    get errorNotice() { return errorNotice; },
    previewRecipeScale,
    requests,
  };
}

describe('recipeScalePreviewState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces successive target changes into one latest AI request', async () => {
    const harness = createHarness();
    harness.targetPortions = 3;
    harness.controller.requestScalePreview(3, harness.currentRecipe!);
    harness.targetPortions = 4;
    harness.controller.requestScalePreview(4, harness.currentRecipe!);

    await vi.advanceTimersByTimeAsync(RECIPE_SCALE_DEBOUNCE_MS - 1);
    expect(harness.previewRecipeScale).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(harness.previewRecipeScale).toHaveBeenCalledTimes(1);
    expect(harness.requests[0]?.request).toEqual({ recipeId: 'recipe-1', targetPortions: 4 });
  });

  it('aborts an older request when a new target starts', async () => {
    const firstRequest = deferred<RecipeScalePreviewResponse>();
    const harness = createHarness();
    harness.previewRecipeScale.mockReturnValueOnce(firstRequest.promise);

    harness.targetPortions = 3;
    harness.controller.requestScalePreview(3, harness.currentRecipe!);
    await vi.advanceTimersByTimeAsync(RECIPE_SCALE_DEBOUNCE_MS);
    const firstSignal = harness.requests[0]?.signal;
    expect(firstSignal?.aborted).toBe(false);

    harness.targetPortions = 4;
    harness.controller.requestScalePreview(4, harness.currentRecipe!);

    expect(firstSignal?.aborted).toBe(true);
  });

  it('ignores a stale response from an older request', async () => {
    const firstRequest = deferred<RecipeScalePreviewResponse>();
    const secondRequest = deferred<RecipeScalePreviewResponse>();
    const harness = createHarness();
    harness.previewRecipeScale
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    harness.targetPortions = 3;
    harness.controller.requestScalePreview(3, harness.currentRecipe!);
    await vi.advanceTimersByTimeAsync(RECIPE_SCALE_DEBOUNCE_MS);
    harness.targetPortions = 4;
    harness.controller.requestScalePreview(4, harness.currentRecipe!);
    await vi.advanceTimersByTimeAsync(RECIPE_SCALE_DEBOUNCE_MS);

    firstRequest.resolve(makeResponse(3, 'Veralteter Text'));
    await Promise.resolve();
    expect(harness.textPreview.status).toBe('loading');

    secondRequest.resolve(makeResponse(4, 'Aktueller Text'));
    await Promise.resolve();
    expect(harness.textPreview).toEqual({
      status: 'ready',
      description: 'Aktueller Text',
      steps: [{ order: 1, description: 'Aktueller Text Schritt' }],
    });
  });

  it('ignores a response after the loaded recipe id or updatedAt changes', async () => {
    const changedRecipes = [
      makeRecipe({ id: 'recipe-2' }),
      makeRecipe({ updatedAt: '2026-01-02T00:00:00.000Z' }),
    ];

    for (const changedRecipe of changedRecipes) {
      const request = deferred<RecipeScalePreviewResponse>();
      const harness = createHarness();
      harness.previewRecipeScale.mockReturnValueOnce(request.promise);

      harness.targetPortions = 3;
      harness.controller.requestScalePreview(3, harness.currentRecipe!);
      await vi.advanceTimersByTimeAsync(RECIPE_SCALE_DEBOUNCE_MS);
      harness.currentRecipe = changedRecipe;
      request.resolve(makeResponse(3, 'Veralteter Text'));
      await Promise.resolve();

      expect(harness.textPreview.status).toBe('loading');
    }
  });

  it('restores the original preview without an AI request on reset', () => {
    const harness = createHarness();
    harness.targetPortions = 3;
    harness.controller.requestScalePreview(3, harness.currentRecipe!);
    harness.targetPortions = 2;
    harness.controller.requestScalePreview(2, harness.currentRecipe!);

    expect(harness.previewRecipeScale).not.toHaveBeenCalled();
    expect(harness.targetPortions).toBe(2);
    expect(harness.textPreview).toEqual(createOriginalTextPreview(harness.currentRecipe!));
    expect(harness.errorNotice).toBeNull();
  });

  it('invalidates pending work and restores the original on recipe reload', async () => {
    const request = deferred<RecipeScalePreviewResponse>();
    const originalRecipe = harnessRecipe();
    const reloadedRecipe = harnessRecipe({ description: 'Neue Originalbeschreibung', updatedAt: '2026-01-02T00:00:00.000Z' });
    const harness = createHarness(originalRecipe);
    harness.previewRecipeScale.mockReturnValueOnce(request.promise);

    harness.targetPortions = 3;
    harness.controller.requestScalePreview(3, originalRecipe);
    await vi.advanceTimersByTimeAsync(RECIPE_SCALE_DEBOUNCE_MS);
    harness.controller.resetForReload(originalRecipe);
    harness.currentRecipe = reloadedRecipe;
    harness.controller.restoreOriginalPreview(reloadedRecipe);

    request.resolve(makeResponse(3, 'Veralteter Text'));
    await Promise.resolve();

    expect(harness.targetPortions).toBe(2);
    expect(harness.textPreview).toEqual(createOriginalTextPreview(reloadedRecipe));
    expect(harness.requests[0]?.signal.aborted).toBe(true);
  });

  it('invalidates timers and requests on unmount', async () => {
    const request = deferred<RecipeScalePreviewResponse>();
    const harness = createHarness();
    harness.previewRecipeScale.mockReturnValueOnce(request.promise);

    harness.targetPortions = 3;
    harness.controller.requestScalePreview(3, harness.currentRecipe!);
    await vi.advanceTimersByTimeAsync(RECIPE_SCALE_DEBOUNCE_MS);
    harness.controller.dispose();
    request.resolve(makeResponse(3, 'Text nach Unmount'));
    await Promise.resolve();

    expect(harness.requests[0]?.signal.aborted).toBe(true);
    expect(harness.textPreview.status).toBe('loading');
  });

  it('keeps the scaled target while restoring original texts after an AI error', async () => {
    const request = deferred<RecipeScalePreviewResponse>();
    const harness = createHarness();
    harness.previewRecipeScale.mockReturnValueOnce(request.promise);

    harness.targetPortions = 3;
    harness.controller.requestScalePreview(3, harness.currentRecipe!);
    await vi.advanceTimersByTimeAsync(RECIPE_SCALE_DEBOUNCE_MS);
    request.reject(new Error('AI unavailable'));
    await Promise.resolve();
    await Promise.resolve();

    expect(harness.targetPortions).toBe(3);
    expect(harness.textPreview).toEqual({
      status: 'error',
      description: 'Originalbeschreibung',
      steps: [{ order: 1, description: 'Originalschritt' }],
    });
    expect(harness.errorNotice).toEqual({
      title: 'Rezepttexte konnten nicht angepasst werden',
      body: 'Die Zutaten wurden angepasst. Die ursprüngliche Beschreibung und Zubereitung werden angezeigt.',
    });
  });
});

function harnessRecipe(overrides: Partial<Recipe> = {}) {
  return makeRecipe(overrides);
}