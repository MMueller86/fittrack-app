import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_RECIPE_IMAGE_HERO_CROP } from '@fittrack/shared';
import type { CommunityRecipe, CommunityRecipeIngredient } from '@fittrack/shared';
import CommunityRecipeDetailScreen from './CommunityRecipeDetailScreen';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  recipeApi: {
    getCommunity: vi.fn(),
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
vi.mock('../../shared/components/NutritionTile', () => ({ NutritionTile: 'NutritionTile' }));
vi.mock('./RecipeIngredientGroup', () => ({ RecipeIngredientGroup: 'RecipeIngredientGroup' }));
vi.mock('./RecipeImageHeroImage', () => ({ RecipeImageHeroImage: 'RecipeImageHeroImage' }));
vi.mock('./LogRecipeModal', () => ({ default: 'LogRecipeModal' }));

const zeroNutrition = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

function makeIngredient(overrides: Partial<CommunityRecipeIngredient> = {}): CommunityRecipeIngredient {
  return {
    id: 'ingredient-1',
    displayName: 'Paprika',
    inputMode: 'grams',
    inputAmount: 120,
    amountGrams: 120,
    unit: 'g',
    isAiEstimate: true,
    nutritionSource: 'ai',
    category: 'food',
    nutritionPer100g: zeroNutrition,
    nutritionContribution: zeroNutrition,
    ...overrides,
  };
}

function makeCommunityRecipe(overrides: Partial<CommunityRecipe> = {}): CommunityRecipe {
  return {
    id: 'recipe-1',
    name: 'Paprikasalat',
    description: 'Frisch und knackig.',
    portions: 2,
    ingredients: [makeIngredient()],
    steps: [{ order: 1, description: 'Paprika schneiden.' }],
    images: [{
      id: 'image-1',
      order: 1,
      heroCrop: DEFAULT_RECIPE_IMAGE_HERO_CROP,
      url: '/api/community-recipes/recipe-1/images/image-1',
    }],
    nutritionTotal: zeroNutrition,
    nutritionPerPortion: zeroNutrition,
    tags: ['Schnell'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    authorDisplayName: '',
    isOwnRecipe: false,
    ingredientNotices: { containsAiEstimates: true, containsManualIngredients: true },
    ...overrides,
  };
}

type DetailProps = React.ComponentProps<typeof CommunityRecipeDetailScreen>;

async function renderDetail() {
  const navigation = { goBack: vi.fn(), navigate: vi.fn() };
  const props = {
    route: {
      key: 'RecipeDetail',
      name: 'RecipeDetail',
      params: { id: 'recipe-1', source: 'community' },
    },
    navigation,
  } as unknown as DetailProps;
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<CommunityRecipeDetailScreen {...props} />);
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

beforeEach(() => {
  vi.resetAllMocks();
  mocks.recipeApi.getCommunity.mockResolvedValue(makeCommunityRecipe());
  mocks.recipeApi.getCommunityImage.mockResolvedValue('data:image/jpeg;base64,dGVzdA==');
  mocks.favoritesApi.listFavorites.mockResolvedValue([]);
  mocks.favoritesApi.addFavorite.mockResolvedValue(undefined);
  mocks.favoritesApi.removeFavorite.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CommunityRecipeDetailScreen', () => {
  it('shows the safe community detail, both provenance notices and authenticated images without owner actions', async () => {
    const { renderer } = await renderDetail();

    const text = visibleText(renderer);
    expect(text).toContain('Paprikasalat');
    expect(text).toContain('Anonymous');
    expect(text).toContain('Enthält KI-Schätzungen');
    expect(text).toContain('Enthält manuell erfasste Zutaten');
    expect(text).toContain('Nährwerte wurden von FitTrack nicht verifiziert.');
    expect(text).toContain('Paprika schneiden.');
    expect(text).not.toMatch(/Bearbeiten|Löschen|Teilen/);
    expect(mocks.recipeApi.getCommunity).toHaveBeenCalledWith('recipe-1', expect.any(AbortSignal));
    expect(mocks.recipeApi.getCommunityImage).toHaveBeenCalledWith(
      'recipe-1',
      'image-1',
      expect.any(AbortSignal),
    );

    const image = findOne(renderer, (node) => node.type === 'RecipeImageHeroImage', 'community image');
    expect(image.props.uri).toBe('data:image/jpeg;base64,dGVzdA==');
    const actionLabels = renderer.root
      .findAll((node) => typeof node.props.accessibilityLabel === 'string')
      .map((node) => node.props.accessibilityLabel);
    expect(actionLabels).not.toContain('Rezept teilen');
    expect(actionLabels).not.toContain('Rezept bearbeiten');
  });

  it('stores only a favorite reference and passes the community DTO to the portion logger', async () => {
    const recipe = makeCommunityRecipe();
    mocks.recipeApi.getCommunity.mockResolvedValue(recipe);
    const { renderer } = await renderDetail();

    const favoriteButton = findOne(
      renderer,
      (node) => node.type === 'TouchableOpacity'
        && node.props.accessibilityLabel === 'Zu Favoriten hinzufügen',
      'add favorite button',
    );
    await act(async () => {
      (favoriteButton.props.onPress as () => void)();
      await Promise.resolve();
    });
    expect(mocks.favoritesApi.addFavorite).toHaveBeenCalledWith({
      foodRef: 'recipe-1',
      foodRefType: 'recipe',
      displayName: 'Paprikasalat',
    });

    const logButton = findOne(
      renderer,
      (node) => node.type === 'TouchableOpacity' && node.props.accessibilityLabel === 'Portion eintragen',
      'portion log button',
    );
    await act(async () => {
      (logButton.props.onPress as () => void)();
    });
    const logModal = findOne(renderer, (node) => node.type === 'LogRecipeModal', 'portion log modal');
    expect(logModal.props.visible).toBe(true);
    expect(logModal.props.recipe).toBe(recipe);
    expect(mocks.favoritesApi.addFavorite.mock.calls[0]?.[0]).not.toHaveProperty('nutritionPer100g');
    expect(mocks.favoritesApi.addFavorite.mock.calls[0]?.[0]).not.toHaveProperty('imageUrl');
  });

  it('removes the detail after a known community recipe becomes unavailable', async () => {
    const { renderer } = await renderDetail();
    mocks.recipeApi.getCommunity.mockRejectedValueOnce({ response: { status: 404 } });

    const logModal = findOne(renderer, (node) => node.type === 'LogRecipeModal', 'portion log modal');
    await act(async () => {
      (logModal.props.onUnavailable as () => void)();
    });
    await settle();

    const text = visibleText(renderer);
    expect(text).toContain('Rezept nicht verfügbar');
    expect(text).not.toContain('Paprikasalat');
    expect(renderer.root.findAll((node) => node.type === 'RecipeImageHeroImage')).toHaveLength(0);
    expect(mocks.recipeApi.getCommunity).toHaveBeenCalledTimes(2);
  });

  it('does not reveal a private recipe through a known community ID', async () => {
    mocks.recipeApi.getCommunity.mockRejectedValueOnce({ response: { status: 404 } });
    const { renderer } = await renderDetail();

    expect(visibleText(renderer)).toContain('Rezept nicht verfügbar');
    expect(visibleText(renderer)).not.toContain('Paprikasalat');
    expect(mocks.recipeApi.getCommunityImage).not.toHaveBeenCalled();
    expect(renderer.root.findAll((node) => node.type === 'LogRecipeModal')).toHaveLength(0);
  });
});