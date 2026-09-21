import React, { type ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import {
  createRecipeShareDraftController,
  createRecipeShareDraftState,
} from './recipeShareDraftState';
import {
  getInitialRecipeInstagramTags,
  RecipeInstagramOptionsSheet,
} from './RecipeInstagramOptionsSheet';
import type { RecipeShareDraftState } from './recipeShareDraftState';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock('react-native', async () => {
  const ReactModule = await import('react');

  const Modal = ({ visible, children, ...props }: { visible: boolean; children?: ReactNode }) => (
    visible ? ReactModule.createElement('Modal', { ...props, visible }, children) : null
  );

  return {
    Modal,
    ScrollView: 'ScrollView',
    StyleSheet: {
      absoluteFillObject: {},
      create: <T,>(styles: T) => styles,
    },
    Switch: 'Switch',
    Text: 'Text',
    TouchableOpacity: 'TouchableOpacity',
    View: 'View',
  };
});

function getByLabel(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  const matches = renderer.root.findAll(
    (node) => (node.type === 'TouchableOpacity' || node.type === 'Switch')
      && node.props.accessibilityLabel === label,
  );
  if (matches.length !== 1) {
    throw new Error(`Expected one element with accessibilityLabel ${label}, found ${matches.length}`);
  }
  return matches[0]!;
}

function getText(renderer: ReactTestRenderer, text: string): ReactTestInstance {
  const matches = renderer.root.findAll((node) => node.type === 'Text' && node.props.children === text);
  if (matches.length !== 1) {
    throw new Error(`Expected one Text node with value ${text}, found ${matches.length}`);
  }
  return matches[0]!;
}

async function renderSheet(tags: readonly string[], onConfirm = vi.fn()) {
  let renderer!: ReactTestRenderer;
  const onClose = vi.fn();

  await act(async () => {
    renderer = create(
      <RecipeInstagramOptionsSheet
        visible
        tags={tags}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );
  });

  return { renderer, onClose, onConfirm };
}

async function press(instance: ReactTestInstance): Promise<void> {
  const onPress = instance.props.onPress as (() => void) | undefined;
  if (!onPress) throw new Error('Expected an onPress handler');

  await act(async () => {
    onPress();
  });
}

describe('RecipeInstagramOptionsSheet', () => {
  it.each([
    { name: 'keine Tags', tags: [], expected: [] },
    { name: 'ein bis drei Tags', tags: ['Schnell', 'Salat', 'Einfach'], expected: ['Schnell', 'Salat', 'Einfach'] },
    { name: 'vier Tags', tags: ['Schnell', 'Salat', 'Einfach', 'Abendessen'], expected: ['Schnell', 'Salat', 'Einfach', 'Abendessen'] },
    { name: 'mehr als vier Tags', tags: ['Schnell', 'Salat', 'Einfach', 'Abendessen', 'Meal Prep'], expected: ['Schnell', 'Salat', 'Einfach', 'Abendessen'] },
  ])('wählt bei $name die vorgeschriebenen Tags vor', ({ tags, expected }) => {
    expect(getInitialRecipeInstagramTags(tags)).toEqual(expected);
  });

  it('zeigt bei vier aktiven Tags weitere Tags sichtbar, aber deaktiviert', async () => {
    const { renderer } = await renderSheet(['Schnell', 'Salat', 'Einfach', 'Abendessen', 'Meal Prep']);

    expect(getText(renderer, 'Welche Tags sollen auf dem Bild erscheinen?')).toBeDefined();
    expect(getByLabel(renderer, 'Tag Meal Prep').props.accessibilityState).toMatchObject({
      checked: false,
      disabled: true,
    });

    await press(getByLabel(renderer, 'Tag Schnell'));

    expect(getByLabel(renderer, 'Tag Meal Prep').props.accessibilityState).toMatchObject({
      checked: false,
      disabled: false,
    });
  });

  it('zeigt für ein Rezept ohne Tags einen verständlichen Hinweis', async () => {
    const { renderer } = await renderSheet([]);

    expect(getText(renderer, 'Für dieses Rezept sind keine Tags hinterlegt.')).toBeDefined();
  });

  it('startet standardmäßig ohne Highlight und mappt den Toggle auf high-protein', async () => {
    const { renderer } = await renderSheet(['Schnell']);
    const toggle = getByLabel(renderer, 'High-Protein-Symbol anzeigen');

    expect(toggle.props.value).toBe(false);
    expect(getText(renderer, 'Kein Highlight')).toBeDefined();

    await act(async () => {
      (toggle.props.onValueChange as (enabled: boolean) => void)(true);
    });

    expect(getByLabel(renderer, 'High-Protein-Symbol anzeigen').props.value).toBe(true);
    expect(getText(renderer, 'High-Protein')).toBeDefined();
  });

  it('übergibt die Optionen an den Share-Draft und rendert nur den expliziten Highlight-Wert', async () => {
    let state: RecipeShareDraftState = createRecipeShareDraftState({ images: [] }, {
      recipeId: 'recipe-1',
      selectedTags: [],
      nutritionHighlight: null,
    });
    const renderInstagramRecipe = vi.fn().mockResolvedValue(new ArrayBuffer(0));
    const controller = createRecipeShareDraftController({
      initialState: state,
      renderApi: { renderInstagramRecipe },
      onStateChange: (nextState) => {
        state = nextState;
      },
    });
    const { renderer } = await renderSheet(['Schnell', 'Salat'], vi.fn((options) => {
      controller.setOptions(options);
      controller.startInitialPreview();
    }));

    await act(async () => {
      (getByLabel(renderer, 'High-Protein-Symbol anzeigen').props.onValueChange as (enabled: boolean) => void)(true);
    });
    await press(getByLabel(renderer, 'Vorschau anzeigen'));

    expect(renderInstagramRecipe).toHaveBeenCalledWith(
      'recipe-1',
      expect.objectContaining({
        selectedTags: ['Schnell', 'Salat'],
        nutritionHighlight: 'high-protein',
      }),
      expect.any(AbortSignal),
    );
    expect(state.nutritionHighlight).toBe('high-protein');

    await act(async () => {
      (getByLabel(renderer, 'High-Protein-Symbol anzeigen').props.onValueChange as (enabled: boolean) => void)(false);
    });
    await press(getByLabel(renderer, 'Vorschau anzeigen'));

    expect(renderInstagramRecipe).toHaveBeenLastCalledWith(
      'recipe-1',
      expect.objectContaining({
        selectedTags: ['Schnell', 'Salat'],
        nutritionHighlight: null,
      }),
      expect.any(AbortSignal),
    );
    expect(state.nutritionHighlight).toBeNull();
  });
});