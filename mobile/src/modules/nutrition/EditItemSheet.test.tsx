import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Meal, MealItem } from '@fittrack/shared';
import EditItemSheet from './EditItemSheet';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const diary = vi.hoisted(() => ({ updateItem: vi.fn() }));

const animations = vi.hoisted(() => ({
  withTiming: vi.fn((value: number) => value),
  withSpring: vi.fn((value: number) => value),
}));

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Alert: { alert: vi.fn() },
  Keyboard: { dismiss: vi.fn() },
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Modal: 'Modal',
  Platform: { OS: 'ios' },
  StyleSheet: { absoluteFill: {}, create: <T,>(styles: T) => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));
vi.mock('react-native-reanimated', () => ({
  default: { View: 'AnimatedView' },
  useAnimatedStyle: (factory: () => unknown) => factory(),
  useSharedValue: (value: number) => ({ value }),
  withTiming: animations.withTiming,
  withSpring: animations.withSpring,
  runOnJS: (callback: () => void) => callback,
}));
vi.mock('react-native-gesture-handler', () => ({
  Gesture: {
    Pan: () => {
      const gesture = {
        onUpdate: () => gesture,
        onEnd: () => gesture,
      };
      return gesture;
    },
  },
  GestureDetector: 'GestureDetector',
  GestureHandlerRootView: 'GestureHandlerRootView',
}));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(),
  notificationAsync: vi.fn(),
  selectionAsync: vi.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));
vi.mock('../../services/nutritionDiaryService', () => ({ nutritionDiaryService: diary }));
vi.mock('../../shared/components/ConfirmSheet', () => ({ ConfirmSheet: () => null }));
vi.mock('./useSourceProduct', () => ({ useSourceProduct: () => ({ product: null }) }));

const item: MealItem = {
  id: 'item-1',
  name: 'Haferflocken',
  sourceType: 'manual',
  quantity: 100,
  unit: 'g',
  macros: { calories: 100, protein: 10, carbs: 10, fat: 5, fiber: 2 },
};

let renderer: ReactTestRenderer | null = null;

afterEach(() => {
  if (renderer) act(() => renderer?.unmount());
  renderer = null;
  vi.clearAllMocks();
});

describe('EditItemSheet entrance', () => {
  it('slides in with timing instead of springing', () => {
    act(() => {
      renderer = create(
        <EditItemSheet
          visible
          mealId="meal-1"
          mealName="Frühstück"
          dateLabel="Heute"
          item={item}
          onSaved={vi.fn()}
          onDeleted={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });

    expect(animations.withTiming).toHaveBeenCalledWith(0, { duration: 220 });
    expect(animations.withSpring).not.toHaveBeenCalled();
  });

  it('updates through the diary facade before reporting success', async () => {
    const updatedMeal = { id: 'meal-1', items: [item] } as Meal;
    const onSaved = vi.fn();
    diary.updateItem.mockResolvedValue({ meal: updatedMeal });

    act(() => {
      renderer = create(
        <EditItemSheet
          visible
          mealId="meal-1"
          mealName="Frühstück"
          dateLabel="Heute"
          item={item}
          onSaved={onSaved}
          onDeleted={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });

    const saveButton = renderer!.root.findAll((node) => node.type === 'TouchableOpacity'
      && node.findAll((text) => text.type === 'Text' && String(text.props.children).includes('Speichern')).length > 0)[0]!;
    const onPress = saveButton.props.onPress;
    if (typeof onPress !== 'function') throw new Error('Save button has no action');
    await act(async () => {
      await onPress();
    });

    expect(diary.updateItem).toHaveBeenCalledWith('meal-1', 'item-1', {
      inputMode: 'grams',
      amountGrams: 100,
    });
    expect(onSaved).toHaveBeenCalledWith(updatedMeal);
    expect(onSaved.mock.invocationCallOrder[0]).toBeGreaterThan(diary.updateItem.mock.invocationCallOrder[0]);
  });
});
