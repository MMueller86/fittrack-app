import React, { type ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DiaryBulkCopyResponse,
  DiaryBulkCopyTarget,
  DiaryDayResponse,
  DiaryItemReference,
  Meal,
  MealItem,
} from '@fittrack/shared';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NutritionStackParamList } from '../../app/navigation/RootNavigator';
import { addLocalDays, getLocalIsoDate } from '../../shared/date/localDate';

const mocks = vi.hoisted(() => ({
  apiGetDay: vi.fn(),
  apiGetProfile: vi.fn(),
  apiSetSpecialActivity: vi.fn(),
  apiRemoveSpecialActivity: vi.fn(),
  apiListAllMeals: vi.fn(),
  apiCreateMeal: vi.fn(),
  apiDeleteMeal: vi.fn(),
  apiAddItem: vi.fn(),
  apiDeleteItem: vi.fn(),
  apiUpdateItem: vi.fn(),
  apiBulkDeleteItems: vi.fn(),
  apiBulkMoveItems: vi.fn(),
  apiBulkCopyItems: vi.fn(),
  syncNutritionUpsert: vi.fn(),
  syncNutritionDelete: vi.fn(),
  syncNutritionDeleteMeal: vi.fn(),
  syncNutritionDeletes: vi.fn(),
  hydrateDayType: vi.fn(),
  setTargets: vi.fn(),
  dayStoryTarget: vi.fn(),
  profileTargets: {
    restDay: {
      calories: 2000,
      proteinG: 150,
      fatG: 70,
      carbsG: 250,
      fiberG: 25,
      macroRanges: {
        proteinG: { minG: 120, maxG: 160 },
        carbsG: { minG: 200, maxG: 300 },
      },
    },
    trainingDay: {
      calories: 2300,
      proteinG: 150,
      fatG: 75,
      carbsG: 325,
      fiberG: 25,
      macroRanges: {
        proteinG: { minG: 120, maxG: 160 },
        carbsG: { minG: 275, maxG: 375 },
      },
    },
  },
  storeHasTargets: true,
  safeAreaTop: 0,
  openFoodEntryHub: vi.fn(),
  showSnackbar: vi.fn(),
}));

vi.mock('../../shared/api/diaryApi', () => ({
  diaryApi: {
    getDay: mocks.apiGetDay,
    setSpecialActivity: mocks.apiSetSpecialActivity,
    removeSpecialActivity: mocks.apiRemoveSpecialActivity,
    listAllMeals: mocks.apiListAllMeals,
    createMeal: mocks.apiCreateMeal,
    deleteMeal: mocks.apiDeleteMeal,
    addItem: mocks.apiAddItem,
    deleteItem: mocks.apiDeleteItem,
    updateItem: mocks.apiUpdateItem,
    bulkDeleteItems: mocks.apiBulkDeleteItems,
    bulkMoveItems: mocks.apiBulkMoveItems,
    bulkCopyItems: mocks.apiBulkCopyItems,
  },
}));

vi.mock('../../shared/api/profileApi', () => ({
  profileApi: { getMe: mocks.apiGetProfile },
}));

vi.mock('../../services/health/nutritionSyncService', () => ({
  nutritionSyncService: {
    syncNutritionUpsert: mocks.syncNutritionUpsert,
    syncNutritionDelete: mocks.syncNutritionDelete,
    syncNutritionDeleteMeal: mocks.syncNutritionDeleteMeal,
    syncNutritionDeletes: mocks.syncNutritionDeletes,
  },
}));

vi.mock('@react-navigation/native', () => ({ useFocusEffect: () => undefined }));
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(),
  notificationAsync: vi.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Warning: 'warning' },
}));
vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Modal: 'Modal',
  RefreshControl: 'RefreshControl',
  ScrollView: 'ScrollView',
  StyleSheet: { absoluteFillObject: {}, create: (styles: object) => styles },
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: mocks.safeAreaTop, right: 0, bottom: 0, left: 0 }),
}));
vi.mock('react-native-gesture-handler', () => {
  const createGesture = () => {
    const gesture = {
      activeOffsetX: () => gesture,
      failOffsetY: () => gesture,
      onEnd: () => gesture,
    };
    return gesture;
  };

  return {
    Gesture: { Pan: createGesture },
    GestureDetector: ({ children }: { children?: ReactNode }) => children ?? null,
  };
});
vi.mock('react-native-reanimated', () => ({
  default: { View: 'AnimatedView' },
  runOnJS: (callback: () => void) => callback,
  useAnimatedStyle: (factory: () => unknown) => factory(),
  useSharedValue: (value: number) => ({ value }),
  withTiming: (value: number) => value,
}));

vi.mock('../../shared/components/DayStoryCard', () => ({
  DayStoryCard: ({ target }: { target: unknown }) => {
    mocks.dayStoryTarget(target);
    return null;
  },
}));
vi.mock('../../shared/components/Icon', () => ({ Icon: () => null }));
vi.mock('../../shared/components/Snackbar', () => ({
  Snackbar: () => null,
  useSnackbar: () => ({ ref: { current: null }, show: mocks.showSnackbar }),
}));
vi.mock('../../shared/components/SwipeableRow', async () => {
  const ReactModule = await import('react');
  return {
    SwipeableRow: ({ children }: { children?: ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
  };
});
vi.mock('../../shared/components/DiaryItemRow', async () => {
  const ReactModule = await import('react');
  type Props = {
    name: string;
    selectionMode?: boolean;
    selected?: boolean;
    onPress?: () => void;
    onLongPress?: () => void;
    onToggleSelection?: () => void;
  };

  return {
    DiaryItemRow: ({ name, selectionMode, selected, onPress, onLongPress, onToggleSelection }: Props) =>
      ReactModule.createElement(
        'TouchableOpacity',
        {
          accessibilityLabel: selectionMode
            ? `${name}, ${selected ? 'ausgewählt' : 'nicht ausgewählt'}`
            : `edit:${name}`,
          testID: selected ? `diary-item-selected:${name}` : `diary-item-not-selected:${name}`,
          onPress: selectionMode ? onToggleSelection : onPress,
          onLongPress,
        },
        ReactModule.createElement('Text', null, name),
      ),
  };
});
vi.mock('../../shared/components/ConfirmSheet', async () => {
  const ReactModule = await import('react');
  type Props = {
    visible: boolean;
    actions: { label: string; onPress: () => void }[];
    onClose: () => void;
    onDismiss?: () => void;
  };

  return {
    ConfirmSheet: ({ visible, actions, onClose, onDismiss }: Props) => visible
      ? ReactModule.createElement(
          'View',
          null,
          ...actions.map((action) => ReactModule.createElement(
            'TouchableOpacity',
            {
              key: action.label,
              accessibilityLabel: `confirm:${action.label}`,
              onPress: () => {
                onClose();
                action.onPress();
              },
            },
            ReactModule.createElement('Text', null, action.label),
          )),
          ReactModule.createElement('TouchableOpacity', {
            accessibilityLabel: 'confirm:cancel',
            onPress: () => {
              onDismiss?.();
              onClose();
            },
          }, ReactModule.createElement('Text', null, 'Abbrechen')),
        )
      : null,
  };
});
vi.mock('./useDayTypeStore', () => ({
  useDayTypeStore: () => ({
    dayType: 'rest',
    targets: mocks.storeHasTargets ? mocks.profileTargets : null,
    setTargets: mocks.setTargets,
    hydrateDayType: mocks.hydrateDayType,
  }),
}));
vi.mock('./hub/useFoodEntryHubStore', () => ({ useFoodEntryHubStore: () => mocks.openFoodEntryHub }));
vi.mock('./EditItemSheet', async () => {
  const ReactModule = await import('react');
  type Props = {
    visible: boolean;
    item: MealItem;
    onMoveRequest: (item: MealItem) => void;
    onCopyRequest: (item: MealItem) => void;
  };

  return {
    default: ({ visible, item, onMoveRequest, onCopyRequest }: Props) => visible
      ? ReactModule.createElement(
          ReactModule.Fragment,
          null,
          ReactModule.createElement('TouchableOpacity', {
            accessibilityLabel: `open-single-move:${item.id}`,
            onPress: () => onMoveRequest(item),
          }),
          ReactModule.createElement('TouchableOpacity', {
            accessibilityLabel: `open-single-copy:${item.id}`,
            onPress: () => onCopyRequest(item),
          }),
        )
      : null,
  };
});
vi.mock('./CopyItemSheet', async () => {
  const ReactModule = await import('react');
  type Props = {
    visible: boolean;
    sourceDate: string;
    items: DiaryItemReference[];
    onCopy: (
      items: DiaryItemReference[],
      targetDate: string,
      target: DiaryBulkCopyTarget,
    ) => Promise<DiaryBulkCopyResponse | null>;
    onClose: () => void;
  };

  return {
    default: ({ visible, sourceDate, items, onCopy, onClose }: Props) => visible
      ? ReactModule.createElement(
          'View',
          null,
          ReactModule.createElement('Text', { accessibilityLabel: 'copy-sheet-source-date' }, sourceDate),
          ReactModule.createElement('Text', { accessibilityLabel: 'copy-sheet-item-references' }, JSON.stringify(items)),
          ReactModule.createElement('TouchableOpacity', {
            accessibilityLabel: 'copy-sheet-cancel',
            onPress: onClose,
          }),
          ReactModule.createElement('TouchableOpacity', {
            accessibilityLabel: 'copy-sheet-existing-target',
            onPress: async () => {
              const result = await onCopy(items, '2026-08-14', { mealId: 'target-meal' });
              if (result) onClose();
            },
          }),
          ReactModule.createElement('TouchableOpacity', {
            accessibilityLabel: 'copy-sheet-same-day-target',
            onPress: async () => {
              const result = await onCopy(items, sourceDate, { mealId: items[0]?.mealId ?? 'target-meal' });
              if (result) onClose();
            },
          }),
        )
      : null,
  };
});
vi.mock('./components/ActivityBonusSheet', () => ({ ActivityBonusSheet: () => null }));

import DiaryScreen from './DiaryScreen';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type ScreenProps = NativeStackScreenProps<NutritionStackParamList, 'DiaryMain'>;

const DATE = '2026-08-13';
const activeRenderers: ReactTestRenderer[] = [];

function makeItem(id: string, name = id): MealItem {
  return {
    id,
    name,
    sourceType: 'manual',
    quantity: 100,
    unit: 'g',
    macros: { calories: 100, protein: 10, carbs: 10, fat: 5, fiber: 2 },
  };
}

function makeMeal(id: string, type: Meal['type'], name: string, items: MealItem[], date = DATE): Meal {
  return {
    id,
    userId: 'user-1',
    date,
    type,
    name,
    items,
    createdAt: `${date}T12:00:00.000Z`,
  };
}

function makeDay(meals: Meal[]): DiaryDayResponse {
  return {
    meals,
    summary: { calories: 300, protein: 30, carbs: 40, fat: 8, fiber: 5 },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function getByLabel(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  const matches = renderer.root.findAll((node) => node.props.accessibilityLabel === label);
  if (matches.length !== 1) {
    throw new Error(`Expected one element with accessibilityLabel ${label}, found ${matches.length}`);
  }
  return matches[0]!;
}

function queryByLabel(renderer: ReactTestRenderer, label: string): ReactTestInstance | undefined {
  return renderer.root.findAll((node) => node.props.accessibilityLabel === label)[0];
}

function getMealOptionsButton(renderer: ReactTestRenderer): ReactTestInstance {
  const button = renderer.root.findAll((node) => typeof node.props.accessibilityLabel === 'string'
    && node.props.accessibilityLabel.startsWith('Optionen für '))[0];
  if (!button) throw new Error('Expected a meal options button');
  return button;
}

async function startSelectionModeFromMealOptions(renderer: ReactTestRenderer): Promise<void> {
  await press(getMealOptionsButton(renderer));
  await press(getByLabel(renderer, 'confirm:Einträge auswählen'));
}

function getMoveTargetButton(renderer: ReactTestRenderer, mealName: string): ReactTestInstance {
  const modals = renderer.root.findAll((node) => node.type === 'Modal');
  if (modals.length !== 1) throw new Error(`Expected one MoveItemSheet modal, found ${modals.length}`);
  const modal = modals[0]!;
  const matches = modal.findAll((node: ReactTestInstance) => node.type === 'TouchableOpacity'
    && node.findAll((child: ReactTestInstance) => child.type === 'Text' && child.props.children === mealName).length > 0);
  if (matches.length !== 1) {
    throw new Error(`Expected one move target named ${mealName}, found ${matches.length}`);
  }
  return matches[0]!;
}

function getMoveCancelButton(renderer: ReactTestRenderer): ReactTestInstance {
  const modals = renderer.root.findAll((node) => node.type === 'Modal');
  if (modals.length !== 1) throw new Error(`Expected one MoveItemSheet modal, found ${modals.length}`);
  const matches = modals[0]!.findAll((node: ReactTestInstance) => node.type === 'TouchableOpacity'
    && node.findAll((child: ReactTestInstance) => child.type === 'Text' && child.props.children === 'Abbrechen').length > 0);
  if (matches.length !== 1) throw new Error(`Expected one MoveItemSheet cancel button, found ${matches.length}`);
  return matches[0]!;
}

async function flushAsyncWork(): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
  });
}

async function press(instance: ReactTestInstance): Promise<void> {
  const onPress = instance.props.onPress as (() => unknown) | undefined;
  if (!onPress) throw new Error('Expected an onPress handler');
  await act(async () => {
    await onPress();
    for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
  });
}

async function longPress(instance: ReactTestInstance): Promise<void> {
  const onLongPress = instance.props.onLongPress as (() => unknown) | undefined;
  if (!onLongPress) throw new Error('Expected an onLongPress handler');
  await act(async () => {
    await onLongPress();
    for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
  });
}

async function renderScreenWithRouteDate(responses: DiaryDayResponse[], initialDate = DATE): Promise<{
  renderer: ReactTestRenderer;
  updateRouteDate: (date: string) => Promise<void>;
}> {
  let responseIndex = 0;
  mocks.apiGetDay.mockImplementation(async () => {
    const result = responses[Math.min(responseIndex, responses.length - 1)];
    responseIndex += 1;
    return result;
  });

  const navigation = { setParams: vi.fn() } as unknown as ScreenProps['navigation'];
  let setRouteDate!: (date: string) => void;
  function RouteHarness() {
    const [date, updateDate] = React.useState(initialDate);
    setRouteDate = updateDate;
    const route = {
      key: 'diary-route',
      name: 'DiaryMain',
      params: { date },
    } as ScreenProps['route'];
    return <DiaryScreen navigation={navigation} route={route} />;
  }

  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<RouteHarness />);
  });
  activeRenderers.push(renderer);
  await flushAsyncWork();

  const updateRouteDate = async (date: string) => {
    await act(async () => setRouteDate(date));
    await flushAsyncWork();
  };

  return { renderer, updateRouteDate };
}

async function renderScreen(responses: DiaryDayResponse[]): Promise<ReactTestRenderer> {
  const { renderer } = await renderScreenWithRouteDate(responses);
  return renderer;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.safeAreaTop = 0;
  mocks.storeHasTargets = true;
  mocks.apiGetProfile.mockResolvedValue({ targets: mocks.profileTargets });
  mocks.syncNutritionUpsert.mockResolvedValue(undefined);
  mocks.syncNutritionDelete.mockResolvedValue(undefined);
  mocks.syncNutritionDeleteMeal.mockResolvedValue(undefined);
  mocks.syncNutritionDeletes.mockResolvedValue(undefined);
});

afterEach(() => {
  while (activeRenderers.length > 0) {
    const renderer = activeRenderers.pop()!;
    act(() => renderer.unmount());
  }
});

describe('DiaryScreen F2 bulk actions', () => {
  it('does not show Health Connect status in diary entries', async () => {
    const renderer = await renderScreen([makeDay([
      makeMeal('meal-1', 'breakfast', 'Frühstück', [makeItem('item-1', 'Haferflocken')]),
    ])]);
    const visibleText = renderer.root.findAll((node) => node.type === 'Text')
      .map((node) => typeof node.props.children === 'string' ? node.props.children : '')
      .join(' ');

    expect(visibleText).toContain('Haferflocken');
    expect(visibleText).not.toMatch(/Health Connect|Synchronisationsstatus|Ausstehende Löschungen|Letzter erfolgreicher Abgleich/);
  });

  it('puts date navigation below the Home search row and uses the same sheet inset', async () => {
    mocks.safeAreaTop = 24;
    const renderer = await renderScreen([makeDay([])]);
    const orderedHeaderText = renderer.root.findAll((node) => (
      node.type === 'Text'
      && (node.props.children === 'Lebensmittel hinzufügen' || node.props.testID === 'diary-date-label')
    ));
    expect(orderedHeaderText).toHaveLength(2);
    expect(orderedHeaderText[0]!.props.children).toBe('Lebensmittel hinzufügen');
    expect(orderedHeaderText[1]!.props.testID).toBe('diary-date-label');

    const dateControls = renderer.root.findAll((node) => (
      node.type === 'Text' && node.props.testID === 'diary-date-label'
      || node.type === 'TouchableOpacity' && (
        node.props.accessibilityLabel === 'Vorheriger Tag'
        || node.props.accessibilityLabel === 'Nächster Tag'
      )
    ));
    expect(dateControls.map((node) => node.props.testID ?? node.props.accessibilityLabel)).toEqual([
      'diary-date-label', 'Vorheriger Tag', 'Nächster Tag',
    ]);

    expect(renderer.root.findAll((node) => node.props.children === 'Lebensmittel hinzufügen')).toHaveLength(1);
    expect(renderer.root.findAll((node) => node.props.children === 'KI')).toHaveLength(1);
    const actionCaptions = renderer.root.findAll((node) => (
      node.props.children === 'Schätzen' || node.props.children === 'Scan'
    ));
    expect(actionCaptions.map((caption) => caption.props.children)).toEqual(['Schätzen', 'Scan']);
    expect(actionCaptions.every((caption) => caption.props.numberOfLines === 1)).toBe(true);

    await press(getByLabel(renderer, 'Lebensmittel hinzufügen'));
    expect(mocks.openFoodEntryHub).toHaveBeenLastCalledWith(expect.objectContaining({
      date: DATE,
      topInset: 24,
      onSuccess: expect.any(Function),
    }));

    mocks.openFoodEntryHub.mockClear();
    await press(getByLabel(renderer, 'KI schätzen'));
    expect(mocks.openFoodEntryHub).toHaveBeenLastCalledWith(expect.objectContaining({
      date: DATE,
      initialSubflow: 'ai',
      autoCloseOnSave: true,
      topInset: 24,
    }));

    mocks.openFoodEntryHub.mockClear();
    await press(getByLabel(renderer, 'Barcode scannen'));
    expect(mocks.openFoodEntryHub).toHaveBeenLastCalledWith(expect.objectContaining({
      date: DATE,
      initialSubflow: 'barcode',
      autoCloseOnSave: true,
      topInset: 24,
    }));
  });

  it('does not show current profile macro targets for a historical diary day', async () => {
    const historicalDate = addLocalDays(getLocalIsoDate(), -1);
    await renderScreenWithRouteDate([makeDay([])], historicalDate);

    expect(mocks.dayStoryTarget).toHaveBeenLastCalledWith(null);
  });

  it('uses the selected profile-day ranges for today', async () => {
    const today = getLocalIsoDate();
    await renderScreenWithRouteDate([{ ...makeDay([]), dayType: 'training' }], today);

    expect(mocks.dayStoryTarget).toHaveBeenLastCalledWith(mocks.profileTargets.trainingDay);
  });

  it('loads profile ranges when today is opened before the profile store is hydrated', async () => {
    mocks.storeHasTargets = false;
    const today = getLocalIsoDate();
    await renderScreenWithRouteDate([{ ...makeDay([]), dayType: 'training' }], today);

    expect(mocks.apiGetProfile).toHaveBeenCalledTimes(1);
    expect(mocks.dayStoryTarget).toHaveBeenLastCalledWith(mocks.profileTargets.trainingDay);
  });

    it('renders the German meal label when the API meal name is English', async () => {
      const renderer = await renderScreen([makeDay([
        makeMeal('meal-breakfast', 'breakfast', 'Breakfast', [makeItem('item-1', 'Haferflocken')]),
      ])]);

      expect(getMealOptionsButton(renderer).props.accessibilityLabel).toBe('Optionen für Frühstück');
      expect(renderer.root.findAll((node) => node.type === 'Text' && node.props.children === 'Frühstück')).not.toHaveLength(0);
      expect(renderer.root.findAll((node) => node.type === 'Text' && node.props.children === 'Breakfast')).toHaveLength(0);
    });

    it('starts selection from a long press and selects that item immediately', async () => {
      const item = makeItem('item-1', 'Haferflocken');
      const renderer = await renderScreen([makeDay([
        makeMeal('meal-breakfast', 'breakfast', 'Frühstück', [item]),
      ])]);

      await longPress(getByLabel(renderer, 'edit:Haferflocken'));

      expect(getByLabel(renderer, 'Haferflocken, ausgewählt')).toBeDefined();
      expect(getByLabel(renderer, '1 Eintrag ausgewählt')).toBeDefined();
      expect(getByLabel(renderer, 'Mehrfachauswahl beenden')).toBeDefined();
    });

    it('offers selection from meal options and leaves entries unselected initially', async () => {
      const firstItem = makeItem('item-1', 'Haferflocken');
      const secondItem = makeItem('item-2', 'Joghurt');
      const renderer = await renderScreen([makeDay([
        makeMeal('meal-breakfast', 'breakfast', 'Frühstück', [firstItem, secondItem]),
      ])]);

      await press(getMealOptionsButton(renderer));
      expect(getByLabel(renderer, 'confirm:Einträge auswählen')).toBeDefined();
      expect(getByLabel(renderer, 'confirm:Mahlzeit löschen')).toBeDefined();
      await press(getByLabel(renderer, 'confirm:Einträge auswählen'));

      expect(getByLabel(renderer, 'Haferflocken, nicht ausgewählt')).toBeDefined();
      expect(getByLabel(renderer, 'Joghurt, nicht ausgewählt')).toBeDefined();
      expect(getByLabel(renderer, '0 Einträge ausgewählt')).toBeDefined();
    });

    it('keeps meal deletion behind its existing confirmation from the options menu', async () => {
      const meal = makeMeal('meal-breakfast', 'breakfast', 'Frühstück', [makeItem('item-1', 'Haferflocken')]);
      const renderer = await renderScreen([makeDay([meal])]);

      await press(getMealOptionsButton(renderer));
      await press(getByLabel(renderer, 'confirm:Mahlzeit löschen'));

      expect(mocks.apiDeleteMeal).not.toHaveBeenCalled();
      expect(getByLabel(renderer, 'confirm:Mahlzeit löschen')).toBeDefined();

      await press(getByLabel(renderer, 'confirm:Mahlzeit löschen'));
      expect(mocks.apiDeleteMeal).toHaveBeenCalledWith(meal.id);
    });

  it('clears selection mode and selected references when the route date changes', async () => {
    const nextDate = '2026-08-14';
    const item = makeItem('item-1', 'Haferflocken');
    const firstDay = makeDay([makeMeal('meal-breakfast', 'breakfast', 'Frühstück', [item], DATE)]);
    const nextDay = makeDay([makeMeal('meal-breakfast', 'breakfast', 'Frühstück', [item], nextDate)]);
    const { renderer, updateRouteDate } = await renderScreenWithRouteDate([firstDay, nextDay]);

    await startSelectionModeFromMealOptions(renderer);
    await press(getByLabel(renderer, 'Haferflocken, nicht ausgewählt'));

    expect(getByLabel(renderer, 'Haferflocken, ausgewählt')).toBeDefined();
    expect(getByLabel(renderer, '1 Eintrag ausgewählt')).toBeDefined();
    expect(renderer.root.findAll((node) => node.props.testID === 'diary-item-selected:Haferflocken')).toHaveLength(1);

    await updateRouteDate(nextDate);

    expect(mocks.apiGetDay).toHaveBeenNthCalledWith(1, DATE);
    expect(mocks.apiGetDay).toHaveBeenNthCalledWith(2, nextDate);
    expect(queryByLabel(renderer, 'Mehrfachauswahl beenden')).toBeUndefined();
    expect(queryByLabel(renderer, '1 Eintrag ausgewählt')).toBeUndefined();
    expect(renderer.root.findAll((node) => node.props.testID === 'diary-item-selected:Haferflocken')).toHaveLength(0);
    expect(renderer.root.findAll((node) => node.props.testID === 'diary-item-not-selected:Haferflocken')).toHaveLength(1);
  });

  it('clears selection when the bulk-delete confirmation is cancelled', async () => {
    const item = makeItem('item-1', 'Haferflocken');
    const before = makeDay([makeMeal('meal-breakfast', 'breakfast', 'Frühstück', [item])]);

    const renderer = await renderScreen([before]);
    await startSelectionModeFromMealOptions(renderer);
    await press(getByLabel(renderer, 'Haferflocken, nicht ausgewählt'));
    await press(getByLabel(renderer, 'Löschen'));
    await press(getByLabel(renderer, 'confirm:cancel'));

    expect(mocks.apiBulkDeleteItems).not.toHaveBeenCalled();
    expect(queryByLabel(renderer, 'Mehrfachauswahl beenden')).toBeUndefined();
    await startSelectionModeFromMealOptions(renderer);
    expect(getByLabel(renderer, 'Haferflocken, nicht ausgewählt')).toBeDefined();
  });

  it('reloads and resets selection after commit, syncing only deleted IDs', async () => {
    const firstItem = makeItem('item-1', 'Haferflocken');
    const secondItem = makeItem('item-2', 'Joghurt');
    const before = makeDay([makeMeal('meal-breakfast', 'breakfast', 'Frühstück', [firstItem, secondItem])]);
    const after = makeDay([makeMeal('meal-breakfast', 'breakfast', 'Frühstück', [secondItem])]);
    const commit = deferred<{ deletedCount: number; deletedItemIds: string[] }>();
    mocks.apiBulkDeleteItems.mockReturnValue(commit.promise);

    const renderer = await renderScreen([before, after]);
    await startSelectionModeFromMealOptions(renderer);
    await press(getByLabel(renderer, 'Haferflocken, nicht ausgewählt'));
    await press(getByLabel(renderer, 'Löschen'));
    await press(getByLabel(renderer, 'confirm:Eintrag löschen'));

    expect(mocks.apiBulkDeleteItems).toHaveBeenCalledTimes(1);
    expect(mocks.syncNutritionDelete).not.toHaveBeenCalled();

    commit.resolve({ deletedCount: 1, deletedItemIds: ['item-1'] });
    await flushAsyncWork();

    expect(mocks.apiBulkDeleteItems).toHaveBeenCalledWith({
      sourceDate: DATE,
      items: [{ mealId: 'meal-breakfast', itemId: 'item-1' }],
    });
    expect(mocks.apiGetDay).toHaveBeenCalledTimes(2);
    expect(mocks.apiGetDay).toHaveBeenNthCalledWith(2, DATE);
    expect(mocks.syncNutritionDeletes).toHaveBeenCalledWith(['item-1']);
    expect(mocks.syncNutritionUpsert).not.toHaveBeenCalled();
    expect(mocks.apiAddItem).not.toHaveBeenCalled();
    expect(mocks.apiDeleteItem).not.toHaveBeenCalled();
    expect(getMealOptionsButton(renderer)).toBeDefined();
    await startSelectionModeFromMealOptions(renderer);
    expect(getByLabel(renderer, 'Joghurt, nicht ausgewählt')).toBeDefined();
  });

  it('uses the same bulk-move endpoint for one item and an existing same-day target', async () => {
    const sourceItem = makeItem('item-source', 'Haferflocken');
    const existingTargetItem = makeItem('item-existing', 'Apfel');
    const movedItem = makeItem('item-moved', 'Haferflocken');
    const restoredItem = makeItem('item-restored', 'Haferflocken');
    const sourceBefore = makeMeal('meal-breakfast', 'breakfast', 'Frühstück', [sourceItem]);
    const targetBefore = makeMeal('meal-dinner', 'dinner', 'Abendessen', [existingTargetItem]);
    const targetAfter = makeMeal('meal-dinner', 'dinner', 'Abendessen', [existingTargetItem, movedItem]);
    const sourceAfterUndo = makeMeal('meal-breakfast', 'breakfast', 'Frühstück', [restoredItem]);
    const before = makeDay([sourceBefore, targetBefore]);
    const after = makeDay([makeMeal('meal-breakfast', 'breakfast', 'Frühstück', []), targetAfter]);
    const afterUndo = makeDay([sourceAfterUndo, targetBefore]);
    mocks.apiBulkMoveItems
      .mockResolvedValueOnce({
        movedCount: 1,
        removedItemIds: ['item-source'],
        targetMeal: targetAfter,
      })
      .mockResolvedValueOnce({
        movedCount: 1,
        removedItemIds: ['item-moved'],
        targetMeal: sourceAfterUndo,
      });

    const renderer = await renderScreen([before, after, afterUndo]);
    await press(getByLabel(renderer, 'edit:Haferflocken'));
    await press(getByLabel(renderer, 'open-single-move:item-source'));
    await press(getMoveTargetButton(renderer, 'Abendessen'));

    expect(mocks.apiBulkMoveItems).toHaveBeenCalledTimes(1);
    expect(mocks.apiBulkMoveItems).toHaveBeenCalledWith({
      sourceDate: DATE,
      items: [{ mealId: 'meal-breakfast', itemId: 'item-source' }],
      target: { mealId: 'meal-dinner' },
    });
    expect(mocks.apiCreateMeal).not.toHaveBeenCalled();
    expect(mocks.apiAddItem).not.toHaveBeenCalled();
    expect(mocks.apiDeleteItem).not.toHaveBeenCalled();
    expect(mocks.apiGetDay).toHaveBeenCalledTimes(2);
    expect(mocks.syncNutritionDeletes).toHaveBeenCalledWith(['item-source']);
    expect(mocks.syncNutritionUpsert).toHaveBeenCalledWith(targetAfter, ['item-moved']);

    const moveSnackbar = mocks.showSnackbar.mock.calls
      .map(([config]) => config)
      .find((config) => config.message === '1 Eintrag nach Abendessen verschoben.');
    expect(moveSnackbar).toMatchObject({ undoLabel: 'Rückgängig', durationMs: 5000 });
    expect(moveSnackbar?.onUndo).toEqual(expect.any(Function));
    await act(async () => { await moveSnackbar?.onUndo?.(); });

    expect(mocks.apiBulkMoveItems).toHaveBeenNthCalledWith(2, {
      sourceDate: DATE,
      items: [{ mealId: 'meal-dinner', itemId: 'item-moved' }],
      target: { mealId: 'meal-breakfast' },
    });
    expect(mocks.apiGetDay).toHaveBeenCalledTimes(3);
    expect(mocks.syncNutritionDeletes).toHaveBeenCalledWith(['item-moved']);
    expect(mocks.syncNutritionUpsert).toHaveBeenCalledWith(sourceAfterUndo, ['item-restored']);
  });

  it('undoes a move into a new meal and deletes that meal only after it is empty', async () => {
    const sourceItem = makeItem('item-source', 'Haferflocken');
    const movedItem = makeItem('item-moved', 'Haferflocken');
    const restoredItem = makeItem('item-restored', 'Haferflocken');
    const sourceBefore = makeMeal('meal-breakfast', 'breakfast', 'Frühstück', [sourceItem]);
    const sourceEmpty = makeMeal('meal-breakfast', 'breakfast', 'Frühstück', []);
    const createdTarget = makeMeal('meal-lunch', 'lunch', 'Mittagessen', [movedItem]);
    const emptyTarget = makeMeal('meal-lunch', 'lunch', 'Mittagessen', []);
    const sourceAfterUndo = makeMeal('meal-breakfast', 'breakfast', 'Frühstück', [restoredItem]);
    const before = makeDay([sourceBefore]);
    const afterMove = makeDay([sourceEmpty, createdTarget]);
    const afterUndo = makeDay([sourceAfterUndo, emptyTarget]);
    mocks.apiBulkMoveItems
      .mockResolvedValueOnce({
        movedCount: 1,
        removedItemIds: ['item-source'],
        targetMeal: createdTarget,
      })
      .mockResolvedValueOnce({
        movedCount: 1,
        removedItemIds: ['item-moved'],
        targetMeal: sourceAfterUndo,
      });

    const renderer = await renderScreen([before, afterMove, afterUndo, afterUndo]);
    await press(getByLabel(renderer, 'edit:Haferflocken'));
    await press(getByLabel(renderer, 'open-single-move:item-source'));
    await press(getMoveTargetButton(renderer, 'Mittagessen'));

    const moveSnackbar = mocks.showSnackbar.mock.calls
      .map(([config]) => config)
      .find((config) => config.message === '1 Eintrag nach Mittagessen verschoben.');
    expect(moveSnackbar?.onUndo).toEqual(expect.any(Function));
    await act(async () => { await moveSnackbar?.onUndo?.(); });

    expect(mocks.apiBulkMoveItems).toHaveBeenNthCalledWith(2, {
      sourceDate: DATE,
      items: [{ mealId: 'meal-lunch', itemId: 'item-moved' }],
      target: { mealId: 'meal-breakfast' },
    });
    expect(mocks.apiDeleteMeal).toHaveBeenCalledWith('meal-lunch');
    expect(mocks.syncNutritionDeleteMeal).toHaveBeenCalledWith(emptyTarget);
  });

  it('moves the complete selection once, reloads, resets selection, and syncs only affected IDs', async () => {
    const firstItem = makeItem('item-1', 'Haferflocken');
    const secondItem = makeItem('item-2', 'Joghurt');
    const existingTargetItem = makeItem('item-existing', 'Apfel');
    const firstMovedItem = makeItem('item-moved-1', 'Haferflocken');
    const secondMovedItem = makeItem('item-moved-2', 'Joghurt');
    const sourceBefore = makeMeal('meal-breakfast', 'breakfast', 'Frühstück', [firstItem, secondItem]);
    const targetBefore = makeMeal('meal-dinner', 'dinner', 'Abendessen', [existingTargetItem]);
    const targetAfter = makeMeal('meal-dinner', 'dinner', 'Abendessen', [
      existingTargetItem,
      firstMovedItem,
      secondMovedItem,
    ]);
    const before = makeDay([sourceBefore, targetBefore]);
    const after = makeDay([
      makeMeal('meal-breakfast', 'breakfast', 'Frühstück', []),
      targetAfter,
    ]);
    mocks.apiBulkMoveItems.mockResolvedValue({
      movedCount: 2,
      removedItemIds: ['item-1', 'item-2'],
      targetMeal: targetAfter,
    });

    const renderer = await renderScreen([before, after]);
    await startSelectionModeFromMealOptions(renderer);
    await press(getByLabel(renderer, 'Haferflocken, nicht ausgewählt'));
    await press(getByLabel(renderer, 'Joghurt, nicht ausgewählt'));
    await press(getByLabel(renderer, 'Verschieben'));
    await press(getMoveTargetButton(renderer, 'Abendessen'));

    expect(mocks.apiBulkMoveItems).toHaveBeenCalledTimes(1);
    expect(mocks.apiBulkMoveItems).toHaveBeenCalledWith({
      sourceDate: DATE,
      items: [
        { mealId: 'meal-breakfast', itemId: 'item-1' },
        { mealId: 'meal-breakfast', itemId: 'item-2' },
      ],
      target: { mealId: 'meal-dinner' },
    });
    expect(mocks.apiGetDay).toHaveBeenCalledTimes(2);
    expect(mocks.apiGetDay).toHaveBeenNthCalledWith(2, DATE);
    expect(mocks.syncNutritionDeletes).toHaveBeenCalledWith(['item-1', 'item-2']);
    expect(mocks.syncNutritionUpsert).toHaveBeenCalledWith(targetAfter, ['item-moved-1', 'item-moved-2']);
    expect(mocks.apiCreateMeal).not.toHaveBeenCalled();
    expect(mocks.apiAddItem).not.toHaveBeenCalled();
    expect(mocks.apiDeleteItem).not.toHaveBeenCalled();
    expect(getMealOptionsButton(renderer)).toBeDefined();
  });

  it('clears selection when backing out of Move without sending a request', async () => {
    const item = makeItem('item-1', 'Haferflocken');
    const before = makeDay([makeMeal('meal-breakfast', 'breakfast', 'Frühstück', [item])]);

    const renderer = await renderScreen([before]);
    await startSelectionModeFromMealOptions(renderer);
    await press(getByLabel(renderer, 'Haferflocken, nicht ausgewählt'));
    await press(getByLabel(renderer, 'Verschieben'));
    await press(getMoveCancelButton(renderer));

    expect(mocks.apiBulkMoveItems).not.toHaveBeenCalled();
    expect(queryByLabel(renderer, 'Mehrfachauswahl beenden')).toBeUndefined();
    await startSelectionModeFromMealOptions(renderer);
    expect(getByLabel(renderer, 'Haferflocken, nicht ausgewählt')).toBeDefined();
  });

  it('reloads after a move conflict and retains valid selection for retry', async () => {
    const item = makeItem('item-1', 'Haferflocken');
    const sourceMeal = makeMeal('meal-breakfast', 'breakfast', 'Frühstück', [item]);
    const targetMeal = makeMeal('meal-dinner', 'dinner', 'Abendessen', [makeItem('item-target', 'Apfel')]);
    const before = makeDay([sourceMeal, targetMeal]);
    mocks.apiBulkMoveItems.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: 'diary_bulk_conflict' } },
    });

    const renderer = await renderScreen([before, before]);
    await startSelectionModeFromMealOptions(renderer);
    await press(getByLabel(renderer, 'Haferflocken, nicht ausgewählt'));
    await press(getByLabel(renderer, 'Verschieben'));
    await press(getMoveTargetButton(renderer, 'Abendessen'));

    expect(mocks.apiGetDay).toHaveBeenCalledTimes(2);
    expect(mocks.showSnackbar).toHaveBeenCalledWith({
      message: 'Das Tagebuch wurde gleichzeitig geändert. Die Ansicht wurde aktualisiert. Bitte prüfe deine Auswahl und versuche es erneut.',
    });
    expect(queryByLabel(renderer, 'Mehrfachauswahl beenden')).toBeDefined();
    expect(getByLabel(renderer, 'Haferflocken, ausgewählt')).toBeDefined();
    expect(mocks.syncNutritionDelete).not.toHaveBeenCalled();
    expect(mocks.syncNutritionUpsert).not.toHaveBeenCalled();
  });

  it('reloads after a conflict, shows its concrete message, and keeps only valid selected references', async () => {
    const firstItem = makeItem('item-1', 'Haferflocken');
    const secondItem = makeItem('item-2', 'Joghurt');
    const before = makeDay([makeMeal('meal-breakfast', 'breakfast', 'Frühstück', [firstItem, secondItem])]);
    const after = makeDay([makeMeal('meal-breakfast', 'breakfast', 'Frühstück', [firstItem])]);
    mocks.apiBulkDeleteItems.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: 'diary_bulk_conflict' } },
    });

    const renderer = await renderScreen([before, after]);
    await startSelectionModeFromMealOptions(renderer);
    await press(getByLabel(renderer, 'Haferflocken, nicht ausgewählt'));
    await press(getByLabel(renderer, 'Joghurt, nicht ausgewählt'));
    await press(getByLabel(renderer, 'Löschen'));
    await press(getByLabel(renderer, 'confirm:Einträge löschen'));
    await flushAsyncWork();

    expect(mocks.apiGetDay).toHaveBeenCalledTimes(2);
    expect(mocks.apiGetDay).toHaveBeenNthCalledWith(2, DATE);
    expect(mocks.showSnackbar).toHaveBeenCalledWith({
      message: 'Das Tagebuch wurde gleichzeitig geändert. Die Ansicht wurde aktualisiert. Bitte prüfe deine Auswahl und versuche es erneut.',
    });
    expect(queryByLabel(renderer, 'Mehrfachauswahl beenden')).toBeDefined();
    expect(getByLabel(renderer, 'Haferflocken, ausgewählt')).toBeDefined();
    expect(queryByLabel(renderer, 'Joghurt, ausgewählt')).toBeUndefined();
    expect(mocks.syncNutritionDelete).not.toHaveBeenCalled();
    expect(mocks.syncNutritionUpsert).not.toHaveBeenCalled();
  });

  it("copies yesterday's complete selection to today with one explicit target and reloads the source date", async () => {
    const firstItem = makeItem('item-1', 'Haferflocken');
    const secondItem = makeItem('item-2', 'Joghurt');
    const before = makeDay([
      makeMeal('meal-breakfast', 'breakfast', 'Frühstück', [firstItem]),
      makeMeal('meal-lunch', 'lunch', 'Mittagessen', [secondItem]),
    ]);
    const targetMeal = makeMeal(
      'target-meal',
      'dinner',
      'Abendessen',
      [makeItem('copy-1'), makeItem('copy-2')],
      '2026-08-14',
    );
    mocks.apiBulkCopyItems.mockResolvedValue({ copiedCount: 2, targetMeal });

    const renderer = await renderScreen([before, before]);
    await startSelectionModeFromMealOptions(renderer);
    await press(getByLabel(renderer, 'Haferflocken, nicht ausgewählt'));
    await press(getByLabel(renderer, 'Joghurt, nicht ausgewählt'));
    await press(getByLabel(renderer, 'Kopieren'));

    expect(getByLabel(renderer, 'copy-sheet-source-date').props.children).toBe(DATE);
    expect(getByLabel(renderer, 'copy-sheet-item-references').props.children).toBe(JSON.stringify([
      { mealId: 'meal-breakfast', itemId: 'item-1' },
      { mealId: 'meal-lunch', itemId: 'item-2' },
    ]));
    await press(getByLabel(renderer, 'copy-sheet-existing-target'));

    expect(mocks.apiBulkCopyItems).toHaveBeenCalledTimes(1);
    expect(mocks.apiBulkCopyItems).toHaveBeenCalledWith({
      sourceDate: DATE,
      targetDate: '2026-08-14',
      items: [
        { mealId: 'meal-breakfast', itemId: 'item-1' },
        { mealId: 'meal-lunch', itemId: 'item-2' },
      ],
      target: { mealId: 'target-meal' },
    });
    expect(mocks.apiGetDay).toHaveBeenCalledTimes(2);
    expect(mocks.apiGetDay).toHaveBeenNthCalledWith(2, DATE);
    expect(mocks.apiCreateMeal).not.toHaveBeenCalled();
    expect(mocks.apiAddItem).not.toHaveBeenCalled();
    expect(mocks.apiDeleteItem).not.toHaveBeenCalled();
    expect(mocks.syncNutritionUpsert).toHaveBeenCalledWith(targetMeal, ['copy-1', 'copy-2']);
    expect(getMealOptionsButton(renderer)).toBeDefined();
  });

  it('copies to the source meal on the same day and syncs only the copied item ID', async () => {
    const sourceItem = makeItem('item-source', 'Haferflocken');
    const copiedItem = makeItem('copy-1', 'Haferflocken');
    const sourceMeal = makeMeal('meal-breakfast', 'breakfast', 'Frühstück', [sourceItem]);
    const targetMeal = makeMeal('meal-breakfast', 'breakfast', 'Frühstück', [sourceItem, copiedItem]);
    const before = makeDay([sourceMeal]);
    mocks.apiBulkCopyItems.mockResolvedValue({ copiedCount: 1, targetMeal });

    const renderer = await renderScreen([before, before]);
    await press(getByLabel(renderer, 'edit:Haferflocken'));
    await press(getByLabel(renderer, 'open-single-copy:item-source'));
    expect(getByLabel(renderer, 'copy-sheet-source-date').props.children).toBe(DATE);
    await press(getByLabel(renderer, 'copy-sheet-same-day-target'));

    expect(mocks.apiBulkCopyItems).toHaveBeenCalledTimes(1);
    expect(mocks.apiBulkCopyItems).toHaveBeenCalledWith({
      sourceDate: DATE,
      targetDate: DATE,
      items: [{ mealId: sourceMeal.id, itemId: sourceItem.id }],
      target: { mealId: sourceMeal.id },
    });
    expect(mocks.apiGetDay).toHaveBeenCalledTimes(2);
    expect(mocks.apiGetDay).toHaveBeenNthCalledWith(2, DATE);
    expect(mocks.syncNutritionUpsert).toHaveBeenCalledWith(targetMeal, ['copy-1']);
    expect(mocks.syncNutritionDelete).not.toHaveBeenCalled();
    expect(mocks.apiCreateMeal).not.toHaveBeenCalled();
    expect(mocks.apiAddItem).not.toHaveBeenCalled();
    expect(mocks.apiDeleteItem).not.toHaveBeenCalled();
  });

  it('clears selection when backing out of Copy without sending a request', async () => {
    const item = makeItem('item-1', 'Haferflocken');
    const before = makeDay([makeMeal('meal-breakfast', 'breakfast', 'Frühstück', [item])]);

    const renderer = await renderScreen([before]);
    await startSelectionModeFromMealOptions(renderer);
    await press(getByLabel(renderer, 'Haferflocken, nicht ausgewählt'));
    await press(getByLabel(renderer, 'Kopieren'));
    await press(getByLabel(renderer, 'copy-sheet-cancel'));

    expect(mocks.apiBulkCopyItems).not.toHaveBeenCalled();
    expect(queryByLabel(renderer, 'Mehrfachauswahl beenden')).toBeUndefined();
    await startSelectionModeFromMealOptions(renderer);
    expect(getByLabel(renderer, 'Haferflocken, nicht ausgewählt')).toBeDefined();
  });

  it('routes a single-item copy from edit through the same snapshot-copy endpoint', async () => {
    const sourceItem = makeItem('item-source', 'Haferflocken');
    const before = makeDay([
      makeMeal('meal-breakfast', 'breakfast', 'Frühstück', [sourceItem]),
    ]);
    const targetMeal = makeMeal(
      'target-meal',
      'dinner',
      'Abendessen',
      [makeItem('copy-1')],
      '2026-08-14',
    );
    mocks.apiBulkCopyItems.mockResolvedValue({ copiedCount: 1, targetMeal });

    const renderer = await renderScreen([before, before]);
    await press(getByLabel(renderer, 'edit:Haferflocken'));
    await press(getByLabel(renderer, 'open-single-copy:item-source'));
    expect(getByLabel(renderer, 'copy-sheet-item-references').props.children).toBe(JSON.stringify([
      { mealId: 'meal-breakfast', itemId: 'item-source' },
    ]));
    await press(getByLabel(renderer, 'copy-sheet-existing-target'));

    expect(mocks.apiBulkCopyItems).toHaveBeenCalledTimes(1);
    expect(mocks.apiBulkCopyItems).toHaveBeenCalledWith({
      sourceDate: DATE,
      targetDate: '2026-08-14',
      items: [{ mealId: 'meal-breakfast', itemId: 'item-source' }],
      target: { mealId: 'target-meal' },
    });
    expect(mocks.apiGetDay).toHaveBeenNthCalledWith(2, DATE);
    expect(mocks.apiCreateMeal).not.toHaveBeenCalled();
    expect(mocks.apiAddItem).not.toHaveBeenCalled();
  });

  it('reloads the source date and keeps valid selection after a copy conflict', async () => {
    const firstItem = makeItem('item-1', 'Haferflocken');
    const secondItem = makeItem('item-2', 'Joghurt');
    const before = makeDay([
      makeMeal('meal-breakfast', 'breakfast', 'Frühstück', [firstItem, secondItem]),
    ]);
    const after = makeDay([
      makeMeal('meal-breakfast', 'breakfast', 'Frühstück', [firstItem]),
    ]);
    mocks.apiBulkCopyItems.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: 'diary_bulk_conflict' } },
    });

    const renderer = await renderScreen([before, after]);
    await startSelectionModeFromMealOptions(renderer);
    await press(getByLabel(renderer, 'Haferflocken, nicht ausgewählt'));
    await press(getByLabel(renderer, 'Joghurt, nicht ausgewählt'));
    await press(getByLabel(renderer, 'Kopieren'));
    await press(getByLabel(renderer, 'copy-sheet-existing-target'));

    expect(mocks.apiGetDay).toHaveBeenCalledTimes(2);
    expect(mocks.apiGetDay).toHaveBeenNthCalledWith(2, DATE);
    expect(mocks.showSnackbar).toHaveBeenCalledWith({
      message: 'Das Tagebuch wurde gleichzeitig geändert. Die Ansicht wurde aktualisiert. Bitte prüfe deine Auswahl und versuche es erneut.',
    });
    expect(queryByLabel(renderer, 'Mehrfachauswahl beenden')).toBeDefined();
    expect(getByLabel(renderer, 'Haferflocken, ausgewählt')).toBeDefined();
    expect(queryByLabel(renderer, 'Joghurt, ausgewählt')).toBeUndefined();
    expect(mocks.syncNutritionUpsert).not.toHaveBeenCalled();
    expect(mocks.syncNutritionDelete).not.toHaveBeenCalled();
  });
});