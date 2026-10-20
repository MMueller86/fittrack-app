import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyInsightResponse } from '../../services/insightService';
import HomeScreen from './HomeScreen';
import { CoachingHeroCard } from './CoachingHeroCard';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  getInsight: vi.fn(),
  setDayType: vi.fn(),
  setTargets: vi.fn(),
  hydrateDayType: vi.fn(),
  openHub: vi.fn(),
  navigate: vi.fn(),
  getParent: vi.fn(),
}));

vi.mock('react-native', () => ({
  RefreshControl: 'RefreshControl', ScrollView: 'ScrollView', Text: 'Text',
  TouchableOpacity: 'TouchableOpacity', View: 'View',
  StyleSheet: { create: <T,>(styles: T) => styles },
}));
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 24, bottom: 24 }),
}));
vi.mock('@react-navigation/native', async () => {
  const react = await import('react');
  return { useFocusEffect: (callback: () => (() => void)) => react.useEffect(callback, [callback]) };
});
vi.mock('../../services/insightService', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../services/insightService')>(),
  getInsight: mocks.getInsight,
}));
vi.mock('../../shared/api/aiApi', () => ({ aiApi: { getWeeklyInsight: vi.fn().mockResolvedValue(null) } }));
vi.mock('../../services/weightsService', () => ({ listWeights: vi.fn().mockResolvedValue([]) }));
vi.mock('../../shared/api/profileApi', () => ({
  profileApi: { getMe: vi.fn().mockResolvedValue({ profile: { displayName: 'Alex' } }) },
}));
vi.mock('../../shared/api/diaryApi', () => ({
  diaryApi: { getDay: vi.fn().mockResolvedValue({ meals: [], dayType: 'rest' }) },
}));
vi.mock('../../services/health/syncLogger', () => ({ syncLogger: { error: vi.fn() } }));
vi.mock('../nutrition/useDayTypeStore', () => ({ useDayTypeStore: () => ({
  dayType: 'rest', workoutType: null, targets: null,
  setTargets: mocks.setTargets, setDayType: mocks.setDayType, hydrateDayType: mocks.hydrateDayType,
}) }));
vi.mock('../nutrition/hub/useFoodEntryHubStore', () => ({ useFoodEntryHubStore: () => mocks.openHub }));
vi.mock('./WorkoutTypePicker', () => ({ default: 'WorkoutTypePicker' }));
vi.mock('./DayNutritionCard', () => ({ DayNutritionCard: 'DayNutritionCard' }));
vi.mock('./WeeklyReviewCard', () => ({ WeeklyReviewCard: 'WeeklyReviewCard' }));
vi.mock('./InsightCard', () => ({ InsightCard: 'InsightDetail' }));
vi.mock('../../shared/components/Icon', () => ({ Icon: 'Icon' }));
vi.mock('../../shared/components/ErrorBanner', () => ({ ErrorBanner: 'ErrorBanner' }));
vi.mock('../../shared/components/FoodEntrySearchRow', () => ({ FoodEntrySearchRow: 'FoodEntrySearchRow' }));
vi.mock('../nutrition/components/ActivityCtaCard', () => ({ ActivityCtaCard: 'ActivityCtaCard' }));
vi.mock('../nutrition/components/ActivityCard', () => ({ ActivityCard: 'ActivityCard' }));
vi.mock('../nutrition/components/ActivityPickerSheet', () => ({ ActivityPickerSheet: 'ActivityPickerSheet' }));
vi.mock('../nutrition/components/ActivityBonusSheet', () => ({ ActivityBonusSheet: 'ActivityBonusSheet' }));
vi.mock('../../shared/components/ConfirmSheet', () => ({ ConfirmSheet: 'ConfirmSheet' }));
vi.mock('../../shared/components/Snackbar', () => ({
  Snackbar: () => null, useSnackbar: () => ({ ref: null, show: vi.fn() }),
}));

const insight: DailyInsightResponse = {
  greeting: 'Hallo, Alex! 👋', shortInsight: 'Dein Verlauf bleibt stabil.',
  title: 'Verlauf', summary: 'Der vollständige Insight.', status: 'fresh',
  generatedAt: '2026-10-16T10:00:00.000Z', promptVersion: 'v23',
};
const renderers: ReactTestRenderer[] = [];

function deferredInsight() {
  let resolve!: (value: DailyInsightResponse | null) => void;
  const promise = new Promise<DailyInsightResponse | null>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

async function renderHome() {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(React.createElement(HomeScreen, {
      navigation: { navigate: mocks.navigate, getParent: mocks.getParent },
      route: { key: 'HomeMain', name: 'HomeMain' },
    } as unknown as React.ComponentProps<typeof HomeScreen>));
  });
  renderers.push(renderer);
  return renderer;
}

async function refresh(renderer: ReactTestRenderer) {
  await act(async () => {
    const control = findType(renderer, 'ScrollView').props.refreshControl as React.ReactElement<{ onRefresh: () => Promise<void> }>;
    await control.props.onRefresh();
  });
}

function findType(renderer: ReactTestRenderer, type: unknown) {
  return renderer.root.findAll((node) => node.type === type)[0]!;
}

function findInsightToggle(renderer: ReactTestRenderer, label = 'Mehr anzeigen') {
  return renderer.root.findAll((node) => node.props.accessibilityLabel === label);
}

async function invoke(callback: unknown, ...args: unknown[]) {
  if (typeof callback !== 'function') throw new Error('Expected event callback');
  await act(async () => { await callback(...args); });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getInsight.mockReset().mockResolvedValue(insight);
  mocks.getParent.mockReturnValue({ navigate: mocks.navigate });
});
afterEach(() => {
  for (const renderer of renderers.splice(0)) act(() => renderer.unmount());
});

describe('Home daily insight integration', () => {
  it('fetches on focus/refresh, but not on inline expansion or day-type selection', async () => {
    const renderer = await renderHome();
    expect(mocks.getInsight).toHaveBeenCalledTimes(1);
    expect(renderer.root.findAll((node) => node.type === 'InsightDetail')).toHaveLength(0);
    await invoke(findInsightToggle(renderer)[0]!.props.onPress);
    expect(renderer.root.findAll((node) => node.type === 'InsightDetail')).toHaveLength(1);
    expect(findType(renderer, 'InsightDetail').props.inlineDetail).toBe(true);
    expect(findType(renderer, 'InsightDetail').props.detail).toBeUndefined();
    await invoke(findInsightToggle(renderer, 'Weniger anzeigen')[0]!.props.onPress);
    expect(renderer.root.findAll((node) => node.type === 'InsightDetail')).toHaveLength(0);
    await invoke(findType(renderer, 'WorkoutTypePicker').props.onSelect, 'gym');
    expect(mocks.setDayType).toHaveBeenCalledWith('training', 'gym');
    expect(mocks.getInsight).toHaveBeenCalledTimes(1);
    await refresh(renderer);
    expect(mocks.getInsight).toHaveBeenCalledTimes(2);
  });

  it('ignores an older overlapping response and updates expanded content to the latest insight', async () => {
    const renderer = await renderHome();
    await invoke(findInsightToggle(renderer)[0]!.props.onPress);
    const older = deferredInsight();
    const newer = deferredInsight();
    mocks.getInsight.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    await refresh(renderer);
    expect(findInsightToggle(renderer, 'Weniger anzeigen')).toHaveLength(1);
    expect(findType(renderer, CoachingHeroCard).props.insight).toBe(insight);
    await refresh(renderer);
    const latest = { ...insight, summary: 'Neue Analyse', generatedAt: '2026-10-16T12:00:00.000Z' };
    await act(async () => newer.resolve(latest));
    await act(async () => older.resolve({ ...insight, summary: 'Veraltete Antwort' }));
    expect(findType(renderer, CoachingHeroCard).props.insight).toBe(latest);
    expect(findInsightToggle(renderer)).toHaveLength(1);
    await invoke(findInsightToggle(renderer)[0]!.props.onPress);
    expect(findType(renderer, 'InsightDetail').props.insight).toBe(latest);
  });

  it.each([null, { ...insight, status: 'quota_exceeded' as const }, { ...insight, greeting: undefined }])(
    'shows static fallback without an extra missing-field request %#', async (response) => {
      mocks.getInsight.mockResolvedValue(response);
      const renderer = await renderHome();
      expect(findInsightToggle(renderer)).toHaveLength(0);
      expect(renderer.root.findAll((node) => node.props.testID === 'short-insight')).toHaveLength(0);
      expect(mocks.getInsight).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps the previous pair while a refresh is pending and falls back when the refresh yields no insight', async () => {
    const renderer = await renderHome();
    expect(findInsightToggle(renderer)).toHaveLength(1);
    const pending = deferredInsight();
    mocks.getInsight.mockReturnValueOnce(pending.promise);
    await refresh(renderer);
    expect(findInsightToggle(renderer)).toHaveLength(1);
    expect(renderer.root.findAll((node) => node.props.testID === 'short-insight')).toHaveLength(1);
    await act(async () => pending.resolve(null));
    expect(findInsightToggle(renderer)).toHaveLength(0);
    expect(renderer.root.findAll((node) => node.props.testID === 'short-insight')).toHaveLength(0);
  });

  it('falls back on a rejected request and after focus cleanup ignores an in-flight result', async () => {
    mocks.getInsight.mockRejectedValueOnce(new Error('network'));
    const renderer = await renderHome();
    expect(findInsightToggle(renderer)).toHaveLength(0);
    const pending = deferredInsight();
    mocks.getInsight.mockReturnValueOnce(pending.promise);
    await refresh(renderer);
    act(() => renderer.unmount());
    renderers.splice(renderers.indexOf(renderer), 1);
    await act(async () => pending.resolve(insight));
    expect(mocks.getInsight).toHaveBeenCalledTimes(2);
  });
});