import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Keyboard } from 'react-native';
import * as Haptics from 'expo-haptics';
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
  previewMeal: vi.fn(),
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
  Keyboard: { dismiss: vi.fn(), addListener: () => ({ remove: vi.fn() }) },
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
vi.mock('react-native-reanimated', () => ({
  default: { View: 'AnimatedView' },
  useAnimatedStyle: (factory: () => object) => factory(),
  useSharedValue: (value: number) => ({ value }),
  withTiming: (value: number) => value,
}));
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
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
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
    previewMeal: mocks.previewMeal,
    scanLabel: mocks.scanLabel,
  },
}));
vi.mock('../../shared/components/ErrorBanner', () => ({ ErrorBanner: 'ErrorBanner' }));
vi.mock('../../shared/components/Icon', () => ({ Icon: 'Icon' }));
vi.mock('../../shared/components/Snackbar', () => ({
  Snackbar: () => null,
  useSnackbar: () => ({ ref: { current: null }, show: vi.fn() }),
}));
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

const structuredMealEstimate: AiMealEstimatePreview = {
  ...mealEstimate,
  componentItems: [{ name: 'Haferflocken', estimatedGrams: 100, calories: 150 }],
  estimatedTotalGrams: 180,
  promptVersion: 'meal-v2-test',
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

function findAccessibleButton(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  const button = renderer.root.findAll((node) => node.type === 'TouchableOpacity'
    && node.props.accessibilityLabel === label)[0];
  if (!button) throw new Error(`Accessible button not found: ${label}`);
  return button;
}

function allText(renderer: ReactTestRenderer): string {
  return renderer.root.findAll((node) => node.type === 'Text').map(textContent).join(' ');
}

function inputValue(renderer: ReactTestRenderer, label: string): string {
  const input = renderer.root.findAll((node) => node.type === 'TextInput'
    && node.props.accessibilityLabel === label)[0];
  if (!input || typeof input.props.value !== 'string') throw new Error(`Input not found: ${label}`);
  return input.props.value;
}

function callHandler(node: ReactTestInstance, propName: string, ...args: unknown[]): unknown {
  const handler = node.props[propName];
  if (typeof handler !== 'function') throw new Error(`Missing ${propName} handler`);
  return handler(...args);
}

function changeInputValue(node: ReactTestInstance, value: string): void {
  callHandler(node, 'onChangeText', value);
}

async function pressAccessible(renderer: ReactTestRenderer, label: string): Promise<void> {
  const onPress = findAccessibleButton(renderer, label).props.onPress;
  if (typeof onPress !== 'function') throw new Error(`Button has no action: ${label}`);
  await act(async () => {
    await onPress();
    for (let index = 0; index < 6; index += 1) await Promise.resolve();
  });
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
        estimate={{
          ...mealEstimate,
          photoProvided: true,
          photoAssessment: 'consistent',
          photoUse: 'included',
          photoUsed: true,
        }}
        onClose={vi.fn()}
        onSaved={onSaved}
        onRefine={vi.fn()}
      />,
    );
    renderers.push(renderer);

    await press(renderer, 'Speichern');

    expect(mocks.diary.addItem).toHaveBeenCalledWith('meal-1', expect.objectContaining({
      productName: 'Porridge',
      sourceType: 'ai-meal-estimate',
      inputMode: 'portion',
      inputAmount: 1,
    }));
    expect(mocks.diary.addItem.mock.calls[0]?.[1]).not.toHaveProperty('amountGrams');
    expect(mocks.diary.addItem.mock.calls[0]?.[1]).toHaveProperty('aiMealEstimateComponents', ['Haferflocken']);
    expect(mocks.diary.addItem.mock.calls[0]?.[1]).not.toHaveProperty('aiMealEstimateItems');
    expect(mocks.diary.addItem.mock.calls[0]?.[1]).toHaveProperty('aiMealEstimatePhotoUsed', true);
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
    vi.mocked(Keyboard.dismiss).mockClear();
    const renderer = await render(
      <AISubFlow visible context={makeContext('meal-1')} onClose={vi.fn()} onSaved={onSaved} safeAreaTopInset={0} />,
    );
    renderers.push(renderer);

    const description = renderer.root.findAll((node) => node.type === 'TextInput')[0]!;
    const onChangeText = description.props.onChangeText;
    if (typeof onChangeText !== 'function') throw new Error('Description input has no change handler');
    act(() => onChangeText('Porridge'));
    await press(renderer, 'KI schätzen');
    expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
    await press(renderer, 'Speichern');

    expect(mocks.diary.addItem).toHaveBeenCalledWith('meal-1', expect.objectContaining({
      productName: 'Porridge',
      sourceType: 'ai-meal-estimate',
      inputMode: 'portion',
      inputAmount: 1,
    }));
    expect(mocks.diary.addItem.mock.calls[0]?.[1]).not.toHaveProperty('amountGrams');
    expect(mocks.diary.addItem.mock.calls[0]?.[1]).toHaveProperty('aiMealEstimatePhotoUsed', false);
    expect(onSaved).toHaveBeenCalledWith('KI-Mahlzeitschätzung');
  });

  it('shows only legacy names and disables AI refinement for a V1 response', async () => {
    const renderer = await render(
      <AISubFlow visible context={makeContext('meal-1')} onClose={vi.fn()} onSaved={vi.fn()} safeAreaTopInset={0} />,
    );
    renderers.push(renderer);
    const description = renderer.root.findAll((node) => node.type === 'TextInput')[0]!;
    act(() => changeInputValue(description, 'Porridge'));
    await press(renderer, 'KI schätzen');

    expect(allText(renderer)).toContain('Haferflocken');
    expect(allText(renderer)).not.toContain('Gesamtgewicht ca.');
    expect(allText(renderer)).not.toContain('ca. 100 g');
    expect(findAccessibleButton(renderer, 'Stimmt nicht ganz? Neu schätzen').props.disabled).toBe(true);
    expect(allText(renderer)).toContain('Für diese ältere KI-Schätzung nicht verfügbar');
  });

  it('saves adjusted V2 macros, scaled component grams, weight, and prompt version without legacy names', async () => {
    mocks.estimateMeal.mockResolvedValueOnce(structuredMealEstimate);
    const onSaved = vi.fn();
    const renderer = await render(
      <AISubFlow visible context={makeContext('meal-1')} onClose={vi.fn()} onSaved={onSaved} safeAreaTopInset={0} />,
    );
    renderers.push(renderer);
    const description = renderer.root.findAll((node) => node.type === 'TextInput')[0]!;
    act(() => changeInputValue(description, 'Porridge'));
    await press(renderer, 'KI schätzen');
    await pressAccessible(renderer, 'Portion um fünf Prozent erhöhen');
    await pressAccessible(renderer, 'Protein erhöhen');

    expect(inputValue(renderer, 'Kalorien')).toBe('235');
    expect(inputValue(renderer, 'Protein')).toBe('14');
    expect(allText(renderer)).toContain('ca. 105 g · 158 kcal');
    expect(allText(renderer)).toContain('+15 kcal');
    await press(renderer, 'Speichern');

    const payload = mocks.diary.addItem.mock.calls[0]?.[1];
    expect(payload).toMatchObject({
      sourceType: 'ai-meal-estimate',
      inputMode: 'portion',
      inputAmount: 1,
      aiMealEstimateItems: [{ name: 'Haferflocken', estimatedGrams: 105, calories: 157.5 }],
      aiMealEstimateWeightGrams: 189,
      aiMealEstimateVersion: 'meal-v2-test',
    });
    expect(payload.calculatedNutrition.calories).toBeCloseTo(235);
    expect(payload.calculatedNutrition.protein).toBeCloseTo(14);
    expect(payload.calculatedNutrition.carbs).toBeCloseTo(29);
    expect(payload.calculatedNutrition.fat).toBeCloseTo(7);
    expect(payload.calculatedNutrition.fiber).toBeCloseTo(4);
    expect(payload).not.toHaveProperty('aiMealEstimateComponents');
    expect(payload).not.toHaveProperty('aiMealEstimateBaseCalories');
    expect(payload).not.toHaveProperty('amountGrams');
    expect(onSaved).toHaveBeenCalledWith('KI-Mahlzeitschätzung');
  });

  it('keeps macro values directly editable as numeric inputs', async () => {
    const renderer = await render(
      <AISubFlow visible context={makeContext('meal-1')} onClose={vi.fn()} onSaved={vi.fn()} safeAreaTopInset={0} />,
    );
    renderers.push(renderer);
    const description = renderer.root.findAll((node) => node.type === 'TextInput')[0]!;
    act(() => changeInputValue(description, 'Porridge'));
    await press(renderer, 'KI schätzen');

    const proteinInput = renderer.root.findAll((node) => node.type === 'TextInput'
      && node.props.accessibilityLabel === 'Protein')[0];
    expect(proteinInput?.props.keyboardType).toBe('decimal-pad');
    act(() => changeInputValue(proteinInput!, '18,5'));
    expect(inputValue(renderer, 'Protein')).toBe('18,5');
    await press(renderer, 'Speichern');

    expect(mocks.diary.addItem.mock.calls[0]?.[1].calculatedNutrition.protein).toBe(18.5);
  });

  it('restores every scaled value after one +5% and one -5% portion step', async () => {
    mocks.estimateMeal.mockResolvedValueOnce(structuredMealEstimate);
    const renderer = await render(
      <AISubFlow visible context={makeContext('meal-1')} onClose={vi.fn()} onSaved={vi.fn()} safeAreaTopInset={0} />,
    );
    renderers.push(renderer);
    const description = renderer.root.findAll((node) => node.type === 'TextInput')[0]!;
    act(() => changeInputValue(description, 'Porridge'));
    await press(renderer, 'KI schätzen');
    await pressAccessible(renderer, 'Portion um fünf Prozent erhöhen');
    await pressAccessible(renderer, 'Portion um fünf Prozent verringern');

    expect(inputValue(renderer, 'Kalorien')).toBe('220');
    expect(allText(renderer)).not.toContain('Gesamtgewicht');
    expect(allText(renderer)).toContain('ca. 100 g · 150 kcal');
    expect(allText(renderer)).not.toMatch(/[+−][\d.,]+ (kcal|g)/);
    expect(renderer.root.findAll((node) => node.props.accessibilityLabel === 'Rückgängig')).toHaveLength(0);
  });

  it('resets adjusted values and repeats held steppers until release', async () => {
    mocks.estimateMeal.mockResolvedValueOnce(structuredMealEstimate);
    const renderer = await render(
      <AISubFlow visible context={makeContext('meal-1')} onClose={vi.fn()} onSaved={vi.fn()} safeAreaTopInset={0} />,
    );
    renderers.push(renderer);
    const description = renderer.root.findAll((node) => node.type === 'TextInput')[0]!;
    act(() => changeInputValue(description, 'Porridge'));
    await press(renderer, 'KI schätzen');

    const increasePortion = findAccessibleButton(renderer, 'Portion um fünf Prozent erhöhen');
    expect(increasePortion.props.delayLongPress).toBe(400);
    vi.useFakeTimers();
    act(() => {
      callHandler(increasePortion, 'onPressIn');
      callHandler(increasePortion, 'onLongPress');
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(140); });
    await act(async () => { await vi.advanceTimersByTimeAsync(140); });
    expect(allText(renderer)).toContain('+33 kcal');
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(3);

    act(() => { callHandler(increasePortion, 'onPressOut'); });
    await act(async () => { await vi.advanceTimersByTimeAsync(280); });
    expect(allText(renderer)).toContain('+33 kcal');

    await pressAccessible(renderer, 'Rückgängig');
    expect(allText(renderer)).not.toMatch(/[+−][\d.,]+ (kcal|g)/);
  });

  it('keeps labeled 48pt controls, stops at 150%, and warns at the boundary', async () => {
    mocks.estimateMeal.mockResolvedValueOnce(structuredMealEstimate);
    const renderer = await render(
      <AISubFlow visible context={makeContext('meal-1')} onClose={vi.fn()} onSaved={vi.fn()} safeAreaTopInset={0} />,
    );
    renderers.push(renderer);
    const description = renderer.root.findAll((node) => node.type === 'TextInput')[0]!;
    act(() => changeInputValue(description, 'Porridge'));
    await press(renderer, 'KI schätzen');

    const steppers = renderer.root.findAll((node) => node.type === 'TouchableOpacity'
      && typeof node.props.accessibilityLabel === 'string'
      && (node.props.accessibilityLabel.includes('erhöhen') || node.props.accessibilityLabel.includes('verringern')));
    expect(steppers.length).toBeGreaterThanOrEqual(10);
    for (const stepper of steppers) {
      expect(stepper.props.accessibilityRole).toBe('button');
      expect(stepper.props.style).toMatchObject({ width: 48, height: 48 });
    }

    for (let index = 0; index < 10; index += 1) {
      await pressAccessible(renderer, 'Portion um fünf Prozent erhöhen');
    }
    expect(allText(renderer)).toContain('+110 kcal');
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(10);
    await pressAccessible(renderer, 'Portion um fünf Prozent erhöhen');
    expect(allText(renderer)).toContain('+110 kcal');
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('warning');

    for (let index = 0; index < 20; index += 1) {
      await pressAccessible(renderer, 'Portion um fünf Prozent verringern');
    }
    expect(allText(renderer)).toContain('−110 kcal');
    await pressAccessible(renderer, 'Portion um fünf Prozent verringern');
    expect(allText(renderer)).toContain('−110 kcal');
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(2);
  });

  it('keeps manual calorie entry and shows the existing macro-consistency warning', async () => {
    const renderer = await render(
      <AISubFlow visible context={makeContext('meal-1')} onClose={vi.fn()} onSaved={vi.fn()} safeAreaTopInset={0} />,
    );
    renderers.push(renderer);
    const description = renderer.root.findAll((node) => node.type === 'TextInput')[0]!;
    act(() => changeInputValue(description, 'Porridge'));
    await press(renderer, 'KI schätzen');

    const calorieInput = renderer.root.findAll((node) => node.type === 'TextInput'
      && node.props.accessibilityLabel === 'Kalorien')[0]!;
    act(() => changeInputValue(calorieInput, '500'));
    expect(allText(renderer)).toContain('Nährwerte inkonsistent');
    await press(renderer, 'Speichern');

    expect(mocks.diary.addItem.mock.calls[0]?.[1].calculatedNutrition.calories).toBe(500);
  });

  it('sends a V2 re-estimate with the full previous snapshot and one size hint', async () => {
    mocks.estimateMeal.mockResolvedValueOnce(structuredMealEstimate).mockResolvedValueOnce({
      ...structuredMealEstimate,
      mealEstimate: { ...NUTRITION, calories: 250 },
    });
    const renderer = await render(
      <AISubFlow visible context={makeContext('meal-1')} onClose={vi.fn()} onSaved={vi.fn()} safeAreaTopInset={0} />,
    );
    renderers.push(renderer);
    const description = renderer.root.findAll((node) => node.type === 'TextInput')[0]!;
    act(() => changeInputValue(description, 'Porridge'));
    await press(renderer, 'KI schätzen');
    await pressAccessible(renderer, 'Stimmt nicht ganz? Neu schätzen');
    await pressAccessible(renderer, 'Portion größer');
    await pressAccessible(renderer, 'Neu schätzen bestätigen');

    expect(mocks.estimateMeal).toHaveBeenNthCalledWith(2, 'Porridge', undefined, undefined, {
      previous: {
        mealName: 'Porridge',
        estimatedTotalGrams: 180,
        mealEstimate: NUTRITION,
        componentItems: [{ name: 'Haferflocken', estimatedGrams: 100, calories: 150 }],
      },
      hints: ['larger'],
    });
    expect(inputValue(renderer, 'Kalorien')).toBe('250');
    expect(allText(renderer)).not.toMatch(/[+−][\d.,]+ (kcal|g)/);
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
    const selectedPhoto = renderer.root.findAll((node) => node.type === 'Image')[0];
    expect(selectedPhoto?.props.source).toEqual({ uri: '/meal-cropped.jpg' });
    expect(selectedPhoto?.props.resizeMode).toBe('contain');
    expect(selectedPhoto?.props.accessibilityLabel).toBe('Ausgewähltes Mahlzeitenfoto');
    await press(renderer, 'KI schätzen');
    expect(mocks.estimateMeal).toHaveBeenLastCalledWith(
      'Porridge',
      '/meal-cropped.jpg',
      'image/jpeg',
      undefined,
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        onProgress: expect.any(Function),
      }),
    );

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
    expect(renderer.root.findAll((node) => node.type === 'Image')).toHaveLength(0);
    await press(renderer, 'KI schätzen');
    expect(mocks.estimateMeal).toHaveBeenLastCalledWith(
      'Porridge',
      undefined,
      undefined,
      undefined,
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        onProgress: expect.any(Function),
      }),
    );
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