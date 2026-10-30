import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserFoodRelation } from '@fittrack/shared';

const mocks = vi.hoisted(() => {
  Object.assign(globalThis, { __DEV__: false });
  return {
    diary: { getDay: vi.fn(), createMeal: vi.fn(), addItem: vi.fn() },
    listFavoritesRanked: vi.fn(),
    listRecent: vi.fn(),
    onSuccess: vi.fn(),
    close: vi.fn(),
  };
});

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Alert: { alert: vi.fn() },
  Animated: {
    View: 'AnimatedView',
    Value: class {
      constructor(public value: number) {}
      setValue(value: number) { this.value = value; }
      interpolate() { return this.value; }
    },
    timing: vi.fn(() => ({ start: (callback?: () => void) => callback?.() })),
  },
  Keyboard: { addListener: () => ({ remove: vi.fn() }), dismiss: vi.fn() },
  Modal: 'Modal',
  Platform: { OS: 'ios' },
  StyleSheet: { absoluteFill: {}, create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  Text: 'Text',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  TouchableWithoutFeedback: 'TouchableWithoutFeedback',
  View: 'View',
}));
vi.mock('@gorhom/bottom-sheet', async () => {
  const ReactModule = await import('react');
  const BottomSheetModal = ReactModule.forwardRef((props: { children?: React.ReactNode }, ref) => {
    ReactModule.useImperativeHandle(ref, () => ({ present: vi.fn(), dismiss: vi.fn() }));
    return ReactModule.createElement('View', null, props.children);
  });
  return {
    BottomSheetBackdrop: 'BottomSheetBackdrop',
    BottomSheetModal,
    BottomSheetTextInput: 'TextInput',
  };
});
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(),
  selectionAsync: vi.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}));
vi.mock('react-native-reanimated', () => ({
  default: { View: 'AnimatedView' },
  FadeIn: { duration: () => undefined },
  useAnimatedStyle: (factory: () => unknown) => factory(),
  useReducedMotion: () => true,
  useSharedValue: (value: number) => ({ value }),
}));
vi.mock('../../../services/nutritionDiaryService', () => ({ nutritionDiaryService: mocks.diary }));
vi.mock('../../../services/health/nutritionSyncService', () => ({ nutritionSyncService: {} }));
vi.mock('../../../shared/api/favoritesApi', () => ({ favoritesApi: {
  listFavoritesRanked: mocks.listFavoritesRanked,
  listRecent: mocks.listRecent,
} }));
vi.mock('../../../shared/api/foodApi', () => ({ foodApi: { search: vi.fn() } }));
vi.mock('../../../shared/api/reusableItemsApi', () => ({ reusableItemsApi: { list: vi.fn() } }));
vi.mock('../../../shared/api/recipeApi', () => ({ recipeApi: { list: vi.fn() } }));
vi.mock('../../../shared/viewModels/recipeLoggingViewModel', () => ({
  isRecipeUnavailableError: () => false,
  loadRecipeForRelation: vi.fn(),
  submitRecipeLog: vi.fn(),
}));
vi.mock('./useFoodEntryHubStore', () => ({ useFoodEntryHubStore: () => ({
  isOpen: true,
  context: { purpose: 'diary', date: '2026-10-23', mealType: 'breakfast' },
  onSuccess: mocks.onSuccess,
  close: mocks.close,
  autoFocusSearch: false,
  initialSubflow: null,
  autoCloseOnSave: false,
  topInset: 0,
  initialQuery: '',
  prefillAmount: null,
  onSelectIngredient: null,
  onEstimateIngredient: null,
} ) }));
vi.mock('../../../shared/components/Icon', () => ({ Icon: 'Icon' }));
vi.mock('../../../shared/components/FoodEntryQuickActionButton', () => ({ FoodEntryQuickActionButton: () => null }));
vi.mock('../../../shared/components/ConfirmSheet', () => ({ ConfirmSheet: () => null }));
vi.mock('./FoodList', async () => {
  const ReactModule = await import('react');
  return { FoodList: ({ items, onDirectAdd, showDirectAdd }: {
    items: UserFoodRelation[];
    onDirectAdd: (item: UserFoodRelation) => void;
    showDirectAdd: boolean;
  }) => showDirectAdd && items[0]
    ? ReactModule.createElement('TouchableOpacity', {
        accessibilityLabel: 'direct-add',
        onPress: () => onDirectAdd(items[0]),
      }, ReactModule.createElement('Text', null, 'Direkt hinzufügen'))
    : null };
});
vi.mock('./SearchState', () => ({ SearchState: () => null }));
vi.mock('./QuantityView', () => ({ QuantityView: () => null, RecipeQuantityView: () => null }));
vi.mock('./ManuellerSubFlow', () => ({ ManuellerSubFlow: () => null }));
vi.mock('./AISubFlow', () => ({ AISubFlow: () => null }));
vi.mock('./BarcodeSubFlow', () => ({ BarcodeSubFlow: () => null }));
vi.mock('./LabelSubFlow', () => ({ LabelSubFlow: () => null }));

import { FoodEntryHub } from './FoodEntryHub';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const relation = {
  id: 'relation-1',
  userId: 'user-1',
  foodRef: 'food-1',
  foodRefType: 'personal',
  displayName: 'Haferflocken',
  isFavorite: true,
  usageCount: 1,
  preferredInputMode: 'grams',
  preferredInputAmount: 100,
  nutritionPer100g: { calories: 220, protein: 12, carbs: 28, fat: 7 },
} as UserFoodRelation;

let renderer: ReactTestRenderer | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.listFavoritesRanked.mockResolvedValue({ items: [relation] });
  mocks.listRecent.mockResolvedValue([]);
  mocks.diary.getDay.mockResolvedValue({ meals: [] });
  mocks.diary.createMeal.mockResolvedValue({ meal: { id: 'meal-created' } });
  mocks.diary.addItem.mockResolvedValue({ meal: { items: [{ id: 'item-created' }] } });
});

afterEach(() => {
  if (renderer) act(() => renderer?.unmount());
  renderer = null;
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('FoodEntryHub diary mutation flows', () => {
  it('direct-adds a favorite through the diary facade before reporting success', async () => {
    await act(async () => {
      renderer = create(<FoodEntryHub />);
      for (let index = 0; index < 6; index += 1) await Promise.resolve();
    });

    const button = renderer!.root.findAll((node) => node.props.accessibilityLabel === 'direct-add')[0]!;
    const onPress = button.props.onPress;
    if (typeof onPress !== 'function') throw new Error('Direct-add button has no action');
    await act(async () => {
      await onPress();
      for (let index = 0; index < 6; index += 1) await Promise.resolve();
    });

    expect(mocks.diary.getDay).toHaveBeenCalledWith('2026-10-23');
    expect(mocks.diary.createMeal).toHaveBeenCalledWith('2026-10-23', 'breakfast');
    expect(mocks.diary.addItem).toHaveBeenCalledWith('meal-created', expect.objectContaining({
      productId: 'food-1',
      productName: 'Haferflocken',
      inputAmount: 100,
      amountGrams: 100,
    }));
    expect(mocks.onSuccess).toHaveBeenCalledTimes(1);
    expect(mocks.onSuccess.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.diary.addItem.mock.invocationCallOrder[0]);
  });
});