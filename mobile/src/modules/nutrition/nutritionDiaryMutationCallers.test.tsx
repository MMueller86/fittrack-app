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
  openCamera: vi.fn(),
  openPicker: vi.fn(),
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
  StyleSheet: { absoluteFillObject: {}, create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  Text: 'Text',
  TextInput: 'TextInput',
  TurboModuleRegistry: {
    get: () => null,
    getEnforcing: () => ({
      openCamera: mocks.openCamera,
      openPicker: mocks.openPicker,
      openCropper: vi.fn(),
      clean: vi.fn(),
      cleanSingle: vi.fn(),
    }),
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
vi.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: vi.fn(),
  requestMediaLibraryPermissionsAsync: vi.fn(),
  launchCameraAsync: vi.fn(),
  launchImageLibraryAsync: vi.fn(),
}));
vi.mock('react-native-image-crop-picker', () => ({
  default: { openCamera: mocks.openCamera, openPicker: mocks.openPicker },
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

import AddItemModal from './AddItemModal';
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
  mocks.openCamera.mockResolvedValue({ path: '/label.jpg', mime: 'image/jpeg' });
  mocks.openPicker.mockResolvedValue({ path: '/label.jpg', mime: 'image/jpeg' });
});

afterEach(() => {
  renderers.splice(0).forEach((renderer) => act(() => renderer.unmount()));
  vi.useRealTimers();
});

describe('nutrition diary mutation caller flows', () => {
  it('adds a selected product from AddItemModal through the facade before calling onSaved', async () => {
    vi.useFakeTimers();
    const onSaved = vi.fn();
    const renderer = await render(
      <AddItemModal visible mealId="meal-1" mealName="Frühstück" onClose={vi.fn()} onSaved={onSaved} />,
    );
    renderers.push(renderer);

    const searchInput = renderer.root.findAll((node) => node.type === 'TextInput')[0]!;
    const onChangeText = searchInput.props.onChangeText;
    if (typeof onChangeText !== 'function') throw new Error('Search input has no change handler');
    await act(async () => {
      onChangeText('Hafer');
      await vi.advanceTimersByTimeAsync(300);
      for (let index = 0; index < 6; index += 1) await Promise.resolve();
    });
    await press(renderer, 'Haferflocken');
    await press(renderer, 'Zur Mahlzeit hinzufügen');

    expect(mocks.diary.addItem).toHaveBeenCalledWith('meal-1', expect.objectContaining({
      productId: 'food-1',
      productName: 'Haferflocken',
    }));
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

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