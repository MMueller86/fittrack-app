import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoachingHeroCard } from './CoachingHeroCard';
import type { DailyInsightResponse } from '../../services/insightService';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-native', () => ({
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));

vi.mock('../../shared/components/Icon', () => ({ Icon: 'Icon' }));
vi.mock('./InsightCard', () => ({ InsightCard: 'InsightDetail' }));
vi.mock('../../shared/api/aiApi', () => ({ aiApi: { getDailyInsight: vi.fn() } }));

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

function getDetail(renderer: ReactTestRenderer) {
  return renderer.root.findAll((node) => node.type === 'InsightDetail')[0]!;
}

function invoke(callback: unknown) {
  if (typeof callback !== 'function') throw new Error('Expected callback');
  act(() => callback());
}

const activeRenderers: ReactTestRenderer[] = [];

const INSIGHT: DailyInsightResponse = {
  greeting: 'Hallo, Alex! 👋',
  shortInsight: 'Dein Gewichtsverlauf bleibt stabil.',
  title: 'Dein Verlauf',
  summary: 'Der vollständige unveränderte Insight.',
  generatedAt: '2026-10-16T10:00:00.000Z',
  promptVersion: 'v23',
  status: 'fresh',
};

function renderCard(onTrainingPress: () => void = vi.fn(), insight: DailyInsightResponse | null = null): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <CoachingHeroCard
        displayName="Alex"
        greeting="Guten Morgen"
        dayType="training"
        workoutType="gym"
        onTrainingPress={onTrainingPress}
        insight={insight}
        insightDate="2026-10-16"
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

describe('CoachingHeroCard', () => {
  it('contains only the greeting and the right-aligned day selector', () => {
    const renderer = renderCard();
    const row = getByTestId(renderer, 'coaching-hero-row');
    const selector = getByTestId(renderer, 'training-selector');
    const texts = renderer.root.findAll((node) => node.type === 'Text').map(getTextContent);

    expect(texts).toEqual(['Guten Morgen, Alex  👋', 'Alex', 'Gym', '▾']);
    expect((row as TestInstanceWithChildren).children[1]).toBe(selector);
    expect(row.props.style).toMatchObject({
      flexDirection: 'row',
      justifyContent: 'space-between',
    });
    expect(selector.props.accessibilityRole).toBe('button');
    expect(selector.props.accessibilityLabel).toBe('Tagesart auswählen: Gym');
    expect(renderer.root.findAll((node) => node.type === 'Svg')).toHaveLength(0);
    expect(texts.join(' ')).not.toMatch(/Hint|seit gestern|kg|Gewicht/i);
  });

  it('keeps the existing day-selection callback wired to the selector', () => {
    const onTrainingPress = vi.fn();
    const renderer = renderCard(onTrainingPress);

    const onPress = getByTestId(renderer, 'training-selector').props.onPress;
    expect(typeof onPress).toBe('function');
    act(() => (onPress as () => void)());

    expect(onTrainingPress).toHaveBeenCalledOnce();
  });

  it.each(['fresh', 'cached'] as const)('renders the supplied %s pair without shortening or generating copy', (status) => {
    const insight = { ...INSIGHT, status, greeting: 'a'.repeat(120), shortInsight: `${'b'.repeat(239)}.` };
    const renderer = renderCard(vi.fn(), insight);
    const texts = renderer.root.findAll((node) => node.type === 'Text').map(getTextContent);
    expect(texts).toContain(insight.greeting);
    expect(texts).toContain(insight.shortInsight);
    expect(getByTestId(renderer, 'short-insight').props.numberOfLines).toBeUndefined();
    const toggle = renderer.root.findAll((node) => node.props.accessibilityLabel === 'Mehr anzeigen')[0]!;
    expect(toggle.props.style).toMatchObject({ minHeight: 48 });
    expect(getByTestId(renderer, 'training-selector').props.style).toMatchObject({ minHeight: 48 });
  });

  it.each([
    null,
    { ...INSIGHT, status: 'unavailable' as const },
    { ...INSIGHT, status: 'quota_exceeded' as const },
    { ...INSIGHT, greeting: undefined },
    { ...INSIGHT, shortInsight: undefined },
    { ...INSIGHT, greeting: ' ' },
    { ...INSIGHT, shortInsight: '' },
    { ...INSIGHT, greeting: 'a'.repeat(121) },
    { ...INSIGHT, shortInsight: 'a'.repeat(241) },
  ])('uses only the existing static greeting for unavailable or incomplete content %#', (insight) => {
    const renderer = renderCard(vi.fn(), insight);
    expect(renderer.root.findAll((node) => node.props.accessibilityLabel === 'Mehr anzeigen')).toHaveLength(0);
    expect(renderer.root.findAll((node) => node.props.testID === 'short-insight')).toHaveLength(0);
    expect(renderer.root.findAll((node) => node.type === 'Text').map(getTextContent)).toContain('Guten Morgen, Alex  👋');
  });

  it('expands the full insight inline and allows it to collapse again', () => {
    const renderer = renderCard(vi.fn(), INSIGHT);
    expect(renderer.root.findAll((node) => node.type === 'InsightDetail')).toHaveLength(0);
    const expand = renderer.root.findAll((node) => node.props.accessibilityLabel === 'Mehr anzeigen')[0]!;
    expect(expand.props.accessibilityState).toEqual({ expanded: false });
    invoke(expand.props.onPress);

    const detail = getDetail(renderer);
    expect(detail.props.insight).toBe(INSIGHT);
    expect(detail.props.date).toBe('2026-10-16');
    expect(detail.props.inlineDetail).toBe(true);
    expect(detail.props.detail).toBeUndefined();
    const collapse = renderer.root.findAll((node) => node.props.accessibilityLabel === 'Weniger anzeigen')[0]!;
    expect(collapse.props.accessibilityState).toEqual({ expanded: true });
    invoke(collapse.props.onPress);
    expect(renderer.root.findAll((node) => node.type === 'InsightDetail')).toHaveLength(0);
    expect(renderer.root.findAll((node) => node.props.accessibilityLabel === 'Mehr anzeigen')).toHaveLength(1);
  });
});