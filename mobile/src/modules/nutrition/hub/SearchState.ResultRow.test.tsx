import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FoodSearchResult } from '@fittrack/shared';
import { ResultRow, type ResultRowProps } from './SearchState';
import { FOOD_THUMBNAIL_SIZE } from '../../../shared/components/foodProductSummaryUtils';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  favoritesApi: { addFavorite: vi.fn(), removeFavorite: vi.fn() },
}));

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Image: 'Image',
  Pressable: 'Pressable',
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));
vi.mock('@gorhom/bottom-sheet', () => ({ BottomSheetFlatList: 'BottomSheetFlatList' }));
vi.mock('expo-haptics', () => ({ impactAsync: vi.fn(), ImpactFeedbackStyle: { Light: 'light' } }));
vi.mock('../../../shared/api/favoritesApi', () => ({ favoritesApi: mocks.favoritesApi }));
vi.mock('../../../shared/api/foodApi', () => ({ foodApi: { search: vi.fn() } }));
vi.mock('../../../shared/components/Icon', () => ({ Icon: 'Icon' }));
vi.mock('../../../shared/components/ErrorBanner', () => ({ ErrorBanner: 'ErrorBanner' }));
vi.mock('./RelationRow', () => ({ RelationRow: 'RelationRow' }));

const renderers: ReactTestRenderer[] = [];

function item(overrides: Partial<FoodSearchResult>): FoodSearchResult {
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

function renderRow(result: FoodSearchResult, props: Partial<ResultRowProps> = {}) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<ResultRow item={result} onPress={vi.fn()} {...props} />);
  });
  renderers.push(renderer);
  return renderer;
}

function heart(renderer: ReactTestRenderer): ReactTestInstance {
  return renderer.root.findAll(
    (n: ReactTestInstance) =>
      (n.type as unknown) === 'TouchableOpacity' && n.props.accessibilityLabel === 'Zu Favoriten hinzufuegen',
  )[0]!;
}

async function toggle(renderer: ReactTestRenderer) {
  await act(async () => {
    (heart(renderer).props.onPress as () => void)();
    await Promise.resolve();
  });
}

function heartIconName(renderer: ReactTestRenderer): unknown {
  return renderer.root.findAll((n: ReactTestInstance) => (n.type as unknown) === 'Icon')
    .map((n: ReactTestInstance) => n.props.name)
    .find((name: unknown) => name === 'heart' || name === 'heart-outline');
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  while (renderers.length) {
    const renderer = renderers.pop()!;
    act(() => renderer.unmount());
  }
});

describe('SearchState.ResultRow favorite toggle', () => {
  it('sends a remote image URL to addFavorite', async () => {
    mocks.favoritesApi.addFavorite.mockResolvedValue({});
    const renderer = renderRow(item({ imageUrl: 'https://example.invalid/oats.jpg' }));

    await toggle(renderer);

    expect(mocks.favoritesApi.addFavorite).toHaveBeenCalledWith(
      expect.objectContaining({ foodRef: 'item-1', imageUrl: 'https://example.invalid/oats.jpg' }),
    );
  });

  it('never sends a blob path as imageUrl and keeps the heart toggled', async () => {
    mocks.favoritesApi.addFavorite.mockResolvedValue({});
    const renderer = renderRow(item({ imageUrl: 'user-1/item-1.jpg' }));

    await toggle(renderer);

    expect(mocks.favoritesApi.addFavorite).toHaveBeenCalledTimes(1);
    expect(mocks.favoritesApi.addFavorite).toHaveBeenCalledWith(expect.objectContaining({ imageUrl: null }));
    expect(heartIconName(renderer)).toBe('heart');
  });

  it('sends null when the item has no image', async () => {
    mocks.favoritesApi.addFavorite.mockResolvedValue({});
    const renderer = renderRow(item({}));

    await toggle(renderer);

    expect(mocks.favoritesApi.addFavorite).toHaveBeenCalledWith(expect.objectContaining({ imageUrl: null }));
  });

  it('sends the brand as displayBrand so the favorite keeps its manufacturer', async () => {
    mocks.favoritesApi.addFavorite.mockResolvedValue({});
    const renderer = renderRow(item({ id: 'openFoodFacts:4001', source: 'openFoodFacts', brand: 'Kölln' }));

    await toggle(renderer);

    expect(mocks.favoritesApi.addFavorite).toHaveBeenCalledWith(
      expect.objectContaining({
        foodRef: 'openFoodFacts:4001',
        foodRefType: 'catalog',
        displayName: 'Haferflocken',
        displayBrand: 'Kölln',
      }),
    );
  });

  it('sends no displayBrand for items without a brand', async () => {
    mocks.favoritesApi.addFavorite.mockResolvedValue({});
    const renderer = renderRow(item({}));

    await toggle(renderer);

    expect(mocks.favoritesApi.addFavorite.mock.calls[0]?.[0].displayBrand).toBeUndefined();
  });

  it('reverts the heart when addFavorite fails', async () => {
    mocks.favoritesApi.addFavorite.mockRejectedValue(new Error('400'));
    const renderer = renderRow(item({ imageUrl: 'https://example.invalid/oats.jpg' }));

    await toggle(renderer);

    expect(heartIconName(renderer)).toBe('heart-outline');
  });
});

describe('SearchState.ResultRow layout and interactions', () => {
  it('renders the product thumbnail at 52 pt via FoodProductSummary', () => {
    const renderer = renderRow(item({ imageUrl: 'https://example.invalid/oats.jpg' }));

    const image = renderer.root.findAll((n: ReactTestInstance) => (n.type as unknown) === 'Image')[0]!;
    const style = image.props.style as { width: number; height: number };
    expect(FOOD_THUMBNAIL_SIZE).toBe(52);
    expect(style.width).toBe(FOOD_THUMBNAIL_SIZE);
    expect(style.height).toBe(FOOD_THUMBNAIL_SIZE);
  });

  it('row tap calls only onPress with the item', () => {
    const onPress = vi.fn();
    const result = item({});
    const renderer = renderRow(result, { onPress });

    const row = renderer.root.findAll((n: ReactTestInstance) => (n.type as unknown) === 'Pressable')[0]!;
    act(() => (row.props.onPress as () => void)());

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledWith(result);
    expect(mocks.favoritesApi.addFavorite).not.toHaveBeenCalled();
    expect(mocks.favoritesApi.removeFavorite).not.toHaveBeenCalled();
  });

  it('heart tap calls only favoritesApi and not onPress', async () => {
    mocks.favoritesApi.addFavorite.mockResolvedValue({});
    const onPress = vi.fn();
    const onQuickAccept = vi.fn();
    const renderer = renderRow(item({}), { onPress, quickAcceptLabel: '100 g', onQuickAccept });

    await toggle(renderer);

    expect(mocks.favoritesApi.addFavorite).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
    expect(onQuickAccept).not.toHaveBeenCalled();
  });

  it('quick-accept tap calls only onQuickAccept with the item', () => {
    const onPress = vi.fn();
    const onQuickAccept = vi.fn();
    const result = item({});
    const renderer = renderRow(result, { onPress, quickAcceptLabel: '100 g', onQuickAccept });

    const pill = renderer.root.findAll(
      (n: ReactTestInstance) =>
        (n.type as unknown) === 'TouchableOpacity' && n.props.accessibilityLabel === 'Sofort hinzufügen: 100 g',
    )[0]!;
    act(() => (pill.props.onPress as () => void)());

    expect(onQuickAccept).toHaveBeenCalledTimes(1);
    expect(onQuickAccept).toHaveBeenCalledWith(result);
    expect(onPress).not.toHaveBeenCalled();
    expect(mocks.favoritesApi.addFavorite).not.toHaveBeenCalled();
  });
});
