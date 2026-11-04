import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MealEstimateRefineSheet from './MealEstimateRefineSheet';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Platform: { OS: 'android' },
  ScrollView: 'ScrollView',
  StyleSheet: { absoluteFill: {}, create: <T,>(styles: T) => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));
vi.mock('react-native-reanimated', () => ({
  default: { View: 'AnimatedView' },
  useAnimatedStyle: (factory: () => object) => factory(),
  useSharedValue: (value: number) => ({ value }),
  withTiming: (value: number) => value,
}));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
vi.mock('../../shared/components/ErrorBanner', () => ({ ErrorBanner: 'ErrorBanner' }));
vi.mock('../../shared/components/Icon', () => ({ Icon: 'Icon' }));

const renderers: ReactTestRenderer[] = [];

function nodes(renderer: ReactTestRenderer, type: string): ReactTestInstance[] {
  return renderer.root.findAll((node) => (node.type as unknown) === type);
}

function findButton(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  const button = nodes(renderer, 'TouchableOpacity').find((node) => node.props.accessibilityLabel === label);
  if (!button) throw new Error(`Button "${label}" nicht gefunden`);
  return button;
}

function invoke(node: ReactTestInstance, property: string, ...args: unknown[]) {
  const callback: unknown = node.props[property];
  if (typeof callback !== 'function') throw new Error(`Event "${property}" fehlt`);
  return Reflect.apply(callback, node, args);
}

function isSelected(node: ReactTestInstance): boolean {
  const state: unknown = node.props.accessibilityState;
  if (typeof state !== 'object' || state === null || !('selected' in state)) return false;
  return state.selected === true;
}

async function renderSheet(overrides: Partial<React.ComponentProps<typeof MealEstimateRefineSheet>> = {}) {
  const props = {
    visible: true,
    loading: false,
    quotaExceeded: false,
    error: null,
    attemptsUsed: 0,
    onClose: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<MealEstimateRefineSheet {...props} />);
  });
  renderers.push(renderer);
  return { renderer, onSubmit: props.onSubmit };
}

afterEach(() => {
  renderers.splice(0).forEach((renderer) => act(() => renderer.unmount()));
  vi.clearAllMocks();
});

describe('MealEstimateRefineSheet', () => {
  it('keeps the portion chips mutually exclusive', async () => {
    const { renderer } = await renderSheet();
    const larger = findButton(renderer, 'Portion größer');
    const smaller = findButton(renderer, 'Portion kleiner');

    await act(async () => { invoke(larger, 'onPress'); });
    expect(isSelected(findButton(renderer, 'Portion größer'))).toBe(true);
    expect(isSelected(findButton(renderer, 'Portion kleiner'))).toBe(false);

    await act(async () => { invoke(findButton(renderer, 'Portion kleiner'), 'onPress'); });
    expect(isSelected(findButton(renderer, 'Portion größer'))).toBe(false);
    expect(isSelected(findButton(renderer, 'Portion kleiner'))).toBe(true);
  });

  it('disables empty and too-short submissions, then sends a trimmed note', async () => {
    const { renderer, onSubmit } = await renderSheet();
    const submit = () => findButton(renderer, 'Neu schätzen bestätigen');
    expect(submit().props.disabled).toBe(true);

    const input = nodes(renderer, 'TextInput')[0]!;
    await act(async () => { invoke(input, 'onChangeText', 'ab'); });
    expect(submit().props.disabled).toBe(true);

    await act(async () => { invoke(input, 'onChangeText', '  abc  '); });
    expect(submit().props.disabled).toBe(false);
    await act(async () => { await invoke(submit(), 'onPress'); });
    expect(onSubmit).toHaveBeenCalledWith({ note: 'abc' });
  });

  it('allows a portion hint without a note and omits the optional note', async () => {
    const { renderer, onSubmit } = await renderSheet();
    await act(async () => { invoke(findButton(renderer, 'Portion größer'), 'onPress'); });
    await act(async () => { await invoke(findButton(renderer, 'Neu schätzen bestätigen'), 'onPress'); });
    expect(onSubmit).toHaveBeenCalledWith({ hints: ['larger'] });
  });

  it('keeps entered values after a failed request', async () => {
    const onSubmit = vi.fn().mockResolvedValue(false);
    const { renderer } = await renderSheet({ onSubmit, error: 'Anfrage fehlgeschlagen' });
    const input = nodes(renderer, 'TextInput')[0]!;
    await act(async () => { invoke(findButton(renderer, 'Portion kleiner'), 'onPress'); });
    await act(async () => { invoke(input, 'onChangeText', '  abc  '); });
    await act(async () => { await invoke(findButton(renderer, 'Neu schätzen bestätigen'), 'onPress'); });

    expect(input.props.value).toBe('  abc  ');
    expect(isSelected(findButton(renderer, 'Portion kleiner'))).toBe(true);
    expect(nodes(renderer, 'ErrorBanner')[0]?.props.error).toBe('Anfrage fehlgeschlagen');
  });

  it('locks every sheet control while loading', async () => {
    const { renderer } = await renderSheet({ loading: true });
    const input = nodes(renderer, 'TextInput')[0]!;

    expect(findButton(renderer, 'Portion größer').props.disabled).toBe(true);
    expect(input.props.editable).toBe(false);
    expect(findButton(renderer, 'Schließen').props.disabled).toBe(true);
    expect(findButton(renderer, 'Neu schätzen bestätigen').props.disabled).toBe(true);
  });

  it('shows quota errors and disables submission when the quota is exhausted', async () => {
    const { renderer } = await renderSheet({ quotaExceeded: true, error: 'Monatskontingent ausgeschöpft' });
    await act(async () => { invoke(findButton(renderer, 'Portion größer'), 'onPress'); });

    expect(findButton(renderer, 'Neu schätzen bestätigen').props.disabled).toBe(true);
    expect(nodes(renderer, 'ErrorBanner')[0]?.props.error).toBe('Monatskontingent ausgeschöpft');
  });

  it('disables submission after three successful re-estimates', async () => {
    const { renderer } = await renderSheet({ attemptsUsed: 3 });
    await act(async () => { invoke(findButton(renderer, 'Portion größer'), 'onPress'); });

    expect(findButton(renderer, 'Neu schätzen bestätigen').props.disabled).toBe(true);
  });
});