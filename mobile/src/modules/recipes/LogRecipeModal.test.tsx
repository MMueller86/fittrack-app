import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Meal } from '@fittrack/shared';

const mocks = vi.hoisted(() => ({
  getDay: vi.fn(),
  createMealForRecipeSetup: vi.fn(),
  logRecipe: vi.fn(),
  syncNutritionUpsert: vi.fn(),
}));

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Modal: 'Modal',
  ScrollView: 'ScrollView',
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('../../shared/api/diaryApi', () => ({ diaryApi: { getDay: mocks.getDay } }));
vi.mock('../../shared/api/recipeApi', () => ({ recipeApi: { log: mocks.logRecipe } }));
vi.mock('../../services/nutritionDiaryService', () => ({
  nutritionDiaryService: { createMealForRecipeSetup: mocks.createMealForRecipeSetup },
}));
vi.mock('../../services/health/nutritionSyncService', () => ({
  nutritionSyncService: { syncNutritionUpsert: mocks.syncNutritionUpsert },
}));
vi.mock('../../shared/components/InfoOverlay', () => ({ InfoOverlay: 'InfoOverlay' }));
vi.mock('../../shared/components/MealChip', () => ({ MealChip: 'MealChip' }));
vi.mock('../../shared/components/NutritionTile', () => ({ NutritionTile: 'NutritionTile' }));

import LogRecipeModal from './LogRecipeModal';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeMeal(id: string, items: Meal['items'] = []): Meal {
  return {
    id,
    userId: 'user-1',
    date: '2026-10-23',
    type: 'dinner',
    name: 'Abendessen',
    items,
    createdAt: '2026-10-23T18:00:00.000Z',
  };
}

function getTextContent(node: ReactTestInstance): string {
  return (node as ReactTestInstance & { children: Array<string | ReactTestInstance> }).children
    .map((child) => typeof child === 'string' ? child : getTextContent(child))
    .join('');
}

function findSubmitButton(renderer: ReactTestRenderer): ReactTestInstance {
  const button = renderer.root.findAll((node) => node.type === 'TouchableOpacity'
    && getTextContent(node) === 'Eintragen')[0];
  if (!button) throw new Error('Recipe submit button not found');
  return button;
}

async function renderModal() {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <LogRecipeModal
        visible
        recipe={{
          id: 'recipe-1',
          name: 'Linsensuppe',
          nutritionPerPortion: { calories: 420, protein: 24, carbs: 50, fat: 12, fiber: 8 },
        }}
        onClose={vi.fn()}
        onLogged={vi.fn()}
      />,
    );
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  return renderer;
}

async function submit(renderer: ReactTestRenderer): Promise<void> {
  const onPress = findSubmitButton(renderer).props.onPress;
  if (typeof onPress !== 'function') throw new Error('Recipe submit action is unavailable');
  await act(async () => {
    await onPress();
  });
}

let renderer: ReactTestRenderer | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDay.mockResolvedValue({ meals: [] });
  mocks.createMealForRecipeSetup.mockResolvedValue({ meal: makeMeal('meal-created') });
  mocks.logRecipe.mockResolvedValue(makeMeal('meal-created', [{
    id: 'recipe-item',
    name: 'Linsensuppe',
    sourceType: 'recipe',
    quantity: 1,
    unit: 'portion',
    macros: { calories: 420, protein: 24, carbs: 50, fat: 12, fiber: 8 },
  }]));
  mocks.syncNutritionUpsert.mockResolvedValue(undefined);
});

afterEach(() => {
  if (renderer) act(() => renderer?.unmount());
  renderer = null;
});

describe('LogRecipeModal Health Connect trigger', () => {
  it('syncs the logged recipe only after recipeApi.log succeeds', async () => {
    const order: string[] = [];
    mocks.createMealForRecipeSetup.mockImplementation(async () => {
      order.push('meal-setup');
      return { meal: makeMeal('meal-created') };
    });
    mocks.logRecipe.mockImplementation(async () => {
      order.push('recipe-log');
      return makeMeal('meal-created', [{
        id: 'recipe-item',
        name: 'Linsensuppe',
        sourceType: 'recipe',
        quantity: 1,
        unit: 'portion',
        macros: { calories: 420, protein: 24, carbs: 50, fat: 12, fiber: 8 },
      }]);
    });
    mocks.syncNutritionUpsert.mockImplementation(() => { order.push('health-sync'); });
    renderer = await renderModal();

    await submit(renderer);

    expect(mocks.createMealForRecipeSetup).toHaveBeenCalledTimes(1);
    expect(mocks.logRecipe).toHaveBeenCalledWith('recipe-1', { portions: 1, mealId: 'meal-created' });
    expect(mocks.syncNutritionUpsert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'meal-created',
      items: [expect.objectContaining({ id: 'recipe-item', sourceType: 'recipe' })],
    }));
    expect(order).toEqual(['meal-setup', 'recipe-log', 'health-sync']);
  });

  it('does not sync the recipe when recipeApi.log fails', async () => {
    mocks.logRecipe.mockRejectedValue(new Error('Recipe log failed'));
    renderer = await renderModal();

    await submit(renderer);

    expect(mocks.createMealForRecipeSetup).toHaveBeenCalledTimes(1);
    expect(mocks.logRecipe).toHaveBeenCalledTimes(1);
    expect(mocks.syncNutritionUpsert).not.toHaveBeenCalled();
  });
});