import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WeightEntry } from '@fittrack/shared';
import { colors } from '../../app/theme';

vi.mock('react-native', () => ({
  StyleSheet: { create: <T,>(styles: T) => styles },
  ActivityIndicator: 'ActivityIndicator',
  Text: 'Text',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));

vi.mock('./Icon', () => ({ Icon: 'Icon' }));
vi.mock('./SwipeableRow', () => ({ SwipeableRow: 'SwipeableRow' }));

import { daysSince, ProgressHeroCard, type ProgressHeroCardProps } from './ProgressHeroCard';
import { HistoryList } from './HistoryList';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type TestInstanceWithChildren = ReactTestInstance & {
  children: Array<string | ReactTestInstance>;
};

const activeRenderers: ReactTestRenderer[] = [];

function renderProgressCard(latest?: WeightEntry, overrides: Partial<ProgressHeroCardProps> = {}): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      React.createElement(ProgressHeroCard, {
        entries: latest ? [latest] : [],
        latest,
        startEntry: latest,
        targetWeightKg: undefined,
        today: '2026-10-16',
        showTodayForm: latest?.date !== '2026-10-16',
        onOpenCalendar: vi.fn(),
        input: '78,5',
        onInputChange: vi.fn(),
        onSave: vi.fn(),
        saving: false,
        inputError: null,
        saveError: null,
        ...overrides,
      }),
    );
  });
  activeRenderers.push(renderer);
  return renderer;
}

function getTextContent(node: ReactTestInstance): string {
  return (node as TestInstanceWithChildren).children
    .map((child) => typeof child === 'string' ? child : getTextContent(child))
    .join('');
}

function invokeCallback(callback: unknown): void {
  if (typeof callback !== 'function') throw new Error('Expected an event callback');
  act(() => callback());
}

afterEach(() => {
  vi.useRealTimers();
  while (activeRenderers.length > 0) {
    const renderer = activeRenderers.pop()!;
    act(() => renderer.unmount());
  }
});

describe('ProgressHeroCard weight entry and weekly comparison', () => {
  it.each([
    { values: [82, 80], label: '2,0 kg weniger als letzte Woche', visibleDelta: '− 2,0 kg', icon: 'arrow-down-right' },
    { values: [80, 82], label: '2,0 kg mehr als letzte Woche', visibleDelta: '+ 2,0 kg', icon: 'arrow-up-right' },
    { values: [80, 80], label: 'Gleicher Schnitt wie letzte Woche', visibleDelta: '= 0,0 kg', icon: 'arrow-right' },
  ])('compares the rolling seven-day average against last week: $label', ({ values, label, visibleDelta, icon }) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 16, 12));
    const entries: WeightEntry[] = values.map((value, index) => ({
      id: `weight-${index}`, userId: 'user-1', date: index === 0 ? '2026-10-08' : '2026-10-16',
      value, unit: 'kg', createdAt: '2026-10-16T08:00:00.000Z',
    }));
    const latest = entries[entries.length - 1]!;
    const outsideWindow = [
      { ...latest, id: 'old', date: '2026-09-01', value: 200 },
      { ...latest, id: 'future', date: '2026-10-17', value: 10 },
    ];
    const renderer = renderProgressCard(latest, { entries: [...entries, ...outsideWindow] });

    const changeColumn = renderer.root.findAll((node) => node.type === 'View'
      && node.props.accessibilityLabel === label)[0]!;
    expect(changeColumn).toBeDefined();
    expect(getTextContent(changeColumn)).toContain(visibleDelta);
    expect(changeColumn.props.style).toEqual(expect.arrayContaining([
      expect.objectContaining({ alignItems: 'flex-end' }),
    ]));
    const directionIcon = changeColumn.findAll((node) => node.type === 'Icon')[0]!;
    expect(directionIcon.props.name).toBe(icon);
    expect(directionIcon.props.size).toBe('md');
    expect(directionIcon.props.color).toBe(colors.textSecondary);
    const deltaRow = changeColumn.findAll((node) => node.type === 'View')[1]!;
    expect(deltaRow.props.style).toEqual(expect.objectContaining({ gap: 4 }));
    expect(renderer.root.findAll((node) => node.props.testID === 'weight-week-comparison')).toHaveLength(1);
  });

  it('keeps history averages while limiting the visible comparison to labels, values and change', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 16, 12));
    const latest: WeightEntry = {
      id: 'latest', userId: 'user-1', date: '2026-10-16', value: 90,
      unit: 'kg', createdAt: '2026-10-16T08:00:00.000Z',
    };
    const entries = [
      latest,
      { ...latest, id: 'sunday', date: '2026-10-11', value: 80 },
      { ...latest, id: 'monday-later', date: '2026-10-05', value: 82 },
      { ...latest, id: 'monday-earlier', date: '2026-10-05', value: 86 },
      { ...latest, id: 'previous', date: '2026-10-04', value: 84 },
    ];
    const renderer = renderProgressCard(latest, { entries });
    let history!: ReactTestRenderer;
    act(() => {
      history = create(React.createElement(HistoryList, { entries, onDelete: vi.fn() }));
    });
    activeRenderers.push(history);
    const cardText = renderer.root.findAll((node) => node.type === 'Text').map(getTextContent).join(' ');
    const historyText = history.root.findAll((node) => node.type === 'Text').map(getTextContent).join(' ');

    for (const value of ['Ø 85,0 kg', 'Ø 82,7 kg']) {
      expect(cardText).toContain(value);
      expect(historyText).toContain(value);
    }
    expect(cardText).toContain('Letzte 7 Tage');
    expect(historyText).toContain('Die letzten 7 Tage');
    expect(cardText).toContain('Letzte Woche');
    expect(cardText).not.toContain('Woche davor');
    expect(cardText).toContain('+ 2,3 kg');
    const comparison = renderer.root.findAll((node) => node.props.testID === 'weight-week-comparison')[0]!;
    const comparisonText = getTextContent(comparison);
    expect(comparisonText).not.toMatch(/Wochenschnitte|Messung|\d{2}\.\d{2}\.|als letzte Woche/);
    const accessibleLabels = comparison.findAll((node) => node.props.accessible === true)
      .map((node) => node.props.accessibilityLabel);
    expect(accessibleLabels).toContain('Letzte 7 Tage, 10.10. – 16.10.: Durchschnitt 85,0 kg, 2 Messungen');
    expect(accessibleLabels).toContain('Letzte Woche, 05.10. – 11.10.: Durchschnitt 82,7 kg, 3 Messungen');
    expect(accessibleLabels).toContain('2,3 kg mehr als letzte Woche');
    const texts = renderer.root.findAll((node) => node.type === 'Text').map(getTextContent);
    expect(texts.indexOf('90,0 kg')).toBeLessThan(texts.indexOf('Letzte 7 Tage'));
  });

  it.each([
    { label: 'only the current average exists', dates: ['2026-10-16'] },
    { label: 'only the completed-week average exists', dates: ['2026-10-05'] },
    { label: 'neither average exists', dates: [] },
  ])('omits the entire comparison without messages when $label', ({ dates }) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 16, 12));
    const latest: WeightEntry = {
      id: 'latest', userId: 'user-1', date: '2026-10-16', value: 80,
      unit: 'kg', createdAt: '2026-10-16T08:00:00.000Z',
    };
    const entries = dates.map((date) => ({ ...latest, id: date, date }));
    const renderer = renderProgressCard(entries[0], { entries });

    const texts = renderer.root.findAll((node) => node.type === 'Text').map(getTextContent);
    expect(renderer.root.findAll((node) => node.props.testID === 'weight-week-comparison')).toHaveLength(0);
    expect(texts).not.toContain('Wochenschnitte');
    expect(texts).not.toContain('Kein Wochenschnitt verfügbar');
    expect(texts).not.toContain('Noch nicht vergleichbar.');
  });

  it('counts the next local calendar day across spring-forward', () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = 'America/New_York';

    try {
      expect(daysSince('2026-03-08', new Date('2026-03-09T04:30:00.000Z'))).toBe(1);
    } finally {
      if (previousTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimezone;
    }
  });

  it('offers one kg input and a single entry action without an alternate unit selector', () => {
    const renderer = renderProgressCard();
    const input = renderer.root.findAll((node) => node.type === 'TextInput');
    const saveButtons = renderer.root.findAll((node) => node.type === 'TouchableOpacity'
      && node.props.accessibilityLabel === 'Gewicht speichern');
    const editButtons = renderer.root.findAll((node) => node.type === 'TouchableOpacity'
      && node.props.accessibilityLabel === 'Datum zum Bearbeiten wählen');
    const texts = renderer.root.findAll((node) => node.type === 'Text').map(getTextContent);
    const text = texts.join(' ');

    expect(input).toHaveLength(1);
    expect(input[0]!.props.accessibilityLabel).toBe('Gewicht in Kilogramm');
    expect(input[0]!.props.placeholder).toBe('0,0');
    expect(saveButtons).toHaveLength(1);
    expect(editButtons).toHaveLength(1);
    expect(saveButtons[0]!.props.accessibilityLabel).toBe('Gewicht speichern');
    expect(text).toContain('Heute eintragen');
    expect(text).not.toContain('Neue Messungen erscheinen direkt in deinem Verlauf.');
    expect(text).toContain('Noch keine Messung');
    expect(text).toContain('kg');
    expect(renderer.root.findAll((node) => node.type === 'Icon' && node.props.name === 'save')).toHaveLength(1);
    expect(text).toContain('Speichern');
    expect(saveButtons[0]!.props.style).toEqual(expect.arrayContaining([
      expect.objectContaining({
        flexBasis: 144, minWidth: 144, minHeight: 48, flexShrink: 0,
        backgroundColor: colors.primaryBright,
      }),
    ]));
    expect(renderer.root.findAll((node) => node.type === 'Text'
      && getTextContent(node) === 'Speichern')[0]!.props.numberOfLines).toBe(1);
    const title = renderer.root.findAll((node) => node.type === 'Text' && getTextContent(node) === 'Heute eintragen')[0]!;
    expect(title).toBeDefined();
    expect(text).not.toMatch(/lbs|lb/i);
    expect(text).not.toContain('AKTUELL');
  });

  it.each([
    { date: '2026-10-16', label: 'Heute', color: colors.primaryBright },
    { date: '2026-10-15', label: 'Vor 1 Tag', color: colors.primaryBright },
    { date: '2026-10-14', label: 'Vor 2 Tagen', color: colors.warning },
    { date: '2026-10-13', label: '13. Oktober', color: colors.textSecondary },
    { date: '2026-10-12', label: '12. Oktober', color: colors.textSecondary },
    { date: '2025-10-12', label: '12. Oktober 2025', color: colors.textSecondary },
    { date: '2026-10-17', label: '17. Oktober', color: colors.textSecondary },
  ])('shows the latest weight with the date label $label', ({ date, label, color }) => {
    const latest: WeightEntry = {
      id: 'weight-1', userId: 'user-1', date, value: 72.4,
      unit: 'kg', createdAt: `${date}T08:00:00.000Z`,
    };
    const renderer = renderProgressCard(latest);
    const entryCard = renderer.root.findAll((node) => node.type === 'View'
      && node.props.testID === 'weight-entry-card')[0]!;
    const dateText = renderer.root.findAll((node) => node.type === 'Text' && getTextContent(node) === label);

    expect(getTextContent(entryCard)).toContain('72,4 kg');
    expect(dateText).toHaveLength(1);
    expect(dateText[0]!.props.style).toEqual(expect.arrayContaining([{ color }]));
  });

  it('shows an edit action without multiple-measurement labels or add controls', () => {
    const latest: WeightEntry = {
      id: 'weight-1',
      userId: 'user-1',
      date: '2026-10-16',
      value: 72.4,
      unit: 'kg',
      createdAt: '2026-10-16T08:00:00.000Z',
    };
    const renderer = renderProgressCard(latest);
    const entryCard = renderer.root.findAll((node) => node.type === 'View'
      && node.props.testID === 'weight-entry-card')[0]!;
    const entryText = getTextContent(entryCard);

    expect(entryText).toContain('72,4 kg');
    expect(entryText).toContain('Heute');
    expect(entryText).not.toContain('Tagesmessungen');
    expect(entryText).not.toContain('Messung 1');
    expect(renderer.root.findAll((node) => node.type === 'TextInput')).toHaveLength(0);
    expect(renderer.root.findAll((node) => node.type === 'TouchableOpacity'
      && node.props.accessibilityLabel === 'Datum zum Bearbeiten wählen')).toHaveLength(1);
    expect(renderer.root.findAll((node) => node.type === 'Icon' && node.props.name === 'edit-2')).toHaveLength(1);
    expect(renderer.root.findAll((node) => node.props.testID === 'weight-entry-card')[0]!
      .findAll((node) => node.type === 'Icon' && node.props.name === 'edit-2')[0]!.props.size).toBe(14);
    expect(renderer.root.findAll((node) => node.type === 'Icon' && node.props.name === 'plus')).toHaveLength(0);
    const editButton = renderer.root.findAll((node) => node.type === 'TouchableOpacity'
      && node.props.accessibilityLabel === 'Datum zum Bearbeiten wählen')[0]!;
    expect(editButton.props.style).toMatchObject({ width: 40, height: 40 });
    expect(editButton.props.hitSlop).toBe(4);
  });

  it('integrates goal progress into the weight summary card', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 16, 12));
    const start: WeightEntry = {
      id: 'start', userId: 'user-1', date: '2026-10-10', value: 82,
      unit: 'kg', createdAt: '2026-10-10T08:00:00.000Z',
    };
    const latest = { ...start, id: 'latest', date: '2026-10-16', value: 80 };
    const renderer = renderProgressCard(latest, {
      entries: [latest, start], startEntry: start, targetWeightKg: 75,
    });
    const texts = renderer.root.findAll((node) => node.type === 'Text').map(getTextContent);
    const entryCard = renderer.root.findAll((node) => node.type === 'View' && node.props.testID === 'weight-entry-card')[0]!;
    const goalSection = renderer.root.findAll((node) => node.type === 'View' && node.props.testID === 'weight-goal-section')[0]!;
    const entryText = getTextContent(entryCard);

    expect(entryText).toContain('80,0 kg');
    expect(entryText).toContain('Noch 5,0 kg bis zum Ziel');
    expect(getTextContent(goalSection)).toContain('Ziel 75,0 kg');
    expect(renderer.root.findAll((node) => node.props.testID === 'weight-statistics-card')).toHaveLength(0);
    expect(entryText).toContain('Ø 81,0 kg');
    expect(texts.some((text) => /basis:/i.test(text))).toBe(false);
    expect(texts).toContain('Veränderung');
    expect(texts).toContain('− 1,0 kg');
    const comparison = entryCard.findAll((node) => node.props.testID === 'weight-week-comparison')[0]!;
    expect(comparison.findAll((node) => node.props.testID === 'weight-week-divider')).toHaveLength(2);
    const columns = comparison.findAll((node) => node.props.accessible === true
      && typeof node.props.accessibilityLabel === 'string');
    expect(columns).toHaveLength(3);
    expect(columns[0]!.props.style).toMatchObject({ alignItems: 'center' });
    expect(columns[1]!.props.style).toMatchObject({ alignItems: 'center' });
    expect(columns[2]!.props.style).toEqual(expect.arrayContaining([
      expect.objectContaining({ alignItems: 'flex-end' }),
    ]));
  });

  it('uses the seven-day regression when the week comparison is unavailable', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 16, 12));
    const entries: WeightEntry[] = [
      { id: 'earlier', userId: 'user-1', date: '2026-10-12', value: 82, unit: 'kg', createdAt: '2026-10-12T08:00:00.000Z' },
      { id: 'latest', userId: 'user-1', date: '2026-10-16', value: 80, unit: 'kg', createdAt: '2026-10-16T08:00:00.000Z' },
    ];
    const renderer = renderProgressCard(entries[1], { entries });
    const comparison = renderer.root.findAll((node) => node.props.testID === 'weight-week-comparison')[0]!;
    const trendIcon = comparison.findAll((node) => node.type === 'Icon')[0]!;

    expect(getTextContent(comparison)).toContain('Trend letzte 7 Tage');
    expect(getTextContent(comparison)).toContain('3,5 kg/Woche weniger');
    expect(trendIcon.props.size).toBe('md');
    expect(comparison.props.accessibilityLabel).toBeUndefined();
    expect(renderer.root.findAll((node) => node.props.accessibilityLabel === 'Trend letzte 7 Tage: 3,5 kg/Woche weniger'))
      .toHaveLength(1);
  });

  it('keeps saving and keyboard submission wired to the same action', () => {
    const onSave = vi.fn();
    const renderer = renderProgressCard(undefined, { onSave });
    const button = renderer.root.findAll((node) => node.type === 'TouchableOpacity'
      && node.props.accessibilityLabel === 'Gewicht speichern')[0]!;
    const input = renderer.root.findAll((node) => node.type === 'TextInput')[0]!;

    invokeCallback(button.props.onPress);
    invokeCallback(input.props.onSubmitEditing);

    expect(onSave).toHaveBeenCalledTimes(2);
    expect(button.props.disabled).toBe(false);
  });

  it.each([{ input: '   ', saving: false }, { input: '78,5', saving: true }])(
    'prevents submission for empty input or while saving: %j',
    (overrides) => {
      const renderer = renderProgressCard(undefined, overrides);
      const button = renderer.root.findAll((node) => node.type === 'TouchableOpacity'
        && node.props.accessibilityLabel === 'Gewicht speichern')[0]!;
      const input = renderer.root.findAll((node) => node.type === 'TextInput')[0]!;

      expect(button.props.disabled).toBe(true);
      expect(button.props.style).toEqual(expect.arrayContaining([
        { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
      ]));
      expect(button.props.accessibilityState).toEqual(expect.objectContaining({ busy: overrides.saving }));
      expect(input.props.onSubmitEditing).toBeUndefined();
      expect(input.props.editable).toBe(!overrides.saving);
      expect(renderer.root.findAll((node) => node.type === 'ActivityIndicator')).toHaveLength(overrides.saving ? 1 : 0);
    },
  );

  it('announces errors and gives the input a visible focus state', () => {
    const renderer = renderProgressCard(undefined, { inputError: 'Ungültiges Gewicht' });
    const input = renderer.root.findAll((node) => node.type === 'TextInput')[0]!;
    const error = renderer.root.findAll((node) => node.type === 'Text').find((node) => getTextContent(node) === 'Ungültiges Gewicht')!;
    const inputContainer = () => renderer.root.findAll((node) =>
      node.type === 'View' && Array.isArray(node.props.style) && node.props.style[0]?.flexBasis === 128,
    )[0]!;

    expect(error.props.accessibilityRole).toBe('alert');
    expect(error.props.accessibilityLiveRegion).toBe('polite');
    invokeCallback(input.props.onFocus);
    expect(inputContainer().props.style).toEqual(expect.arrayContaining([
      { borderColor: colors.primaryBright },
      { borderColor: colors.negative },
    ]));
    invokeCallback(input.props.onBlur);
    expect(inputContainer().props.style).toEqual(expect.arrayContaining([false]));
  });

  it('separates remaining weight, target and comparison without changing progress', () => {
    const start: WeightEntry = {
      id: 'start', userId: 'user-1', date: '2026-05-21', value: 82.4,
      unit: 'kg', createdAt: '2026-05-21T08:00:00.000Z',
    };
    const latest = { ...start, id: 'latest', date: '2026-10-15', value: 84 };
    const renderer = renderProgressCard(latest, { entries: [latest, start], startEntry: start, targetWeightKg: 75 });
    const text = renderer.root.findAll((node) => node.type === 'Text').map(getTextContent).join(' ');
    const progress = renderer.root.findAll((node) => node.props.accessibilityRole === 'progressbar')[0]!;

    expect(text).toContain('Noch 9,0 kg bis zum Ziel');
    expect(text).toContain('Ziel 75,0 kg');
    expect(text).toContain('Start 82,4 kg');
    expect(text).not.toContain('zur letzten Messung');
    expect(text).not.toContain('Wochenschnitte');
    expect(renderer.root.findAll((node) => node.type === 'TrendPill')).toHaveLength(0);
    expect(text).not.toContain('Gewichtsreduktion');
    expect(progress.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 0 });
  });

  it('omits comparison context and goal progress when no reference exists', () => {
    const renderer = renderProgressCard();
    const text = renderer.root.findAll((node) => node.type === 'Text').map(getTextContent).join(' ');

    expect(text).not.toContain('zur letzten Messung');
    expect(renderer.root.findAll((node) => node.props.testID === 'weight-statistics-card')).toHaveLength(0);
    expect(renderer.root.findAll((node) => node.props.accessibilityRole === 'progressbar')).toHaveLength(0);
  });

  it('shows a meaningful statistics state when the latest measurement is older than 30 days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 16, 12));
    const latest: WeightEntry = {
      id: 'old', userId: 'user-1', date: '2026-01-01', value: 82,
      unit: 'kg', createdAt: '2026-01-01T08:00:00.000Z',
    };
    const renderer = renderProgressCard(latest);
    const statisticsCard = renderer.root.findAll((node) => node.type === 'View'
      && node.props.testID === 'weight-statistics-card')[0]!;

    expect(statisticsCard).toBeUndefined();
  });
});

describe('HistoryList row actions', () => {
  it('opens the row on tap and deletes through the swipe wrapper without row icons', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 16, 12));
    const entry: WeightEntry = {
      id: 'measurement-a', userId: 'user-1', date: '2026-10-16', value: 80,
      unit: 'kg', createdAt: '2026-10-16T12:30:00.000Z',
    };
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(React.createElement(HistoryList, {
        entries: [entry],
        onDelete,
        onEdit,
      }));
    });
    activeRenderers.push(renderer);
    const editRows = renderer.root.findAll((node) => node.type === 'TouchableOpacity'
      && typeof node.props.accessibilityLabel === 'string'
      && node.props.accessibilityLabel.endsWith(' bearbeiten'));
    const swipeRows = renderer.root.findAll((node) => node.type === 'SwipeableRow');

    expect(editRows.map((row) => row.props.accessibilityLabel)).toEqual([
      'Gewicht vom 2026-10-16, 80,0 kg bearbeiten',
    ]);
    expect(editRows[0]!.props.style).toEqual(expect.arrayContaining([
      expect.objectContaining({ flexWrap: 'nowrap' }),
    ]));
    invokeCallback(editRows[0]!.props.onPress);
    expect(onEdit).toHaveBeenCalledWith(entry);
    expect(swipeRows).toHaveLength(1);
    invokeCallback(swipeRows[0]!.props.onDelete);
    expect(onDelete).toHaveBeenCalledWith(entry);
    expect(renderer.root.findAll((node) => node.type === 'Icon'
      && (node.props.name === 'edit-2' || node.props.name === 'trash-2'))).toHaveLength(0);
  });
});