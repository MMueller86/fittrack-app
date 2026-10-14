import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoachingHeroCard } from './CoachingHeroCard';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-native', () => ({
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));

vi.mock('../../shared/components/Icon', () => ({ Icon: 'Icon' }));

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

const activeRenderers: ReactTestRenderer[] = [];

function renderCard(onTrainingPress: () => void = vi.fn()): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <CoachingHeroCard
        displayName="Alex"
        greeting="Guten Morgen"
        dayType="training"
        workoutType="gym"
        onTrainingPress={onTrainingPress}
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
});