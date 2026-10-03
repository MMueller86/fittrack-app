import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Recipe,
  RecipeExportViewInput,
  RecipeImageHeroCrop,
  RecipeIngredient,
} from '@fittrack/shared';
import type { RecipeStackParamList } from '../../app/navigation/RootNavigator';
import RecipeDetailScreen from './RecipeDetailScreen';
import type { PendingRecipeExportDraft } from './recipeWizardExportView';
import type { WizardExportDraft } from './recipeWizardTypes';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  recipeApi: {
    get: vi.fn(),
    prepareExportView: vi.fn(),
    update: vi.fn(),
    renderShareBundle: vi.fn(),
    delete: vi.fn(),
  },
  aiApi: { previewRecipeScale: vi.fn() },
  favoritesApi: { listFavorites: vi.fn() },
  media: {
    createPreviewUri: vi.fn(),
    cleanupPreviewUri: vi.fn(),
    createSession: vi.fn(),
  },
  focusEffect: undefined as (() => void | (() => void)) | undefined,
}));

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Linking: { openSettings: vi.fn(async () => undefined) },
  ScrollView: 'ScrollView',
  StyleSheet: {
    absoluteFillObject: {},
    create: <T,>(styles: T) => styles,
  },
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));

vi.mock('react-native-reanimated', () => {
  const transition = { duration: () => ({}) };
  return {
    default: { View: 'Animated.View' },
    FadeIn: transition,
    FadeOut: transition,
    LinearTransition: transition,
  };
});

vi.mock('@react-navigation/native', async () => {
  const ReactModule = await import('react');
  return {
    useFocusEffect: (effect: () => void | (() => void)) => ReactModule.useEffect(() => {
      mocks.focusEffect = effect;
      return effect();
    }, [effect]),
  };
});

vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'test-uuid' }));
vi.mock('../../shared/api/client', () => ({
  isQuotaExceededError: (error: unknown) => (
    typeof error === 'object' && error !== null && 'quotaExceeded' in error
  ),
}));
vi.mock('../../shared/api/recipeApi', () => ({ recipeApi: mocks.recipeApi }));
vi.mock('../../shared/api/aiApi', () => ({ aiApi: mocks.aiApi }));
vi.mock('../../shared/api/favoritesApi', () => ({ favoritesApi: mocks.favoritesApi }));
vi.mock('../../services/recipeShareMediaService', () => ({
  RecipeShareMediaError: class RecipeShareMediaError extends Error {
    code = 'unknown';
  },
  recipeShareMediaService: mocks.media,
}));
vi.mock('../../shared/components/ConfirmSheet', () => ({ ConfirmSheet: 'ConfirmSheet' }));
vi.mock('../../shared/components/Icon', () => ({ Icon: 'Icon' }));
vi.mock('../../shared/components/InfoOverlay', () => ({ InfoOverlay: 'InfoOverlay' }));
vi.mock('../../shared/components/NutritionTile', () => ({ NutritionTile: 'NutritionTile' }));
vi.mock('./RecipeIngredientGroup', () => ({ RecipeIngredientGroup: 'RecipeIngredientGroup' }));
vi.mock('./RecipeImageHeroImage', () => ({ RecipeImageHeroImage: 'RecipeImageHeroImage' }));
vi.mock('./RecipeImageHeroCropEditor', () => ({ RecipeImageHeroCropEditor: 'RecipeImageHeroCropEditor' }));
vi.mock('./RecipeInstagramPreview', () => ({ RecipeInstagramPreview: 'RecipeInstagramPreview' }));
vi.mock('./LogRecipeModal', () => ({ default: 'LogRecipeModal' }));
vi.mock('./recipeScalePreviewState', () => ({
  createRecipeScalePreviewController: () => ({
    resetForReload: vi.fn(),
    restoreOriginalPreview: vi.fn(),
    requestScalePreview: vi.fn(),
    dispose: vi.fn(),
  }),
}));

const zeroNutrition = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

function makeIngredient(id = 'food-1'): RecipeIngredient {
  return {
    id,
    displayName: 'Tomaten',
    inputMode: 'grams',
    inputAmount: 100,
    amountGrams: 100,
    unit: 'g',
    linkedProductId: null,
    linkedReusableItemId: null,
    isAiEstimate: false,
    category: 'food',
    nutritionPer100g: zeroNutrition,
    nutritionContribution: zeroNutrition,
  };
}

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'recipe-1',
    ownerUserId: 'user-1',
    name: 'Paprikasalat',
    description: 'Paprika schneiden.',
    portions: 2,
    ingredients: [makeIngredient()],
    steps: [{ order: 1, description: 'Paprika schneiden.' }],
    images: [{
      id: 'photo-1',
      blobName: 'recipe-1/photo-1.jpg',
      order: 1,
      url: 'https://example.test/photo-1.jpg',
    }],
    nutritionTotal: zeroNutrition,
    nutritionPerPortion: zeroNutrition,
    visibility: 'private',
    sharedWithUserIds: [],
    tags: ['Schnell'],
    usageCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeExportView(overrides: Partial<RecipeExportViewInput> = {}): RecipeExportViewInput {
  return {
    version: 1,
    teaser: 'Frisch und schnell',
    totalTimeMinutes: 15,
    difficulty: 'Einfach',
    steps: [{ order: 1, description: 'Paprika schneiden.' }],
    includedIngredientIds: ['food-1'],
    ...overrides,
  };
}

function makeStoredExportView(overrides: Partial<RecipeExportViewInput> = {}) {
  return { ...makeExportView(overrides), sourceFingerprint: 'sha256:server-owned' };
}

function makePendingDraft(): PendingRecipeExportDraft {
  return {
    version: 1,
    teaser: 'Aus der Analyse',
    totalTimeMinutes: 20,
    difficulty: 'Einfach',
    steps: [{ order: 1, description: 'Paprika schneiden.' }],
    includedIngredientIds: ['food-1'],
  };
}

function makePreparationResponse(recipeId = 'recipe-1') {
  return {
    contractVersion: 2 as const,
    recipeId,
    sourceEtag: 'compatibility-etag',
    suggestion: {
      version: 1 as const,
      teaser: 'Für den Export vorbereitet',
      totalTimeMinutes: 25,
      difficulty: 'Einfach',
      steps: [{ order: 1, description: 'Paprika schneiden.' }],
    },
  };
}

function createPng(marker: number): ArrayBuffer {
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

function makeBundle(recipeId = 'recipe-1') {
  const instagram = createPng(1);
  const detail = createPng(2);
  return {
    recipeId,
    instagram: { mimeType: 'image/png' as const, size: instagram.byteLength, data: encodeBase64(instagram) },
    detail: { mimeType: 'image/png' as const, size: detail.byteLength, data: encodeBase64(detail) },
  };
}

function makeMissingViewError() {
  return Object.assign(new Error('Missing export view'), {
    isAxiosError: true,
    response: { status: 409, data: { code: 'MISSING_EXPORT_VIEW' } },
  });
}

function makeRevisionConflictError() {
  return { response: { status: 412, data: { error: 'recipe_revision_conflict' } } };
}

function makePreparationStatusError(status: 422 | 502) {
  return Object.assign(new Error(`Preparation failed with ${status}`), {
    response: { status, data: { error: 'preparation_failed' } },
  });
}

function makePreparationQuotaError() {
  const quotaExceeded = {
    feature: 'recipe-analyze',
    used: 10,
    limit: 10,
    resetsAt: '2026-11-01T00:00:00.000Z',
  };
  return Object.assign(new Error('Quota exceeded'), {
    response: {
      status: 429,
      data: {
        error: 'quota_exceeded',
        ...quotaExceeded,
        period: '2026-10',
      },
    },
    quotaExceeded,
  });
}

type DetailParams = RecipeStackParamList['RecipeDetail'];
type NoticeAction = { label: string; onPress: () => void };

async function renderDetail(params: DetailParams = { id: 'recipe-1' }) {
  const navigation = { goBack: vi.fn(), navigate: vi.fn(), setParams: vi.fn() };
  const props = {
    route: { key: 'RecipeDetail', name: 'RecipeDetail', params },
    navigation,
  } as unknown as React.ComponentProps<typeof RecipeDetailScreen>;
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<RecipeDetailScreen {...props} />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return { renderer, navigation };
}

it('does not offer sharing or prepare export texts for a recipe without a photo', async () => {
  mocks.recipeApi.get.mockResolvedValue(makeRecipe({ images: [] }));
  const { renderer } = await renderDetail();

  expect(renderer.root.findAll((node) => node.props.accessibilityLabel === 'Rezept teilen'))
    .toHaveLength(0);
  expect(mocks.recipeApi.prepareExportView).not.toHaveBeenCalled();
  expect(mocks.recipeApi.renderShareBundle).not.toHaveBeenCalled();
});

async function settle(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 6; index += 1) await Promise.resolve();
  });
}

function findOne(
  renderer: ReactTestRenderer,
  predicate: (node: ReactTestInstance) => boolean,
  description: string,
): ReactTestInstance {
  const matches = renderer.root.findAll(predicate);
  if (matches.length !== 1) {
    throw new Error(`Expected one ${description}, found ${matches.length}`);
  }
  return matches[0]!;
}

function getShareButton(renderer: ReactTestRenderer): ReactTestInstance {
  return findOne(
    renderer,
    (node) => node.type === 'TouchableOpacity' && node.props.accessibilityLabel === 'Rezept teilen',
    'recipe share button',
  );
}

function getSharePreview(renderer: ReactTestRenderer): ReactTestInstance {
  return findOne(renderer, (node) => node.type === 'RecipeInstagramPreview', 'share preview');
}

function getVisibleNotice(renderer: ReactTestRenderer, title: string): ReactTestInstance {
  return findOne(
    renderer,
    (node) => node.type === 'InfoOverlay' && Boolean(node.props.visible) && node.props.title === title,
    `visible notice titled "${title}"`,
  );
}

async function pressShare(renderer: ReactTestRenderer): Promise<void> {
  const onPress = getShareButton(renderer).props.onPress as (() => void) | undefined;
  if (!onPress) throw new Error('Expected the recipe share button handler');
  await act(async () => {
    onPress();
  });
}

let previewUriSequence = 0;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.focusEffect = undefined;
  previewUriSequence = 0;
  mocks.recipeApi.get.mockImplementation(async () => makeRecipe());
  mocks.recipeApi.prepareExportView.mockImplementation(async (recipeId: string) => makePreparationResponse(recipeId));
  mocks.recipeApi.renderShareBundle.mockImplementation(async (recipeId: string) => makeBundle(recipeId));
  mocks.favoritesApi.listFavorites.mockResolvedValue([]);
  mocks.media.createPreviewUri.mockImplementation(async () => {
    previewUriSequence += 1;
    return `file:///cache/share-preview-${previewUriSequence}.png`;
  });
  mocks.media.cleanupPreviewUri.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RecipeDetailScreen Share lifecycle', () => {
  it('closes sharing and explains when the server reports a missing photo', async () => {
    mocks.recipeApi.renderShareBundle.mockRejectedValue(Object.assign(new Error('No photo'), {
      isAxiosError: true,
      response: { status: 422, data: { code: 'NO_RECIPE_IMAGE' } },
    }));
    const { renderer } = await renderDetail();
    await pressShare(renderer);
    await settle();

    const notice = findOne(renderer, (node) => (
      node.type === 'InfoOverlay' && Boolean(node.props.visible) && node.props.title === 'Rezeptfoto fehlt'
    ), 'missing-photo notice');
    expect(notice.props.body).toBe('Bitte lade zuerst ein Rezeptfoto hoch, bevor du das Rezept teilst.');
    expect(notice.props.secondaryAction).toBeUndefined();
    expect(getSharePreview(renderer).props.visible).toBe(false);
    expect(renderer.root.findAll((node) => node.props.accessibilityLabel === 'Rezept teilen')).toHaveLength(0);
    expect(mocks.recipeApi.renderShareBundle).toHaveBeenCalledTimes(1);
    expect(mocks.media.createPreviewUri).not.toHaveBeenCalled();
  });

  it.each(['current', 'stale'] as const)(
    'reuses a stored %s export view without preparation',
    async (status) => {
      const recipe = makeRecipe({
        exportView: makeStoredExportView(),
        exportViewStatus: status,
      });
      mocks.recipeApi.get.mockResolvedValueOnce(recipe);
      const { renderer } = await renderDetail();

      await pressShare(renderer);
      await settle();

      expect(getSharePreview(renderer).props.exportDraft).toMatchObject({
        source: 'persisted',
        teaser: 'Frisch und schnell',
      });
      expect(getSharePreview(renderer).props.providerRequestInFlight).toBe(false);
      expect(mocks.recipeApi.prepareExportView).not.toHaveBeenCalled();
      expect(mocks.recipeApi.update).not.toHaveBeenCalled();
      expect(mocks.recipeApi.renderShareBundle).toHaveBeenCalledTimes(1);
    },
  );

  it('does not save an unchanged stale export view', async () => {
    mocks.recipeApi.get.mockResolvedValueOnce(makeRecipe({
      exportView: makeStoredExportView(),
      exportViewStatus: 'stale',
    }));
    const { renderer } = await renderDetail();

    await pressShare(renderer);
    await settle();

    const preview = getSharePreview(renderer);
    expect(preview.props.exportDraftNeedsSaving).toBe(false);
    const onSave = preview.props.onSaveExportDraft as (() => Promise<boolean>) | undefined;
    if (!onSave) throw new Error('Expected the explicit export save handler');
    let saved = true;
    await act(async () => {
      saved = await onSave();
    });

    expect(saved).toBe(false);
    expect(mocks.recipeApi.update).not.toHaveBeenCalled();
  });

  it('renders a new-recipe transient suggestion as a nullable request draft before any write', async () => {
    const pendingDraft = makePendingDraft();
    pendingDraft.totalTimeMinutes = null;
    pendingDraft.difficulty = null;
    mocks.recipeApi.get.mockResolvedValueOnce(makeRecipe());
    const { renderer } = await renderDetail({ id: 'recipe-1', pendingExportDraft: pendingDraft });

    await pressShare(renderer);
    await settle();

    expect(getSharePreview(renderer).props.exportDraft).toMatchObject({
      source: 'analysis',
      teaser: 'Aus der Analyse',
      totalTimeMinutes: '',
      difficulty: '',
      includedIngredientIds: ['food-1'],
    });
    expect(mocks.recipeApi.prepareExportView).not.toHaveBeenCalled();
    expect(mocks.recipeApi.update).not.toHaveBeenCalled();
    expect(mocks.recipeApi.renderShareBundle).toHaveBeenCalledTimes(1);
    expect(mocks.recipeApi.renderShareBundle.mock.calls[0]?.[1]).toMatchObject({
      exportViewDraft: {
        version: 1,
        teaser: 'Aus der Analyse',
        totalTimeMinutes: null,
        difficulty: null,
        steps: [{ order: 1, description: 'Paprika schneiden.' }],
        includedIngredientIds: ['food-1'],
      },
    });
  });

  it('prefers a stored export view loaded on focus over a retained transient draft', async () => {
    const refreshedRecipe = makeRecipe({
      exportView: makeStoredExportView({ teaser: 'Aktuell bestätigter Text' }),
    });
    mocks.recipeApi.get
      .mockResolvedValueOnce(makeRecipe())
      .mockResolvedValueOnce(refreshedRecipe);
    const { renderer } = await renderDetail({
      id: 'recipe-1',
      pendingExportDraft: makePendingDraft(),
    });

    await pressShare(renderer);
    expect(getSharePreview(renderer).props.exportDraft).toMatchObject({
      source: 'analysis',
      teaser: 'Aus der Analyse',
    });
    const close = getSharePreview(renderer).props.onClose as (() => void) | undefined;
    if (!close) throw new Error('Expected the preview close handler');
    await act(async () => {
      close();
    });

    const focusEffect = mocks.focusEffect;
    if (!focusEffect) throw new Error('Expected the recipe detail focus effect');
    await act(async () => {
      focusEffect();
      await Promise.resolve();
    });
    await settle();
    await pressShare(renderer);
    await settle();

    expect(getSharePreview(renderer).props.exportDraft).toMatchObject({
      source: 'persisted',
      teaser: 'Aktuell bestätigter Text',
    });
    expect(mocks.recipeApi.get).toHaveBeenCalledTimes(2);
    expect(mocks.recipeApi.prepareExportView).not.toHaveBeenCalled();
    expect(mocks.recipeApi.update).not.toHaveBeenCalled();
    expect(mocks.recipeApi.renderShareBundle).toHaveBeenCalledTimes(2);
  });

  it('renders transient edits and crop without writes, then saves before refreshing the pair', async () => {
    const images = [{
      id: 'image-1',
      blobName: 'recipe.png',
      order: 1,
      url: 'https://example.test/recipe.png',
    }];
    const storedRecipe = makeRecipe({
      images,
      exportView: makeStoredExportView(),
      exportViewStatus: 'stale',
    });
    mocks.recipeApi.get.mockResolvedValueOnce(storedRecipe);
    mocks.recipeApi.update.mockResolvedValueOnce(makeRecipe({
      images,
      exportView: makeStoredExportView({ teaser: 'Überarbeiteter Teaser' }),
    }));
    const { renderer } = await renderDetail();

    await pressShare(renderer);
    await settle();
    let preview = getSharePreview(renderer);
    expect(mocks.recipeApi.renderShareBundle).toHaveBeenCalledTimes(1);
    expect(mocks.recipeApi.renderShareBundle.mock.calls[0]?.[1]).toHaveProperty('exportViewDraft');
    expect(mocks.recipeApi.update).not.toHaveBeenCalled();

    const changeDraft = preview.props.onChangeExportDraft as ((draft: WizardExportDraft) => void) | undefined;
    if (!changeDraft) throw new Error('Expected the export draft change handler');
    await act(async () => {
      changeDraft({ ...(preview.props.exportDraft as WizardExportDraft), teaser: '' });
    });
    preview = getSharePreview(renderer);
    expect(preview.props.exportDraftValid).toBe(false);
    expect(preview.props.previewErrors).toContain('Bitte gib einen Teaser ein.');
    await act(async () => {
      (preview.props.onUpdatePreview as () => void)();
    });
    await settle();
    expect(mocks.recipeApi.renderShareBundle).toHaveBeenCalledTimes(1);

    await act(async () => {
      changeDraft({ ...(preview.props.exportDraft as WizardExportDraft), teaser: 'Überarbeiteter Teaser' });
      (getSharePreview(renderer).props.onUpdatePreview as () => void)();
    });
    await settle();

    expect(mocks.recipeApi.renderShareBundle).toHaveBeenCalledTimes(2);
    expect(mocks.recipeApi.update).not.toHaveBeenCalled();
    expect(mocks.recipeApi.renderShareBundle.mock.calls[1]?.[1]).toMatchObject({
      exportViewDraft: { teaser: 'Überarbeiteter Teaser' },
    });

    preview = getSharePreview(renderer);
    await act(async () => {
      (preview.props.onAdjustCrop as () => void)();
    });
    const cropEditor = findOne(
      renderer,
      (node) => node.type === 'RecipeImageHeroCropEditor',
      'recipe crop editor',
    );
    const crop: RecipeImageHeroCrop = {
      version: 1,
      frame: 'instagram-recipe-v1',
      focusX: 0.2,
      focusY: 0.7,
      zoom: 1.4,
    };
    await act(async () => {
      (cropEditor.props.onConfirm as (value: RecipeImageHeroCrop) => void)(crop);
    });
    await settle();

    expect(mocks.recipeApi.update).not.toHaveBeenCalled();
    expect(mocks.recipeApi.renderShareBundle).toHaveBeenCalledTimes(3);
    expect(mocks.recipeApi.renderShareBundle.mock.calls[2]?.[1]).toMatchObject({
      exportViewDraft: { teaser: 'Überarbeiteter Teaser' },
      presentation: { focusX: 0.2, focusY: 0.7, zoom: 1.4 },
    });

    preview = getSharePreview(renderer);
    expect(preview.props.exportDraftNeedsSaving).toBe(true);
    await act(async () => {
      await (preview.props.onSaveExportDraft as () => Promise<boolean>)();
    });
    await settle();

    expect(mocks.recipeApi.update).toHaveBeenCalledWith('recipe-1', {
      exportView: makeExportView({ teaser: 'Überarbeiteter Teaser' }),
      exportViewAction: 'confirm',
    });
    expect(mocks.recipeApi.renderShareBundle).toHaveBeenCalledTimes(4);
    expect(mocks.recipeApi.renderShareBundle.mock.calls[3]?.[1]).toMatchObject({
      presentation: { focusX: 0.2, focusY: 0.7, zoom: 1.4 },
    });
    expect(mocks.recipeApi.renderShareBundle.mock.calls[3]?.[1]).not.toHaveProperty('exportViewDraft');
    expect(mocks.recipeApi.update.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.recipeApi.renderShareBundle.mock.invocationCallOrder[3]!,
    );
  });

  it('guards duplicate taps and reuses a successful preparation after closing and reopening Share', async () => {
    let resolvePreparation!: (response: ReturnType<typeof makePreparationResponse>) => void;
    const preparation = new Promise<ReturnType<typeof makePreparationResponse>>((resolve) => {
      resolvePreparation = resolve;
    });
    mocks.recipeApi.prepareExportView.mockReturnValueOnce(preparation);
    const { renderer } = await renderDetail();

    await pressShare(renderer);
    expect(getSharePreview(renderer).props.preparationMessage).toBe(
      'Die KI macht deine Texte gerade fit fürs Bild ... Gleich kannst du beide Bilder checken und die Texte noch anpassen.',
    );
    expect(getSharePreview(renderer).props.providerRequestInFlight).toBe(true);
    expect(getShareButton(renderer).props.disabled).toBe(true);

    const duplicateTap = getShareButton(renderer).props.onPress as (() => void) | undefined;
    if (!duplicateTap) throw new Error('Expected the share handler during preflight');
    await act(async () => {
      duplicateTap();
    });
    expect(mocks.recipeApi.prepareExportView).toHaveBeenCalledTimes(1);
    expect(mocks.recipeApi.renderShareBundle).not.toHaveBeenCalled();

    await act(async () => {
      resolvePreparation(makePreparationResponse());
      await preparation;
    });
    await settle();
    expect(getSharePreview(renderer).props.exportDraft).toMatchObject({ source: 'prepared' });
    expect(getSharePreview(renderer).props.preparationMessage).toBeNull();
    expect(getSharePreview(renderer).props.providerRequestInFlight).toBe(false);
    expect(mocks.recipeApi.renderShareBundle).toHaveBeenCalledTimes(1);

    const close = getSharePreview(renderer).props.onClose as (() => void) | undefined;
    if (!close) throw new Error('Expected the preview close handler');
    await act(async () => {
      close();
    });
    await pressShare(renderer);
    await settle();

    expect(getSharePreview(renderer).props.exportDraft).toMatchObject({ source: 'prepared' });
    expect(mocks.recipeApi.prepareExportView).toHaveBeenCalledTimes(1);
    expect(mocks.recipeApi.update).not.toHaveBeenCalled();
    expect(mocks.recipeApi.renderShareBundle).toHaveBeenCalledTimes(2);
  });

  it('keeps a failed preparation retryable and renders the transient result without a write', async () => {
    mocks.recipeApi.prepareExportView
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce(makePreparationResponse());
    const { renderer } = await renderDetail();

    await pressShare(renderer);
    await settle();

    const notice = getVisibleNotice(renderer, 'Exportvorschau konnte nicht vorbereitet werden');
    const retryAction = notice.props.secondaryAction as NoticeAction;
    expect(retryAction.label).toBe('Erneut versuchen');
    expect(mocks.recipeApi.renderShareBundle).not.toHaveBeenCalled();
    expect(mocks.recipeApi.update).not.toHaveBeenCalled();

    await act(async () => {
      retryAction.onPress();
    });
    await settle();

    expect(mocks.recipeApi.prepareExportView).toHaveBeenCalledTimes(2);
    expect(getSharePreview(renderer).props.exportDraft).toMatchObject({ source: 'prepared' });
    expect(mocks.recipeApi.renderShareBundle).toHaveBeenCalledTimes(1);
    expect(mocks.recipeApi.update).not.toHaveBeenCalled();
  });

  it.each([
    [
      429,
      makePreparationQuotaError,
      'Kontingent ausgeschöpft',
      'Das monatliche Kontingent für Rezeptanalysen ist ausgeschöpft.',
      'Du kannst die Exportvorschau danach erneut vorbereiten.',
    ],
    [
      422,
      () => makePreparationStatusError(422),
      'Exportvorschau konnte nicht vorbereitet werden',
      'Die vorgeschlagenen Exporttexte konnten nicht zuverlässig geprüft werden.',
      'Deine Rezeptdaten bleiben unverändert.',
    ],
    [
      502,
      () => makePreparationStatusError(502),
      'Exportvorschau konnte nicht vorbereitet werden',
      'Der Textdienst ist gerade nicht erreichbar.',
      'Deine Rezeptdaten bleiben unverändert.',
    ],
  ] as const)(
    'shows a retryable German preparation state for HTTP %s without persisting before retry',
    async (_status, createError, expectedTitle, expectedBody, retainedDataCopy) => {
      mocks.recipeApi.prepareExportView
        .mockRejectedValueOnce(createError())
        .mockResolvedValueOnce(makePreparationResponse());
      const { renderer } = await renderDetail();

      await pressShare(renderer);
      await settle();

      const notice = getVisibleNotice(renderer, expectedTitle);
      expect(notice.props.body).toContain(expectedBody);
      expect(notice.props.body).toContain(retainedDataCopy);
      const retryAction = notice.props.secondaryAction as NoticeAction;
      expect(retryAction.label).toBe('Erneut versuchen');
      expect(mocks.recipeApi.update).not.toHaveBeenCalled();
      expect(mocks.recipeApi.renderShareBundle).not.toHaveBeenCalled();

      await act(async () => {
        retryAction.onPress();
      });
      await settle();

      expect(getSharePreview(renderer).props.exportDraft).toMatchObject({ source: 'prepared' });
      expect(mocks.recipeApi.update).not.toHaveBeenCalled();
      expect(mocks.recipeApi.renderShareBundle).toHaveBeenCalledTimes(1);
    },
  );

  it('renders the draft first, then persists explicitly before rendering the confirmed view', async () => {
    let resolveUpdate!: (recipe: Recipe) => void;
    const update = new Promise<Recipe>((resolve) => {
      resolveUpdate = resolve;
    });
    mocks.recipeApi.update.mockReturnValueOnce(update);
    const { renderer } = await renderDetail();

    await pressShare(renderer);
    await settle();
    let preview = getSharePreview(renderer);
    expect(mocks.recipeApi.renderShareBundle).toHaveBeenCalledTimes(1);
    expect(mocks.recipeApi.renderShareBundle.mock.calls[0]?.[1]).toMatchObject({
      exportViewDraft: { teaser: 'Für den Export vorbereitet' },
    });
    const onSave = preview.props.onSaveExportDraft as (() => Promise<boolean>) | undefined;
    if (!onSave) throw new Error('Expected the explicit export save handler');
    let savePromise!: Promise<boolean>;
    await act(async () => {
      savePromise = onSave();
      await Promise.resolve();
    });

    expect(mocks.recipeApi.update).toHaveBeenCalledWith('recipe-1', {
      exportView: makeExportView({
        teaser: 'Für den Export vorbereitet',
        totalTimeMinutes: 25,
      }),
      exportViewAction: 'confirm',
    });
    expect(mocks.recipeApi.renderShareBundle).toHaveBeenCalledTimes(1);

    const confirmedView = makeStoredExportView({
      teaser: 'Für den Export vorbereitet',
      totalTimeMinutes: 25,
    });
    await act(async () => {
      resolveUpdate(makeRecipe({ exportView: confirmedView }));
      await update;
      await savePromise;
    });
    await settle();

    expect(mocks.recipeApi.renderShareBundle).toHaveBeenCalledTimes(2);
    expect(mocks.recipeApi.update.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.recipeApi.renderShareBundle.mock.invocationCallOrder[1]!,
    );
    preview = getSharePreview(renderer);
    expect(mocks.recipeApi.renderShareBundle.mock.calls[1]?.[1]).not.toHaveProperty('exportViewDraft');
    expect(preview.props.exportDraft).toMatchObject({ source: 'persisted' });
  });

  it('reloads the current recipe after a revision conflict without merging or retrying the save', async () => {
    const original = makeRecipe({ exportView: makeStoredExportView() });
    const reloaded = makeRecipe({
      updatedAt: '2026-02-01T00:00:00.000Z',
      exportView: makeStoredExportView({ teaser: 'Aktueller Servertext' }),
    });
    mocks.recipeApi.get.mockResolvedValueOnce(original).mockResolvedValueOnce(reloaded);
    mocks.recipeApi.update.mockRejectedValueOnce(makeRevisionConflictError());
    const { renderer } = await renderDetail();

    await pressShare(renderer);
    await settle();
    let preview = getSharePreview(renderer);
    const initialDraft = preview.props.exportDraft as WizardExportDraft;
    const onChange = preview.props.onChangeExportDraft as ((draft: WizardExportDraft) => void) | undefined;
    if (!onChange) throw new Error('Expected the export draft change handler');
    await act(async () => {
      onChange({ ...initialDraft, teaser: 'Nicht bestätigter lokaler Text' });
    });
    preview = getSharePreview(renderer);
    const onSave = preview.props.onSaveExportDraft as (() => Promise<boolean>) | undefined;
    if (!onSave) throw new Error('Expected the explicit export save handler');
    await act(async () => {
      await onSave();
    });
    await settle();

    expect(mocks.recipeApi.update).toHaveBeenCalledTimes(1);
    expect(mocks.recipeApi.get).toHaveBeenCalledTimes(2);
    expect(mocks.recipeApi.renderShareBundle).toHaveBeenCalledTimes(2);
    expect(mocks.recipeApi.prepareExportView).not.toHaveBeenCalled();
    expect(getSharePreview(renderer).props.exportDraft).toMatchObject({
      source: 'persisted',
      teaser: 'Aktueller Servertext',
    });
    expect(getVisibleNotice(renderer, 'Rezept wurde geändert')).toBeDefined();
  });

  it('keeps the edited draft for review after a conflict reload without a stored view', async () => {
    const original = makeRecipe({ exportView: makeStoredExportView() });
    const reloaded = makeRecipe({ updatedAt: '2026-02-01T00:00:00.000Z' });
    mocks.recipeApi.get.mockResolvedValueOnce(original).mockResolvedValueOnce(reloaded);
    mocks.recipeApi.update.mockRejectedValueOnce(makeRevisionConflictError());
    const { renderer } = await renderDetail();

    await pressShare(renderer);
    await settle();
    let preview = getSharePreview(renderer);
    const initialDraft = preview.props.exportDraft as WizardExportDraft;
    const onChange = preview.props.onChangeExportDraft as ((draft: WizardExportDraft) => void) | undefined;
    if (!onChange) throw new Error('Expected the export draft change handler');
    await act(async () => {
      onChange({ ...initialDraft, teaser: 'Nicht bestätigter lokaler Text' });
    });
    preview = getSharePreview(renderer);
    const onSave = preview.props.onSaveExportDraft as (() => Promise<boolean>) | undefined;
    if (!onSave) throw new Error('Expected the explicit export save handler');
    await act(async () => {
      await onSave();
    });
    await settle();

    expect(mocks.recipeApi.update).toHaveBeenCalledTimes(1);
    expect(mocks.recipeApi.get).toHaveBeenCalledTimes(2);
    expect(mocks.recipeApi.prepareExportView).not.toHaveBeenCalled();
    expect(mocks.recipeApi.renderShareBundle).toHaveBeenCalledTimes(1);
    expect(mocks.recipeApi.renderShareBundle.mock.calls[0]?.[1]?.exportViewDraft).toEqual({
      version: 1,
      teaser: 'Frisch und schnell',
      totalTimeMinutes: 15,
      difficulty: 'Einfach',
      steps: [{ order: 1, description: 'Paprika schneiden.' }],
      includedIngredientIds: ['food-1'],
    });
    expect(getSharePreview(renderer).props.exportDraft).toMatchObject({
      source: 'persisted',
      teaser: 'Nicht bestätigter lokaler Text',
      includedIngredientIds: ['food-1'],
    });
    expect(getSharePreview(renderer).props.renderStatus).toBe('idle');
    expect(getVisibleNotice(renderer, 'Rezept wurde geändert').props.body)
      .toContain('aktualisiere die Vorschau manuell');
  });

  it('removes stale ingredient IDs from the retained draft and asks for review', async () => {
    const original = makeRecipe({ exportView: makeStoredExportView() });
    const reloaded = makeRecipe({
      updatedAt: '2026-02-01T00:00:00.000Z',
      ingredients: [makeIngredient('food-2')],
    });
    mocks.recipeApi.get.mockResolvedValueOnce(original).mockResolvedValueOnce(reloaded);
    mocks.recipeApi.update.mockRejectedValueOnce(makeRevisionConflictError());
    const { renderer } = await renderDetail();

    await pressShare(renderer);
    await settle();
    let preview = getSharePreview(renderer);
    const initialDraft = preview.props.exportDraft as WizardExportDraft;
    const onChange = preview.props.onChangeExportDraft as ((draft: WizardExportDraft) => void) | undefined;
    if (!onChange) throw new Error('Expected the export draft change handler');
    await act(async () => {
      onChange({ ...initialDraft, teaser: 'Nicht bestätigter lokaler Text' });
    });
    preview = getSharePreview(renderer);
    const onSave = preview.props.onSaveExportDraft as (() => Promise<boolean>) | undefined;
    if (!onSave) throw new Error('Expected the explicit export save handler');
    await act(async () => {
      await onSave();
    });
    await settle();

    expect(mocks.recipeApi.update).toHaveBeenCalledTimes(1);
    expect(mocks.recipeApi.prepareExportView).not.toHaveBeenCalled();
    expect(mocks.recipeApi.renderShareBundle).toHaveBeenCalledTimes(1);
    expect(getSharePreview(renderer).props.exportDraft).toMatchObject({
      teaser: 'Nicht bestätigter lokaler Text',
      includedIngredientIds: [],
    });
    expect(getVisibleNotice(renderer, 'Rezept wurde geändert').props.body)
      .toContain('aus der Auswahl entfernt');
    expect(getSharePreview(renderer).props.renderStatus).toBe('idle');
  });

  it('shares both rendered preview images without writing recipe data', async () => {
    const session = {
      previewUri: 'file:///cache/share-preview-1.png',
      detailUri: 'file:///cache/share-preview-2.png',
      save: vi.fn(async () => undefined),
      share: vi.fn(async () => undefined),
      cleanup: vi.fn(async () => undefined),
    };
    mocks.media.createSession.mockReturnValueOnce(session);
    const { renderer } = await renderDetail();

    await pressShare(renderer);
    await settle();
    const preview = getSharePreview(renderer);
    await act(async () => {
      (preview.props.onSaveAndShare as () => void)();
      await Promise.resolve();
    });
    await settle();

    expect(mocks.media.createSession).toHaveBeenCalledWith(
      'file:///cache/share-preview-1.png',
      'file:///cache/share-preview-2.png',
    );
    expect(session.save).toHaveBeenCalledOnce();
    expect(session.share).toHaveBeenCalledOnce();
    expect(mocks.recipeApi.update).not.toHaveBeenCalled();
    expect(mocks.recipeApi.renderShareBundle).toHaveBeenCalledTimes(1);
  });

  it('recovers MISSING_EXPORT_VIEW inside Share and does not enter an automatic retry loop', async () => {
    const original = makeRecipe({ exportView: makeStoredExportView() });
    mocks.recipeApi.get.mockResolvedValueOnce(original).mockResolvedValueOnce(makeRecipe());
    mocks.recipeApi.renderShareBundle.mockRejectedValue(makeMissingViewError());
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { renderer, navigation } = await renderDetail();

    await pressShare(renderer);
    await settle();

    expect(mocks.recipeApi.get).toHaveBeenCalledTimes(2);
    expect(mocks.recipeApi.prepareExportView).toHaveBeenCalledTimes(1);
    expect(mocks.recipeApi.renderShareBundle).toHaveBeenCalledTimes(2);
    expect(navigation.navigate).not.toHaveBeenCalled();

    const preview = getSharePreview(renderer);
    expect(preview.props.exportDraft).toMatchObject({ source: 'prepared' });
    expect(mocks.recipeApi.update).not.toHaveBeenCalled();
    expect(mocks.recipeApi.get).toHaveBeenCalledTimes(2);
    expect(mocks.recipeApi.prepareExportView).toHaveBeenCalledTimes(1);
    expect(mocks.recipeApi.renderShareBundle).toHaveBeenCalledTimes(2);
    const retryAction = getVisibleNotice(renderer, 'Exportansicht fehlt')
      .props.secondaryAction as NoticeAction;
    expect(retryAction.label).toBe('Erneut vorbereiten');
    expect(navigation.navigate).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});