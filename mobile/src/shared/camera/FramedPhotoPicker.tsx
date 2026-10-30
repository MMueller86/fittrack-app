import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../../app/theme';
import { Icon } from '../components/Icon';
import { cropImageToFrame } from './cropImageToFrame';
import { FramedCameraCapture, type CapturedPhoto } from './FramedCameraCapture';
import { FramedImageEditor } from './FramedImageEditor';
import {
  getCropForSourceRect,
  getSourceRectForCrop,
  type FrameCrop,
  type FrameSize,
  type ImageSize,
} from './frameCropMath';
import { FRAME_PRESETS, type FramePresetId } from './framePresets';

export interface FramedPhotoResult {
  uri: string;
  mime: 'image/jpeg' | 'image/png';
  crop: FrameCrop;
}

interface Props {
  visible: boolean;
  preset: FramePresetId;
  /** `metadata` keeps the original file and returns the crop; `cropped-file` returns the cropped, downsized JPEG. */
  output: 'metadata' | 'cropped-file';
  /** `editor` opens the pan/zoom editor after a capture; `direct` uses the frame as shown in the camera. */
  cameraReview: 'direct' | 'editor';
  sourceTitle: string;
  sourceSubtitle: string;
  /** Completes "FitTrack benötigt Kamerazugriff, um …". */
  cameraPurpose: string;
  editorTitle: string;
  editorOverlay?: (frame: FrameSize) => ReactNode;
  onClose: () => void;
  onSelected: (result: FramedPhotoResult) => void;
}

type PickerView = 'sources' | 'camera';

export function FramedPhotoPicker({
  visible,
  preset,
  output,
  cameraReview,
  sourceTitle,
  sourceSubtitle,
  cameraPurpose,
  editorTitle,
  editorOverlay,
  onClose,
  onSelected,
}: Props) {
  const insets = useSafeAreaInsets();
  const { aspectRatio, maxEdge } = FRAME_PRESETS[preset] as { aspectRatio: number; maxEdge?: number };
  const [pickerView, setPickerView] = useState<PickerView>('sources');
  const [error, setError] = useState<string | null>(null);
  const [editorSource, setEditorSource] = useState<{ uri: string; mime: 'image/jpeg' | 'image/png' } | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (!visible) {
      setPickerView('sources');
      setError(null);
      setEditorSource(null);
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    setPickerView('sources');
    setError(null);
    setEditorSource(null);
    onClose();
  }, [onClose]);

  const finish = useCallback(async (
    source: { uri: string; mime: 'image/jpeg' | 'image/png' },
    image: ImageSize,
    crop: FrameCrop,
  ) => {
    if (busy.current) return;
    busy.current = true;
    try {
      if (output === 'metadata') {
        onSelected({ ...source, crop });
      } else {
        const rect = getSourceRectForCrop(image, aspectRatio, crop);
        const cropped = await cropImageToFrame(source.uri, rect, image, maxEdge);
        onSelected({ ...cropped, crop });
      }
      handleClose();
    } catch {
      setEditorSource(null);
      setPickerView('sources');
      setError('Das Foto konnte nicht verarbeitet werden. Bitte versuche es erneut.');
    } finally {
      busy.current = false;
    }
  }, [aspectRatio, handleClose, maxEdge, onSelected, output]);

  const handleOpenGallery = useCallback(async () => {
    setError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError(
          permission.canAskAgain
            ? 'Der Zugriff auf deine Fotos wurde nicht erteilt.'
            : 'Bitte erlaube FitTrack den Fotozugriff in den Geräteeinstellungen.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: false,
        selectionLimit: 1,
      });
      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        setError('Das Foto konnte nicht übernommen werden.');
        return;
      }
      setEditorSource({ uri: asset.uri, mime: asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg' });
    } catch {
      setError('Die Galerie konnte nicht geöffnet werden. Bitte versuche es erneut.');
    }
  }, []);

  const handleCaptured = useCallback(async (photo: CapturedPhoto) => {
    if (cameraReview === 'editor') {
      setPickerView('sources');
      setEditorSource({ uri: photo.uri, mime: photo.mime });
      return;
    }
    const image = { width: photo.width, height: photo.height };
    await finish(
      { uri: photo.uri, mime: photo.mime },
      image,
      getCropForSourceRect(image, aspectRatio, photo.frameRect),
    );
  }, [aspectRatio, cameraReview, finish]);

  const handleEditorCancel = useCallback(() => {
    setEditorSource(null);
    setPickerView('sources');
  }, []);

  return (
    <>
      <Modal
        visible={visible && pickerView === 'sources' && editorSource == null}
        transparent
        animationType="slide"
        onRequestClose={handleClose}
      >
        <View style={styles.sourceModal}>
          <TouchableOpacity
            style={styles.sourceBackdrop}
            activeOpacity={1}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Fotoauswahl schließen"
          />
          <View style={[styles.sourceSheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <View style={styles.handle} />
            <Text style={styles.sourceTitle}>{sourceTitle}</Text>
            <Text style={styles.sourceSubtitle}>{sourceSubtitle}</Text>

            <TouchableOpacity
              style={styles.sourceOption}
              onPress={() => {
                setError(null);
                setPickerView('camera');
              }}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Kamera öffnen"
            >
              <View style={styles.sourceIcon}>
                <Icon lib="feather" name="camera" size="md" color={colors.primaryBright} />
              </View>
              <View style={styles.sourceOptionCopy}>
                <Text style={styles.sourceOptionTitle}>Kamera</Text>
                <Text style={styles.sourceOptionText}>Ein neues Foto aufnehmen</Text>
              </View>
              <Icon lib="feather" name="chevron-right" size="md" color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sourceOption}
              onPress={() => void handleOpenGallery()}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Galerie öffnen"
            >
              <View style={styles.sourceIcon}>
                <Icon lib="feather" name="image" size="md" color={colors.primaryBright} />
              </View>
              <View style={styles.sourceOptionCopy}>
                <Text style={styles.sourceOptionTitle}>Galerie</Text>
                <Text style={styles.sourceOptionText}>Ein vorhandenes Foto auswählen</Text>
              </View>
              <Icon lib="feather" name="chevron-right" size="md" color={colors.textMuted} />
            </TouchableOpacity>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Fotoauswahl abbrechen"
            >
              <Text style={styles.cancelButtonText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={visible && pickerView === 'camera' && editorSource == null}
        animationType="slide"
        onRequestClose={handleClose}
      >
        <FramedCameraCapture
          aspectRatio={aspectRatio}
          permissionPurpose={cameraPurpose}
          onClose={handleClose}
          onCaptured={handleCaptured}
        />
      </Modal>

      <FramedImageEditor
        visible={visible && editorSource != null}
        imageUri={editorSource?.uri ?? null}
        aspectRatio={aspectRatio}
        title={editorTitle}
        overlay={editorOverlay}
        onCancel={handleEditorCancel}
        onConfirm={(crop, imageSize) => {
          if (editorSource) void finish(editorSource, imageSize, crop);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sourceModal: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sourceBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.background,
    opacity: 0.75,
  },
  sourceSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  handle: {
    width: spacing.xl,
    height: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sourceTitle: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
  },
  sourceSubtitle: {
    ...typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  sourceOption: {
    minHeight: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  sourceIcon: {
    width: spacing.xl,
    height: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceOptionCopy: {
    flex: 1,
  },
  sourceOptionTitle: {
    ...typography.body1,
    color: colors.text,
    fontWeight: '600',
  },
  sourceOptionText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  errorBox: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  errorText: {
    ...typography.body2,
    color: colors.textSecondary,
  },
  cancelButton: {
    minHeight: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  cancelButtonText: {
    ...typography.body1,
    color: colors.textSecondary,
  },
});
