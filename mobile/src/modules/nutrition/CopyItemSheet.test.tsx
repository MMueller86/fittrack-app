import React, { type ComponentProps } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiaryBulkCopyResponse, DiaryDayResponse, Meal } from '@fittrack/shared';

const mockGetDay = vi.hoisted(() => vi.fn());

vi.mock('../../services/nutritionDiaryService', () => ({
  nutritionDiaryService: { getDay: mockGetDay },
}));

vi.mock('../../shared/date/localDate', () => ({
  getLocalIsoDate: () => '2026-08-14',
  addLocalDays: (iso: string, days: number) => {
    const [year, month, day] = iso.split('-').map(Number);
    const result = new Date(year, month - 1, day + days);
    return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, '0')}-${String(result.getDate()).padStart(2, '0')}`;
  },
}));

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

import CopyItemSheet from './CopyItemSheet';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type SheetProps = ComponentProps<typeof CopyItemSheet>;
const activeRenderers: ReactTestRenderer[] = [];

function makeMeal(id: string, type: Meal['type'], name: string, date: string): Meal {
  return {
    id,
    userId: 'user-1',
    date,
    type,
    name,
    items: [],
    createdAt: `${date}T12:00:00.000Z`,
  };
}

function makeDay(meals: Meal[]): DiaryDayResponse {
  return {
    meals,
    summary: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
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

async function renderSheet(
  props: Pick<SheetProps, 'sourceDate' | 'items' | 'itemLabel' | 'sourceMealType'>,
  response: DiaryBulkCopyResponse,
) {
  const onCopy: SheetProps['onCopy'] = vi.fn().mockResolvedValue(response);
  const onClose = vi.fn();
  const baseProps: SheetProps = {
    visible: true,
    ...props,
    onCopy,
    onClose,
  };

  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<CopyItemSheet {...baseProps} />);
  });
  activeRenderers.push(renderer);
  return { renderer, onCopy, onClose };
}

beforeEach(() => {
  mockGetDay.mockReset();
});

afterEach(() => {
  while (activeRenderers.length > 0) {
    const renderer = activeRenderers.pop()!;
    act(() => renderer.unmount());
  }
});

describe('CopyItemSheet', () => {
  it('offers today from yesterday, loads that day, and copies to one explicit target meal', async () => {
    const targetMeal = makeMeal('today-dinner', 'dinner', 'Dinner', '2026-08-14');
    mockGetDay.mockResolvedValue(makeDay([targetMeal]));
    const items = [{ mealId: 'source-meal', itemId: 'source-item' }];
    const { renderer, onCopy, onClose } = await renderSheet({
      sourceDate: '2026-08-13',
      items,
      itemLabel: 'Haferflocken',
    }, { copiedCount: 1, targetMeal });

    await press(getButtonContainingText(renderer, 'Heute'));
    expect(mockGetDay).toHaveBeenCalledWith('2026-08-14');
    await press(getButtonContainingText(renderer, 'Abendessen'));

    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onCopy).toHaveBeenCalledWith(items, '2026-08-14', { mealId: 'today-dinner' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('offers the source date outside the date strip and allows the source meal as target', async () => {
    const sourceDate = '2026-07-20';
    const sourceMeal = makeMeal('source-meal', 'breakfast', 'Frühstück', sourceDate);
    mockGetDay.mockResolvedValue(makeDay([sourceMeal]));
    const items = [{ mealId: sourceMeal.id, itemId: 'source-item' }];
    const { renderer, onCopy, onClose } = await renderSheet({
      sourceDate,
      items,
      itemLabel: 'Haferflocken',
      sourceMealType: 'breakfast',
    }, { copiedCount: 1, targetMeal: sourceMeal });

    await press(getButtonContainingText(renderer, 'Gleicher Tag'));
    expect(mockGetDay).toHaveBeenCalledWith(sourceDate);
    await press(getButtonContainingText(renderer, 'Frühstück'));

    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onCopy).toHaveBeenCalledWith(items, sourceDate, { mealId: sourceMeal.id });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('allows another existing meal as the same-day target', async () => {
    const sourceDate = '2026-08-14';
    const sourceMeal = makeMeal('source-meal', 'breakfast', 'Frühstück', sourceDate);
    const targetMeal = makeMeal('target-meal', 'dinner', 'Abendessen', sourceDate);
    mockGetDay.mockResolvedValue(makeDay([sourceMeal, targetMeal]));
    const items = [{ mealId: sourceMeal.id, itemId: 'source-item' }];
    const { renderer, onCopy } = await renderSheet({
      sourceDate,
      items,
      itemLabel: 'Haferflocken',
    }, { copiedCount: 1, targetMeal });

    await press(getButtonContainingText(renderer, 'Gleicher Tag'));
    await press(getButtonContainingText(renderer, 'Abendessen'));

    expect(onCopy).toHaveBeenCalledWith(items, sourceDate, { mealId: targetMeal.id });
  });

  it('keeps newMealType available as a same-day target', async () => {
    const sourceDate = '2026-08-14';
    const sourceMeal = makeMeal('source-meal', 'breakfast', 'Frühstück', sourceDate);
    const existingMeal = makeMeal('existing-meal', 'lunch', 'Mittagessen', sourceDate);
    const targetMeal = makeMeal('new-meal', 'dinner', 'Abendessen', sourceDate);
    mockGetDay.mockResolvedValue(makeDay([sourceMeal, existingMeal]));
    const items = [{ mealId: sourceMeal.id, itemId: 'source-item' }];
    const { renderer, onCopy } = await renderSheet({
      sourceDate,
      items,
      itemLabel: 'Haferflocken',
    }, { copiedCount: 1, targetMeal });

    await press(getButtonContainingText(renderer, 'Gleicher Tag'));
    await press(getButtonContainingText(renderer, 'Abendessen'));

    expect(onCopy).toHaveBeenCalledWith(items, sourceDate, { newMealType: 'dinner' });
  });

  it('copies one reference to one explicitly selected existing meal on a different date', async () => {
    const targetMeal = makeMeal('target-meal', 'dinner', 'Abendessen', '2026-08-12');
    mockGetDay.mockResolvedValue(makeDay([targetMeal]));
    const items = [{ mealId: 'source-meal', itemId: 'source-item' }];
    const { renderer, onCopy, onClose } = await renderSheet({
      sourceDate: '2026-08-13',
      items,
      itemLabel: 'Haferflocken',
      sourceMealType: 'breakfast',
    }, { copiedCount: 1, targetMeal });

    const sourceDateQuickPick = renderer.root.findAll((node) => node.type === 'TouchableOpacity'
      && node.findAll((child) => child.type === 'Text' && child.props.children === 'Gestern').length > 0);
    expect(sourceDateQuickPick).toHaveLength(0);

    await press(getButtonContainingText(renderer, 'Vorgestern'));
    expect(mockGetDay).toHaveBeenCalledWith('2026-08-12');
    await press(getButtonContainingText(renderer, 'Abendessen'));

    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onCopy).toHaveBeenCalledWith(items, '2026-08-12', { mealId: 'target-meal' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('sends the whole selection with one explicit newMealType target', async () => {
    const existingMeal = makeMeal('existing-meal', 'breakfast', 'Frühstück', '2026-08-12');
    const targetMeal = makeMeal('new-meal', 'dinner', 'Abendessen', '2026-08-12');
    mockGetDay.mockResolvedValue(makeDay([existingMeal]));
    const items = [
      { mealId: 'source-breakfast', itemId: 'item-1' },
      { mealId: 'source-lunch', itemId: 'item-2' },
    ];
    const { renderer, onCopy, onClose } = await renderSheet({
      sourceDate: '2026-08-13',
      items,
      itemLabel: '2 Einträge ausgewählt',
    }, { copiedCount: 2, targetMeal });

    await press(getButtonContainingText(renderer, 'Vorgestern'));
    await press(getButtonContainingText(renderer, 'Abendessen'));

    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onCopy).toHaveBeenCalledWith(items, '2026-08-12', { newMealType: 'dinner' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});