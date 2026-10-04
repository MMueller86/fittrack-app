import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_RECIPE_IMAGE_HERO_CROP } from '@fittrack/shared';
import type { CommunityRecipe, Recipe, UserFoodRelation } from '@fittrack/shared';
import RecipeListScreen from './RecipeListScreen';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  recipeApi: {
    list: vi.fn(),
    listCommunity: vi.fn(),
    getCommunityImage: vi.fn(),
  },
  favoritesApi: {
    listFavorites: vi.fn(),
    addFavorite: vi.fn(),
    removeFavorite: vi.fn(),
  },
}));

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  RefreshControl: 'RefreshControl',
  ScrollView: 'ScrollView',
  StyleSheet: {
    absoluteFillObject: {},
    create: <T,>(styles: T) => styles,
  },
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));

vi.mock('@react-navigation/native', async () => {
  const ReactModule = await import('react');
  return {
    useFocusEffect: (effect: () => void | (() => void)) => ReactModule.useEffect(() => effect(), [effect]),
  };
});

vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('../../shared/api/recipeApi', () => ({ recipeApi: mocks.recipeApi }));
vi.mock('../../shared/api/favoritesApi', () => ({ favoritesApi: mocks.favoritesApi }));
vi.mock('../../shared/components/Icon', () => ({ Icon: 'Icon' }));
vi.mock('../../shared/components/InfoOverlay', () => ({ InfoOverlay: 'InfoOverlay' }));
vi.mock('./RecipeImageHeroImage', () => ({ RecipeImageHeroImage: 'RecipeImageHeroImage' }));

const zeroNutrition = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

function makeRecipe(id: string, visibility: Recipe['visibility']): Recipe {
  return {
    id,
    ownerUserId: 'owner-1',
    name: id,
    portions: 2,
    ingredients: [],
    steps: [],
    images: [],
    nutritionTotal: zeroNutrition,
    nutritionPerPortion: zeroNutrition,
    visibility,
    sharedWithUserIds: [],
    tags: [],
    usageCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeCommunityRecipe(id: string, isOwnRecipe = false): CommunityRecipe {
  return {
    id,
    name: id,
    portions: 2,
    ingredients: [],
    steps: [],
    images: [{
      id: `${id}-image`,
      order: 1,
      heroCrop: DEFAULT_RECIPE_IMAGE_HERO_CROP,
      url: `/api/community-recipes/${id}/images/${id}-image`,
    }],
    nutritionTotal: zeroNutrition,
    nutritionPerPortion: zeroNutrition,
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    authorDisplayName: 'Anonymous',
    isOwnRecipe,
    ingredientNotices: { containsAiEstimates: false, containsManualIngredients: false },
  };
}

function makeUnavailableFavorite(): UserFoodRelation {
  return {
    id: 'user-1:recipe-old',
    userId: 'user-1',
    foodRef: 'recipe-old',
    foodRefType: 'recipe',
    recipeAccess: 'unavailable',
    displayName: 'Altes Rezept',
    isFavorite: true,
    lastUsedAt: null,
    usageCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

type Props = React.ComponentProps<typeof RecipeListScreen>;

async function renderList() {
  const navigation = { navigate: vi.fn() };
  const props = {
    route: { key: 'RecipeList', name: 'RecipeList', params: undefined },
    navigation,
  } as unknown as Props;
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<RecipeListScreen {...props} />);
    await Promise.resolve();
  });
  await settle();
  return { renderer, navigation };
}

async function settle(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 6; index += 1) await Promise.resolve();
  });
}

function visibleText(renderer: ReactTestRenderer): string {
  return renderer.root
    .findAll((node) => node.type === 'Text')
    .map((node) => {
      const children: unknown = node.props.children;
      if (Array.isArray(children)) {
        return children
          .filter((child): child is string | number => typeof child === 'string' || typeof child === 'number')
          .map(String)
          .join('');
      }
      return typeof children === 'string' || typeof children === 'number' ? String(children) : '';
    })
    .join(' ');
}

function findOne(
  renderer: ReactTestRenderer,
  predicate: (node: ReactTestInstance) => boolean,
  description: string,
): ReactTestInstance {
  const matches = renderer.root.findAll(predicate);
  if (matches.length !== 1) throw new Error(`Expected one ${description}, found ${matches.length}`);
  return matches[0]!;
}

async function press(
  renderer: ReactTestRenderer,
  accessibilityLabel: string,
): Promise<void> {
  const button = findOne(
    renderer,
    (node) => node.type === 'TouchableOpacity' && node.props.accessibilityLabel === accessibilityLabel,
    accessibilityLabel,
  );
  await act(async () => {
    const result = (button.props.onPress as (() => unknown) | undefined)?.();
    if (result instanceof Promise) await result;
  });
  await settle();
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.recipeApi.list.mockResolvedValue({ recipes: [] });
  mocks.recipeApi.listCommunity.mockResolvedValue({ recipes: [] });
  mocks.recipeApi.getCommunityImage.mockResolvedValue('data:image/jpeg;base64,ZmFrZQ==');
  mocks.favoritesApi.listFavorites.mockResolvedValue([]);
  mocks.favoritesApi.addFavorite.mockImplementation(async (input: { foodRef: string; displayName: string }) => ({
    ...makeUnavailableFavorite(),
    foodRef: input.foodRef,
    displayName: input.displayName,
    recipeAccess: 'community',
  }));
  mocks.favoritesApi.removeFavorite.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RecipeListScreen', () => {
  it('opens on the owner section and shows private and published status for every recipe', async () => {
    mocks.recipeApi.list.mockResolvedValue({
      recipes: [makeRecipe('Tomatensuppe', 'private'), makeRecipe('Linsenbowl', 'community')],
    });
    const { renderer } = await renderList();

    const ownerTab = findOne(
      renderer,
      (node) => node.type === 'TouchableOpacity' && node.props.accessibilityLabel === 'Deine Rezepte',
      'owner tab',
    );
    const accessibilityState = ownerTab.props.accessibilityState as { selected?: boolean } | undefined;
    expect(accessibilityState?.selected).toBe(true);
    expect(visibleText(renderer)).toContain('Tomatensuppe');
    expect(visibleText(renderer)).toContain('Linsenbowl');
    expect(visibleText(renderer)).toContain('Privat');
    expect(visibleText(renderer)).toContain('Veröffentlicht');
    expect(mocks.recipeApi.listCommunity).not.toHaveBeenCalled();
  });

  it('loads paginated community recipes, opens foreign details as community, and routes own items to owner detail', async () => {
    const foreignRecipe = makeCommunityRecipe('Fremdes Rezept');
    const ownRecipe = makeCommunityRecipe('Eigenes veröffentlichtes Rezept', true);
    mocks.recipeApi.listCommunity
      .mockResolvedValueOnce({ recipes: [foreignRecipe, ownRecipe], continuationToken: 'page-2' })
      .mockResolvedValueOnce({ recipes: [makeCommunityRecipe('Weiteres Rezept')] });
    const { renderer, navigation } = await renderList();

    await press(renderer, 'Community-Rezepte');
    expect(mocks.recipeApi.listCommunity).toHaveBeenNthCalledWith(
      1,
      { limit: 20 },
      expect.any(AbortSignal),
    );
    expect(visibleText(renderer)).toContain('Fremdes Rezept');
    expect(visibleText(renderer)).toContain('Eigenes veröffentlichtes Rezept');
    const thumbnails = renderer.root.findAll((node) => node.type === 'RecipeImageHeroImage');
    expect(thumbnails).toHaveLength(2);
    expect(thumbnails[0]?.props).toMatchObject({
      uri: 'data:image/jpeg;base64,ZmFrZQ==',
      heroCrop: DEFAULT_RECIPE_IMAGE_HERO_CROP,
    });
    expect(mocks.recipeApi.getCommunityImage).toHaveBeenCalledWith(
      foreignRecipe.id,
      foreignRecipe.images[0]?.id,
      expect.any(AbortSignal),
    );
    expect(mocks.recipeApi.getCommunityImage).toHaveBeenCalledWith(
      ownRecipe.id,
      ownRecipe.images[0]?.id,
      expect.any(AbortSignal),
    );

    await press(renderer, 'Rezept öffnen: Fremdes Rezept');
    expect(navigation.navigate).toHaveBeenCalledWith('RecipeDetail', {
      id: 'Fremdes Rezept',
      source: 'community',
    });
    await press(renderer, 'Rezept öffnen: Eigenes veröffentlichtes Rezept');
    expect(navigation.navigate).toHaveBeenCalledWith('RecipeDetail', {
      id: 'Eigenes veröffentlichtes Rezept',
    });

    await press(renderer, 'Mehr Rezepte laden');
    expect(mocks.recipeApi.listCommunity).toHaveBeenNthCalledWith(
      2,
      { limit: 20, continuationToken: 'page-2' },
      expect.any(AbortSignal),
    );
    expect(visibleText(renderer)).toContain('Weiteres Rezept');
  });

  it('keeps the placeholder when a community recipe has no image', async () => {
    const recipe = makeCommunityRecipe('Rezept ohne Bild');
    recipe.images = [];
    mocks.recipeApi.listCommunity.mockResolvedValue({ recipes: [recipe] });
    const { renderer } = await renderList();

    await press(renderer, 'Community-Rezepte');

    expect(mocks.recipeApi.getCommunityImage).not.toHaveBeenCalled();
    expect(renderer.root.findAll((node) => (
      node.type === 'Icon' && node.props.name === 'restaurant-outline'
    ))).toHaveLength(1);
    expect(renderer.root.findAll((node) => node.type === 'RecipeImageHeroImage')).toHaveLength(0);
  });

  it('keeps the placeholder and card actions available when a community image fails to load', async () => {
    const recipe = makeCommunityRecipe('Rezept mit Ladefehler');
    mocks.recipeApi.listCommunity.mockResolvedValue({ recipes: [recipe] });
    mocks.recipeApi.getCommunityImage.mockRejectedValueOnce(new Error('Image request failed'));
    const { renderer, navigation } = await renderList();

    await press(renderer, 'Community-Rezepte');

    expect(renderer.root.findAll((node) => (
      node.type === 'Icon' && node.props.name === 'restaurant-outline'
    ))).toHaveLength(1);
    expect(renderer.root.findAll((node) => node.type === 'RecipeImageHeroImage')).toHaveLength(0);

    await press(renderer, 'Rezept öffnen: Rezept mit Ladefehler');
    expect(navigation.navigate).toHaveBeenCalledWith('RecipeDetail', {
      id: recipe.id,
      source: 'community',
    });
    await press(renderer, 'Zu Favoriten hinzufügen');
    expect(mocks.favoritesApi.addFavorite).toHaveBeenCalledWith({
      foodRef: recipe.id,
      foodRefType: 'recipe',
      displayName: recipe.name,
    });
  });

  it('keeps owner recipe thumbnails on their existing URL', async () => {
    const recipe = makeRecipe('Eigenes Rezept', 'private');
    recipe.images = [{
      id: 'owner-image',
      blobName: 'owner-image.jpg',
      order: 1,
      heroCrop: DEFAULT_RECIPE_IMAGE_HERO_CROP,
      url: 'https://example.test/owner-image.jpg',
    }];
    mocks.recipeApi.list.mockResolvedValue({ recipes: [recipe] });
    const { renderer } = await renderList();

    const thumbnail = findOne(
      renderer,
      (node) => node.type === 'RecipeImageHeroImage',
      'owner recipe thumbnail',
    );
    expect(thumbnail.props).toMatchObject({
      uri: 'https://example.test/owner-image.jpg',
      heroCrop: DEFAULT_RECIPE_IMAGE_HERO_CROP,
    });
    expect(mocks.recipeApi.getCommunityImage).not.toHaveBeenCalled();
  });

  it('keeps unavailable recipe favorites removable without opening the recipe', async () => {
    mocks.favoritesApi.listFavorites.mockResolvedValue([makeUnavailableFavorite()]);
    const { renderer, navigation } = await renderList();
    await press(renderer, 'Community-Rezepte');

    expect(visibleText(renderer)).toContain('Altes Rezept');
    expect(visibleText(renderer)).toContain('Nicht mehr in der Community verfügbar');
    await press(renderer, 'Favorit entfernen');

    expect(mocks.favoritesApi.removeFavorite).toHaveBeenCalledWith('recipe-old');
    expect(visibleText(renderer)).not.toContain('Altes Rezept');
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('ignores an owner-list response that arrives after switching to the community section', async () => {
    let resolveOwnerList!: (response: { recipes: Recipe[] }) => void;
    mocks.recipeApi.list.mockReturnValueOnce(new Promise((resolve) => {
      resolveOwnerList = resolve;
    }));
    mocks.recipeApi.listCommunity.mockResolvedValueOnce({
      recipes: [makeCommunityRecipe('Community-Rezept')],
    });
    const { renderer } = await renderList();

    await press(renderer, 'Community-Rezepte');
    expect(visibleText(renderer)).toContain('Community-Rezept');

    await act(async () => {
      resolveOwnerList({ recipes: [makeRecipe('Verspätetes privates Rezept', 'private')] });
      await Promise.resolve();
    });
    await settle();

    expect(visibleText(renderer)).toContain('Community-Rezept');
    expect(visibleText(renderer)).not.toContain('Verspätetes privates Rezept');
  });
});