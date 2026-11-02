import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiFoodEstimatePreview, AiMealEstimatePreview, FoodSearchResult, Meal, MealItem, NutritionLabelScanResult } from '@fittrack/shared';
import type { MealParserPreviewItem } from '../../shared/api/aiApi';
import type { FoodEntryHubContext } from './hub/useFoodEntryHubStore';

const mocks = vi.hoisted(() => {
  Object.assign(globalThis, { __DEV__: false });
  return {
  diary: {
    getDay: vi.fn(),
    createMeal: vi.fn(),
    addItem: vi.fn(),
  },
  reusableCreate: vi.fn(),
  foodSearch: vi.fn(),
  estimateFood: vi.fn(),
  estimateMeal: vi.fn(),
  scanLabel: vi.fn(),
  photoPickerProps: {
    current: null as null | {
      visible: boolean;
      initialSource?: 'camera' | 'gallery';
      preset: string;
      output: string;
      cameraReview: string;
      onClose: () => void;
      onSelected: (result: unknown) => void;
    },
  },
  };
});

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Alert: { alert: vi.fn() },
  Image: 'Image',
  Keyboard: { dismiss: vi.fn() },
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Modal: 'Modal',
  Platform: { OS: 'android' },
  SafeAreaView: 'SafeAreaView',
  ScrollView: 'ScrollView',
  StyleSheet: { absoluteFill: {}, create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  Text: 'Text',
  TextInput: 'TextInput',
  TurboModuleRegistry: {
    get: () => null,
    getEnforcing: () => ({}),
  },
  TouchableOpacity: 'TouchableOpacity',
  TouchableWithoutFeedback: 'TouchableWithoutFeedback',
  View: 'View',
}));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));
vi.mock('expo-modules-core', () => ({
  CodedError: class extends Error {},
  EventEmitter: class {},
  PermissionStatus: {},
  UnavailabilityError: class extends Error {},
  createPermissionHook: () => () => [],
  requireNativeModule: () => ({}),
}));
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(),
  notificationAsync: vi.fn(),
  selectionAsync: vi.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));
vi.mock('../../shared/camera/FramedPhotoPicker', () => ({
  FramedPhotoPicker: (props: NonNullable<typeof mocks.photoPickerProps.current>) => {
    mocks.photoPickerProps.current = props;
    return null;
  },
}));
vi.mock('../../services/nutritionDiaryService', () => ({ nutritionDiaryService: mocks.diary }));
vi.mock('../../shared/api/client', () => ({ isQuotaExceededError: () => false }));
vi.mock('../../shared/api/reusableItemsApi', () => ({ reusableItemsApi: { create: mocks.reusableCreate } }));
vi.mock('../../shared/api/foodApi', () => ({ foodApi: { search: mocks.foodSearch } }));
vi.mock('../../shared/api/aiApi', () => ({
  aiApi: {
    estimateFood: mocks.estimateFood,
    estimateMeal: mocks.estimateMeal,
    scanLabel: mocks.scanLabel,
  },
}));
vi.mock('../../shared/components/ErrorBanner', () => ({ ErrorBanner: 'ErrorBanner' }));
vi.mock('../../shared/components/Icon', () => ({ Icon: 'Icon' }));
vi.mock('../../shared/components/ConfirmSheet', () => ({ ConfirmSheet: () => null }));

import FoodEstimateReviewScreen from './FoodEstimateReviewScreen';
import MealEstimateReviewScreen from './MealEstimateReviewScreen';
import MealParserReviewScreen from './MealParserReviewScreen';
import { AISubFlow } from './hub/AISubFlow';
import { LabelSubFlow } from './hub/LabelSubFlow';
import { ManuellerSubFlow } from './hub/ManuellerSubFlow';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NUTRITION = { calories: 220, protein: 12, carbs: 28, fat: 7, fiber: 4 };

const food: FoodSearchResult = {
  id: 'food-1',
  source: 'library',
  name: 'Haferflocken',
  displayLabel: '220 kcal / 100 g',
  nutritionBasis: 'per100g',
  nutritionPer100g: NUTRITION,
  isComplete: true,
};

const foodEstimate: AiFoodEstimatePreview = {
  displayName: 'Haferflocken',
  estimatedNutritionPer100g: { ...NUTRITION, per: '100g' },
  estimatedPortion: null,
  category: 'food',
  sourceProduct: null,
  searchTerms: [],
  confidence: 0.8,
  warnings: [],
};

const mealEstimate: AiMealEstimatePreview = {
  mealName: 'Porridge',
  mealEstimate: NUTRITION,
  components: ['Haferflocken'],
  contextDetected: null,
  portionConfidence: 'high',
  photoUsed: false,
  assumptions: [],
  warnings: [],
};

const labelResult: NutritionLabelScanResult = {
  productName: 'Haferflocken',
  brand: null,
  baseUnit: '100g',
  servingSize: null,
  nutrition: {
    calories: 220,
    protein: 12,
    carbs: 28,
    sugar: null,
    fat: 7,
    saturatedFat: null,
    fiber: 4,
    salt: null,
  },
  ocrConfidence: 0.9,
  aiConfidence: 0.9,
  warnings: [],
  rawOcrText: 'Haferflocken',
};

function makeItem(id: string): MealItem {
  return {
    id,
    name: 'Haferflocken',
    sourceType: 'manual',
    quantity: 100,
    unit: 'g',
    macros: NUTRITION,
  };
}

function makeMeal(id: string, items: MealItem[] = []): Meal {
  return {
    id,
    userId: 'user-1',
    date: '2026-10-23',
    type: 'breakfast',
    name: 'Frühstück',
    items,
    createdAt: '2026-10-23T07:00:00.000Z',
  };
}

function makeContext(mealId?: string): FoodEntryHubContext {
  return { purpose: 'diary', mealId, date: '2026-10-23', mealType: 'breakfast' };
}

function textContent(node: ReactTestInstance): string {
  return (node as ReactTestInstance & { children: Array<string | ReactTestInstance> }).children
    .map((child) => typeof child === 'string' ? child : textContent(child))
    .join('');
}

function findButton(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  const button = renderer.root.findAll((node) => node.type === 'TouchableOpacity'
    && textContent(node).includes(label))[0];
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

async function press(renderer: ReactTestRenderer, label: string): Promise<void> {
  const onPress = findButton(renderer, label).props.onPress;
  if (typeof onPress !== 'function') throw new Error(`Button has no action: ${label}`);
  await act(async () => {
    await onPress();
    for (let index = 0; index < 6; index += 1) await Promise.resolve();
  });
}

async function render(element: React.ReactElement): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(element);
    for (let index = 0; index < 6; index += 1) await Promise.resolve();
  });
  return renderer;
}

const renderers: ReactTestRenderer[] = [];

function rerender(renderer: ReactTestRenderer, element: React.ReactElement): void {
  (renderer as ReactTestRenderer & { update(element: React.ReactElement): void }).update(element);
}

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  mocks.diary.getDay.mockResolvedValue({ meals: [] });
  mocks.diary.createMeal.mockResolvedValue({ meal: makeMeal('meal-created') });
  mocks.diary.addItem.mockResolvedValue({ meal: makeMeal('meal-1', [makeItem('new-item')]) });
  mocks.reusableCreate.mockResolvedValue({ item: { id: 'reusable-1', name: 'Haferflocken' } });
  mocks.foodSearch.mockResolvedValue({ results: [food] });
  mocks.estimateFood.mockResolvedValue(foodEstimate);
  mocks.estimateMeal.mockResolvedValue(mealEstimate);
  mocks.scanLabel.mockResolvedValue(labelResult);
  mocks.photoPickerProps.current = null;
});

afterEach(() => {
  renderers.splice(0).forEach((renderer) => act(() => renderer.unmount()));
  vi.useRealTimers();
});

describe('nutrition diary mutation caller flows', () => {
  it('saves a FoodEstimateReviewScreen entry through the facade and reports success', async () => {
    const onSaved = vi.fn();
    const renderer = await render(
      <FoodEstimateReviewScreen visible mealId="meal-1" estimate={foodEstimate} onClose={vi.fn()} onSaved={onSaved} />,
    );
    renderers.push(renderer);

    await press(renderer, 'Einmalig hinzufügen');

    expect(mocks.diary.addItem).toHaveBeenCalledWith('meal-1', expect.objectContaining({ name: 'Haferflocken' }));
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ displayName: 'Haferflocken' }));
  });

  it('saves a MealEstimateReviewScreen entry through the facade and reports success', async () => {
    const onSaved = vi.fn();
    const renderer = await render(
      <MealEstimateReviewScreen
        visible
        mealId="meal-1"
        originalText="Porridge"
        estimate={mealEstimate}
        onClose={vi.fn()}
        onSaved={onSaved}
        onRefine={vi.fn()}
      />,
    );
    renderers.push(renderer);

    await press(renderer, 'Mahlzeit speichern');

    expect(mocks.diary.addItem).toHaveBeenCalledWith('meal-1', expect.objectContaining({
      productName: 'Porridge',
      sourceType: 'ai-meal-estimate',
    }));
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('saves resolved MealParserReviewScreen items through the facade and reports success', async () => {
    const onSaved = vi.fn();
    const parserItem: MealParserPreviewItem = {
      rawText: 'Haferflocken',
      displayName: 'Haferflocken',
      status: 'matched',
      selectedProductId: food.id,
      selectedProductName: food.name,
      candidates: [food],
      inputMode: 'grams',
      inputAmount: 100,
      amountGrams: 100,
      needsReview: false,
      warnings: [],
    };
    const renderer = await render(
      <MealParserReviewScreen visible mealId="meal-1" items={[parserItem]} warnings={[]} onClose={vi.fn()} onSaved={onSaved} />,
    );
    renderers.push(renderer);

    await press(renderer, 'Alle speichern');

    expect(mocks.diary.addItem).toHaveBeenCalledWith('meal-1', expect.objectContaining({
      productId: 'food-1',
      productName: 'Haferflocken',
    }));
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('saves the AISubFlow estimate through the facade and reports success', async () => {
    const onSaved = vi.fn();
    const renderer = await render(
      <AISubFlow visible context={makeContext('meal-1')} onClose={vi.fn()} onSaved={onSaved} safeAreaTopInset={0} />,
    );
    renderers.push(renderer);

    const description = renderer.root.findAll((node) => node.type === 'TextInput')[0]!;
    const onChangeText = description.props.onChangeText;
    if (typeof onChangeText !== 'function') throw new Error('Description input has no change handler');
    act(() => onChangeText('Porridge'));
    await press(renderer, 'Analysieren');
    await press(renderer, 'Speichern');

    expect(mocks.diary.addItem).toHaveBeenCalledWith('meal-1', expect.objectContaining({
      productName: 'Porridge',
      sourceType: 'ai-meal-estimate',
    }));
    expect(onSaved).toHaveBeenCalledWith('KI-Mahlzeitschätzung');
  });

  it('resolves a LabelSubFlow meal through the facade before scanning', async () => {
    const onSaved = vi.fn();
    const renderer = await render(
      <LabelSubFlow visible context={makeContext()} onClose={vi.fn()} onSaved={onSaved} />,
    );
    renderers.push(renderer);

    expect(mocks.diary.getDay).toHaveBeenCalledWith('2026-10-23');
    expect(mocks.diary.createMeal).toHaveBeenCalledWith('2026-10-23', 'breakfast');
    expect(mocks.diary.addItem).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('sends the photo selected in the shared frame flow to the label scan', async () => {
    const renderer = await render(
      <LabelSubFlow visible context={makeContext()} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    renderers.push(renderer);

    await act(async () => {
      mocks.photoPickerProps.current?.onSelected({
        uri: '/label.jpg',
        mime: 'image/jpeg',
        crop: { focusX: 0.5, focusY: 0.5, zoom: 1 },
      });
      for (let index = 0; index < 6; index += 1) await Promise.resolve();
    });

    expect(mocks.scanLabel).toHaveBeenCalledWith('/label.jpg', 'image/jpeg');
  });

  it.each([['Kamera', 'camera'], ['Galerie', 'gallery']] as const)(
    'opens the shared picker directly with %s as the initial source in LabelSubFlow',
    async (label, source) => {
      const renderer = await render(
        <LabelSubFlow visible context={makeContext()} onClose={vi.fn()} onSaved={vi.fn()} />,
      );
      renderers.push(renderer);
      expect(mocks.photoPickerProps.current?.visible).toBe(false);

      await press(renderer, label);

      expect(mocks.photoPickerProps.current?.visible).toBe(true);
      expect(mocks.photoPickerProps.current?.initialSource).toBe(source);
    },
  );

  it.each([['Kamera', 'camera'], ['Galerie', 'gallery']] as const)(
    'opens the shared picker directly with %s as the initial source in AISubFlow',
    async (label, source) => {
      const renderer = await render(
        <AISubFlow visible context={makeContext('meal-1')} onClose={vi.fn()} onSaved={vi.fn()} safeAreaTopInset={0} />,
      );
      renderers.push(renderer);
      expect(mocks.photoPickerProps.current?.visible).toBe(false);

      await press(renderer, label);

      expect(mocks.photoPickerProps.current?.visible).toBe(true);
      expect(mocks.photoPickerProps.current?.initialSource).toBe(source);
    },
  );

  it.each([
    ['LabelSubFlow', 'nutritionLabel'],
    ['AISubFlow', 'mealPhoto'],
  ] as const)('wires the shared picker preset and review mode in %s', async (flow, preset) => {
    const element = flow === 'LabelSubFlow'
      ? <LabelSubFlow visible context={makeContext()} onClose={vi.fn()} onSaved={vi.fn()} />
      : <AISubFlow visible context={makeContext('meal-1')} onClose={vi.fn()} onSaved={vi.fn()} safeAreaTopInset={0} />;
    const renderer = await render(element);
    renderers.push(renderer);

    expect(mocks.photoPickerProps.current).toEqual(expect.objectContaining({
      visible: false,
      initialSource: undefined,
      preset,
      output: 'cropped-file',
      cameraReview: 'direct',
    }));

    await press(renderer, 'Kamera');
    expect(mocks.photoPickerProps.current).toEqual(expect.objectContaining({
      visible: true,
      initialSource: 'camera',
      preset,
      output: 'cropped-file',
      cameraReview: 'direct',
    }));

    await press(renderer, 'Galerie');
    expect(mocks.photoPickerProps.current).toEqual(expect.objectContaining({
      visible: true,
      initialSource: 'gallery',
      preset,
      output: 'cropped-file',
      cameraReview: 'direct',
    }));
  });

  it.each([['LabelSubFlow'], ['AISubFlow']] as const)(
    'resets the picker source when the picker closes and when %s is reopened',
    async (flow) => {
      const build = (visible: boolean) => flow === 'LabelSubFlow'
        ? <LabelSubFlow visible={visible} context={makeContext()} onClose={vi.fn()} onSaved={vi.fn()} />
        : <AISubFlow visible={visible} context={makeContext('meal-1')} onClose={vi.fn()} onSaved={vi.fn()} safeAreaTopInset={0} />;
      const renderer = await render(build(true));
      renderers.push(renderer);

      await press(renderer, 'Galerie');
      expect(mocks.photoPickerProps.current?.visible).toBe(true);
      await act(async () => {
        mocks.photoPickerProps.current?.onClose();
      });
      expect(mocks.photoPickerProps.current?.visible).toBe(false);
      expect(mocks.photoPickerProps.current?.initialSource).toBeUndefined();

      await press(renderer, 'Kamera');
      expect(mocks.photoPickerProps.current?.initialSource).toBe('camera');
      await act(async () => { rerender(renderer, build(false)); });
      await act(async () => { rerender(renderer, build(true)); });

      expect(mocks.photoPickerProps.current?.visible).toBe(false);
      expect(mocks.photoPickerProps.current?.initialSource).toBeUndefined();
    },
  );

  it('sends the cropped meal photo to estimateMeal, removes it again and resets it on reopen', async () => {
    const build = (visible: boolean) => (
      <AISubFlow visible={visible} context={makeContext('meal-1')} onClose={vi.fn()} onSaved={vi.fn()} safeAreaTopInset={0} />
    );
    const renderer = await render(build(true));
    renderers.push(renderer);
    const typeText = (value: string) => {
      const onChangeText = renderer.root.findAll((node) => node.type === 'TextInput')[0]!.props.onChangeText as (value: string) => void;
      act(() => onChangeText(value));
    };
    const selectPhoto = async (uri: string, mime: 'image/jpeg' | 'image/png') => {
      await act(async () => {
        mocks.photoPickerProps.current?.onSelected({ uri, mime, crop: { focusX: 0.5, focusY: 0.5, zoom: 1 } });
      });
    };
    const hasButton = (label: string) => renderer.root.findAll((node) => node.type === 'TouchableOpacity'
      && node.props.accessibilityLabel === label).length > 0;

    typeText('Porridge');
    await selectPhoto('/meal-cropped.jpg', 'image/jpeg');
    expect(hasButton('Foto entfernen')).toBe(true);
    expect(hasButton('Foto mit der Kamera aufnehmen')).toBe(false);
    await press(renderer, 'Analysieren');
    expect(mocks.estimateMeal).toHaveBeenLastCalledWith('Porridge', '/meal-cropped.jpg', 'image/jpeg');

    // Close and reopen the flow: the photo must be gone.
    await act(async () => { rerender(renderer, build(false)); });
    await act(async () => { rerender(renderer, build(true)); });
    expect(hasButton('Foto entfernen')).toBe(false);

    typeText('Porridge');
    await selectPhoto('/meal-2.png', 'image/png');
    const remove = renderer.root.findAll((node) => node.type === 'TouchableOpacity'
      && node.props.accessibilityLabel === 'Foto entfernen')[0]!;
    await act(async () => { (remove.props.onPress as () => void)(); });
    expect(hasButton('Foto entfernen')).toBe(false);
    expect(hasButton('Foto mit der Kamera aufnehmen')).toBe(true);
    await press(renderer, 'Analysieren');
    expect(mocks.estimateMeal).toHaveBeenLastCalledWith('Porridge', undefined, undefined);
  });

  it('shows a label scan error and keeps the camera and gallery buttons usable', async () => {
    mocks.scanLabel.mockRejectedValueOnce(new Error('Scan-Kontingent erschöpft'));
    const renderer = await render(
      <LabelSubFlow visible context={makeContext()} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    renderers.push(renderer);

    await act(async () => {
      mocks.photoPickerProps.current?.onSelected({
        uri: '/label.jpg',
        mime: 'image/jpeg',
        crop: { focusX: 0.5, focusY: 0.5, zoom: 1 },
      });
      for (let index = 0; index < 6; index += 1) await Promise.resolve();
    });

    const banner = renderer.root.findAll((node) => node.type === 'ErrorBanner')[0];
    expect(banner?.props.error).toBe('Scan-Kontingent erschöpft');
    expect(renderer.root.findAll((node) => node.type === 'ActivityIndicator')).toHaveLength(0);
    await press(renderer, 'Galerie');
    expect(mocks.photoPickerProps.current?.initialSource).toBe('gallery');
    await press(renderer, 'Kamera');
    expect(mocks.photoPickerProps.current?.initialSource).toBe('camera');
  });

  it('saves a ManuellerSubFlow entry through the facade and reports success', async () => {
    const onSaved = vi.fn();
    const renderer = await render(
      <ManuellerSubFlow visible context={makeContext()} onClose={vi.fn()} onSaved={onSaved} />,
    );
    renderers.push(renderer);

    await press(renderer, 'Einmalig hinzufügen');

    expect(mocks.diary.createMeal).toHaveBeenCalledWith('2026-10-23', 'breakfast');
    expect(mocks.diary.addItem).toHaveBeenCalledWith('meal-created', expect.any(Object));
    expect(onSaved).toHaveBeenCalledWith('Manueller Eintrag');
  });
});