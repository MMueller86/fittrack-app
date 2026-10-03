import React, { type ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import type { RecipeIngredient } from '@fittrack/shared';
import { getInitialRecipeInstagramTags } from './recipeInstagramOptions';
import { RecipeInstagramPreview } from './RecipeInstagramPreview';
import type { WizardExportDraft } from './recipeWizardTypes';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock('react-native-reanimated', () => ({
  default: {
    View: 'Animated.View',
    Image: 'Animated.Image',
  },
  FadeIn: { duration: () => ({}) },
  FadeOut: { duration: () => ({}) },
}));

vi.mock('../../shared/components/Icon', () => ({
  Icon: 'Icon',
}));
vi.mock('../../shared/components/MealChip', () => ({
  MealChip: 'MealChip',
}));

vi.mock('react-native', async () => {
  const ReactModule = await import('react');

  const Modal = ({ visible, children, ...props }: { visible: boolean; children?: ReactNode }) => (
    visible ? ReactModule.createElement('Modal', { ...props, visible }, children) : null
  );

  return {
    ActivityIndicator: 'ActivityIndicator',
    Modal,
    Pressable: 'Pressable',
    ScrollView: 'ScrollView',
    StyleSheet: {
      absoluteFillObject: {},
      create: <T,>(styles: T) => styles,
    },
    Switch: 'Switch',
    Text: 'Text',
    TextInput: 'TextInput',
    TouchableOpacity: 'TouchableOpacity',
    useWindowDimensions: () => ({ width: 390, height: 844 }),
    View: 'View',
  };
});

function getByLabel(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  const matches = renderer.root.findAll(
    (node) => node.props.accessibilityLabel === label,
  );
  if (matches.length !== 1) {
    throw new Error(`Expected one element with accessibilityLabel ${label}, found ${matches.length}`);
  }
  return matches[0]!;
}

function makeDraft(overrides: Partial<WizardExportDraft> = {}): WizardExportDraft {
  return {
    version: 1,
    teaser: 'Frisch und schnell',
    totalTimeMinutes: '15',
    difficulty: 'Einfach',
    steps: [{ order: 1, description: 'Tomaten schneiden.' }],
    includedIngredientIds: [],
    includedIngredientKeys: [],
    analysisIngredientKeys: [],
    source: 'persisted',
    confirmed: false,
    ...overrides,
  };
}

function makeIngredient(index: number): RecipeIngredient {
  const nutrition = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  return {
    id: `ingredient-${index}`,
    displayName: `Zutat ${index + 1}`,
    inputMode: 'grams',
    inputAmount: 100,
    amountGrams: 100,
    unit: 'g',
    linkedProductId: null,
    linkedReusableItemId: null,
    isAiEstimate: false,
    category: 'food',
    nutritionContribution: nutrition,
    nutritionPer100g: nutrition,
  };
}

async function renderPreview(overrides: Partial<React.ComponentProps<typeof RecipeInstagramPreview>> = {}) {
  const props: React.ComponentProps<typeof RecipeInstagramPreview> = {
    visible: true,
    preparationMessage: null,
    providerRequestInFlight: false,
    instagramUri: 'file:///cache/instagram.png',
    detailUri: 'file:///cache/detail.png',
    exportDraft: makeDraft(),
    exportIngredients: [],
    recipeTags: ['Schnell', 'Salat'],
    selectedTags: ['Schnell', 'Salat'],
    nutritionHighlight: null,
    previewErrors: [],
    saveErrors: [],
    exportDraftValid: true,
    exportDraftSaveValid: true,
    exportDraftNeedsSaving: true,
    canChangeOptions: true,
    renderStatus: 'ready',
    renderStage: 'initial',
    assetStatus: 'idle',
    shareStatus: 'idle',
    canAdjustCrop: true,
    busy: false,
    onClose: vi.fn(),
    onChangeExportDraft: vi.fn(),
    onToggleIncludedIngredient: vi.fn(),
    onAdjustCrop: vi.fn(),
    onChangeOptions: vi.fn(),
    onUpdatePreview: vi.fn(),
    onSaveExportDraft: vi.fn(async () => true),
    onRetryRender: vi.fn(),
    onSaveAndShare: vi.fn(),
    ...overrides,
  };
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<RecipeInstagramPreview {...props} />);
  });
  return { renderer, props };
}

describe('RecipeInstagramPreview', () => {
  it.each(['Titelbild', 'Detailbild'])('opens the selected %s in a full-screen paged viewer', async (label) => {
    const { renderer, props } = await renderPreview();
    await act(async () => {
      (getByLabel(renderer, `${label} vergrößern`).props.onPress as () => void)();
    });
    const viewer = renderer.root.findAll((node) => node.props.testID === 'recipe-share-image-viewer')[0]!;
    expect(viewer.props.horizontal).toBe(true);
    expect(viewer.props.pagingEnabled).toBe(true);
    expect(viewer.props.contentOffset).toEqual({ x: label === 'Detailbild' ? 390 : 0, y: 0 });
    expect(renderer.root.findAll((node) => node.type === 'Animated.Image')).toHaveLength(2);
    await act(async () => {
      (viewer.props.onMomentumScrollEnd as (event: { nativeEvent: { contentOffset: { x: number } } }) => void)(
        { nativeEvent: { contentOffset: { x: 390 } } },
      );
    });
    expect(getByLabel(renderer, 'Nächstes Bild').props.disabled).toBe(true);
    expect(getByLabel(renderer, 'Vorheriges Bild').props.disabled).toBe(false);
    await act(async () => {
      (getByLabel(renderer, 'Optionen & Texte bearbeiten').props.onPress as () => void)();
    });
    expect(renderer.root.findAll((node) => node.props.testID === 'recipe-share-image-viewer')).toHaveLength(0);
    expect(renderer.root.findAll((node) => node.props.testID === 'recipe-share-editor-title-section')).toHaveLength(1);
    expect(props.onChangeExportDraft).not.toHaveBeenCalled();
    expect(props.onUpdatePreview).not.toHaveBeenCalled();
  });

  it('returns from the viewer to both previews without closing the share flow', async () => {
    const { renderer, props } = await renderPreview();
    await act(async () => {
      (getByLabel(renderer, 'Titelbild vergrößern').props.onPress as () => void)();
    });
    await act(async () => {
      (getByLabel(renderer, 'Großansicht schließen').props.onPress as () => void)();
    });
    expect(renderer.root.findAll((node) => node.props.testID === 'recipe-share-preview-pair')).toHaveLength(1);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('does not open a large viewer while previews are rendering', async () => {
    const { renderer } = await renderPreview({ renderStatus: 'loading' });
    expect(getByLabel(renderer, 'Titelbild vergrößern').props.disabled).toBe(true);
    expect(getByLabel(renderer, 'Detailbild vergrößern').props.disabled).toBe(true);
  });

  it('supports a single image without carousel controls', async () => {
    const { renderer } = await renderPreview({ detailUri: null });
    await act(async () => {
      (getByLabel(renderer, 'Titelbild vergrößern').props.onPress as () => void)();
    });
    expect(renderer.root.findAll((node) => node.type === 'Animated.Image')).toHaveLength(1);
    expect(renderer.root.findAll((node) => node.props.accessibilityLabel === 'Nächstes Bild')).toHaveLength(0);
  });

  it('sizes pages to the measured viewport and offers accessible arrow navigation', async () => {
    const { renderer } = await renderPreview();
    await act(async () => {
      (getByLabel(renderer, 'Titelbild vergrößern').props.onPress as () => void)();
    });
    const viewer = renderer.root.findAll((node) => node.props.testID === 'recipe-share-image-viewer')[0]!;
    await act(async () => {
      (viewer.props.onLayout as (event: { nativeEvent: { layout: { width: number; height: number } } } ) => void)(
        { nativeEvent: { layout: { width: 640, height: 400 } } },
      );
    });
    const images = renderer.root.findAll((node) => node.type === 'Animated.Image');
    expect(images.every((image) => image.props.resizeMode === 'contain')).toBe(true);
    expect(renderer.root.findAll((node) => (
      node.type === 'View' && Array.isArray(node.props.style)
      && node.props.style.some((style: unknown) => (
        typeof style === 'object' && style !== null && 'width' in style && 'height' in style
        && style.width === 640 && style.height === 400
      ))
    ))).toHaveLength(2);
    await act(async () => {
      (getByLabel(renderer, 'Nächstes Bild').props.onPress as () => void)();
    });
    expect(getByLabel(renderer, 'Nächstes Bild').props.disabled).toBe(true);
    await act(async () => {
      (getByLabel(renderer, 'Vorheriges Bild').props.onPress as () => void)();
    });
    expect(getByLabel(renderer, 'Vorheriges Bild').props.disabled).toBe(true);
  });

  it('defaults to at most the first four stored recipe tags', () => {
    expect(getInitialRecipeInstagramTags([])).toEqual([]);
    expect(getInitialRecipeInstagramTags(['Schnell', 'Salat', 'Einfach', 'Abendessen']))
      .toEqual(['Schnell', 'Salat', 'Einfach', 'Abendessen']);
    expect(getInitialRecipeInstagramTags(['Schnell', 'Salat', 'Einfach', 'Abendessen', 'Meal Prep']))
      .toEqual(['Schnell', 'Salat', 'Einfach', 'Abendessen']);
  });

  it('shows both rendered PNG previews together in fixed 4:5 frames', async () => {
    const { renderer, props } = await renderPreview();

    const images = renderer.root.findAll((node) => node.type === 'Animated.Image');
    expect(images).toHaveLength(2);
    expect(images.map((image) => image.props.source)).toEqual([
      { uri: 'file:///cache/instagram.png' },
      { uri: 'file:///cache/detail.png' },
    ]);
    expect(images[0]?.props.style).toMatchObject({ width: '100%', height: '100%' });
    expect(renderer.root.findAll((node) => {
      if (node.type !== 'View') return false;
      const style = (node.props as Record<string, unknown>).style;
      return typeof style === 'object'
        && style !== null
        && 'aspectRatio' in style
        && style.aspectRatio === 1080 / 1350;
    })).toHaveLength(2);
    expect(renderer.root.findAll((node) => node.type === 'Text' && node.props.children === 'Titelbild'))
      .toHaveLength(1);
    expect(renderer.root.findAll((node) => node.type === 'Text' && node.props.children === 'Detailbild'))
      .toHaveLength(1);
    expect(renderer.root.findAll((node) => node.props.accessibilityRole === 'tab')).toHaveLength(0);
    const previewPair = renderer.root.findAll((node) => (
      node.type === 'View' && node.props.testID === 'recipe-share-preview-pair'
    ))[0];
    expect(previewPair?.props.style).toMatchObject({
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'space-between',
    });
    expect(getByLabel(renderer, 'Ausschnitt anpassen').props.disabled).toBe(false);
    expect(getByLabel(renderer, 'Bilder speichern und teilen').props.disabled).toBe(false);

    await act(async () => {
      (getByLabel(renderer, 'Bilder speichern und teilen').props.onPress as () => void)();
    });
    expect(props.onSaveAndShare).toHaveBeenCalledTimes(1);
  });

  it('offers one combined editor without a pre-render text-confirmation action', async () => {
    const { renderer } = await renderPreview();

    expect(renderer.root.findAll((node) => node.type === 'TextInput')).toHaveLength(0);
    expect(renderer.root.findAll((node) => (
      node.type === 'TouchableOpacity'
      && node.props.accessibilityLabel === 'Optionen & Texte bearbeiten'
    ))).toHaveLength(1);
    expect(renderer.root.findAll((node) => (
      node.props.accessibilityLabel === 'Texte prüfen'
      || node.props.accessibilityLabel === 'Texte übernehmen und Vorschau anzeigen'
      || node.props.accessibilityLabel === 'Instagram-Optionen ändern'
    ))).toHaveLength(0);

    await act(async () => {
      (getByLabel(renderer, 'Optionen & Texte bearbeiten').props.onPress as () => void)();
    });

    expect(renderer.root.findAll((node) => node.type === 'Text' && node.props.children === 'Titelbild'))
      .toHaveLength(2);
    expect(renderer.root.findAll((node) => node.type === 'Text' && node.props.children === 'Detailbild'))
      .toHaveLength(2);
    const titleSection = renderer.root.findAll((node) => (
      node.type === 'View' && node.props.testID === 'recipe-share-editor-title-section'
    ))[0];
    const detailSection = renderer.root.findAll((node) => (
      node.type === 'View' && node.props.testID === 'recipe-share-editor-detail-section'
    ))[0];
    expect(titleSection?.findAll((node) => node.props.accessibilityLabel === 'Export-Teaser')).toHaveLength(0);
    expect(detailSection?.findAll((node) => node.props.accessibilityLabel === 'Export-Teaser')).toHaveLength(1);
    const cropAction = getByLabel(renderer, 'Ausschnitt anpassen');
    expect(cropAction.props.accessibilityRole).toBe('button');
    expect(cropAction.props.accessibilityState).toMatchObject({ disabled: false });
    expect(titleSection?.findAll((node) => node.props.accessibilityLabel === 'Ausschnitt anpassen')).toHaveLength(1);
    expect(getByLabel(renderer, 'High-Protein-Symbol anzeigen')).toBeDefined();
  });

  it('shows the review hint only after both previews are ready', async () => {
    const hint = 'Check beide Bilder kurz durch. Die Texte kannst du jederzeit noch anpassen.';
    const { renderer: readyRenderer } = await renderPreview();
    expect(readyRenderer.root.findAll((node) => node.type === 'Text' && node.props.children === hint))
      .toHaveLength(1);

    const { renderer: loadingRenderer } = await renderPreview({ renderStatus: 'loading' });
    expect(loadingRenderer.root.findAll((node) => node.type === 'Text' && node.props.children === hint))
      .toHaveLength(0);

    const { renderer: incompleteRenderer } = await renderPreview({
      detailUri: null,
      renderStatus: 'ready',
    });
    expect(incompleteRenderer.root.findAll((node) => node.type === 'Text' && node.props.children === hint))
      .toHaveLength(0);
  });

  it('edits tags and the explicit highlight in the same editor', async () => {
    const recipeTags = ['Schnell', 'Salat', 'Einfach', 'Abendessen', 'Meal Prep'];
    const selectedTags = recipeTags.slice(0, 4);
    const { renderer, props } = await renderPreview({ recipeTags, selectedTags });
    await act(async () => {
      (getByLabel(renderer, 'Optionen & Texte bearbeiten').props.onPress as () => void)();
    });

    expect(getByLabel(renderer, 'Tag Meal Prep').props.accessibilityState).toMatchObject({
      checked: false,
      disabled: true,
    });
    await act(async () => {
      (getByLabel(renderer, 'Tag Schnell').props.onPress as () => void)();
    });
    expect(props.onChangeOptions).toHaveBeenCalledWith({
      selectedTags: ['Salat', 'Einfach', 'Abendessen'],
      nutritionHighlight: null,
    });

    await act(async () => {
      (getByLabel(renderer, 'High-Protein-Symbol anzeigen').props.onValueChange as (enabled: boolean) => void)(true);
    });
    expect(props.onChangeOptions).toHaveBeenLastCalledWith({
      selectedTags,
      nutritionHighlight: 'high-protein',
    });
  });

  it('shows the empty-tag state inside the unified editor', async () => {
    const { renderer } = await renderPreview({ recipeTags: [], selectedTags: [] });
    await act(async () => {
      (getByLabel(renderer, 'Optionen & Texte bearbeiten').props.onPress as () => void)();
    });

    expect(renderer.root.findAll((node) => (
      node.type === 'Text'
      && node.props.children === 'Für dieses Rezept sind keine Tags hinterlegt.'
    ))).toHaveLength(1);
  });

  it.each([
    ['missing detail preview', { detailUri: null }],
    ['duplicate preview URI', { detailUri: 'file:///cache/instagram.png' }],
    ['render error', { renderStatus: 'error' as const }],
  ])('keeps save/share disabled for a %s', async (_caseName, overrides) => {
    const { renderer, props } = await renderPreview(overrides);

    expect(getByLabel(renderer, 'Bilder speichern und teilen').props.disabled).toBe(true);
    expect(props.onSaveAndShare).not.toHaveBeenCalled();
  });

  it('keeps actions locked while a save/share promise is active', async () => {
    const { renderer } = await renderPreview({ busy: true });

    const closeButton = renderer.root.findAll(
      (node) => node.type === 'TouchableOpacity' && node.props.accessibilityLabel === 'Vorschau schließen',
    )[0];
    if (!closeButton) throw new Error('Expected the preview close button');
    expect(closeButton.props.disabled).toBe(true);
    expect(getByLabel(renderer, 'Ausschnitt anpassen').props.disabled).toBe(true);
    expect(getByLabel(renderer, 'Bilder speichern und teilen').props.disabled).toBe(true);
  });

  it('keeps both previews visible and locks crop and sharing while replacing them', async () => {
    const { renderer } = await renderPreview({ renderStatus: 'loading', renderStage: 'final' });

    const images = renderer.root.findAll((node) => node.type === 'Animated.Image');
    expect(images).toHaveLength(2);
    expect(images.map((image) => image.props.source)).toEqual([
      { uri: 'file:///cache/instagram.png' },
      { uri: 'file:///cache/detail.png' },
    ]);
    expect(getByLabel(renderer, 'Ausschnitt anpassen').props.disabled).toBe(true);
    expect(getByLabel(renderer, 'Bilder speichern und teilen').props.disabled).toBe(true);
  });

  it('renders two fixed loading frames before the PNG pair exists', async () => {
    const { renderer } = await renderPreview({
      instagramUri: null,
      detailUri: null,
      renderStatus: 'loading',
    });

    expect(renderer.root.findAll((node) => node.type === 'Animated.Image')).toHaveLength(0);
    expect(renderer.root.findAll((node) => node.type === 'Text' && node.props.children === 'Vorschau wird erstellt…'))
      .toHaveLength(2);
  });

  it('keeps nullable preparation metadata editable for render but invalid for confirmation save', async () => {
    const { renderer, props } = await renderPreview({
      exportDraft: makeDraft({ totalTimeMinutes: '', difficulty: '' }),
      exportDraftValid: true,
      exportDraftSaveValid: false,
      previewErrors: [],
      saveErrors: [
        'Bitte gib eine ganze Zubereitungszeit zwischen 1 und 10080 Minuten an.',
        'Bitte gib eine Schwierigkeit in einer Zeile an.',
      ],
    });
    await act(async () => {
      (getByLabel(renderer, 'Optionen & Texte bearbeiten').props.onPress as () => void)();
    });

    expect(getByLabel(renderer, 'Zubereitungszeit in Minuten').props.value).toBe('');
    expect(getByLabel(renderer, 'Export-Schwierigkeit').props.value).toBe('');
    expect(getByLabel(renderer, 'Vorschau aktualisieren').props.disabled).toBe(false);
    expect(getByLabel(renderer, 'Exportansicht speichern').props.disabled).toBe(true);
    expect(renderer.root.findAll((node) => (
      node.type === 'Text'
      && node.props.children === 'Bitte gib eine Schwierigkeit in einer Zeile an.'
    ))).toHaveLength(1);
    expect(props.onSaveExportDraft).not.toHaveBeenCalled();
  });

  it('updates draft fields directly in the editor and persists only after explicit Speichern', async () => {
    const { renderer, props } = await renderPreview();
    await act(async () => {
      (getByLabel(renderer, 'Optionen & Texte bearbeiten').props.onPress as () => void)();
    });

    const teaserInput = getByLabel(renderer, 'Export-Teaser');

    await act(async () => {
      (teaserInput.props.onChangeText as (value: string) => void)('Neuer Teaser');
    });

    expect(props.onChangeExportDraft).toHaveBeenCalledWith(expect.objectContaining({
      teaser: 'Neuer Teaser',
    }));

    await act(async () => {
      (getByLabel(renderer, 'Exportansicht speichern').props.onPress as () => void)();
    });
    expect(props.onSaveExportDraft).toHaveBeenCalledTimes(1);
  });

  it('hides ingredient selection for four ingredients and shows it only above the image limit', async () => {
    const { renderer: fourRenderer } = await renderPreview({
      exportIngredients: Array.from({ length: 4 }, (_, index) => makeIngredient(index)),
    });
    await act(async () => {
      (getByLabel(fourRenderer, 'Optionen & Texte bearbeiten').props.onPress as () => void)();
    });
    expect(fourRenderer.root.findAll((node) => node.type === 'Text' && node.props.children === 'Zutaten im Bild'))
      .toHaveLength(0);
    expect(fourRenderer.root.findAll((node) => node.type === 'Switch')).toHaveLength(1);

    const { renderer: twentyOneRenderer } = await renderPreview({
      exportIngredients: Array.from({ length: 21 }, (_, index) => makeIngredient(index)),
    });
    await act(async () => {
      (getByLabel(twentyOneRenderer, 'Optionen & Texte bearbeiten').props.onPress as () => void)();
    });
    expect(twentyOneRenderer.root.findAll((node) => node.type === 'Text' && node.props.children === 'Zutaten im Bild'))
      .toHaveLength(1);
    expect(twentyOneRenderer.root.findAll((node) => node.type === 'Switch')).toHaveLength(22);
  });

  it('anchors each step removal control to the right side of its step header', async () => {
    const { renderer, props } = await renderPreview({
      exportDraft: {
        version: 1,
        teaser: 'Frisch und schnell',
        totalTimeMinutes: '15',
        difficulty: 'Einfach',
        steps: [
          { order: 1, description: 'Tomaten schneiden.' },
          { order: 2, description: 'Alles vermengen.' },
        ],
        includedIngredientIds: [],
        includedIngredientKeys: [],
        analysisIngredientKeys: [],
        source: 'persisted',
        confirmed: false,
      },
    });
    await act(async () => {
      (getByLabel(renderer, 'Optionen & Texte bearbeiten').props.onPress as () => void)();
    });
    const removeButton = getByLabel(renderer, 'Exportschritt 1 entfernen');
    const stepHeader = renderer.root.findAll((node) => (
      node.type === 'View' && node.props.testID === 'export-step-header-0'
    ))[0];
    expect(stepHeader?.props.style).toMatchObject({
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    });
    expect(removeButton.props.style).toMatchObject({
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    });
    expect(removeButton.props.style).not.toHaveProperty('borderWidth');
    expect(removeButton.props.style).not.toHaveProperty('backgroundColor');
    await act(async () => {
      (removeButton.props.onPress as () => void)();
    });
    expect(props.onChangeExportDraft).toHaveBeenCalledWith(expect.objectContaining({
      steps: [{ order: 1, description: 'Alles vermengen.' }],
    }));
  });

  it('keeps preview guidance, editing, and footer actions on a consistent spacing rhythm', async () => {
    const { renderer } = await renderPreview();
    const scroll = renderer.root.findAll((node) => node.type === 'ScrollView')[0];
    expect(scroll?.props.contentContainerStyle).toMatchObject({ gap: 16, paddingBottom: 16 });
    expect(getByLabel(renderer, 'Optionen & Texte bearbeiten').props.style).toMatchObject({
      minHeight: 48,
      paddingHorizontal: 16,
    });
    const cropStyles = getByLabel(renderer, 'Ausschnitt anpassen').props.style as unknown[];
    expect(cropStyles[0]).toMatchObject({ minHeight: 48 });
    const shareStyles = getByLabel(renderer, 'Bilder speichern und teilen').props.style as unknown[];
    expect(shareStyles[0]).toMatchObject({ minHeight: 48 });
    expect(renderer.root.findAll((node) => (
      node.type === 'Text' && typeof node.props.children === 'string'
      && node.props.children.includes('Instagram')
    ))).toHaveLength(0);
  });

  it.each([
    ['generic', 'Exportvorschau wird vorbereitet.', false],
    [
      'AI provider',
      'Die KI macht deine Texte gerade fit fürs Bild ... Gleich kannst du beide Bilder checken und die Texte noch anpassen.',
      true,
    ],
  ])('shows %s preparation copy and provider activity only during the request', async (
    _kind,
    message,
    providerRequestInFlight,
  ) => {
    const { renderer } = await renderPreview({
      preparationMessage: message,
      providerRequestInFlight,
    });

    expect(renderer.root.findAll((node) => node.type === 'ActivityIndicator'))
      .toHaveLength(providerRequestInFlight ? 1 : 0);
    expect(renderer.root.findAll((node) => node.type === 'Text' && node.props.children === message))
      .toHaveLength(1);
    expect(renderer.root.findAll((node) => node.type === 'TextInput')).toHaveLength(0);
  });
});