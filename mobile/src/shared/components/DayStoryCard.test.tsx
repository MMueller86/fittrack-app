import React, { createRef } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { ScrollViewInstance } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiaryDayResponse } from '@fittrack/shared';
import { DayStoryCard } from './DayStoryCard';
import type { MacroTarget } from './MacroSummaryCard';

vi.mock('react-native', () => ({
  Modal: 'Modal',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));

vi.mock('react-native-svg', () => ({
  default: 'Svg',
  Circle: 'Circle',
  Line: 'Line',
  Path: 'Path',
}));

vi.mock('./Icon', () => ({ Icon: () => null }));
vi.mock('./MealChip', () => ({ MealChip: () => null }));

const SUMMARY: DiaryDayResponse['summary'] = {
  calories: 1200,
  protein: 100,
  carbs: 140,
  fat: 40,
  fiber: 15,
};

const PROFILE_TARGET: MacroTarget = {
  calories: 2000,
  proteinG: 150,
  carbsG: 325,
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

function getRenderedText(renderer: ReactTestRenderer): string[] {
  return renderer.root
    .findAll((node) => node.type === 'Text')
    .map(getTextContent);
}

function renderCard(target: MacroTarget | null, bonus?: number): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <DayStoryCard
        summary={SUMMARY}
        target={target}
        meals={[]}
        mealSummaries={[]}
        scrollRef={createRef<ScrollViewInstance>()}
        mealOffsets={{}}
        activityBonusInfo={bonus == null ? undefined : { bonus, onShowBreakdown: vi.fn() }}
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

describe('DayStoryCard macro targets', () => {
  it('shows profile ranges in the diary rows and protein breakdown', async () => {
    const renderer = renderCard(PROFILE_TARGET);
    const initialText = getRenderedText(renderer).join(' ');

    expect(initialText).toContain('120–160 g');
    expect(initialText).toContain('200–300 g');

    const proteinRow = renderer.root.findAll((node) =>
      node.type === 'TouchableOpacity' && getTextContent(node).includes('EW'),
    )[0];
    const onPress = proteinRow?.props.onPress as (() => void) | undefined;
    expect(onPress).toBeDefined();
    await act(async () => onPress?.());

    expect(getRenderedText(renderer).join(' ')).toContain(
      'Gesamt: 100 g  /  Zielbereich: 120–160 g',
    );
  });

  it('keeps selected profile ranges unchanged when a special-activity bonus is present', () => {
    const renderer = renderCard(PROFILE_TARGET, 500);
    const text = getRenderedText(renderer).join(' ');

    expect(text).toContain('120–160 g');
    expect(text).toContain('200–300 g');
    expect(text).not.toContain('325–425');
  });

  it('shows historical consumption without implying saved macro targets', () => {
    const renderer = renderCard(null);
    const text = getRenderedText(renderer).join(' ');

    expect(text).toContain('verzehrt');
    expect(text).not.toContain('120–160');
    expect(text).not.toContain('200–300');
    expect(text).not.toContain(' / 150');
    expect(text).not.toContain(' / 325');
  });
});