import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WeightEntry } from '@fittrack/shared';

const mocks = vi.hoisted(() => ({
  addWeight: vi.fn(),
  deleteWeight: vi.fn(),
  listWeights: vi.fn(),
  updateWeight: vi.fn(),
  syncWeightUpsert: vi.fn(),
  syncWeightDelete: vi.fn(),
  getMe: vi.fn(),
  dismiss: vi.fn(),
}));
const platform = vi.hoisted(() => ({ OS: 'android' as 'android' | 'ios' }));

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Keyboard: { dismiss: mocks.dismiss },
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Modal: 'Modal',
  Platform: platform,
  RefreshControl: 'RefreshControl',
  ScrollView: 'ScrollView',
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
  useWindowDimensions: () => ({ width: 390 }),
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));
vi.mock('../../services/weightsService', () => ({
  addWeight: mocks.addWeight,
  deleteWeight: mocks.deleteWeight,
  listWeights: mocks.listWeights,
  updateWeight: mocks.updateWeight,
}));
vi.mock('../../services/health/healthSyncService', () => ({
  healthSyncService: {
    syncWeightUpsert: mocks.syncWeightUpsert,
    syncWeightDelete: mocks.syncWeightDelete,
  },
}));
vi.mock('../../shared/api/profileApi', () => ({ profileApi: { getMe: mocks.getMe } }));
vi.mock('../../shared/components/ErrorBanner', () => ({ ErrorBanner: 'ErrorBanner' }));
vi.mock('../../shared/components/WeightChart', () => ({ WeightChart: 'WeightChart' }));
vi.mock('../../shared/components/ConfirmSheet', () => ({ ConfirmSheet: 'ConfirmSheet' }));
vi.mock('../../shared/components/Icon', () => ({ Icon: 'Icon' }));
vi.mock('../../shared/components/SwipeableRow', () => ({ SwipeableRow: 'SwipeableRow' }));
vi.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'AnimatedView' },
  useAnimatedStyle: (createStyle: () => object) => createStyle(),
  useSharedValue: (value: number) => ({ value }),
  withTiming: (value: number) => value,
}));

import ProgressScreen from './ProgressScreen';
import { ProgressCalendar } from './ProgressCalendar';
import { ProgressHeroCard, WeightEntryForm, type ProgressHeroCardProps, type WeightEntryFormProps } from '../../shared/components/ProgressHeroCard';
import { HistoryList, type HistoryListProps } from '../../shared/components/HistoryList';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const activeRenderers: ReactTestRenderer[] = [];

type TouchableTestInstance = ReactTestRenderer['root'] extends { findAll: (...args: never[]) => infer T }
  ? T extends Array<infer U> ? U & { props: { onPress: () => void } } : never
  : never;

function getTextContent(node: ReactTestInstance): string {
  return (node as ReactTestInstance & { children: Array<string | ReactTestInstance> }).children
    .map((child) => typeof child === 'string' ? child : getTextContent(child))
    .join('');
}

function weightEntry(id: string, date: string, value: number): WeightEntry {
  return {
    id,
    userId: 'user-1',
    date,
    value,
    unit: 'kg',
    createdAt: `${date}T08:00:00.000Z`,
  };
}

function findTouchable(renderer: ReactTestRenderer, label: string): TouchableTestInstance {
  const node = renderer.root.findAll((candidate) => candidate.type === 'TouchableOpacity'
    && candidate.props.accessibilityLabel === label)[0];
  if (!node) throw new Error(`Touchable not found: ${label}`);
  return node as TouchableTestInstance;
}

function findTouchableByText(renderer: ReactTestRenderer, text: string): TouchableTestInstance {
  const node = renderer.root.findAll((candidate) => candidate.type === 'TouchableOpacity'
    && getTextContent(candidate) === text)[0];
  if (!node) throw new Error(`Touchable not found for text: ${text}`);
  return node as TouchableTestInstance;
}

function isComponentInstance(node: ReactTestInstance, component: unknown): boolean {
  return (node as unknown as { type: unknown }).type === component;
}

function openCalendar(renderer: ReactTestRenderer): void {
  act(() => findTouchable(renderer, 'Datum zum Bearbeiten wählen').props.onPress());
  expect(renderer.root.findAll((node) => node.type === 'Modal')[0]?.props.visible).toBe(true);
}

function findComponentProps<T>(renderer: ReactTestRenderer, component: unknown): T {
  const node = renderer.root.findAll((candidate) => isComponentInstance(candidate, component))[0];
  if (!node) throw new Error('Component instance not found');
  return node.props as T;
}

function expectNoGlobalHealthConnectAttemptStatus(renderer: ReactTestRenderer): void {
  const visibleText = renderer.root.findAll((node) => node.type === 'Text').map(getTextContent).join(' ');
  expect(visibleText).not.toMatch(/Synchronisation läuft|Abgleich läuft|Abgleich fehlgeschlagen|Letzter Versuch/i);
}

async function renderProgressScreen(entries: WeightEntry[]): Promise<ReactTestRenderer> {
  mocks.listWeights.mockResolvedValue(entries);
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<ProgressScreen />);
    await Promise.resolve();
  });
  activeRenderers.push(renderer);
  return renderer;
}

async function saveInput(renderer: ReactTestRenderer, value: string): Promise<void> {
  act(() => findComponentProps<ProgressHeroCardProps>(renderer, ProgressHeroCard).onInputChange(value));
  await act(async () => {
    findComponentProps<ProgressHeroCardProps>(renderer, ProgressHeroCard).onSave();
    await Promise.resolve();
  });
}

async function confirmDelete(renderer: ReactTestRenderer): Promise<void> {
  const sheet = renderer.root.findAll((node) => node.type === 'ConfirmSheet')[0];
  if (!sheet) throw new Error('Delete confirmation not found');
  const action = (sheet.props.actions as Array<{ onPress: () => void }>)[0];
  await act(async () => {
    action!.onPress();
    await Promise.resolve();
  });
}

beforeEach(() => {
  platform.OS = 'android';
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 16, 12));
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.getMe.mockResolvedValue({ profile: null });
  mocks.addWeight.mockResolvedValue(weightEntry('added', '2026-10-14', 77.5));
  mocks.updateWeight.mockResolvedValue(weightEntry('historical', '2026-10-12', 74.4));
  mocks.deleteWeight.mockResolvedValue(undefined);
  mocks.syncWeightUpsert.mockResolvedValue(undefined);
  mocks.syncWeightDelete.mockResolvedValue(undefined);
});

afterEach(() => {
  while (activeRenderers.length > 0) {
    const renderer = activeRenderers.pop()!;
    act(() => renderer.unmount());
  }
  vi.useRealTimers();
});

describe('ProgressScreen weight editor', () => {
  it('keeps ordinary Progress entries free of Health Connect status badges', async () => {
    const renderer = await renderProgressScreen([weightEntry('ordinary', '2026-10-14', 77.5)]);
    const visibleText = renderer.root.findAll((node) => node.type === 'Text').map(getTextContent).join(' ');

    expect(visibleText).toContain('77,5 kg');
    expect(visibleText).not.toMatch(/Health Connect|Synchronisationsstatus|Ausstehende Löschungen|Letzter erfolgreicher Abgleich/);
  });

  it('shows one latest-weight summary and keeps today\'s measurements visible in history', async () => {
    const currentEntry: WeightEntry = {
      ...weightEntry('today-current', '2026-10-16', 81),
      createdAt: '2026-10-16T12:00:00.000Z',
    };
    const renderer = await renderProgressScreen([
      weightEntry('today-earlier', '2026-10-16', 80),
      currentEntry,
    ]);
    const heroCard = renderer.root.findAll((node) => node.props.testID === 'weight-entry-card')[0]!;
    const heroText = getTextContent(heroCard);
    const historyList = renderer.root.findAll((node) => isComponentInstance(node, HistoryList))[0]!;
    const historyText = getTextContent(historyList);

    expect(heroText).toContain('81,0 kg');
    expect(heroText).toContain('Heute');
    expect(heroText).not.toContain('Tagesmessungen');
    expect(heroText).not.toMatch(/Messung \d/);
    expect(heroText).not.toContain('Neue Messung');
    expect(findComponentProps<ProgressHeroCardProps>(renderer, ProgressHeroCard).showTodayForm).toBe(false);
    expect(historyText).toContain('81,0 kg');
    expect(historyText).toContain('80,0 kg');
    expect(renderer.root.findAll((node) => isComponentInstance(node, WeightEntryForm))).toHaveLength(1);
  });

  it('matches the chart average and blue-line period to the selected range', async () => {
    mocks.getMe.mockResolvedValue({ profile: { targetWeightKg: 75, goal: 'lose_weight' } });
    const renderer = await renderProgressScreen([
      weightEntry('old', '2026-09-16', 90),
      weightEntry('recent', '2026-10-10', 82),
      weightEntry('today', '2026-10-16', 80),
    ]);
    const getChart = () => renderer.root.findAll((node) => node.type === 'WeightChart')[0]!;
    const getText = () => renderer.root.findAll((node) => node.type === 'Text').map(getTextContent);

    expect(getText()).toContain('81,0 kg');
    expect(renderer.root.findAll((node) => node.props.accessibilityLabel === 'Ø 7 Tage: 81,0 kg')).toHaveLength(1);
    expect(getText()).not.toContain('Ø 7 Tage');
    expect(getChart().props.averageWindowDays).toBe(7);
    expect(getChart().props.targetWeightKg).toBe(75);

    act(() => findTouchableByText(renderer, '30T').props.onPress());
    expect(getText()).toContain('81,0 kg');
    expect(renderer.root.findAll((node) => node.props.accessibilityLabel === 'Ø 30 Tage: 81,0 kg')).toHaveLength(1);
    expect(getChart().props.averageWindowDays).toBe(30);
    expect(getChart().props.targetWeightKg).toBe(75);

    act(() => findTouchableByText(renderer, '90T').props.onPress());
    expect(renderer.root.findAll((node) => node.props.accessibilityLabel === 'Ø 90 Tage: 84,0 kg')).toHaveLength(1);
    expect(getChart().props.averageWindowDays).toBe(90);
    expect(getChart().props.targetWeightKg).toBe(75);

    act(() => findTouchableByText(renderer, 'Alle').props.onPress());
    expect(renderer.root.findAll((node) => node.props.accessibilityLabel === 'Ø Gesamt: 84,0 kg')).toHaveLength(1);
    expect(getChart().props.averageWindowDays).toBe(90);
    expect(getChart().props.targetWeightKg).toBe(75);
  });

  it('uses the same form inline and in the calendar sheet, then creates a backdated entry', async () => {
    const renderer = await renderProgressScreen([]);
    expect(findComponentProps<ProgressHeroCardProps>(renderer, ProgressHeroCard).showTodayForm).toBe(true);
    expect(renderer.root.findAll((node) => isComponentInstance(node, WeightEntryForm))).toHaveLength(2);

    openCalendar(renderer);
    act(() => findTouchable(renderer, 'Mittwoch, 14. Oktober 2026').props.onPress());

    expect(renderer.root.findAll((node) => node.type === 'Modal')[0]!.props.visible).toBe(false);
    expect(renderer.root.findAll((node) => node.type === 'Modal')[1]!.props.visible).toBe(true);
    expect(renderer.root.findAll((node) => isComponentInstance(node, WeightEntryForm))).toHaveLength(2);
    await saveInput(renderer, '77,5');

    expect(mocks.addWeight).toHaveBeenCalledWith({
      value: 77.5,
      unit: 'kg',
      date: '2026-10-14',
    });
    expect(mocks.updateWeight).not.toHaveBeenCalled();
    expect(mocks.syncWeightUpsert).toHaveBeenCalledWith(weightEntry('added', '2026-10-14', 77.5));
    expect(renderer.root.findAll((node) => node.type === 'Modal')[1]!.props.visible).toBe(false);
    expect(findComponentProps<Pick<HistoryListProps, 'entries'>>(renderer, HistoryList).entries)
      .toContainEqual(weightEntry('added', '2026-10-14', 77.5));
  });

  it('does not start Health Connect sync when creating a weight fails', async () => {
    mocks.addWeight.mockRejectedValue(new Error('Create unavailable'));
    const renderer = await renderProgressScreen([]);

    await saveInput(renderer, '77,5');

    expect(mocks.addWeight).toHaveBeenCalledWith({ value: 77.5, unit: 'kg', date: '2026-10-16' });
    expect(mocks.syncWeightUpsert).not.toHaveBeenCalled();
    expect(findComponentProps<Pick<HistoryListProps, 'entries'>>(renderer, HistoryList).entries).toEqual([]);
  });

  it('does not expose global attempt status while a mutation sync is pending or fails', async () => {
    let rejectSync!: (failure: Error) => void;
    const syncAttempt = new Promise<void>((_resolve, reject) => {
      rejectSync = reject;
    }).catch(() => undefined);
    mocks.syncWeightUpsert.mockReturnValue(syncAttempt);
    const renderer = await renderProgressScreen([]);

    await saveInput(renderer, '77,5');

    expect(mocks.syncWeightUpsert).toHaveBeenCalledWith(weightEntry('added', '2026-10-14', 77.5));
    expectNoGlobalHealthConnectAttemptStatus(renderer);

    await act(async () => {
      rejectSync(new Error('Simulated Health Connect provider failure'));
      await syncAttempt;
    });

    expectNoGlobalHealthConnectAttemptStatus(renderer);
  });

  it('opens an existing calendar date with its value and updates by the exact ID', async () => {
    const existingEntry = weightEntry('existing', '2026-10-14', 80);
    const updatedEntry = weightEntry('existing', '2026-10-14', 80.5);
    mocks.updateWeight.mockResolvedValueOnce(updatedEntry);
    const renderer = await renderProgressScreen([weightEntry('today', '2026-10-16', 81), existingEntry]);
    openCalendar(renderer);
    act(() => findTouchable(renderer, 'Mittwoch, 14. Oktober 2026').props.onPress());

    const formProps = findComponentProps<WeightEntryFormProps>(renderer, WeightEntryForm);
    expect(formProps.isEditing).toBe(true);
    expect(formProps.input).toBe('80');

    await saveInput(renderer, '80,5');

    expect(mocks.updateWeight).toHaveBeenCalledWith('existing', 80.5);
    expect(mocks.addWeight).not.toHaveBeenCalled();
    expect(mocks.syncWeightUpsert).toHaveBeenCalledWith(updatedEntry);
    expect(findComponentProps<Pick<HistoryListProps, 'entries'>>(renderer, HistoryList).entries)
      .toContainEqual(updatedEntry);
  });

  it('updates an entry that appears for the selected date before saving instead of posting a duplicate', async () => {
    const existingEntry = weightEntry('arrived-during-edit', '2026-10-14', 80);
    const updatedEntry = weightEntry('arrived-during-edit', '2026-10-14', 80.5);
    const renderer = await renderProgressScreen([]);
    openCalendar(renderer);
    act(() => findTouchable(renderer, 'Mittwoch, 14. Oktober 2026').props.onPress());

    mocks.listWeights.mockResolvedValue([existingEntry]);
    const scrollView = renderer.root.findAll((node) => node.type === 'ScrollView')[0]!;
    const refreshControl = scrollView.props.refreshControl as { props: { onRefresh: () => void } };
    await act(async () => {
      refreshControl.props.onRefresh();
      await Promise.resolve();
    });
    mocks.updateWeight.mockResolvedValueOnce(updatedEntry);

    await saveInput(renderer, '80,5');

    expect(mocks.updateWeight).toHaveBeenCalledWith('arrived-during-edit', 80.5);
    expect(mocks.addWeight).not.toHaveBeenCalled();
    expect(mocks.syncWeightUpsert).toHaveBeenCalledWith(updatedEntry);
    expect(findComponentProps<Pick<HistoryListProps, 'entries'>>(renderer, HistoryList).entries)
      .toEqual([updatedEntry]);
  });

  it('opens a HistoryList entry in the same editor and updates that exact ID', async () => {
    const historicalEntry = weightEntry('historical', '2026-10-12', 74.2);
    const renderer = await renderProgressScreen([
      weightEntry('today', '2026-10-16', 80),
      historicalEntry,
    ]);
    const editButton = findTouchable(renderer, 'Gewicht vom 2026-10-12, 74,2 kg bearbeiten');

    act(() => editButton.props.onPress());
    expect(renderer.root.findAll((node) => node.type === 'Modal')[1]!.props.visible).toBe(true);
    expect(findComponentProps<WeightEntryFormProps>(renderer, WeightEntryForm).input).toBe('74,2');
    const updateButton = findTouchable(renderer, 'Gewicht aktualisieren');
    expect(updateButton.props.style).toEqual(expect.arrayContaining([
      expect.objectContaining({ flexBasis: 144, minWidth: 144 }),
    ]));
    const updateLabel = renderer.root.findAll((node) => node.type === 'Text'
      && getTextContent(node) === 'Aktualisieren')[0]!;
    expect(updateLabel.props.numberOfLines).toBe(1);
    await saveInput(renderer, '74,4');

    expect(mocks.updateWeight).toHaveBeenCalledWith('historical', 74.4);
    expect(mocks.addWeight).not.toHaveBeenCalled();
    expect(mocks.syncWeightUpsert).toHaveBeenCalledWith(weightEntry('historical', '2026-10-12', 74.4));
    expect(findComponentProps<Pick<HistoryListProps, 'entries'>>(renderer, HistoryList).entries)
      .toContainEqual(weightEntry('historical', '2026-10-12', 74.4));
  });

  it('ignores a future date passed to the screen calendar callback', async () => {
    const renderer = await renderProgressScreen([]);
    openCalendar(renderer);
    const calendar = findComponentProps<{
      selectedDate: string;
      onSelectDate: (date: string) => void;
    }>(renderer, ProgressCalendar);

    act(() => calendar.onSelectDate('2026-10-17'));

    expect(findComponentProps<{ selectedDate: string }>(renderer, ProgressCalendar).selectedDate)
      .toBe('2026-10-16');
  });

  it('keeps the calendar closed by default and closes it after selecting a date', async () => {
    const renderer = await renderProgressScreen([weightEntry('today', '2026-10-16', 80)]);
    const calendarModal = renderer.root.findAll((node) => node.type === 'Modal')[0]!;
    const editorModal = renderer.root.findAll((node) => node.type === 'Modal')[1]!;

    expect(calendarModal.props.visible).toBe(false);
    expect(editorModal.props.visible).toBe(false);
    openCalendar(renderer);
    act(() => findTouchable(renderer, 'Kalender schließen').props.onPress());
    expect(renderer.root.findAll((node) => node.type === 'Modal')[0]!.props.visible).toBe(false);

    openCalendar(renderer);
    act(() => findTouchable(renderer, 'Donnerstag, 15. Oktober 2026').props.onPress());
    expect(renderer.root.findAll((node) => node.type === 'Modal')[0]!.props.visible).toBe(false);
    expect(renderer.root.findAll((node) => node.type === 'Modal')[1]!.props.visible).toBe(true);
    expect(renderer.root.findAll((node) => node.type === 'Text').map(getTextContent))
      .toContain('Donnerstag, 15. Oktober 2026');
  });

  it('keeps the calendar editor above the keyboard with a scrollable form', async () => {
    for (const [os, behavior] of [['android', 'height'], ['ios', 'padding']] as const) {
      platform.OS = os;
      const renderer = await renderProgressScreen([]);
      openCalendar(renderer);
      const calendar = findComponentProps<{
        onSelectDate: (date: string) => void;
      }>(renderer, ProgressCalendar);
      act(() => calendar.onSelectDate('2026-10-15'));

      const editorModal = renderer.root.findAll((node) => node.type === 'Modal')[1]!;
      const keyboardAvoider = editorModal.findAll((node) => node.type === 'KeyboardAvoidingView')[0]!;
      const formScroll = editorModal.findAll((node) => node.type === 'ScrollView')
        .find((node) => node.props.keyboardShouldPersistTaps === 'handled');

      expect(keyboardAvoider.props.behavior).toBe(behavior);
      expect(formScroll).toBeDefined();
    }
  });

  it('does not POST when the calendar-selected date becomes future before saving', async () => {
    vi.setSystemTime(new Date(2026, 9, 15, 12));
    const renderer = await renderProgressScreen([]);
    openCalendar(renderer);
    act(() => findTouchable(renderer, 'Donnerstag, 15. Oktober 2026').props.onPress());
    vi.setSystemTime(new Date(2026, 9, 14, 12));

    await saveInput(renderer, '77,5');

    const cardProps = findComponentProps<ProgressHeroCardProps>(renderer, ProgressHeroCard);
    const alerts = renderer.root.findAll((node) => node.type === 'Text'
      && node.props.accessibilityRole === 'alert').map(getTextContent);
    expect(mocks.addWeight).not.toHaveBeenCalled();
    expect(mocks.updateWeight).not.toHaveBeenCalled();
    expect(mocks.syncWeightUpsert).not.toHaveBeenCalled();
    expect(cardProps.saveError).toBe('Zukünftige Messungen können nicht eingetragen werden.');
    expect(alerts).toContain(cardProps.saveError);
  });

  it('preserves the entry and edit input and skips sync when an update fails', async () => {
    const historicalEntry = weightEntry('historical', '2026-10-12', 74.2);
    mocks.updateWeight.mockRejectedValue(new Error('Update unavailable'));
    const renderer = await renderProgressScreen([
      weightEntry('today', '2026-10-16', 80),
      historicalEntry,
    ]);
    act(() => findTouchable(renderer, 'Gewicht vom 2026-10-12, 74,2 kg bearbeiten').props.onPress());

    await saveInput(renderer, '75,1');

    const cardProps = findComponentProps<ProgressHeroCardProps>(renderer, ProgressHeroCard);
    const input = renderer.root.findAll((node) => node.type === 'TextInput')[0]!;
    const alerts = renderer.root.findAll((node) => node.type === 'Text'
      && node.props.accessibilityRole === 'alert').map(getTextContent);
    const historyEntries = findComponentProps<Pick<HistoryListProps, 'entries'>>(renderer, HistoryList).entries;
    const visibleText = renderer.root.findAll((node) => node.type === 'Text').map(getTextContent);

    expect(mocks.updateWeight).toHaveBeenCalledWith('historical', 75.1);
    expect(mocks.addWeight).not.toHaveBeenCalled();
    expect(mocks.syncWeightUpsert).not.toHaveBeenCalled();
    expect(renderer.root.findAll((node) => node.type === 'Modal')[1]!.props.visible).toBe(true);
    expect(cardProps.input).toBe('75,1');
    expect(findComponentProps<WeightEntryFormProps>(renderer, WeightEntryForm).input).toBe('75,1');
    expect(input.props.value).toBe('75,1');
    expect(historyEntries).toContainEqual(historicalEntry);
    expect(visibleText).toContain('74,2 kg');
    expect(visibleText.join(' ')).not.toMatch(/Health Connect|Synchronisationsstatus|Ausstehende Löschungen|Letzter erfolgreicher Abgleich/);
    expect(cardProps.saveError).toBeTruthy();
    expect(alerts).toContain(cardProps.saveError);
  });

  it('syncs a weight delete only after the FitTrack delete succeeds', async () => {
    const entry = weightEntry('deleted', '2026-10-12', 74.2);
    const renderer = await renderProgressScreen([entry]);
    act(() => findComponentProps<HistoryListProps>(renderer, HistoryList).onDelete(entry));

    await confirmDelete(renderer);

    expect(mocks.deleteWeight).toHaveBeenCalledWith('deleted');
    expect(mocks.syncWeightDelete).toHaveBeenCalledWith('deleted');
    expect(findComponentProps<Pick<HistoryListProps, 'entries'>>(renderer, HistoryList).entries)
      .not.toContainEqual(entry);
  });

  it('does not sync a weight delete when the FitTrack delete fails', async () => {
    const entry = weightEntry('delete-failed', '2026-10-12', 74.2);
    mocks.deleteWeight.mockRejectedValue(new Error('Delete unavailable'));
    const renderer = await renderProgressScreen([entry]);
    act(() => findComponentProps<HistoryListProps>(renderer, HistoryList).onDelete(entry));

    await confirmDelete(renderer);

    expect(mocks.deleteWeight).toHaveBeenCalledWith('delete-failed');
    expect(mocks.syncWeightDelete).not.toHaveBeenCalled();
    expect(findComponentProps<Pick<HistoryListProps, 'entries'>>(renderer, HistoryList).entries)
      .toContainEqual(entry);
  });
});