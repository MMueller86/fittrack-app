import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FoodSearchResult } from '@fittrack/shared';
import { QuantityView } from './QuantityView';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  favoritesApi: { addFavorite: vi.fn(), removeFavorite: vi.fn() },
  nutritionDiaryService: { addItem: vi.fn(), getDay: vi.fn(), createMeal: vi.fn() },
}));

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Animated: {},
  BackHandler: { addEventListener: () => ({ remove: vi.fn() }) },
  Image: 'Image',
  Keyboard: { addListener: () => ({ remove: vi.fn() }), dismiss: vi.fn() },
  Modal: 'Modal',
  Platform: { OS: 'ios' },
  ScrollView: 'ScrollView',
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  Text: 'Text',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));
vi.mock('expo-haptics', () => ({ impactAsync: vi.fn(), ImpactFeedbackStyle: { Light: 'light' } }));
vi.mock('../../../shared/api/favoritesApi', () => ({ favoritesApi: mocks.favoritesApi }));
vi.mock('../../../services/nutritionDiaryService', () => ({ nutritionDiaryService: mocks.nutritionDiaryService }));
vi.mock('../../../shared/api/diaryApi', () => ({ diaryApi: {} }));
vi.mock('../../../shared/api/recipeApi', () => ({ recipeApi: {} }));
vi.mock('../../../shared/components/Icon', () => ({ Icon: 'Icon' }));
vi.mock('../../../shared/components/ErrorBanner', () => ({ ErrorBanner: 'ErrorBanner' }));
vi.mock('../../recipes/recipeUtils', () => ({ resolveRecipeQuickEntryPortions: vi.fn() }));
vi.mock('../../../shared/viewModels/recipeLoggingViewModel', () => ({
  isRecipeUnavailableError: vi.fn(),
  resolvePortionInput: vi.fn(),
  scaleNutritionByPortions: vi.fn(),
  submitRecipeLog: vi.fn(),
}));
vi.mock('../../../services/health/nutritionSyncService', () => ({ nutritionSyncService: {} }));

const renderers: ReactTestRenderer[] = [];

function product(overrides: Partial<FoodSearchResult>): FoodSearchResult {
  return {
    id: 'item-1',
    source: 'library',
    name: 'Haferflocken',
    displayLabel: '100g',
    nutritionBasis: 'per100g',
    nutritionPer100g: { calories: 370, protein: 13, carbs: 59, fat: 7 },
    isComplete: true,
    isFavorite: false,
    ...overrides,
  };
}

function renderView(result: FoodSearchResult) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <QuantityView
        product={result}
        context={{ mealId: 'meal-1', date: '2026-10-12', mealType: 'breakfast' } as never}
        onBack={vi.fn()}
        onAdded={vi.fn()}
      />,
    );
  });
  renderers.push(renderer);
  return renderer;
}

function byLabel(renderer: ReactTestRenderer, label: string): ReactTestInstance | undefined {
  return renderer.root.findAll(
    (n: ReactTestInstance) => (n.type as unknown) === 'TouchableOpacity' && n.props.accessibilityLabel === label,
  )[0];
}

async function press(node: ReactTestInstance | undefined) {
  await act(async () => {
    (node!.props.onPress as () => void)();
    await Promise.resolve();
  });
}

function pressAdd(renderer: ReactTestRenderer) {
  const add = renderer.root.findAll(
    (n: ReactTestInstance) =>
      (n.type as unknown) === 'TouchableOpacity' && typeof n.props.onPress === 'function'
      && n.findAll((c: ReactTestInstance) => (c.type as unknown) === 'Text'
        && /hinzuf/i.test(String(c.props.children))).length > 0,
  )[0];
  return press(add);
}

function pressFavorite(renderer: ReactTestRenderer) {
  const fav = renderer.root.findAll(
    (n: ReactTestInstance) =>
      (n.type as unknown) === 'TouchableOpacity'
      && n.findAll((c: ReactTestInstance) => (c.type as unknown) === 'Icon'
        && (c.props.name === 'heart' || c.props.name === 'heart-outline')).length > 0,
  )[0];
  return press(fav);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.favoritesApi.addFavorite.mockResolvedValue({});
  mocks.nutritionDiaryService.addItem.mockResolvedValue({ meal: { items: [{ id: 'new-1' }] } });
});

afterEach(() => {
  while (renderers.length) {
    const renderer = renderers.pop()!;
    act(() => renderer.unmount());
  }
});

describe('QuantityView imageUrl guard', () => {
  it('sends a remote image URL to addFavorite and addItem', async () => {
    const renderer = renderView(product({ imageUrl: 'https://example.invalid/oats.jpg' }));

    await pressFavorite(renderer);
    await pressAdd(renderer);

    expect(mocks.favoritesApi.addFavorite).toHaveBeenCalledWith(
      expect.objectContaining({ imageUrl: 'https://example.invalid/oats.jpg' }),
    );
    expect(mocks.nutritionDiaryService.addItem).toHaveBeenCalledWith(
      'meal-1',
      expect.objectContaining({ imageUrl: 'https://example.invalid/oats.jpg' }),
    );
  });

  it('never sends a blob path as imageUrl to addFavorite', async () => {
    const renderer = renderView(product({ imageUrl: 'user-1/item-1.jpg' }));

    await pressFavorite(renderer);

    expect(mocks.favoritesApi.addFavorite).toHaveBeenCalledTimes(1);
    expect(mocks.favoritesApi.addFavorite).toHaveBeenCalledWith(expect.objectContaining({ imageUrl: null }));
  });

  it('never sends a blob path as imageUrl to addItem', async () => {
    const renderer = renderView(product({ imageUrl: 'user-1/item-1.jpg' }));

    await pressAdd(renderer);

    expect(mocks.nutritionDiaryService.addItem).toHaveBeenCalledTimes(1);
    expect(mocks.nutritionDiaryService.addItem).toHaveBeenCalledWith(
      'meal-1',
      expect.objectContaining({ imageUrl: null }),
    );
  });

  it('sends null when the product has no image', async () => {
    const renderer = renderView(product({}));

    await pressAdd(renderer);

    expect(mocks.nutritionDiaryService.addItem).toHaveBeenCalledWith(
      'meal-1',
      expect.objectContaining({ imageUrl: null }),
    );
  });
});
