import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecipeImageSourcePicker } from './RecipeImageSourcePicker';
import { normalizeRecipeImageHeroCrop } from './recipeImageHeroCropMath';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  photoPickerProps: {
    current: null as null | {
      visible: boolean;
      initialSource?: 'camera' | 'gallery';
      preset: string;
      output: string;
      cameraReview: string;
      editorOverlay: unknown;
      onClose: () => void;
      onSelected: (result: unknown) => void;
    },
  },
  overlay: vi.fn(),
}));

vi.mock('../../shared/camera/FramedPhotoPicker', () => ({
  FramedPhotoPicker: (props: NonNullable<typeof mocks.photoPickerProps.current>) => {
    mocks.photoPickerProps.current = props;
    return null;
  },
}));
vi.mock('./RecipeImageHeroCropEditor', () => ({ renderRecipeHeroOverlay: mocks.overlay }));

beforeEach(() => {
  mocks.photoPickerProps.current = null;
});

describe('RecipeImageSourcePicker', () => {
  it('mounts the shared picker for the recipe hero without a direct source and keeps the original file', async () => {
    const onClose = vi.fn();
    await act(async () => {
      create(<RecipeImageSourcePicker visible onClose={onClose} onImageSelected={vi.fn()} />);
    });

    const props = mocks.photoPickerProps.current!;
    expect(props.visible).toBe(true);
    expect(props.preset).toBe('recipeHero');
    expect(props.output).toBe('metadata');
    expect(props.cameraReview).toBe('editor');
    expect(props.initialSource).toBeUndefined();
    expect(props.editorOverlay).toBe(mocks.overlay);
    expect(props.onClose).toBe(onClose);
  });

  it('maps the picker result to the selection and the normalized hero crop', async () => {
    const onImageSelected = vi.fn();
    await act(async () => {
      create(<RecipeImageSourcePicker visible onClose={vi.fn()} onImageSelected={onImageSelected} />);
    });

    const crop = { focusX: 0.3, focusY: 0.6, zoom: 1.8 };
    mocks.photoPickerProps.current!.onSelected({ uri: 'file:///hero.png', mime: 'image/png', crop });

    expect(onImageSelected).toHaveBeenCalledTimes(1);
    expect(onImageSelected).toHaveBeenCalledWith(
      { uri: 'file:///hero.png', mime: 'image/png' },
      normalizeRecipeImageHeroCrop(crop),
    );
    expect(onImageSelected.mock.calls[0]![1]).toMatchObject({ focusX: 0.3, focusY: 0.6, zoom: 1.8 });
  });
});
