import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  calculateWeightTrendRegressionSeries,
  type DiaryDayResponse,
  type WeightEntry,
} from '@fittrack/shared';
import { colors, spacing } from '../../app/theme';
import type { MacroTarget } from '../../shared/components/MacroSummaryCard';
import { DayNutritionCard } from './DayNutritionCard';
import { MACRO_TRACK_REFERENCE_POSITION } from './dayNutritionTrackGeometry';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { getWindowWidth, setWindowWidth } = vi.hoisted(() => {
  let width = 390;
  return {
    getWindowWidth: () => width,
    setWindowWidth: (nextWidth: number) => {
      width = nextWidth;
    },
  };
});

vi.mock('react-native', () => {
  class AnimatedValue {
    constructor(public value: number) {}

    setValue(value: number) {
      this.value = value;
    }

    interpolate(config: { inputRange: number[]; outputRange: number[] }) {
      return config;
    }
  }

  return {
    Animated: {
      Value: AnimatedValue,
      createAnimatedComponent: (component: unknown) => component,
      timing: () => ({ start: () => undefined }),
    },
    Easing: { out: (easing: unknown) => easing, cubic: 'cubic' },
    StyleSheet: { absoluteFill: {}, create: <T,>(styles: T) => styles },
    Text: 'Text',
    TouchableOpacity: 'TouchableOpacity',
    useWindowDimensions: () => ({ width: getWindowWidth(), height: 844, scale: 1, fontScale: 1 }),
    View: 'View',
  };
});

vi.mock('react-native-svg', () => ({
  default: 'Svg',
  Circle: 'Circle',
  G: 'G',
  Line: 'Line',
  Polyline: 'Polyline',
}));

vi.mock('../../shared/components/Icon', () => ({ Icon: 'Icon' }));

const SUMMARY: DiaryDayResponse['summary'] = {
  calories: 1_200,
  protein: 150.5,
  carbs: 245.25,
  fat: 42.75,
  fiber: 22.5,
};

const EMPTY_SUMMARY: DiaryDayResponse['summary'] = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
};

const TARGET: MacroTarget = {
  calories: 2_000,
  proteinG: 150,
  carbsG: 250,
  fatG: 70,
  fiberG: 25,
  macroRanges: {
    proteinG: { minG: 120, maxG: 160 },
    carbsG: { minG: 200, maxG: 300 },
  },
};

const REFERENCE_DATE = '2026-10-14';

function weightEntry(date: string, value: number, unit: WeightEntry['unit'] = 'kg'): WeightEntry {
  return {
    id: `${date}-${value}-${unit}`,
    userId: 'user-1',
    date,
    value,
    unit,
    createdAt: `${date}T12:00:00.000Z`,
  };
}

const TREND_ENTRIES = [
  weightEntry('2026-10-14', 70.6),
  weightEntry('2026-10-11', 70.5),
  weightEntry('2026-10-09', 70.4 * 2.20462, 'lbs'),
  weightEntry('2026-10-07', 70.3),
  weightEntry('2026-10-05', 70.2),
  weightEntry('2026-10-03', 70.1),
  weightEntry('2026-10-01', 70),
];

function weightEntriesForWeeklySlope(slopeKgPerWeek: number): WeightEntry[] {
  return Array.from({ length: 7 }, (_, index) => (
    weightEntry(
      `2026-10-${String(8 + index).padStart(2, '0')}`,
      70 + ((index - 3) * slopeKgPerWeek) / 7,
    )
  )).reverse();
}

const activeRenderers: ReactTestRenderer[] = [];

type TestInstanceWithChildren = ReactTestInstance & {
  children: Array<string | ReactTestInstance>;
};

function getTextContent(node: ReactTestInstance): string {
  return (node as TestInstanceWithChildren).children
    .map((child) => typeof child === 'string' ? child : getTextContent(child))
    .join('');
}

function getByTestId(renderer: ReactTestRenderer, testID: string): ReactTestInstance {
  const matches = renderer.root.findAll(
    (node) => typeof node.type === 'string' && node.props.testID === testID,
  );
  if (matches.length !== 1) {
    throw new Error(`Expected one element with testID ${testID}, found ${matches.length}`);
  }
  return matches[0]!;
}

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.map(flattenStyle));
  }
  return style != null && typeof style === 'object'
    ? style as Record<string, unknown>
    : {};
}

function renderCard(
  summary: DiaryDayResponse['summary'] | null = SUMMARY,
  activityBonus = 0,
  entries: WeightEntry[] = [],
  screenWidth = 390,
  hasFoodEntries = summary !== null && summary.calories > 0,
  target: MacroTarget = TARGET,
): ReactTestRenderer {
  setWindowWidth(screenWidth);
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <DayNutritionCard
        summary={summary}
        target={target}
        onPress={vi.fn()}
        activityBonus={activityBonus}
        entries={entries}
        referenceDate={REFERENCE_DATE}
        hasFoodEntries={hasFoodEntries}
      />,
    );
  });
  activeRenderers.push(renderer);
  return renderer;
}

afterEach(() => {
  while (activeRenderers.length > 0) {
    const renderer = activeRenderers.pop()!;
    act(() => renderer.unmount());
  }
  setWindowWidth(390);
});

describe('DayNutritionCard empty state', () => {
  it('shows a compact nutrition status without a duplicate add action or empty ring', () => {
    const renderer = renderCard(EMPTY_SUMMARY);

    expect(renderer.root.findAll((node) => (
      node.type === 'Text' && getTextContent(node) === 'Ernährung heute'
    ))).toHaveLength(1);
    expect(renderer.root.findAll((node) => (
      node.type === 'Text'
      && getTextContent(node) === 'Deine Übersicht erscheint hier, sobald du etwas einträgst.'
    ))).toHaveLength(1);
    expect(renderer.root.findAll((node) => node.props.testID === 'empty-state-add-food'))
      .toHaveLength(0);
    expect(renderer.root.findAll((node) => (
      node.type === 'Text' && getTextContent(node) === 'Essen hinzufügen'
    ))).toHaveLength(0);
    expect(renderer.root.findAll((node) => node.props.testID === 'calorie-ring')).toHaveLength(0);
    expect(renderer.root.findAll((node) => (
      typeof node.props.testID === 'string' && node.props.testID.startsWith('macro-track-')
    ))).toHaveLength(0);
    expect(getByTestId(renderer, 'weight-trend-summary')).toBeDefined();
    expect(flattenStyle(getByTestId(renderer, 'empty-state').props.style).alignItems)
      .toBe('flex-start');
  });

  it('treats a real zero-calorie food entry as populated data', () => {
    const renderer = renderCard({ ...EMPTY_SUMMARY, protein: 12 }, 0, [], 390, true);

    expect(renderer.root.findAll((node) => node.props.testID === 'empty-state')).toHaveLength(0);
    expect(renderer.root.findAll((node) => node.props.testID === 'calorie-ring')).toHaveLength(1);
    expect(getByTestId(renderer, 'macro-track-Protein')).toBeDefined();
    expect(renderer.root.findAll((node) => (
      node.props.accessibilityLabel === 'Protein: 12 g; Zielbereich 120 bis 160 g'
    ))).toHaveLength(1);
  });
});

describe('DayNutritionCard weight trend', () => {
  it('converts the latest full-history lbs measurement and keeps the weight panel in the empty-calorie state', () => {
    const renderer = renderCard(EMPTY_SUMMARY, 0, [weightEntry('2026-09-20', 150, 'lbs')]);
    const currentWeight = getByTestId(renderer, 'weight-current');

    expect(getTextContent(currentWeight)).toBe('68,04 kg');
    expect(getByTestId(renderer, 'weight-trend-summary').props.accessibilityLabel)
      .toBe('Aktuelles Gewicht: 68,04 kg');
    expect(renderer.root.findAll((node) => node.props.testID === 'weight-sparkline')).toHaveLength(0);
    expect(renderer.root.findAll((node) => (
      typeof node.props.testID === 'string' && node.props.testID.startsWith('macro-track-')
    ))).toHaveLength(0);
  });

  it('shows only current weight when the 14-day window has one measurement', () => {
    const renderer = renderCard(SUMMARY, 0, [weightEntry(REFERENCE_DATE, 70.4)]);

    expect(getTextContent(getByTestId(renderer, 'weight-current'))).toBe('70,40 kg');
    expect(getByTestId(renderer, 'weight-trend-summary').props.accessibilityLabel)
      .toBe('Aktuelles Gewicht: 70,40 kg');
    expect(renderer.root.findAll((node) => node.props.testID === 'weight-sparkline')).toHaveLength(0);
    expect(renderer.root.findAll((node) => (
      typeof node.props.testID === 'string'
      && node.props.testID.startsWith('weight-measurement-')
    ))).toHaveLength(0);
    expect(renderer.root.findAll((node) => node.props.testID === 'weight-trend-label')).toHaveLength(0);
  });

  it('plots the shared 14-day measurements and raw fitted endpoints with calendar-day spacing', () => {
    const entries = [
      ...TREND_ENTRIES,
      weightEntry('2026-09-30', 69.9),
      weightEntry('2026-10-15', 70.7),
    ];
    const renderer = renderCard(SUMMARY, 0, entries);
    const series = calculateWeightTrendRegressionSeries(
      entries,
      14,
      new Date(`${REFERENCE_DATE}T12:00:00`),
    );
    const actualLine = getByTestId(renderer, 'weight-actual-line');
    const regressionLine = getByTestId(renderer, 'weight-regression-line');
    const actualCoordinates = String(actualLine.props.points).split(' ').map((point) => (
      point.split(',').map(Number)
    ));
    const regressionCoordinates = String(regressionLine.props.points).split(' ').map((point) => (
      point.split(',').map(Number)
    ));
    const trendLabel = getByTestId(renderer, 'weight-trend-label');

    expect(series.measurements).toHaveLength(7);
    expect(series.measurements.find((point) => point.date === '2026-10-09')?.weightKg)
      .toBeCloseTo(70.4);
    expect(renderer.root.findAll((node) => (
      node.type === 'Circle' && typeof node.props.testID === 'string'
        && node.props.testID.startsWith('weight-measurement-')
    ))).toHaveLength(7);
    expect(actualCoordinates).toHaveLength(7);
    expect(actualCoordinates[0]?.[0]).toBe(3);
    expect(actualCoordinates[actualCoordinates.length - 1]?.[0]).toBe(93);
    expect(actualCoordinates[1]?.[0]! - actualCoordinates[0]?.[0]!)
      .toBeCloseTo(2 / 13 * 90);
    expect(regressionCoordinates).toHaveLength(2);
    expect(regressionCoordinates[0]?.[0]).toBe(actualCoordinates[0]?.[0]);
    expect(regressionCoordinates[1]?.[0]).toBe(actualCoordinates[actualCoordinates.length - 1]?.[0]);
    expect(regressionCoordinates[0]?.[1]).not.toBe(regressionCoordinates[1]?.[1]);
    expect(getTextContent(trendLabel)).toBe(new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(series.slopeKgPerWeek!) + ' kg/Woche');
    expect(actualLine.props.stroke).toBe(colors.textMuted);
    expect(actualLine.props.strokeOpacity).toBe(0.45);
    expect(actualLine.props.strokeWidth).toBe(1);
    expect(regressionLine.props.stroke).toBe(colors.text);
    expect(regressionLine.props.strokeWidth).toBe(2.5);
    const measurement = getByTestId(renderer, 'weight-measurement-0');
    expect(measurement.props).toMatchObject({ r: 1.25, fill: colors.textMuted, fillOpacity: 0.6 });
    const sparkline = getByTestId(renderer, 'weight-sparkline');
    expect((sparkline as TestInstanceWithChildren).children.at(-1)).toBe(regressionLine);
    expect(getByTestId(renderer, 'weight-sparkline').props.importantForAccessibility)
      .toBe('no-hide-descendants');
  });

  it('keeps actual measurements but hides regression and rate below seven entries', () => {
    const renderer = renderCard(SUMMARY, 0, TREND_ENTRIES.slice(0, 6));

    expect(renderer.root.findAll((node) => node.props.testID === 'weight-actual-line')).toHaveLength(1);
    expect(renderer.root.findAll((node) => node.props.testID === 'weight-regression-line')).toHaveLength(0);
    expect(renderer.root.findAll((node) => node.props.testID === 'weight-trend-label')).toHaveLength(0);
    expect(getByTestId(renderer, 'weight-trend-summary').props.accessibilityLabel)
      .toBe('Aktuelles Gewicht: 70,60 kg');
  });

  it('hides the rate and fitted line when seven measurements have no date variance', () => {
    const sameDayEntries = Array.from({ length: 7 }, (_, index) => (
      weightEntry(REFERENCE_DATE, 70 + index / 10)
    ));
    const renderer = renderCard(SUMMARY, 0, sameDayEntries);

    expect(renderer.root.findAll((node) => node.props.testID === 'weight-regression-line')).toHaveLength(0);
    expect(renderer.root.findAll((node) => node.props.testID === 'weight-trend-label')).toHaveLength(0);
  });

  it('shows a neutral label below the threshold without flattening the fit line', () => {
    const lowSlopeEntries = Array.from({ length: 7 }, (_, index) => (
      weightEntry(
        `2026-10-${String(1 + index * 2).padStart(2, '0')}`,
        70 + index * 0.005,
      )
    ));
    const renderer = renderCard(SUMMARY, 0, lowSlopeEntries);
    const regressionLine = getByTestId(renderer, 'weight-regression-line');
    const points = String(regressionLine.props.points).split(' ').map((point) => (
      point.split(',').map(Number)
    ));

    expect(getTextContent(getByTestId(renderer, 'weight-trend-label')))
      .toBe('0,0 kg/Woche');
    expect(points[0]?.[1]).not.toBe(points[1]?.[1]);
  });

  it.each([
    { slopeKgPerWeek: 0.049, expectedLabel: '0,0 kg/Woche' },
    { slopeKgPerWeek: -0.049, expectedLabel: '0,0 kg/Woche' },
    { slopeKgPerWeek: 0.05, expectedLabel: '0,1 kg/Woche' },
    { slopeKgPerWeek: -0.05, expectedLabel: '−0,1 kg/Woche' },
    { slopeKgPerWeek: 0.16, expectedLabel: '0,2 kg/Woche' },
    { slopeKgPerWeek: -0.16, expectedLabel: '−0,2 kg/Woche' },
  ])('formats raw weekly slope $slopeKgPerWeek without changing its fit line', ({
    slopeKgPerWeek,
    expectedLabel,
  }) => {
    const entries = weightEntriesForWeeklySlope(slopeKgPerWeek);
    const series = calculateWeightTrendRegressionSeries(
      entries,
      14,
      new Date(`${REFERENCE_DATE}T12:00:00`),
    );
    const renderer = renderCard(SUMMARY, 0, entries);
    const regressionLine = getByTestId(renderer, 'weight-regression-line');
    const points = String(regressionLine.props.points).split(' ').map((point) => (
      point.split(',').map(Number)
    ));

    expect(series.slopeKgPerWeek).toBeCloseTo(slopeKgPerWeek, 12);
    if (Math.abs(slopeKgPerWeek) === 0.05) {
      expect(Math.abs(series.slopeKgPerWeek ?? 0)).toBeGreaterThanOrEqual(0.05);
    }
    expect(getTextContent(getByTestId(renderer, 'weight-trend-label'))).toBe(expectedLabel);
    expect(points[0]?.[1]).not.toBe(points[1]?.[1]);
  });

  it.each([
    { screenWidth: 320, direction: 'column', sparklineWidth: 104 },
    { screenWidth: 360, direction: 'column', sparklineWidth: 104 },
    { screenWidth: 380, direction: 'row', sparklineWidth: 96 },
    { screenWidth: 390, direction: 'row', sparklineWidth: 96 },
  ])('uses a readable overview layout at $screenWidth dp and keeps macros below it', ({
    screenWidth,
    direction,
    sparklineWidth,
  }) => {
    const renderer = renderCard(SUMMARY, 0, TREND_ENTRIES, screenWidth);
    const overview = getByTestId(renderer, 'calorie-weight-overview');
    const overviewStyle = flattenStyle(overview.props.style);
    const caloriePanelStyle = flattenStyle(getByTestId(renderer, 'calorie-panel').props.style);
    const weightPanelStyle = flattenStyle(getByTestId(renderer, 'weight-trend-summary').props.style);
    const separatorStyle = flattenStyle(getByTestId(renderer, 'calorie-weight-separator').props.style);
    const testIDs = renderer.root.findAll((node) => typeof node.props.testID === 'string')
      .map((node) => String(node.props.testID));

    expect(overviewStyle.flexDirection).toBe(direction);
    expect(getByTestId(renderer, 'weight-sparkline').props.width).toBe(sparklineWidth);
    if (direction === 'row') {
      const contentWidth = screenWidth - spacing.md * 4 - 2;
      const gap = Number(overviewStyle.gap);
      const flexibleWidth = contentWidth - gap * 2 - Number(separatorStyle.width);
      const calorieWidth = flexibleWidth
        * Number(caloriePanelStyle.flex)
        / (Number(caloriePanelStyle.flex) + Number(weightPanelStyle.flex));
      const dividerCenter = calorieWidth + gap + Number(separatorStyle.width) / 2;
      const macroReference = contentWidth * MACRO_TRACK_REFERENCE_POSITION;

      expect(Math.abs(dividerCenter - macroReference)).toBeLessThan(1);
    }
    expect(testIDs.indexOf('calorie-weight-overview')).toBeLessThan(testIDs.indexOf('nutrition-divider'));
    expect(testIDs.indexOf('nutrition-divider')).toBeLessThan(testIDs.indexOf('macro-track-Protein'));
  });
});

describe('DayNutritionCard macro tracks', () => {
  it('renders four stable rows with whole-gram values and one shared 100% reference', () => {
    const renderer = renderCard();
    const labels = [
      'Protein: 151 g; Zielbereich 120 bis 160 g',
      'Kohlenhydrate: 245 g; Zielbereich 200 bis 300 g',
      'Fett: 43 g; Ziel 70 g',
      'Ballaststoffe: 23 g; Ziel 25 g',
    ];

    for (const label of labels) {
      expect(renderer.root.findAll((node) => node.props.accessibilityLabel === label)).toHaveLength(1);
    }

    const macroTrackIds = [
      'macro-track-Protein',
      'macro-track-Kohlenhydrate',
      'macro-track-Fett',
      'macro-track-Ballaststoffe',
    ];
    expect(macroTrackIds.map((testID) => getByTestId(renderer, testID).props.style)).toHaveLength(4);
    const valueTexts = renderer.root.findAll(
      (node) => node.type === 'Text' && flattenStyle(node.props.style).textAlign === 'right',
    );
    expect(valueTexts).toHaveLength(4);
    expect(valueTexts.every((node) => flattenStyle(node.props.style).flexShrink === 1)).toBe(true);
    const macroLabels = renderer.root.findAll((node) => (
      node.type === 'Text'
      && ['Protein', 'Kohlenhydrate', 'Fett', 'Ballaststoffe'].includes(getTextContent(node))
    ));
    expect(macroLabels.every((node) => flattenStyle(node.props.style).flexShrink === 1)).toBe(true);

    const proteinBand = flattenStyle(getByTestId(renderer, 'macro-track-Protein-range').props.style);
    const carbsBand = flattenStyle(getByTestId(renderer, 'macro-track-Kohlenhydrate-range').props.style);
    expect(proteinBand.left).toBe('50%');
    expect(parseFloat(String(proteinBand.width))).toBeCloseTo(100 / 6);
    expect(parseFloat(String(carbsBand.left))).toBeCloseTo(400 / 9);
    expect(parseFloat(String(carbsBand.width))).toBeCloseTo(200 / 9);
    expect(proteinBand.borderColor).toBe(colors.macro.protein);
    expect(carbsBand.borderColor).toBe(colors.macro.carbohydrates);
    expect(proteinBand.opacity).toBe(0.4);
    expect(carbsBand.opacity).toBe(0.4);
    const tint = (getByTestId(renderer, 'macro-track-Protein-range') as TestInstanceWithChildren).children[0];
    expect(typeof tint).not.toBe('string');
    expect(flattenStyle((tint as ReactTestInstance).props.style).opacity).toBe(0.12);

    for (const testID of macroTrackIds) {
      const marker = flattenStyle(getByTestId(renderer, `${testID}-reference`).props.style);
      expect(marker.left).toBe('66.66666666666666%');
      expect(marker.backgroundColor).toBe(colors.text);
      expect(marker.borderColor).toBe(colors.surface);
    }
    expect(renderer.root.findAll((node) => node.props.testID === 'macro-reference-axis')).toHaveLength(0);
    expect(renderer.root.findAll((node) => node.type === 'Text' && getTextContent(node) === '100 %')).toHaveLength(0);

    const macroRows = renderer.root.findAll(
      (node) => typeof node.props.accessibilityLabel === 'string'
        && labels.includes(node.props.accessibilityLabel),
    );
    const macroText = macroRows.map(getTextContent).join(' ');
    expect(macroText).toContain('151 / 120–160 g');
    expect(macroText).not.toMatch(/%|noch|Rest|Status/i);
  });

  it.each([
    { protein: 120, screenWidth: 320 },
    { protein: 150.5, screenWidth: 390 },
    { protein: 999, screenWidth: 430 },
  ])('anchors the flag over the 100% marker at $protein g and $screenWidth dp', ({ protein, screenWidth }) => {
    const renderer = renderCard({ ...SUMMARY, protein }, 0, [], screenWidth);
    const group = getByTestId(renderer, 'macro-values-Protein');
    const flag = getByTestId(renderer, 'macro-target-flag');
    const track = getByTestId(renderer, 'macro-track-Protein');
    const info = getByTestId(renderer, 'macro-info-Protein');
    const reference = getByTestId(renderer, 'macro-track-Protein-reference');
    const flagStyle = flattenStyle(flag.props.style);

    expect((info as TestInstanceWithChildren).children).toContain(flag);
    expect((info as TestInstanceWithChildren).children).toContain(group);
    expect(group.findAll((node) => node.props.testID === 'macro-target-flag')).toHaveLength(0);
    expect(flagStyle.left).toBe(flattenStyle(reference.props.style).left);
    expect(flagStyle).toMatchObject({
      position: 'absolute',
      top: '50%',
      marginTop: -spacing.md / 2,
      marginLeft: -spacing.md / 2,
      width: spacing.md,
      height: spacing.md,
    });
    expect(flattenStyle(track.props.style).marginTop).toBeUndefined();
    expect(flattenStyle(info.props.style)).toMatchObject({ flexDirection: 'row', minHeight: spacing.md });
    expect(flattenStyle(group.props.style)).toMatchObject({
      flex: 0,
      marginLeft: 'auto',
      paddingLeft: spacing.md / 2 + spacing.xs,
    });
    expect(parseFloat(String(flattenStyle(group.props.style).width))).toBeCloseTo(100 / 3);
    const valueText = group.findAll((node) => node.type === 'Text' && node.props.numberOfLines === 1);
    expect(valueText).toHaveLength(1);
    expect(valueText[0]?.props.adjustsFontSizeToFit).toBe(true);
    expect(flattenStyle(group.props.style)).toMatchObject({ flexDirection: 'row', justifyContent: 'flex-end' });
    expect(flattenStyle(flag.props.style)).toMatchObject({ opacity: 0.5, flexShrink: 0 });
    expect(flag.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(getTextContent(group)).toBe(`${Math.round(protein)} / 120–160 g`);
    const icons = renderer.root.findAll((node) => node.type === 'Icon');
    expect(icons).toHaveLength(1);
    expect(icons[0]?.props).toMatchObject({ lib: 'mci', name: 'flag-checkered', size: 'sm' });
  });

  it('rounds fractional targets only for display and preserves precise fill and range geometry', () => {
    const target: MacroTarget = {
      ...TARGET,
      fatG: 70.6,
      macroRanges: { ...TARGET.macroRanges!, proteinG: { minG: 120.4, maxG: 160.6 } },
    };
    const summary = Object.freeze({ ...SUMMARY });
    const renderer = renderCard(summary, 0, [], 390, true, target);

    expect(getTextContent(getByTestId(renderer, 'macro-values-Protein'))).toBe('151 / 120–161 g');
    expect(getTextContent(getByTestId(renderer, 'macro-values-Fett'))).toBe('43 / 71 g');
    expect(renderer.root.findAll((node) => (
      node.props.accessibilityLabel === 'Protein: 151 g; Zielbereich 120 bis 161 g'
    ))).toHaveLength(1);
    const fill = flattenStyle(getByTestId(renderer, 'macro-track-Protein-fill').props.style);
    const range = flattenStyle(getByTestId(renderer, 'macro-track-Protein-range').props.style);
    expect(parseFloat(String(fill.width))).toBeCloseTo(150.5 / 160.6 / 1.5 * 100, 10);
    expect(parseFloat(String(range.left))).toBeCloseTo(120.4 / 160.6 / 1.5 * 100, 10);
    expect(summary.protein).toBe(150.5);
    expect(target.macroRanges?.proteinG).toEqual({ minG: 120.4, maxG: 160.6 });
  });

  it.each([0, 60, 120, 150, 160, 200, 260])('keeps range boundaries visible at %s g', (protein) => {
    const renderer = renderCard({ ...SUMMARY, protein });
    const track = getByTestId(renderer, 'macro-track-Protein');
    const start = getByTestId(renderer, 'macro-track-Protein-range-start');
    const reference = getByTestId(renderer, 'macro-track-Protein-reference');
    const fill = getByTestId(renderer, 'macro-track-Protein-fill');

    expect(flattenStyle(start.props.style).left).toBe('50%');
    expect(flattenStyle(start.props.style).opacity).toBe(0.4);
    expect(flattenStyle(reference.props.style).left).toBe('66.66666666666666%');
    expect(parseFloat(String(flattenStyle(fill.props.style).width)))
      .toBeCloseTo(Math.min(protein / 240, 1) * 100);
    expect((track as TestInstanceWithChildren).children.slice(-2)).toEqual([start, reference]);
    expect(renderer.root.findAll((node) => (
      node.type === 'View' && ['macro-track-Fett-range', 'macro-track-Ballaststoffe-range'].includes(String(node.props.testID))
    ))).toHaveLength(0);
  });

  it('keeps the activity allowance separate and visible at zero kcal', () => {
    const renderer = renderCard(EMPTY_SUMMARY, 500);
    const bonusRow = renderer.root.findAll(
      (node) => node.props.accessibilityLabel === 'Aktivitätsbonus: 0 kcal von 500 kcal',
    );
    const bonusTrack = getByTestId(renderer, 'activity-bonus-track');

    expect(bonusRow).toHaveLength(1);
    expect(getTextContent(bonusRow[0]!)).toContain('0 / 500 kcal');
    expect(bonusTrack.findAll((node) => node.type === 'Line')).toHaveLength(0);
    expect(bonusTrack.findAll((node) => {
      const style = flattenStyle(node.props.style);
      return style.position === 'absolute' && typeof style.left === 'string';
    })).toHaveLength(0);
    expect(renderer.root.findAll((node) => (
      typeof node.props.testID === 'string' && node.props.testID.startsWith('macro-track-')
    ))).toHaveLength(0);
  });

  it('keeps profile macro ranges while rendering activity bonus as a separate kcal track', () => {
    const renderer = renderCard(SUMMARY, 500);
    const bonusRow = renderer.root.findAll(
      (node) => node.props.accessibilityLabel === 'Aktivitätsbonus: 0 kcal von 500 kcal',
    );
    const bonusTrack = getByTestId(renderer, 'activity-bonus-track');
    const macroTracks = renderer.root.findAll((node) => (
      node.type === 'View'
      && typeof node.props.testID === 'string'
      && node.props.testID.startsWith('macro-track-')
    ));
    const bonusFill = bonusTrack.findAll((node) => (
      node.type === 'View' && typeof flattenStyle(node.props.style).width === 'string'
    ))[0];
    const bonusLabel = bonusRow[0]?.findAll((node) => (
      node.type === 'Text' && getTextContent(node) === 'Aktivitätsbonus'
    ))[0];
    const bonusValue = bonusRow[0]?.findAll((node) => (
      node.type === 'Text' && flattenStyle(node.props.style).flex === 1
    ))[0];

    expect(bonusRow).toHaveLength(1);
    expect(getTextContent(bonusRow[0]!)).toContain('0 / 500 kcal');
    expect(getTextContent(bonusRow[0]!)).not.toContain(' g');
    expect(macroTracks.filter((node) => typeof node.props.testID === 'string' && [
      'macro-track-Protein', 'macro-track-Kohlenhydrate', 'macro-track-Fett', 'macro-track-Ballaststoffe',
    ].includes(node.props.testID))).toHaveLength(4);
    expect(renderer.root.findAll((node) => (
      node.props.accessibilityLabel === 'Protein: 151 g; Zielbereich 120 bis 160 g'
      || node.props.accessibilityLabel === 'Kohlenhydrate: 245 g; Zielbereich 200 bis 300 g'
    ))).toHaveLength(2);
    expect(flattenStyle(bonusLabel?.props.style).width).toBe(104);
    expect(flattenStyle(bonusValue?.props.style)).toMatchObject({ flex: 1, flexShrink: 1 });
    expect(flattenStyle(bonusFill?.props.style)).toMatchObject({
      width: '0%',
      backgroundColor: colors.chart.specialActivityOutline,
    });
  });

  it('keeps the macro color when intake exceeds the render limit', () => {
    const renderer = renderCard({ ...SUMMARY, protein: 260 });
    const proteinRow = renderer.root.findAll(
      (node) => node.props.accessibilityLabel === 'Protein: 260 g; Zielbereich 120 bis 160 g',
    )[0];
    const proteinTrack = getByTestId(renderer, 'macro-track-Protein');
    const fill = getByTestId(renderer, 'macro-track-Protein-fill');

    expect(proteinRow).toBeDefined();
    expect(getTextContent(proteinRow!)).toContain('260 / 120–160 g');
    expect(flattenStyle(fill?.props.style)).toMatchObject({
      width: '100%',
      backgroundColor: colors.macro.protein,
    });
    expect(getByTestId(renderer, 'macro-track-Protein-range')).toBeDefined();
    expect(getByTestId(renderer, 'macro-track-Protein-reference')).toBeDefined();
    expect((proteinTrack as TestInstanceWithChildren).children.at(-1))
      .toBe(getByTestId(renderer, 'macro-track-Protein-reference'));
  });

  it('keeps the effective calorie target and bonus badge display unchanged', () => {
    const renderer = renderCard({ ...SUMMARY, calories: 2_250 }, 500);
    const visibleText = renderer.root.findAll((node) => node.type === 'Text').map(getTextContent);

    expect(visibleText).toContain('Ziel 2500 kcal +500');
    expect(visibleText).toContain('250');
    expect(visibleText).toContain('250 / 500 kcal');
    expect(renderer.root.findAll((node) => (
      node.props.accessibilityLabel === 'Protein: 151 g; Zielbereich 120 bis 160 g'
      || node.props.accessibilityLabel === 'Kohlenhydrate: 245 g; Zielbereich 200 bis 300 g'
    ))).toHaveLength(2);

    const ring = renderer.root.findAll((node) => (
      node.type === 'Circle' && node.props.strokeDasharray != null
    ))[0];
    const dashOffset = ring?.props.strokeDashoffset as { outputRange: number[] };
    expect(ring?.props.stroke).toBe(colors.primary);
    expect(dashOffset.outputRange[1] / dashOffset.outputRange[0]).toBeCloseTo(0.1);
  });
});