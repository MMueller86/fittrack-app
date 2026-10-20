import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Snackbar, type SnackbarHandle } from './Snackbar';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-native', () => ({
  Animated: {
    Value: class {
      setValue = vi.fn();
      interpolate = vi.fn(() => 0);
    },
    View: 'AnimatedView',
    timing: vi.fn(() => ({ start: vi.fn() })),
  },
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 34, left: 0 }),
}));

const renderers: ReactTestRenderer[] = [];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  for (const renderer of renderers.splice(0)) act(() => renderer.unmount());
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('Snackbar positioning', () => {
  it.each([
    { bottomOffset: 16, expectedBottom: 16 },
    { bottomOffset: undefined, expectedBottom: 98 },
  ])('uses the requested screen-bottom offset %#', ({ bottomOffset, expectedBottom }) => {
    let renderer!: ReactTestRenderer;
    const ref = React.createRef<SnackbarHandle>();
    act(() => {
      renderer = create(<Snackbar ref={ref} bottomOffset={bottomOffset} />);
    });
    renderers.push(renderer);
    act(() => ref.current?.show({ message: 'Eintrag verschoben.' }));

    const snackbar = renderer.root.findAll(
      (node) => node.type === 'AnimatedView' && node.props.pointerEvents === 'box-none',
    )[0]!;
    const positionStyle = (snackbar.props.style as Array<Record<string, unknown>>)
      .find((style) => typeof style === 'object' && style !== null && 'bottom' in style);

    expect(positionStyle?.bottom).toBe(expectedBottom);
  });
});
