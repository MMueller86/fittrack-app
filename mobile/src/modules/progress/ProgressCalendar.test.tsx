import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WeightEntry } from '@fittrack/shared';

vi.mock('react-native', () => ({
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));

vi.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'AnimatedView' },
  useAnimatedStyle: (createStyle: () => object) => createStyle(),
  useSharedValue: (value: number) => ({ value }),
  withTiming: (value: number) => value,
}));

vi.mock('../../shared/components/Icon', () => ({ Icon: 'Icon' }));

import { ProgressCalendar } from './ProgressCalendar';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const activeRenderers: ReactTestRenderer[] = [];

type TouchableTestInstance = ReactTestInstance & {
  props: {
    onPress: () => void;
    disabled?: boolean;
    accessibilityState?: { selected?: boolean; disabled?: boolean };
  };
};

function getTextContent(node: ReactTestInstance): string {
  return (node as ReactTestInstance & { children: Array<string | ReactTestInstance> }).children
    .map((child) => typeof child === 'string' ? child : getTextContent(child))
    .join('');
}

function findTouchable(renderer: ReactTestRenderer, label: string): TouchableTestInstance {
  const node = renderer.root.findAll((candidate) => candidate.type === 'TouchableOpacity'
    && candidate.props.accessibilityLabel === label)[0];
  if (!node) throw new Error(`Touchable not found: ${label}`);
  return node as TouchableTestInstance;
}

function renderCalendar(onSelectDate = vi.fn()): ReactTestRenderer {
  const entries: WeightEntry[] = [
    {
      id: 'weight-1', userId: 'user-1', date: '2026-10-16', value: 80,
      unit: 'kg', createdAt: '2026-10-16T08:00:00.000Z',
    },
  ];
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <ProgressCalendar
        selectedDate="2026-10-16"
        today="2026-10-16"
        entries={entries}
        onSelectDate={onSelectDate}
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

describe('ProgressCalendar', () => {
  it('marks dates with a weight without announcing a measurement count', () => {
    const renderer = renderCalendar();
    const dateButton = findTouchable(renderer, 'Freitag, 16. Oktober 2026');

    expect(renderer.root.findAll((node) => node.type === 'Text').map(getTextContent))
      .toContain('Oktober 2026');
    expect(dateButton.props.accessibilityState).toEqual({ selected: true, disabled: false });
    expect(renderer.root.findAll((node) => node.props.testID === 'progress-calendar-marker')).toHaveLength(1);
  });

  it('selects a day and navigates between displayed months', () => {
    const onSelectDate = vi.fn();
    const renderer = renderCalendar(onSelectDate);
    const dateButton = findTouchable(renderer, 'Donnerstag, 15. Oktober 2026');

    act(() => dateButton.props.onPress());
    expect(onSelectDate).toHaveBeenCalledWith('2026-10-15');

    const previousMonth = findTouchable(renderer, 'Vorheriger Monat');
    act(() => previousMonth.props.onPress());
    expect(renderer.root.findAll((node) => node.type === 'Text').map(getTextContent))
      .toContain('September 2026');

    const nextMonth = findTouchable(renderer, 'Nächster Monat');
    expect(nextMonth.props.disabled).toBe(false);
    act(() => nextMonth.props.onPress());
    expect(renderer.root.findAll((node) => node.type === 'Text').map(getTextContent))
      .toContain('Oktober 2026');
    expect(findTouchable(renderer, 'Nächster Monat').props.disabled).toBe(true);
  });

  it('disables future dates and prevents navigation into future months', () => {
    const onSelectDate = vi.fn();
    const renderer = renderCalendar(onSelectDate);
    const tomorrow = findTouchable(renderer, 'Samstag, 17. Oktober 2026');
    const nextMonth = findTouchable(renderer, 'Nächster Monat');

    expect(tomorrow.props.disabled).toBe(true);
    expect(tomorrow.props.accessibilityState).toEqual({ selected: false, disabled: true });
    expect(nextMonth.props.disabled).toBe(true);
    expect(nextMonth.props.accessibilityState).toEqual({ disabled: true });
    act(() => tomorrow.props.onPress());
    act(() => nextMonth.props.onPress());

    expect(onSelectDate).not.toHaveBeenCalled();
    expect(renderer.root.findAll((node) => node.type === 'Text').map(getTextContent))
      .toContain('Oktober 2026');
    expect(renderer.root.findAll((node) => node.type === 'Text').map(getTextContent))
      .not.toContain('November 2026');
  });
});