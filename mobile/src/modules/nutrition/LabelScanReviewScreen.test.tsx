import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReusableItem } from '@fittrack/shared';
import LabelScanReviewScreen from './LabelScanReviewScreen';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  reusableItemsApi: { update: vi.fn(), create: vi.fn() },
  diaryApi: { addItem: vi.fn() },
}));

// Bewusst ohne `Alert`: jede Verwendung von Alert.alert würde in diesem Test fehlschlagen.
vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Modal: 'Modal',
  Platform: { OS: 'android' },
  ScrollView: 'ScrollView',
  StyleSheet: { absoluteFill: {}, create: <T,>(styles: T) => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));

vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
vi.mock('../../shared/api/reusableItemsApi', () => ({ reusableItemsApi: mocks.reusableItemsApi }));
vi.mock('../../services/nutritionDiaryService', () => ({ nutritionDiaryService: mocks.diaryApi }));
vi.mock('../../shared/components/Icon', () => ({ Icon: 'Icon' }));
vi.mock('../../shared/components/ErrorBanner', () => ({ ErrorBanner: 'ErrorBanner' }));
vi.mock('../../shared/components/ConfirmSheet', async () => {
  const ReactModule = await import('react');
  return {
    ConfirmSheet: (props: { visible: boolean }) =>
      props.visible ? ReactModule.createElement('ConfirmSheet', props) : null,
  };
});

const EXISTING: ReusableItem = {
  id: 'item-1',
  userId: 'user-1',
  name: 'Haferflocken',
  nutritionBasis: 'per100g',
  nutritionPer100g: { calories: 370, protein: 13, carbs: 59, fat: 7 },
  isComplete: true,
  sourceType: 'manual',
  usageCount: 0,
  createdAt: '2026-10-01T00:00:00.000Z',
};

type SheetAction = { label: string; onPress: () => void };

const renderers: ReactTestRenderer[] = [];

async function flush() {
  await act(async () => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
  });
}

async function renderScreen(props: Partial<React.ComponentProps<typeof LabelScanReviewScreen>>) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const onUpdated = vi.fn();
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <LabelScanReviewScreen
        visible
        mealId="meal-1"
        onClose={onClose}
        onSaved={onSaved}
        onUpdated={onUpdated}
        {...props}
      />,
    );
    await Promise.resolve();
  });
  renderers.push(renderer);
  return { renderer, onClose, onSaved, onUpdated };
}

function byType(renderer: ReactTestRenderer, type: string): ReactTestInstance[] {
  return renderer.root.findAll((n: ReactTestInstance) => (n.type as unknown) === type);
}

function textOf(node: ReactTestInstance): string {
  return node
    .findAll((n: ReactTestInstance) => n.type === 'Text')
    .map((n: ReactTestInstance) => [n.props.children].flat().filter((c) => typeof c === 'string').join(''))
    .join('');
}

function pressButton(renderer: ReactTestRenderer, label: string) {
  const btn = byType(renderer, 'TouchableOpacity').find((n) => textOf(n).includes(label));
  if (!btn) throw new Error(`Button "${label}" nicht gefunden`);
  return act(async () => {
    (btn.props.onPress as () => void)();
    await Promise.resolve();
  });
}

function sheet(renderer: ReactTestRenderer): ReactTestInstance | undefined {
  return byType(renderer, 'ConfirmSheet')[0];
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  mocks.reusableItemsApi.update.mockResolvedValue({ item: EXISTING });
  mocks.reusableItemsApi.create.mockResolvedValue({ item: { ...EXISTING, id: 'new-1' } });
  mocks.diaryApi.addItem.mockResolvedValue(undefined);
});

afterEach(() => {
  renderers.splice(0).forEach((r) => act(() => r.unmount()));
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('LabelScanReviewScreen — Edit-Speichern-Pfad', () => {
  it('zeigt ConfirmSheet statt Alert mit den beiden Aktionen', async () => {
    const { renderer } = await renderScreen({ mode: 'edit', existingItem: EXISTING });
    expect(sheet(renderer)).toBeUndefined();

    await pressButton(renderer, 'Produkt speichern');

    const s = sheet(renderer)!;
    expect(s.props.title).toBe('Historische Einträge aktualisieren?');
    expect((s.props.actions as SheetAction[]).map((a) => a.label)).toEqual([
      'Nur Produkt',
      'Produkt + Tagebuch-Einträge',
    ]);
    expect(mocks.reusableItemsApi.update).not.toHaveBeenCalled();
  });

  it('"Nur Produkt" ruft update(..., false) auf', async () => {
    const { renderer, onUpdated, onClose } = await renderScreen({ mode: 'edit', existingItem: EXISTING });
    await pressButton(renderer, 'Produkt speichern');

    const action = (sheet(renderer)!.props.actions as SheetAction[])[0];
    await act(async () => {
      (sheet(renderer)!.props.onClose as () => void)();
      action.onPress();
    });
    await flush();

    expect(mocks.reusableItemsApi.update).toHaveBeenCalledTimes(1);
    expect(mocks.reusableItemsApi.update.mock.calls[0][0]).toBe('item-1');
    expect(mocks.reusableItemsApi.update.mock.calls[0][2]).toBe(false);
    expect(onUpdated).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(sheet(renderer)).toBeUndefined();
  });

  it('"Produkt + Tagebuch-Einträge" ruft update(..., true) auf', async () => {
    const { renderer } = await renderScreen({ mode: 'edit', existingItem: EXISTING });
    await pressButton(renderer, 'Produkt speichern');

    const action = (sheet(renderer)!.props.actions as SheetAction[])[1];
    await act(async () => {
      (sheet(renderer)!.props.onClose as () => void)();
      action.onPress();
    });
    await flush();

    expect(mocks.reusableItemsApi.update).toHaveBeenCalledTimes(1);
    expect(mocks.reusableItemsApi.update.mock.calls[0][2]).toBe(true);
  });

  it('Abbrechen (onClose des Sheets) ruft nichts auf und schließt das Sheet', async () => {
    const { renderer, onClose, onUpdated } = await renderScreen({ mode: 'edit', existingItem: EXISTING });
    await pressButton(renderer, 'Produkt speichern');

    await act(async () => {
      (sheet(renderer)!.props.onClose as () => void)();
    });
    await flush();

    expect(sheet(renderer)).toBeUndefined();
    expect(mocks.reusableItemsApi.update).not.toHaveBeenCalled();
    expect(onUpdated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('LabelScanReviewScreen — Erfassungsmodus', () => {
  it('speichert weiterhin direkt ohne ConfirmSheet (Produkt + Tagebuch)', async () => {
    const { renderer, onSaved } = await renderScreen({ isManual: true });

    await pressButton(renderer, 'Als Produkt speichern + hinzufügen');
    await flush();

    expect(sheet(renderer)).toBeUndefined();
    expect(mocks.reusableItemsApi.create).toHaveBeenCalledTimes(1);
    expect(mocks.diaryApi.addItem).toHaveBeenCalledTimes(1);
    expect(mocks.reusableItemsApi.update).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
  });

  it('"Einmalig hinzufügen" legt kein Produkt an', async () => {
    const { renderer, onSaved } = await renderScreen({ isManual: true });

    await pressButton(renderer, 'Einmalig hinzufügen');
    await flush();

    expect(mocks.reusableItemsApi.create).not.toHaveBeenCalled();
    expect(mocks.diaryApi.addItem).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalled();
  });
});
