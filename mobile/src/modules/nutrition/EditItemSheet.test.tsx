import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MealItem } from '@fittrack/shared';
import EditItemSheet from './EditItemSheet';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
  StyleSheet: { absoluteFillObject: {}, create: <T,>(styles: T) => styles },
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
vi.mock('../../services/nutritionDiaryService', () => ({ nutritionDiaryService: { updateItem: vi.fn() } }));
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
});
