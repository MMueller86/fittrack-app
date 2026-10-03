import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Recipe,
  RecipeExportViewInput,
  RecipeIngredient,
} from '@fittrack/shared';
import type { AiRecipeAnalysis } from '../../shared/api/aiApi';
import type { RecipeStackParamList } from '../../app/navigation/RootNavigator';
import RecipeWizardScreen from './RecipeWizardScreen';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  aiApi: { analyzeRecipe: vi.fn() },
  recipeApi: {
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  showSnackbar: vi.fn(),
  openHub: vi.fn(),
  persistRecipeWizardImages: vi.fn(),
}));

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Alert: { alert: vi.fn() },
  BackHandler: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
  Keyboard: { dismiss: vi.fn() },
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Platform: { OS: 'ios' },
  ScrollView: 'ScrollView',
  StyleSheet: {
    hairlineWidth: 1,
    create: <T,>(styles: T) => styles,
  },
  Text: 'Text',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
  useWindowDimensions: () => ({ height: 800 }),
}));

vi.mock('react-native-reanimated', () => ({
  useSharedValue: (value: number) => ({ value }),
}));

vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'wizard-test-uuid' }));
vi.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
  impactAsync: vi.fn(),
  notificationAsync: vi.fn(),
  selectionAsync: vi.fn(),
}));
vi.mock('../../shared/api/aiApi', () => ({ aiApi: mocks.aiApi }));
vi.mock('../../shared/api/recipeApi', () => ({ recipeApi: mocks.recipeApi }));
vi.mock('../nutrition/hub/useFoodEntryHubStore', () => ({
  useFoodEntryHubStore: () => mocks.openHub,
}));
vi.mock('../../shared/components/Snackbar', () => ({
  Snackbar: 'Snackbar',
  useSnackbar: () => ({ ref: { current: null }, show: mocks.showSnackbar }),
}));
vi.mock('../../shared/components/ConfirmSheet', () => ({ ConfirmSheet: 'ConfirmSheet' }));
vi.mock('../../shared/components/Icon', () => ({ Icon: 'Icon' }));
vi.mock('../../shared/components/InfoOverlay', () => ({ InfoOverlay: 'InfoOverlay' }));
vi.mock('./RecipeImageSourcePicker', () => ({ RecipeImageSourcePicker: 'RecipeImageSourcePicker' }));
vi.mock('./RecipeImageHeroCropEditor', () => ({ RecipeImageHeroCropEditor: 'RecipeImageHeroCropEditor' }));
vi.mock('./recipeWizardImageMutations', () => ({
  persistRecipeWizardImageHeroCrop: vi.fn(),
  persistRecipeWizardImages: mocks.persistRecipeWizardImages,
}));

vi.mock('./RecipeWizardInputPhase', async () => {
  const ReactModule = await import('react');
  return {
    RecipeWizardInputPhase: ({
      inputText,
      onChangeText,
      onAnalyze,
    }: {
      inputText: string;
      onChangeText: (value: string) => void;
      onAnalyze: () => void;
    }) => ReactModule.createElement(
      'View',
      null,
      ReactModule.createElement('TextInput', { value: inputText, onChangeText }),
      ReactModule.createElement('TouchableOpacity', {
        accessibilityLabel: 'start-recipe-analysis',
        onPress: onAnalyze,
      }),
    ),
  };
});

vi.mock('./RecipeWizardIngredientsPhase', () => ({
  RecipeWizardIngredientsPhase: 'RecipeWizardIngredientsPhase',
}));

vi.mock('./RecipeWizardStepsPhase', async () => {
  const ReactModule = await import('react');
  return {
    RecipeWizardStepsPhase: ({ onContinue }: { onContinue: () => void }) => ReactModule.createElement(
      'TouchableOpacity',
      { accessibilityLabel: 'continue-to-preview', onPress: onContinue },
    ),
  };
});

vi.mock('./RecipeWizardPreviewPhase', async () => {
  const ReactModule = await import('react');
  return {
    RecipeWizardPreviewPhase: ({
      onRecipeNameChange,
    }: {
      onRecipeNameChange: (value: string) => void;
    }) => ReactModule.createElement(
      'TouchableOpacity',
      {
        accessibilityLabel: 'change-recipe-name',
        onPress: () => onRecipeNameChange('Paprikasalat geändert'),
      },
    ),
  };
});

const zeroNutrition = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

function makeIngredient(id = 'food-1'): RecipeIngredient {
  return {
    id,
    displayName: 'Paprika',
    inputMode: 'grams',
    inputAmount: 100,
    amountGrams: 100,
    unit: 'g',
    linkedProductId: null,
    linkedReusableItemId: null,
    isAiEstimate: false,
    category: 'food',
    nutritionPer100g: zeroNutrition,
    nutritionContribution: zeroNutrition,
  };
}

function makeExportView(): RecipeExportViewInput & { sourceFingerprint: string } {
  return {
    version: 1,
    teaser: 'Frisch und würzig',
    totalTimeMinutes: 20,
    difficulty: 'Einfach',
    steps: [{ order: 1, description: 'Paprika würfeln.' }],
    includedIngredientIds: ['food-1'],
    sourceFingerprint: 'sha256:server-owned',
  };
}

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'recipe-1',
    ownerUserId: 'user-1',
    name: 'Paprikasalat',
    description: 'Paprika würfeln.',
    portions: 2,
    ingredients: [makeIngredient()],
    steps: [{ order: 1, description: 'Paprika würfeln.' }],
    images: [],
    nutritionTotal: zeroNutrition,
    nutritionPerPortion: zeroNutrition,
    visibility: 'private',
    sharedWithUserIds: [],
    tags: ['Schnell'],
    usageCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeAnalysis(): AiRecipeAnalysis {
  return {
    suggestedName: 'Paprikasalat',
    description: 'Paprika würfeln und würzen.',
    suggestedPortions: 4,
    tags: ['Schnell'],
    steps: [{ order: 1, title: null, description: 'Paprika würfeln.' }],
    ingredients: [{
      analysisKey: 'salt-1',
      rawText: 'Salz',
      displayName: 'Salz',
      status: 'seasoning',
      category: 'seasoning',
      selectedProductId: null,
      selectedProductName: null,
      candidates: [],
      inputMode: 'unknown',
      inputAmount: null,
      amountGrams: null,
      needsReview: false,
      warnings: [],
      kitchenAmountText: '1 Prise',
    }],
    exportSuggestion: {
      version: 1,
      teaser: 'Frisch und würzig',
      totalTimeMinutes: null,
      difficulty: null,
      steps: [{ order: 1, description: 'Paprika würfeln.' }],
      includedIngredientKeys: [],
      sourceFingerprint: 'sha256:analyzer-suggestion',
    },
  };
}

async function settlePromises(): Promise<void> {
  for (let index = 0; index < 6; index += 1) await Promise.resolve();
}

async function renderWizard(params?: RecipeStackParamList['RecipeWizard']) {
  const navigation = { goBack: vi.fn(), replace: vi.fn() };
  const props = {
    route: { key: 'RecipeWizard', name: 'RecipeWizard', params },
    navigation,
  } as unknown as React.ComponentProps<typeof RecipeWizardScreen>;
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<RecipeWizardScreen {...props} />);
    await settlePromises();
  });
  return { renderer, navigation };
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

function findByLabel(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  return findOne(
    renderer,
    (node) => node.props.accessibilityLabel === label,
    `control labeled ${label}`,
  );
}

function findButtonByText(renderer: ReactTestRenderer, text: string): ReactTestInstance {
  return findOne(
    renderer,
    (node) => node.type === 'TouchableOpacity'
      && node.findAll((child) => child.type === 'Text' && child.props.children === text).length > 0,
    `button with text ${text}`,
  );
}

async function press(node: ReactTestInstance): Promise<void> {
  const onPress = node.props.onPress as () => void;
  await act(async () => {
    onPress();
    await settlePromises();
  });
}

async function advanceToPreview(renderer: ReactTestRenderer): Promise<void> {
  await press(findButtonByText(renderer, 'Zur Zubereitung →'));
  await press(findByLabel(renderer, 'continue-to-preview'));
}

beforeEach(() => {
  mocks.aiApi.analyzeRecipe.mockReset();
  mocks.recipeApi.get.mockReset();
  mocks.recipeApi.create.mockReset();
  mocks.recipeApi.update.mockReset();
  mocks.showSnackbar.mockReset();
  mocks.openHub.mockReset();
  mocks.persistRecipeWizardImages.mockReset();
  mocks.persistRecipeWizardImages.mockResolvedValue({
    failedDeleteImageIds: [],
    failedUploadPositions: [],
    reorderFailed: false,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('RecipeWizardScreen ordinary save requests', () => {
  it('omits the export confirmation pair from create and keeps the analyzer suggestion navigation-local', async () => {
    vi.useFakeTimers();
    mocks.aiApi.analyzeRecipe.mockResolvedValue(makeAnalysis());
    mocks.recipeApi.create.mockResolvedValue(makeRecipe());
    const { renderer, navigation } = await renderWizard();

    await act(async () => {
      const onChangeText = findOne(renderer, (node) => node.type === 'TextInput', 'recipe input')
        .props.onChangeText as (value: string) => void;
      onChangeText(
        'Paprikasalat mit Salz und frischen Kräutern.',
      );
    });
    await act(async () => {
      const onAnalyze = findByLabel(renderer, 'start-recipe-analysis').props.onPress as () => void;
      onAnalyze();
      await vi.runOnlyPendingTimersAsync();
      await settlePromises();
    });

    await advanceToPreview(renderer);
    await press(findByLabel(renderer, 'Rezept speichern'));

    const createRequest = mocks.recipeApi.create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(mocks.recipeApi.create).toHaveBeenCalledTimes(1);
    expect(createRequest).toMatchObject({ name: 'Paprikasalat', portions: 4, tags: ['Schnell'] });
    expect(createRequest).not.toHaveProperty('exportView');
    expect(createRequest).not.toHaveProperty('exportViewAction');
    expect(navigation.replace).toHaveBeenCalledWith('RecipeDetail', expect.objectContaining({
      id: 'recipe-1',
      pendingExportDraft: expect.objectContaining({
        teaser: 'Frisch und würzig',
        totalTimeMinutes: null,
        difficulty: null,
      }),
    }));
  });

  it('omits the export confirmation pair from edit requests when a stored export view exists', async () => {
    const storedRecipe = makeRecipe({
      exportView: makeExportView(),
      exportViewStatus: 'current',
    });
    mocks.recipeApi.get.mockResolvedValue(storedRecipe);
    mocks.recipeApi.update.mockResolvedValue(storedRecipe);
    const { renderer } = await renderWizard({ editId: 'recipe-1' });

    await advanceToPreview(renderer);
    await press(findByLabel(renderer, 'change-recipe-name'));
    await press(findByLabel(renderer, 'Rezept speichern'));

    const updateRequest = mocks.recipeApi.update.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(mocks.recipeApi.update).toHaveBeenCalledTimes(1);
    expect(mocks.recipeApi.update).toHaveBeenCalledWith('recipe-1', expect.objectContaining({
      name: 'Paprikasalat geändert',
    }));
    expect(updateRequest).not.toHaveProperty('exportView');
    expect(updateRequest).not.toHaveProperty('exportViewAction');
  });
});