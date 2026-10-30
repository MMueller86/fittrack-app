import React, { useCallback } from 'react';
import type { RecipeImageHeroCrop } from '@fittrack/shared';
import { FramedPhotoPicker, type FramedPhotoResult } from '../../shared/camera/FramedPhotoPicker';
import { renderRecipeHeroOverlay } from './RecipeImageHeroCropEditor';
import { normalizeRecipeImageHeroCrop } from './recipeImageHeroCropMath';
import type { RecipeImageSelection } from './recipeImageSource';

interface Props {
  visible: boolean;
  onClose: () => void;
  onImageSelected: (selection: RecipeImageSelection, heroCrop: RecipeImageHeroCrop) => void;
}

export function RecipeImageSourcePicker({ visible, onClose, onImageSelected }: Props) {
  const handleSelected = useCallback(({ uri, mime, crop }: FramedPhotoResult) => {
    onImageSelected({ uri, mime }, normalizeRecipeImageHeroCrop(crop));
  }, [onImageSelected]);

  return (
    <FramedPhotoPicker
      visible={visible}
      preset="recipeHero"
      output="metadata"
      cameraReview="editor"
      sourceTitle="Foto hinzufügen"
      sourceSubtitle="Wähle eine Quelle für dein Rezeptfoto."
      cameraPurpose="ein Rezeptfoto aufzunehmen"
      editorTitle="Hero-Ausschnitt"
      editorOverlay={renderRecipeHeroOverlay}
      onClose={onClose}
      onSelected={handleSelected}
    />
  );
}
