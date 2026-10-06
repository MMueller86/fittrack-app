import React, { type ComponentProps } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Meal } from '@fittrack/shared';

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Modal: 'Modal',
  ScrollView: 'ScrollView',
  StyleSheet: { absoluteFillObject: {}, create: (styles: object) => styles },
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

import MoveItemSheet from './MoveItemSheet';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type SheetProps = ComponentProps<typeof MoveItemSheet>;
const DATE = '2026-08-13';
const activeRenderers: ReactTestRenderer[] = [];

function makeMeal(id: string, type: Meal['type'], name: string): Meal {
  return {
    id,
    userId: 'user-1',
    date: DATE,
    type,
    name,
    items: [],
    createdAt: `${DATE}T12:00:00.000Z`,
  };
}

function getButtonContainingText(renderer: ReactTestRenderer, text: string): ReactTestInstance {
  const matches = renderer.root.findAll((node) => node.type === 'TouchableOpacity'
    && node.findAll((child) => child.type === 'Text' && child.props.children === text).length > 0);
  if (matches.length !== 1) {
    throw new Error(`Expected one button containing "${text}", found ${matches.length}`);
  }
  return matches[0]!;
}

async function press(instance: ReactTestInstance): Promise<void> {
  const onPress = instance.props.onPress as (() => unknown) | undefined;
  if (!onPress) throw new Error('Expected an onPress handler');
  await act(async () => {
    await onPress();
    for (let turn = 0; turn < 6; turn += 1) await Promise.resolve();
  });
}

async function renderSheet(props: Pick<SheetProps, 'items' | 'itemLabel' | 'meals'>) {
  const onMove: SheetProps['onMove'] = vi.fn().mockResolvedValue(true);
  const onClose = vi.fn();
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <MoveItemSheet visible {...props} onMove={onMove} onClose={onClose} />,
    );
  });
  activeRenderers.push(renderer);
  return { renderer, onMove, onClose };
}

afterEach(() => {
  while (activeRenderers.length > 0) {
    const renderer = activeRenderers.pop()!;
    act(() => renderer.unmount());
  }
});

describe('MoveItemSheet', () => {
  it('excludes every selected source meal and allows an eligible same-day target', async () => {
    const items = [
      { mealId: 'source-breakfast', itemId: 'item-1' },
      { mealId: 'source-lunch', itemId: 'item-2' },
    ];
    const sourceMeals = [
      makeMeal('source-breakfast', 'breakfast', 'Frühstück'),
      makeMeal('source-lunch', 'lunch', 'Mittagessen'),
    ];
    const eligibleTarget = makeMeal('target-dinner', 'dinner', 'Abendessen');
    const { renderer, onMove, onClose } = await renderSheet({
      items,
      itemLabel: '2 Einträge ausgewählt',
      meals: [...sourceMeals, eligibleTarget],
    });

    for (const sourceMeal of sourceMeals) {
      const sourceTargetButtons = renderer.root.findAll((node) => node.type === 'TouchableOpacity'
        && node.findAll((child) => child.type === 'Text' && child.props.children === sourceMeal.name).length > 0);
      expect(sourceTargetButtons).toHaveLength(0);
    }

    const targetButton = getButtonContainingText(renderer, eligibleTarget.name);
    expect(targetButton.props.disabled).toBe(false);
    await press(targetButton);

    expect(onMove).toHaveBeenCalledOnce();
    expect(onMove).toHaveBeenCalledWith(items, { mealId: eligibleTarget.id });
    expect(onClose).toHaveBeenCalledOnce();
  });
});