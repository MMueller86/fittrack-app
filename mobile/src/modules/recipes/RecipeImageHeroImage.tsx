import React, { useEffect, useState } from 'react';
import {
  Image,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { RecipeImageHeroCrop } from '@fittrack/shared';
import { colors } from '../../app/theme';
import { RECIPE_HERO_ASPECT_RATIO } from './recipeImageSource';
import {
  getCropGeometry,
  getTransformForHeroCrop,
  normalizeRecipeImageHeroCrop,
  type CropFrameDimensions,
  type CropImageDimensions,
} from './recipeImageHeroCropMath';

interface Props {
  uri: string;
  heroCrop?: RecipeImageHeroCrop | null;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

interface LoadedImage extends CropImageDimensions {
  uri: string;
}

export function RecipeImageHeroImage({ uri, heroCrop, style, accessibilityLabel }: Props) {
  const [loadedImage, setLoadedImage] = useState<LoadedImage | null>(null);
  const [frame, setFrame] = useState<CropFrameDimensions | null>(null);

  useEffect(() => {
    setLoadedImage(null);
  }, [uri]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    setFrame({ width, height });
  };

  const image = loadedImage?.uri === uri ? loadedImage : null;
  const crop = normalizeRecipeImageHeroCrop(heroCrop);
  const geometry = image && frame ? getCropGeometry(image, frame, crop.zoom) : null;
  const transform = image && frame
    ? getTransformForHeroCrop(image, frame, crop)
    : null;
  const croppedImageStyle = geometry && frame && transform
    ? {
      position: 'absolute' as const,
      width: geometry.renderedWidth,
      height: geometry.renderedHeight,
      left: (frame.width - geometry.renderedWidth) / 2,
      top: (frame.height - geometry.renderedHeight) / 2,
      transform: [
        { translateX: transform.x },
        { translateY: transform.y },
      ],
    }
    : null;

  return (
    <View
      style={[styles.frame, { aspectRatio: RECIPE_HERO_ASPECT_RATIO }, style]}
      onLayout={handleLayout}
    >
      <Image
        source={{ uri }}
        style={styles.preloader}
        onLoad={(event) => {
          const { width, height } = event.nativeEvent.source;
          if (width > 0 && height > 0) {
            setLoadedImage({ uri, width, height });
          }
        }}
        accessible={false}
      />
      {croppedImageStyle ? (
        <Image
          source={{ uri }}
          style={croppedImageStyle}
          accessibilityLabel={accessibilityLabel}
        />
      ) : (
        <Image
          source={{ uri }}
          style={styles.fallbackImage}
          resizeMode="cover"
          accessibilityLabel={accessibilityLabel}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  preloader: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  fallbackImage: {
    ...StyleSheet.absoluteFillObject,
  },
});