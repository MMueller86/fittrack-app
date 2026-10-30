import React, { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../../app/theme';
import { Icon } from '../components/Icon';
import {
  getCaptureFrame,
  getCropGeometry,
  getFocusForTransform,
  getTransformForFocus,
  type FrameCrop,
  type FrameSize,
  type ImageSize,
} from './frameCropMath';

const DEFAULT_CROP: FrameCrop = { focusX: 0.5, focusY: 0.5, zoom: 1 };

export interface FramedImageEditorProps {
  visible: boolean;
  imageUri: string | null;
  aspectRatio: number;
  title: string;
  initialCrop?: FrameCrop | null;
  /** Rendered inside the frame, above the image. */
  overlay?: (frame: FrameSize) => ReactNode;
  onCancel: () => void;
  onConfirm: (crop: FrameCrop, imageSize: ImageSize) => void;
}

export function FramedImageEditor({
  visible,
  imageUri,
  aspectRatio,
  title,
  initialCrop,
  overlay,
  onCancel,
  onConfirm,
}: FramedImageEditorProps) {
  const insets = useSafeAreaInsets();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const frame = getCaptureFrame(aspectRatio, viewportWidth, viewportHeight, insets.top, insets.bottom);
  const frameDimensions = { width: frame.width, height: frame.height };
  const startCrop = initialCrop ?? DEFAULT_CROP;
  const [imageSize, setImageSize] = useState<ImageSize | null>(null);
  const [imageError, setImageError] = useState(false);
  const zoom = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const pinchStartZoom = useSharedValue(1);
  const pinchStartSourceX = useSharedValue(0);
  const pinchStartSourceY = useSharedValue(0);

  useEffect(() => {
    setImageSize(null);
    setImageError(false);
  }, [imageUri, visible]);

  useEffect(() => {
    if (!visible || !imageUri) {
      setImageSize(null);
      setImageError(false);
      return;
    }
    if (imageSize) {
      const initialTransform = getTransformForFocus(imageSize, frameDimensions, startCrop);
      zoom.value = initialTransform.zoom;
      translateX.value = initialTransform.x;
      translateY.value = initialTransform.y;
      return;
    }
    zoom.value = Math.max(1, startCrop.zoom);
    translateX.value = 0;
    translateY.value = 0;
  }, [frame.height, frame.width, imageSize, imageUri, startCrop.focusX, startCrop.focusY, startCrop.zoom, translateX, translateY, visible, zoom]);

  const handleImageLoad = (width: number, height: number) => {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      setImageError(true);
      return;
    }
    const nextImageSize = { width, height };
    setImageError(false);
    setImageSize(nextImageSize);
    const initialTransform = getTransformForFocus(nextImageSize, frameDimensions, startCrop);
    zoom.value = initialTransform.zoom;
    translateX.value = initialTransform.x;
    translateY.value = initialTransform.y;
  };

  const imageWidth = imageSize?.width ?? 0;
  const imageHeight = imageSize?.height ?? 0;
  const minimumScale = imageSize
    ? getCropGeometry(imageSize, frameDimensions, 1).minimumScale
    : 1;
  const canEdit = imageSize != null && !imageError;

  const panGesture = Gesture.Pan()
    .enabled(canEdit)
    .onStart(() => {
      panStartX.value = translateX.value;
      panStartY.value = translateY.value;
    })
    .onUpdate((event) => {
      const geometry = getCropGeometry(
        { width: imageWidth, height: imageHeight },
        frameDimensions,
        zoom.value,
      );
      translateX.value = Math.max(
        geometry.minTranslateX,
        Math.min(geometry.maxTranslateX, panStartX.value + event.translationX),
      );
      translateY.value = Math.max(
        geometry.minTranslateY,
        Math.min(geometry.maxTranslateY, panStartY.value + event.translationY),
      );
    });

  const pinchGesture = Gesture.Pinch()
    .enabled(canEdit)
    .onStart((event) => {
      pinchStartZoom.value = Math.max(1, zoom.value);
      const geometry = getCropGeometry(
        { width: imageWidth, height: imageHeight },
        frameDimensions,
        pinchStartZoom.value,
      );
      const left = geometry.centeredX + translateX.value;
      const top = geometry.centeredY + translateY.value;
      pinchStartSourceX.value = (event.focalX - left) / geometry.scale;
      pinchStartSourceY.value = (event.focalY - top) / geometry.scale;
    })
    .onUpdate((event) => {
      const nextZoom = Math.max(1, pinchStartZoom.value * event.scale);
      const geometry = getCropGeometry(
        { width: imageWidth, height: imageHeight },
        frameDimensions,
        nextZoom,
      );
      const requestedLeft = event.focalX - pinchStartSourceX.value * geometry.scale;
      const requestedTop = event.focalY - pinchStartSourceY.value * geometry.scale;
      translateX.value = Math.max(
        geometry.minTranslateX,
        Math.min(geometry.maxTranslateX, requestedLeft - geometry.centeredX),
      );
      translateY.value = Math.max(
        geometry.minTranslateY,
        Math.min(geometry.maxTranslateY, requestedTop - geometry.centeredY),
      );
      zoom.value = nextZoom;
    });

  const gesture = Gesture.Simultaneous(panGesture, pinchGesture);

  const imageStyle = useAnimatedStyle(() => {
    const scale = minimumScale * Math.max(1, zoom.value);
    const renderedWidth = imageWidth * scale;
    const renderedHeight = imageHeight * scale;
    return {
      width: renderedWidth,
      height: renderedHeight,
      left: (frame.width - renderedWidth) / 2,
      top: (frame.height - renderedHeight) / 2,
      transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
    };
  });

  const handleConfirm = () => {
    if (!imageSize) return;
    onConfirm(
      getFocusForTransform(
        imageSize,
        frameDimensions,
        { zoom: zoom.value, x: translateX.value, y: translateY.value },
        startCrop,
      ),
      imageSize,
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={onCancel}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`${title} schließen`}
          >
            <Icon lib="feather" name="x" size="lg" color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.headerButtonSpacer} />
        </View>

        <GestureDetector gesture={gesture}>
          <View
            style={[
              styles.frame,
              {
                left: frame.left,
                top: frame.top,
                width: frame.width,
                height: frame.height,
              },
            ]}
          >
            {imageUri && (
              <Image
                source={{ uri: imageUri }}
                style={styles.imagePreloader}
                onLoad={(event) => handleImageLoad(
                  event.nativeEvent.source.width,
                  event.nativeEvent.source.height,
                )}
                onError={() => {
                  setImageSize(null);
                  setImageError(true);
                }}
              />
            )}
            {canEdit && <Animated.Image source={{ uri: imageUri! }} style={[styles.image, imageStyle]} />}
            {overlay?.(frameDimensions)}
            {!canEdit && !imageError && <ActivityIndicator color={colors.primaryBright} />}
            {imageError && <Text style={styles.imageErrorText}>Das Bild konnte nicht geladen werden.</Text>}
          </View>
        </GestureDetector>

        <Text style={[styles.instruction, { top: frame.top + frame.height + spacing.sm }]}>
          Bild verschieben oder mit zwei Fingern zoomen
        </Text>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`${title} abbrechen`}
          >
            <Text style={styles.cancelButtonText}>Abbrechen</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmButton, !canEdit && styles.confirmButtonDisabled]}
            onPress={handleConfirm}
            disabled={!canEdit}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`${title} übernehmen`}
          >
            <Icon lib="feather" name="check" size="md" color={colors.background} />
            <Text style={styles.confirmButtonText}>Übernehmen</Text>
          </TouchableOpacity>
        </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    position: 'absolute',
    zIndex: 2,
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  headerButton: {
    width: spacing.xxl,
    height: spacing.xxl,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonSpacer: {
    width: spacing.xxl,
    height: spacing.xxl,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
  },
  frame: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.primaryBright,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePreloader: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  image: {
    position: 'absolute',
  },
  imageErrorText: {
    ...typography.body2,
    color: colors.text,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  instruction: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    ...typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cancelButton: {
    minHeight: spacing.xxl,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    ...typography.button,
    color: colors.textSecondary,
  },
  confirmButton: {
    flex: 1,
    minHeight: spacing.xxl,
    borderRadius: radius.md,
    backgroundColor: colors.primaryBright,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    ...typography.button,
    color: colors.background,
  },
});
