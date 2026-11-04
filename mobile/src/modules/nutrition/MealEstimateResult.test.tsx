import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiMealEstimatePreview } from '@fittrack/shared';
import MealEstimateResult from './MealEstimateResult';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  estimateMeal: vi.fn(),
  previewMeal: vi.fn(),
  addItem: vi.fn(),
  showSnackbar: vi.fn(),
}));

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Image: 'Image',
  Keyboard: { dismiss: vi.fn() },
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Modal: 'Modal',
  Platform: { OS: 'android' },
  ScrollView: 'ScrollView',
  StyleSheet: { absoluteFill: {}, create: <T,>(styles: T) => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(),
  selectionAsync: vi.fn(),
  notificationAsync: vi.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Warning: 'warning' },
}));
vi.mock('react-native-reanimated', () => ({
  default: { View: 'AnimatedView' },
  useAnimatedStyle: (factory: () => object) => factory(),
  useSharedValue: (value: number) => ({ value }),
  withTiming: (value: number) => value,
}));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
vi.mock('../../shared/api/aiApi', () => ({
  aiApi: { estimateMeal: mocks.estimateMeal, previewMeal: mocks.previewMeal },
}));
vi.mock('../../shared/api/apiError', () => ({ formatApiError: () => 'Anfrage fehlgeschlagen' }));
vi.mock('../../shared/api/client', () => ({ isQuotaExceededError: () => false }));
vi.mock('../../services/nutritionDiaryService', () => ({ nutritionDiaryService: { addItem: mocks.addItem } }));
vi.mock('../../shared/components/ErrorBanner', () => ({ ErrorBanner: 'ErrorBanner' }));
vi.mock('../../shared/components/Icon', () => ({ Icon: 'Icon' }));
vi.mock('../../shared/components/Snackbar', async () => {
  const ReactModule = await import('react');
  return {
    Snackbar: ReactModule.forwardRef(() => null),
    useSnackbar: () => ({ ref: { current: null }, show: mocks.showSnackbar }),
  };
});

const V1_ESTIMATE: AiMealEstimatePreview = {
  mealName: 'Reis mit Gemüse',
  mealEstimate: { calories: 420, protein: 12, carbs: 75, fat: 8, fiber: 6 },
  components: ['Reis', 'Gemüse'],
  contextDetected: null,
  portionConfidence: 'medium',
  photoUsed: false,
  assumptions: [],
  warnings: [],
};

const V2_ESTIMATE: AiMealEstimatePreview = {
  ...V1_ESTIMATE,
  componentItems: [{ name: 'Reis', estimatedGrams: 250, calories: 325 }],
  estimatedTotalGrams: 320,
  promptVersion: 'meal-estimate-v2',
};

const UPDATED_ESTIMATE: AiMealEstimatePreview = {
  ...V2_ESTIMATE,
  mealName: 'Reis mit Gemüse und Käse',
  mealEstimate: { calories: 500, protein: 18, carbs: 72, fat: 14, fiber: 6 },
};

const renderers: ReactTestRenderer[] = [];

function nodes(renderer: ReactTestRenderer, type: string): ReactTestInstance[] {
  return renderer.root.findAll((node) => (node.type as unknown) === type);
}

function button(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  const match = nodes(renderer, 'TouchableOpacity').find((node) => node.props.accessibilityLabel === label);
  if (!match) throw new Error(`Button "${label}" nicht gefunden`);
  return match;
}

function renderText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(renderText).join('');
  return '';
}

function containsText(renderer: ReactTestRenderer, text: string): boolean {
  return nodes(renderer, 'Text').some((node) => renderText(node.props.children) === text);
}

function invoke(node: ReactTestInstance, property: string, ...args: unknown[]) {
  const callback: unknown = node.props[property];
  if (typeof callback !== 'function') throw new Error(`Event "${property}" fehlt`);
  return Reflect.apply(callback, node, args);
}

function makeResult(
  estimate: AiMealEstimatePreview,
  options: { includePhoto?: boolean; onSaved?: () => void } = {},
) {
  return (
    <MealEstimateResult
      visible
      estimate={estimate}
      originalText="Reis mit Gemüse"
      {...(options.includePhoto === false ? {} : { imageUri: '/meal.jpg', imageMimeType: 'image/jpeg' as const })}
      mealId="meal-1"
      onClose={vi.fn()}
      onSaved={options.onSaved ?? vi.fn()}
      onRefine={vi.fn()}
    />
  );
}

function saveButton(renderer: ReactTestRenderer): ReactTestInstance {
  const match = nodes(renderer, 'TouchableOpacity').find((node) => node.findAll((child) => (
    child.type === 'Text' && renderText(child.props.children) === 'Speichern'
  )).length > 0);
  if (!match) throw new Error('Speichern-Schaltfläche nicht gefunden');
  return match;
}

beforeEach(() => {
  mocks.estimateMeal.mockReset().mockResolvedValue(UPDATED_ESTIMATE);
  mocks.previewMeal.mockReset();
  mocks.addItem.mockReset();
  mocks.showSnackbar.mockReset();
});

afterEach(() => {
  renderers.splice(0).forEach((renderer) => act(() => renderer.unmount()));
  vi.clearAllMocks();
});

describe('MealEstimateResult re-estimation', () => {
  it('disables re-estimation when a V1 response has no complete structured snapshot', async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(makeResult(V1_ESTIMATE)); });
    renderers.push(renderer);

    expect(button(renderer, 'Stimmt nicht ganz? Neu schätzen').props.disabled).toBe(true);
    expect(nodes(renderer, 'TouchableOpacity').some((node) => node.props.accessibilityLabel === 'Portion größer')).toBe(false);
  });

  it('sends the latest AI snapshot, not locally adjusted values, with the original text and photo', async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(makeResult(V2_ESTIMATE)); });
    renderers.push(renderer);

    await act(async () => { invoke(button(renderer, 'Portion um fünf Prozent erhöhen'), 'onPress'); });
    await act(async () => { invoke(button(renderer, 'Stimmt nicht ganz? Neu schätzen'), 'onPress'); });
    await act(async () => { invoke(button(renderer, 'Portion größer'), 'onPress'); });
    await act(async () => { await invoke(button(renderer, 'Neu schätzen bestätigen'), 'onPress'); });

    expect(mocks.estimateMeal).toHaveBeenCalledWith('Reis mit Gemüse', '/meal.jpg', 'image/jpeg', {
      previous: {
        mealName: V2_ESTIMATE.mealName,
        estimatedTotalGrams: V2_ESTIMATE.estimatedTotalGrams,
        mealEstimate: V2_ESTIMATE.mealEstimate,
        componentItems: V2_ESTIMATE.componentItems,
      },
      hints: ['larger'],
    });
    expect(mocks.showSnackbar).toHaveBeenCalledWith({
      message: 'KI-Schätzung aktualisiert. Deine Anpassungen wurden zurückgesetzt.',
    });
    const calories = renderer.root.findAll((node) => node.type === 'TextInput'
      && node.props.accessibilityLabel === 'Kalorien')[0];
    expect(calories?.props.value).toBe('500');
    expect(containsText(renderer, '100 %')).toBe(true);
  });

  it('shows success feedback when re-estimation succeeds without local adjustments', async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(makeResult(V2_ESTIMATE)); });
    renderers.push(renderer);

    await act(async () => { invoke(button(renderer, 'Stimmt nicht ganz? Neu schätzen'), 'onPress'); });
    await act(async () => { invoke(button(renderer, 'Portion kleiner'), 'onPress'); });
    await act(async () => { await invoke(button(renderer, 'Neu schätzen bestätigen'), 'onPress'); });

    expect(mocks.showSnackbar).toHaveBeenCalledWith({ message: 'Neu geschätzt' });
  });
});

describe('MealEstimateResult photo use', () => {
  it.each([
    [
      'consistent',
      { photoProvided: true, photoAssessment: 'consistent', photoUse: 'included', photoUsed: true },
      'Das Foto passt zur Beschreibung und wurde für die Nährwertschätzung genutzt.',
      true,
    ],
    [
      'complementary',
      { photoProvided: true, photoAssessment: 'complementary', photoUse: 'included', photoUsed: true },
      'Das Foto ergänzt die Beschreibung und wurde für die Nährwertschätzung genutzt.',
      true,
    ],
    [
      'contradictory',
      { photoProvided: true, photoAssessment: 'contradictory', photoUse: 'excluded_mismatch', photoUsed: false },
        'Beschreibung und Foto scheinen nicht zusammenzupassen. Die Schätzung basiert nur auf deiner Beschreibung. Prüfe bitte, ob du das richtige Foto ausgewählt hast.',
      true,
    ],
    [
      'uncertain',
      { photoProvided: true, photoAssessment: 'uncertain', photoUse: 'excluded_uncertain', photoUsed: false },
        'Das Foto ließ sich nicht sicher zuordnen und wurde für die Schätzung nicht verwendet. Bitte prüfe, ob es zur Beschreibung passt.',
      true,
    ],
    [
      'no photo',
      { photoProvided: false, photoAssessment: 'no_photo', photoUse: 'no_photo', photoUsed: false },
      'Kein Foto übermittelt. Die Nährwertschätzung basiert auf deiner Beschreibung.',
      false,
    ],
  ] as const)('explains the structured %s photo state', async (_state, photoFields, notice, includePhoto) => {
    const warning = photoFields.photoUse === 'excluded_mismatch'
      ? 'Beschreibung und Foto scheinen nicht zusammenzupassen. Die Schätzung basiert nur auf deiner Beschreibung. Prüfe bitte, ob du das richtige Foto ausgewählt hast.'
      : photoFields.photoUse === 'excluded_uncertain'
        ? 'Das Foto ließ sich nicht sicher zuordnen und wurde für die Schätzung nicht verwendet. Bitte prüfe, ob es zur Beschreibung passt.'
        : undefined;
    const estimate: AiMealEstimatePreview = {
      ...V2_ESTIMATE,
      ...photoFields,
      warnings: warning === undefined ? [] : [warning, 'Zusätzliche Nährwertwarnung'],
    };
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(makeResult(estimate, { includePhoto })); });
    renderers.push(renderer);

    expect(nodes(renderer, 'Text').filter((node) => renderText(node.props.children) === notice)).toHaveLength(1);
    if (warning !== undefined) expect(containsText(renderer, 'Zusätzliche Nährwertwarnung')).toBe(true);
  });

  it('does not infer photo exclusion from assessment alone and still saves the text-only estimate', async () => {
    const onSaved = vi.fn();
    const estimate: AiMealEstimatePreview = {
      ...V2_ESTIMATE,
      photoProvided: true,
      photoAssessment: 'contradictory',
      photoUsed: false,
    };
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(makeResult(estimate, { onSaved })); });
    renderers.push(renderer);

    expect(containsText(renderer, 'Beschreibung und Foto scheinen nicht zusammenzupassen. Die Schätzung basiert nur auf deiner Beschreibung. Prüfe bitte, ob du das richtige Foto ausgewählt hast.')).toBe(false);
    expect(saveButton(renderer).props.disabled).not.toBe(true);
    await act(async () => { await invoke(saveButton(renderer), 'onPress'); });

    expect(mocks.addItem).toHaveBeenCalledWith('meal-1', expect.objectContaining({
      sourceType: 'ai-meal-estimate',
      aiMealEstimatePhotoUsed: false,
    }));
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it('persists photoUsed=true only for an estimate that used the photo', async () => {
    const estimate: AiMealEstimatePreview = {
      ...V2_ESTIMATE,
      photoProvided: true,
      photoAssessment: 'consistent',
      photoUse: 'included',
      photoUsed: true,
    };
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(makeResult(estimate)); });
    renderers.push(renderer);

    await act(async () => { await invoke(saveButton(renderer), 'onPress'); });

    expect(mocks.addItem).toHaveBeenCalledWith('meal-1', expect.objectContaining({
      aiMealEstimatePhotoUsed: true,
    }));
  });
});
