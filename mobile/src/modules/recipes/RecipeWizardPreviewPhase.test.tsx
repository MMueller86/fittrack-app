import React, { type ComponentProps } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { RecipeWizardPreviewPhase } from './RecipeWizardPreviewPhase';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  ScrollView: 'ScrollView',
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));

vi.mock('../../shared/components/Icon', () => ({ Icon: () => null }));
vi.mock('./RecipeImageHeroImage', () => ({ RecipeImageHeroImage: () => null }));
vi.mock('./RecipeIngredientGroup', () => ({ RecipeIngredientGroup: () => null }));
vi.mock('./recipeImageSource', () => ({ RECIPE_HERO_ASPECT_RATIO: 0.8 }));

type PreviewProps = ComponentProps<typeof RecipeWizardPreviewPhase>;

function makePreviewProps(): PreviewProps {
  return {
    recipeName: 'Paprikasalat',
    recipeDescription: '',
    tags: [],
    portions: 2,
    imageDrafts: [],
    steps: [],
    liveNutrition: null,
    previewViewModel: { groups: [] },
    onRecipeNameChange: () => undefined,
    onRecipeDescriptionChange: () => undefined,
    onPortionsChange: () => undefined,
    onPickImage: () => undefined,
    onEditImage: () => undefined,
    onRemoveImage: () => undefined,
    onMoveImage: () => undefined,
  };
}

async function renderPreview(props: PreviewProps): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<RecipeWizardPreviewPhase {...props} />);
  });
  return renderer;
}

describe('RecipeWizardPreviewPhase', () => {
  it('keeps ordinary recipe review available without export review controls', async () => {
    const renderer = await renderPreview(makePreviewProps());

    expect(renderer.root.findAll(
      (node: ReactTestInstance) => node.type === 'TextInput'
        && node.props.value === 'Paprikasalat',
    )).toHaveLength(1);
    expect(renderer.root.findAll(
      (node: ReactTestInstance) => node.type === 'Text'
        && node.props.children === 'Portionen',
    )).toHaveLength(1);
    expect(renderer.root.findAll(
      (node: ReactTestInstance) => node.props.accessibilityRole === 'tab',
    )).toHaveLength(0);
    expect(renderer.root.findAll(
      (node: ReactTestInstance) => node.type === 'TextInput'
        && typeof node.props.accessibilityLabel === 'string'
        && /Export|Teaser|Gesamtzeit|Schwierigkeit/i.test(node.props.accessibilityLabel),
    )).toHaveLength(0);
    expect(renderer.root.findAll(
      (node: ReactTestInstance) => node.type === 'Text'
        && typeof node.props.children === 'string'
        && /Exportansicht bestätigen|Exportschritt hinzufügen|Zutaten im Export/.test(node.props.children),
    )).toHaveLength(0);
  });
});