import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RecipeImageHeroCrop } from '@fittrack/shared';
import { colors, typography } from '../../app/theme';
import { FramedImageEditor } from '../../shared/camera/FramedImageEditor';
import type { FrameSize } from '../../shared/camera/frameCropMath';
import { RECIPE_HERO_ASPECT_RATIO } from './recipeImageSource';
import {
  normalizeRecipeImageHeroCrop,
  RECIPE_HERO_RENDERER_SAFE_AREA_TOP_RATIO,
} from './recipeImageHeroCropMath';

export interface RecipeImageHeroCropEditorProps {
  visible: boolean;
  imageUri: string | null;
  initialCrop?: RecipeImageHeroCrop | null;
  onCancel: () => void;
  onConfirm: (crop: RecipeImageHeroCrop) => void;
}

export function renderRecipeHeroOverlay(frame: FrameSize) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.safeAreaHint,
        {
          top: frame.height * RECIPE_HERO_RENDERER_SAFE_AREA_TOP_RATIO,
          height: frame.height * (1 - RECIPE_HERO_RENDERER_SAFE_AREA_TOP_RATIO),
        },
      ]}
    >
      <Text style={styles.safeAreaHintText}>Titel- und Tag-Zone</Text>
    </View>
  );
}

export function RecipeImageHeroCropEditor({
  visible,
  imageUri,
  initialCrop,
  onCancel,
  onConfirm,
}: RecipeImageHeroCropEditorProps) {
  return (
    <FramedImageEditor
      visible={visible}
      imageUri={imageUri}
      aspectRatio={RECIPE_HERO_ASPECT_RATIO}
      title="Hero-Ausschnitt"
      initialCrop={normalizeRecipeImageHeroCrop(initialCrop)}
      overlay={renderRecipeHeroOverlay}
      onCancel={onCancel}
      onConfirm={(crop) => onConfirm(normalizeRecipeImageHeroCrop(crop))}
    />
  );
}

const styles = StyleSheet.create({
  safeAreaHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    opacity: 0.62,
    borderTopWidth: 1,
    borderTopColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeAreaHintText: {
    ...typography.caption,
    color: colors.text,
  },
});
