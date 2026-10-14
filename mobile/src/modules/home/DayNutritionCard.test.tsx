import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiaryDayResponse } from '@fittrack/shared';
import { colors } from '../../app/theme';
import type { MacroTarget } from '../../shared/components/MacroSummaryCard';
import { DayNutritionCard } from './DayNutritionCard';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
    StyleSheet: { absoluteFillObject: {}, create: <T,>(styles: T) => styles },
    Text: 'Text',
    TouchableOpacity: 'TouchableOpacity',
    View: 'View',
  };
});

vi.mock('react-native-svg', () => ({
  default: 'Svg',
  Circle: 'Circle',
  G: 'G',
  Line: 'Line',
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
    (node) => node.type === 'View' && node.props.testID === testID,
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
): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <DayNutritionCard
        summary={summary}
        target={TARGET}
        onPress={vi.fn()}
        activityBonus={activityBonus}
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
});

describe('DayNutritionCard macro tracks', () => {
  it('renders four stable rows with exact accessible values and one shared 100% reference', () => {
    const renderer = renderCard();
    const labels = [
      'Protein: 150,5 g; Zielbereich 120 bis 160 g',
      'Kohlenhydrate: 245,25 g; Zielbereich 200 bis 300 g',
      'Fett: 42,75 g; Ziel 70 g',
      'Ballaststoffe: 22,5 g; Ziel 25 g',
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
    expect(macroText).toContain('150,5 / 120–160 g');
    expect(macroText).not.toMatch(/%|noch|Rest|Status/i);
  });

  it.each([120, 150.5, 999])('keeps a translucent flag beside the full three-digit protein value %s', (protein) => {
    const renderer = renderCard({ ...SUMMARY, protein });
    const group = getByTestId(renderer, 'macro-values-Protein');
    const flag = getByTestId(renderer, 'macro-target-flag');

    expect((group as TestInstanceWithChildren).children[0]).toBe(flag);
    expect(flattenStyle(group.props.style)).toMatchObject({ flexDirection: 'row', justifyContent: 'flex-end' });
    expect(flattenStyle(flag.props.style)).toMatchObject({ opacity: 0.5, flexShrink: 0 });
    expect(flag.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(getTextContent(group)).toBe(`${String(protein).replace('.', ',')} / 120–160 g`);
    const icons = renderer.root.findAll((node) => node.type === 'Icon');
    expect(icons).toHaveLength(1);
    expect(icons[0]?.props).toMatchObject({ lib: 'mci', name: 'flag-checkered', size: 'sm' });
  });

  it.each([0, 60, 120, 150, 160, 200, 260])('keeps range boundaries visible at %s g', (protein) => {
    const renderer = renderCard({ ...SUMMARY, protein });
    const track = getByTestId(renderer, 'macro-track-Protein');
    const start = getByTestId(renderer, 'macro-track-Protein-range-start');
    const reference = getByTestId(renderer, 'macro-track-Protein-reference');
    const fill = getByTestId(renderer, 'macro-track-Protein-fill');

    expect(flattenStyle(start.props.style).left).toBe('50%');
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
      node.props.accessibilityLabel === 'Protein: 150,5 g; Zielbereich 120 bis 160 g'
      || node.props.accessibilityLabel === 'Kohlenhydrate: 245,25 g; Zielbereich 200 bis 300 g'
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
      node.props.accessibilityLabel === 'Protein: 150,5 g; Zielbereich 120 bis 160 g'
      || node.props.accessibilityLabel === 'Kohlenhydrate: 245,25 g; Zielbereich 200 bis 300 g'
    ))).toHaveLength(2);

    const ring = renderer.root.findAll((node) => (
      node.type === 'Circle' && node.props.strokeDasharray != null
    ))[0];
    const dashOffset = ring?.props.strokeDashoffset as { outputRange: number[] };
    expect(ring?.props.stroke).toBe(colors.primary);
    expect(dashOffset.outputRange[1] / dashOffset.outputRange[0]).toBeCloseTo(0.1);
  });
});