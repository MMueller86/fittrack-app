import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReusableItem, UserFoodRelation } from '@fittrack/shared';
import LibraryScreen from './LibraryScreen';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  favoritesApi: { listFavorites: vi.fn(), removeFavorite: vi.fn() },
  reusableItemsApi: { list: vi.fn(), remove: vi.fn() },
  showSnackbar: vi.fn(),
}));

// Bewusst ohne `Alert`: jede Verwendung von Alert.alert würde in diesem Test fehlschlagen.
vi.mock('react-native', async () => {
  const ReactModule = await import('react');
  return {
    ActivityIndicator: 'ActivityIndicator',
    FlatList: ({ data, renderItem, refreshControl }: {
      data: unknown[];
      renderItem: (info: { item: unknown; index: number }) => React.ReactNode;
      refreshControl?: React.ReactNode;
    }) =>
      ReactModule.createElement(
        'FlatList',
        { refreshControl },
        data.map((item, index) =>
          ReactModule.createElement(ReactModule.Fragment, { key: index }, renderItem({ item, index })),
        ),
      ),
    Image: 'Image',
    RefreshControl: 'RefreshControl',
    ScrollView: 'ScrollView',
    StyleSheet: { absoluteFillObject: {}, create: <T,>(styles: T) => styles },
    Text: 'Text',
    TextInput: 'TextInput',
    TouchableOpacity: 'TouchableOpacity',
    View: 'View',
  };
});

vi.mock('@react-navigation/native', async () => {
  const ReactModule = await import('react');
  return {
    useFocusEffect: (effect: () => void | (() => void)) => ReactModule.useEffect(() => effect(), [effect]),
  };
});

vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('../../shared/api/favoritesApi', () => ({ favoritesApi: mocks.favoritesApi }));
vi.mock('../../shared/api/reusableItemsApi', () => ({ reusableItemsApi: mocks.reusableItemsApi }));
vi.mock('../../shared/components/Icon', () => ({ Icon: 'Icon' }));
vi.mock('../../shared/components/Snackbar', () => ({
  Snackbar: 'Snackbar',
  useSnackbar: () => ({ ref: { current: null }, show: mocks.showSnackbar }),
}));
vi.mock('../../shared/components/ConfirmSheet', async () => {
  const ReactModule = await import('react');
  return {
    ConfirmSheet: (props: { visible: boolean }) =>
      props.visible ? ReactModule.createElement('ConfirmSheet', props) : null,
  };
});
vi.mock('../nutrition/LabelScanReviewScreen', () => ({ default: 'LabelScanReviewScreen' }));

const NUTRITION = { calories: 120, protein: 5, carbs: 20, fat: 2 };

function ownItem(overrides: Partial<ReusableItem>): ReusableItem {
  return {
    id: 'item',
    userId: 'user-1',
    name: 'Produkt',
    nutritionBasis: 'per100g',
    nutritionPer100g: NUTRITION,
    isComplete: true,
    sourceType: 'manual',
    usageCount: 0,
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

function favorite(overrides: Partial<UserFoodRelation>): UserFoodRelation {
  return {
    id: 'user-1:fav',
    userId: 'user-1',
    foodRef: 'fav',
    foodRefType: 'personal',
    displayName: 'Skyr',
    isFavorite: true,
    lastUsedAt: null,
    usageCount: 2,
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

const renderers: ReactTestRenderer[] = [];

async function flush() {
  await act(async () => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
  });
}

async function renderScreen() {
  const navigation = { goBack: vi.fn() };
  const props = { navigation } as unknown as React.ComponentProps<typeof LibraryScreen>;
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<LibraryScreen {...props} />);
    await Promise.resolve();
  });
  renderers.push(renderer);
  await flush();
  return { renderer, navigation };
}

function allText(renderer: ReactTestRenderer): string {
  return renderer.root
    .findAll((n: ReactTestInstance) => n.type === 'Text')
    .map((n: ReactTestInstance) => {
      const children: unknown = n.props.children;
      if (Array.isArray(children)) return children.filter((c) => typeof c === 'string' || typeof c === 'number').join('');
      return typeof children === 'string' || typeof children === 'number' ? String(children) : '';
    })
    .join(' | ');
}

function byType(renderer: ReactTestRenderer, type: string): ReactTestInstance[] {
  return renderer.root.findAll((n: ReactTestInstance) => (n.type as unknown) === type);
}

// Buchstaben-Avatar des Thumbnails: ein einzelner Großbuchstabe als Text.
function avatarLetters(renderer: ReactTestRenderer): string[] {
  return renderer.root
    .findAll((n: ReactTestInstance) => n.type === 'Text' && /^[A-ZÄÖÜ?]$/.test(String(n.props.children)))
    .map((n: ReactTestInstance) => String(n.props.children));
}

function onlyByType(renderer: ReactTestRenderer, type: string): ReactTestInstance {
  const matches = byType(renderer, type);
  if (matches.length !== 1) throw new Error(`Expected one ${type}, found ${matches.length}`);
  return matches[0]!;
}

function byLabel(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  const node = renderer.root.findAll(
    (n: ReactTestInstance) => n.type === 'TouchableOpacity' && n.props.accessibilityLabel === label,
  )[0];
  if (!node) throw new Error(`No touchable labelled "${label}"`);
  return node;
}

async function press(node: ReactTestInstance) {
  await act(async () => {
    (node.props.onPress as () => void)();
  });
  await flush();
}

async function openOwnFoods(renderer: ReactTestRenderer) {
  const tab = renderer.root.findAll(
    (n: ReactTestInstance) =>
      n.type === 'TouchableOpacity' &&
      n.props.accessibilityRole === 'tab' &&
      n.findAll((c) => c.type === 'Text' && c.props.children === 'Eigene Lebensmittel').length > 0,
  )[0]!;
  await press(tab);
}

function confirmSheet(renderer: ReactTestRenderer): ReactTestInstance {
  return onlyByType(renderer, 'ConfirmSheet');
}

async function confirm(renderer: ReactTestRenderer) {
  const sheet = confirmSheet(renderer);
  const actions = sheet.props.actions as { onPress: () => void }[];
  await act(async () => {
    (sheet.props.onClose as () => void)();
    actions[0]!.onPress();
  });
  await flush();
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.favoritesApi.listFavorites.mockResolvedValue([]);
  mocks.reusableItemsApi.list.mockResolvedValue({ items: [] });
});

afterEach(() => {
  while (renderers.length) {
    const renderer = renderers.pop()!;
    act(() => renderer.unmount());
  }
});

describe('LibraryScreen shell', () => {
  it('offers Favoriten and Eigene Lebensmittel as the single library entry and loads own foods lazily', async () => {
    const { renderer, navigation } = await renderScreen();

    const text = allText(renderer);
    expect(text).toContain('Bibliothek');
    expect(text).toContain('Favoriten');
    expect(text).toContain('Eigene Lebensmittel');
    expect(text).not.toContain('Meine Lebensmittel');
    expect(mocks.reusableItemsApi.list).not.toHaveBeenCalled();

    await openOwnFoods(renderer);
    expect(mocks.reusableItemsApi.list).toHaveBeenCalledTimes(1);

    await press(byLabel(renderer, 'Zurück'));
    expect(navigation.goBack).toHaveBeenCalled();
    expect(allText(renderer)).not.toMatch(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF\u2039\u2661\u2665]/u);
  });
});

describe('Favoriten', () => {
  it('shows a retryable error instead of an empty state when loading fails', async () => {
    mocks.favoritesApi.listFavorites.mockRejectedValueOnce(new Error('network'));
    const { renderer } = await renderScreen();

    expect(allText(renderer)).toContain('Favoriten konnten nicht geladen werden');
    expect(allText(renderer)).not.toContain('Noch keine Favoriten');

    await press(byLabel(renderer, 'Erneut versuchen'));
    expect(allText(renderer)).toContain('Noch keine Favoriten');
  });

  it('removes a favorite only after confirmation and reports failures via snackbar', async () => {
    mocks.favoritesApi.listFavorites.mockResolvedValue([favorite({})]);
    mocks.favoritesApi.removeFavorite.mockRejectedValueOnce(new Error('boom'));
    const { renderer } = await renderScreen();

    expect(allText(renderer)).toContain('Skyr');

    await press(byLabel(renderer, 'Skyr aus Favoriten entfernen'));
    expect(mocks.favoritesApi.removeFavorite).not.toHaveBeenCalled();
    expect(confirmSheet(renderer).props.title).toBe('Aus Favoriten entfernen?');

    await confirm(renderer);
    expect(mocks.favoritesApi.removeFavorite).toHaveBeenCalledWith('fav');
    expect(mocks.showSnackbar).toHaveBeenCalledWith({ message: 'Favorit konnte nicht entfernt werden.' });
    expect(allText(renderer)).toContain('Skyr');

    mocks.favoritesApi.removeFavorite.mockResolvedValueOnce(undefined);
    await press(byLabel(renderer, 'Skyr aus Favoriten entfernen'));
    await confirm(renderer);
    expect(allText(renderer)).toContain('Noch keine Favoriten');
  });

  it('renders each favorite with the shared product summary and no usage-count line', async () => {
    mocks.favoritesApi.listFavorites.mockResolvedValue([
      favorite({
        foodRefType: 'catalog',
        displayName: 'Haferflocken',
        displayBrand: 'Kölln',
        nutritionPer100g: NUTRITION,
        isComplete: false,
      }),
    ]);
    const { renderer } = await renderScreen();

    const text = allText(renderer);
    expect(text).toContain('Haferflocken');
    expect(text).toContain('Kölln');
    expect(text).toContain('OFF');
    expect(text).toContain('120 kcal');
    expect(text).not.toContain('verwendet');
    expect(text).not.toContain('Katalog');
    expect(
      renderer.root.findAll((n: ReactTestInstance) => n.props.accessibilityLabel === 'Nährwerte unvollständig'),
    ).toHaveLength(1);
  });

  it('shows the image of a favorite with a remote URL and falls back to the avatar on load error', async () => {
    mocks.favoritesApi.listFavorites.mockResolvedValue([
      favorite({ displayName: 'Skyr', imageUrl: 'https://example.invalid/skyr.jpg' }),
    ]);
    const { renderer } = await renderScreen();

    const image = onlyByType(renderer, 'Image');
    expect(image.props.source).toEqual({ uri: 'https://example.invalid/skyr.jpg' });
    expect(avatarLetters(renderer)).toHaveLength(0);

    await act(async () => (image.props.onError as () => void)());
    expect(byType(renderer, 'Image')).toHaveLength(0);
    expect(avatarLetters(renderer)).toEqual(['S']);
  });

  it('shows the letter avatar for favorites without image or with a blob path', async () => {
    mocks.favoritesApi.listFavorites.mockResolvedValue([
      favorite({ id: 'u:a', foodRef: 'a', displayName: 'Apfel', imageUrl: null }),
      favorite({ id: 'u:b', foodRef: 'b', displayName: 'Birne', imageUrl: 'user-1/birne.jpg' }),
      favorite({ id: 'u:c', foodRef: 'c', displayName: 'Currywurst' }),
    ]);
    const { renderer } = await renderScreen();

    expect(byType(renderer, 'Image')).toHaveLength(0);
    expect(avatarLetters(renderer)).toEqual(expect.arrayContaining(['A', 'B', 'C']));
  });

  it('shows an inaccessible recipe as unavailable without image or nutrition but keeps it removable', async () => {
    mocks.favoritesApi.listFavorites.mockResolvedValue([
      favorite({
        foodRefType: 'recipe',
        recipeAccess: undefined,
        displayName: 'Geheimes Rezept',
        imageUrl: 'https://example.invalid/r.jpg',
        nutritionPer100g: NUTRITION,
      }),
    ]);
    mocks.favoritesApi.removeFavorite.mockResolvedValue(undefined);
    const { renderer } = await renderScreen();

    expect(allText(renderer)).toContain('Rezept nicht verfügbar');
    expect(allText(renderer)).not.toContain('Geheimes Rezept');
    expect(allText(renderer)).not.toContain('kcal');
    expect(byType(renderer, 'Image')).toHaveLength(0);

    await press(byLabel(renderer, 'Rezept nicht verfügbar aus Favoriten entfernen'));
    await confirm(renderer);
    expect(mocks.favoritesApi.removeFavorite).toHaveBeenCalledWith('fav');
    expect(allText(renderer)).toContain('Noch keine Favoriten');
  });

  it('offers only the remove action with a 48 pt target and no row tap', async () => {
    mocks.favoritesApi.listFavorites.mockResolvedValue([favorite({})]);
    const { renderer } = await renderScreen();

    const cardTouchables = renderer.root.findAll(
      (n: ReactTestInstance) => n.type === 'TouchableOpacity' && n.props.accessibilityRole === 'button',
    );
    expect(cardTouchables.filter((n) => n.props.accessibilityLabel !== 'Zurück')).toHaveLength(1);

    const style = byLabel(renderer, 'Skyr aus Favoriten entfernen').props.style as { minWidth: number; minHeight: number };
    expect(style.minWidth).toBeGreaterThanOrEqual(48);
    expect(style.minHeight).toBeGreaterThanOrEqual(48);
    expect(mocks.favoritesApi.listFavorites).toHaveBeenCalledTimes(1);
  });
});

describe('Eigene Lebensmittel', () => {
  it('lists only self-created items, newest first, with the shared product summary', async () => {
    mocks.reusableItemsApi.list.mockResolvedValue({
      items: [
        ownItem({ id: 'old', name: 'Alt', createdAt: '2026-09-01T00:00:00.000Z' }),
        ownItem({ id: 'off', name: 'Katalogprodukt', sourceType: 'openFoodFacts', createdAt: '2026-10-09T00:00:00.000Z' }),
        ownItem({ id: 'new', name: 'Neu', brand: 'Marke', sourceType: 'ai', createdAt: '2026-10-05T00:00:00.000Z' }),
      ],
    });
    const { renderer } = await renderScreen();
    await openOwnFoods(renderer);

    const text = allText(renderer);
    expect(text).not.toContain('Katalogprodukt');
    expect(text.indexOf('Neu')).toBeGreaterThanOrEqual(0);
    expect(text.indexOf('Neu')).toBeLessThan(text.indexOf('Alt'));
    expect(text).toContain('Marke');
    expect(text).toContain('KI');
    expect(text).toContain('120 kcal');
    expect(text).not.toContain('Noch keine eigenen Lebensmittel');
  });

  it('shows the letter avatar for own foods with a blob-path photo and uses the shared card action size', async () => {
    mocks.reusableItemsApi.list.mockResolvedValue({
      items: [ownItem({ id: 'a', name: 'Haferflocken', imageUrl: 'user-1/a.jpg' })],
    });
    const { renderer } = await renderScreen();
    await openOwnFoods(renderer);

    expect(byType(renderer, 'Image')).toHaveLength(0);
    expect(avatarLetters(renderer)).toEqual(['H']);
    const style = byLabel(renderer, 'Haferflocken löschen').props.style as { minWidth: number; minHeight: number };
    expect(style.minWidth).toBeGreaterThanOrEqual(48);
    expect(style.minHeight).toBeGreaterThanOrEqual(48);
  });

  it('distinguishes a load error from a real empty library and recovers via retry', async () => {
    mocks.reusableItemsApi.list.mockRejectedValueOnce(new Error('network'));
    const { renderer } = await renderScreen();
    await openOwnFoods(renderer);

    expect(allText(renderer)).toContain('Eigene Lebensmittel konnten nicht geladen werden');
    expect(allText(renderer)).not.toContain('Noch keine eigenen Lebensmittel');

    mocks.reusableItemsApi.list.mockResolvedValueOnce({ items: [] });
    await press(byLabel(renderer, 'Erneut versuchen'));
    expect(allText(renderer)).toContain('Noch keine eigenen Lebensmittel');
    expect(allText(renderer)).not.toContain('konnten nicht geladen werden');
  });

  it('treats a library with only Open Food Facts items as empty', async () => {
    mocks.reusableItemsApi.list.mockResolvedValue({
      items: [ownItem({ id: 'off', name: 'Katalogprodukt', sourceType: 'openFoodFacts' })],
    });
    const { renderer } = await renderScreen();
    await openOwnFoods(renderer);

    expect(allText(renderer)).toContain('Noch keine eigenen Lebensmittel');
    expect(allText(renderer)).not.toContain('Katalogprodukt');
  });

  it('filters by name or brand and shows "Keine Treffer" for no match', async () => {
    mocks.reusableItemsApi.list.mockResolvedValue({
      items: [ownItem({ id: 'a', name: 'Haferflocken', brand: 'Kölln' }), ownItem({ id: 'b', name: 'Skyr' })],
    });
    const { renderer } = await renderScreen();
    await openOwnFoods(renderer);

    const input = onlyByType(renderer, 'TextInput');
    await act(async () => (input.props.onChangeText as (t: string) => void)('kölln'));
    expect(allText(renderer)).toContain('Haferflocken');
    expect(allText(renderer)).not.toContain('Skyr');

    await act(async () => (input.props.onChangeText as (t: string) => void)('xyz'));
    expect(allText(renderer)).toContain('Keine Treffer');
    expect(allText(renderer)).not.toContain('Noch keine eigenen Lebensmittel');

    await press(byLabel(renderer, 'Suche löschen'));
    expect(allText(renderer)).toContain('Skyr');
  });

  it('deletes after confirmation and reports retained diary entries', async () => {
    mocks.reusableItemsApi.list.mockResolvedValue({
      items: [ownItem({ id: 'a', name: 'Haferflocken' }), ownItem({ id: 'b', name: 'Skyr' })],
    });
    mocks.reusableItemsApi.remove.mockResolvedValue({ deleted: true, diaryUsageCount: 2 });
    const { renderer } = await renderScreen();
    await openOwnFoods(renderer);

    await press(byLabel(renderer, 'Haferflocken löschen'));
    expect(mocks.reusableItemsApi.remove).not.toHaveBeenCalled();
    expect(confirmSheet(renderer).props.title).toContain('Haferflocken');

    await confirm(renderer);
    expect(mocks.reusableItemsApi.remove).toHaveBeenCalledWith('a');
    expect(allText(renderer)).not.toContain('Haferflocken');
    expect(allText(renderer)).toContain('Skyr');
    expect(mocks.showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('2 Tagebuch-Einträge') }),
    );
  });

  it('keeps the item and reports a failed delete via snackbar', async () => {
    mocks.reusableItemsApi.list.mockResolvedValue({ items: [ownItem({ id: 'a', name: 'Haferflocken' })] });
    mocks.reusableItemsApi.remove.mockRejectedValue(new Error('boom'));
    const { renderer } = await renderScreen();
    await openOwnFoods(renderer);

    await press(byLabel(renderer, 'Haferflocken löschen'));
    await confirm(renderer);

    expect(allText(renderer)).toContain('Haferflocken');
    expect(mocks.showSnackbar).toHaveBeenCalledWith({ message: 'Lebensmittel konnte nicht gelöscht werden.' });
  });

  it('opens the edit flow for the tapped item and reloads after an update', async () => {
    const item = ownItem({ id: 'a', name: 'Haferflocken' });
    mocks.reusableItemsApi.list.mockResolvedValue({ items: [item] });
    const { renderer } = await renderScreen();
    await openOwnFoods(renderer);

    const edit = renderer.root.findAll(
      (n: ReactTestInstance) => n.type === 'TouchableOpacity' && n.props.accessibilityHint === 'Öffnet das Bearbeiten',
    )[0]!;
    await press(edit);

    const modal = onlyByType(renderer, 'LabelScanReviewScreen');
    expect(modal.props.mode).toBe('edit');
    expect((modal.props.existingItem as ReusableItem).id).toBe('a');

    await act(async () => (modal.props.onUpdated as () => void)());
    await flush();
    expect(byType(renderer, 'LabelScanReviewScreen')).toHaveLength(0);
    expect(mocks.reusableItemsApi.list).toHaveBeenCalledTimes(2);
  });

  it('keeps loaded items visible when a later refresh fails and informs via snackbar', async () => {
    mocks.reusableItemsApi.list.mockResolvedValueOnce({ items: [ownItem({ id: 'a', name: 'Haferflocken' })] });
    const { renderer } = await renderScreen();
    await openOwnFoods(renderer);

    mocks.reusableItemsApi.list.mockRejectedValueOnce(new Error('network'));
    const lists = byType(renderer, 'FlatList');
    const refresh = (lists[lists.length - 1]!.props.refreshControl as React.ReactElement<{ onRefresh: () => void }>)
      .props.onRefresh;
    await act(async () => refresh());
    await flush();

    expect(allText(renderer)).toContain('Haferflocken');
    expect(mocks.showSnackbar).toHaveBeenCalledWith({
      message: 'Eigene Lebensmittel konnten nicht aktualisiert werden.',
    });
  });
});
