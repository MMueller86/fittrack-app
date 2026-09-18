import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RecipeImageHeroCrop } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { Icon } from '../../shared/components/Icon';
import { RecipeImageHeroCropEditor } from './RecipeImageHeroCropEditor';
import {
  getRecipeHeroFrame,
  getRecipeImageSelection,
  type RecipeImageSelection,
} from './recipeImageSource';

interface Props {
  visible: boolean;
  onClose: () => void;
  onImageSelected: (selection: RecipeImageSelection, heroCrop: RecipeImageHeroCrop) => void;
}

type PickerView = 'sources' | 'camera';
type CameraStatus = 'checking' | 'ready' | 'denied';

export function RecipeImageSourcePicker({ visible, onClose, onImageSelected }: Props) {
  const insets = useSafeAreaInsets();
  const [pickerView, setPickerView] = useState<PickerView>('sources');
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [editorSelection, setEditorSelection] = useState<RecipeImageSelection | null>(null);

  useEffect(() => {
    if (!visible) {
      setPickerView('sources');
      setGalleryError(null);
      setEditorSelection(null);
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    setPickerView('sources');
    setGalleryError(null);
    setEditorSelection(null);
    onClose();
  }, [onClose]);

  const openEditor = useCallback((selection: RecipeImageSelection) => {
    setPickerView('sources');
    setEditorSelection(selection);
  }, []);

  const handleOpenGallery = useCallback(async () => {
    setGalleryError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setGalleryError(
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

      const selection = getRecipeImageSelection(result.assets?.[0]);
      if (!selection) {
        setGalleryError('Das Foto konnte nicht übernommen werden.');
        return;
      }
      openEditor(selection);
    } catch {
      setGalleryError('Die Galerie konnte nicht geöffnet werden. Bitte versuche es erneut.');
    }
  }, [openEditor]);

  const handleEditorConfirm = useCallback((heroCrop: RecipeImageHeroCrop) => {
    if (!editorSelection) return;
    const selection = editorSelection;
    onImageSelected(selection, heroCrop);
    handleClose();
  }, [editorSelection, handleClose, onImageSelected]);

  const handleEditorCancel = useCallback(() => {
    setEditorSelection(null);
    setPickerView('sources');
  }, []);

  return (
    <>
      <Modal
        visible={visible && pickerView === 'sources' && editorSelection == null}
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
            <Text style={styles.sourceTitle}>Foto hinzufügen</Text>
            <Text style={styles.sourceSubtitle}>Wähle eine Quelle für dein Rezeptfoto.</Text>

            <TouchableOpacity
              style={styles.sourceOption}
              onPress={() => {
                setGalleryError(null);
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

            {galleryError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{galleryError}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => void handleOpenGallery()}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Galerie erneut versuchen"
                >
                  <Icon lib="feather" name="refresh-cw" size="sm" color={colors.primaryBright} />
                  <Text style={styles.retryButtonText}>Erneut versuchen</Text>
                </TouchableOpacity>
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
        visible={visible && pickerView === 'camera' && editorSelection == null}
        animationType="slide"
        onRequestClose={handleClose}
      >
        <RecipeCameraCapture onClose={handleClose} onCaptured={openEditor} />
      </Modal>

      <RecipeImageHeroCropEditor
        visible={visible && editorSelection != null}
        imageUri={editorSelection?.uri ?? null}
        onCancel={handleEditorCancel}
        onConfirm={handleEditorConfirm}
      />
    </>
  );
}

interface CameraProps {
  onClose: () => void;
  onCaptured: (selection: RecipeImageSelection) => void;
}

function RecipeCameraCapture({ onClose, onCaptured }: CameraProps) {
  const insets = useSafeAreaInsets();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [permissionStatus, setPermissionStatus] = useState<CameraStatus>('checking');
  const [permissionRequested, setPermissionRequested] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const frame = getRecipeHeroFrame(viewportWidth, viewportHeight, insets.top, insets.bottom);

  useEffect(() => {
    if (!permission) return;
    if (permission.granted) {
      setPermissionStatus('ready');
      return;
    }
    if (!permission.canAskAgain) {
      setPermissionStatus('denied');
      return;
    }
    if (permissionRequested) return;

    setPermissionRequested(true);
    setPermissionStatus('checking');
    requestPermission()
      .then((result) => setPermissionStatus(result.granted ? 'ready' : 'denied'))
      .catch(() => setPermissionStatus('denied'));
  }, [permission, permissionRequested, requestPermission]);

  const handleRetryPermission = () => {
    setPermissionStatus('checking');
    setPermissionRequested(false);
    setCaptureError(false);
  };

  const handleCapture = async () => {
    if (capturing || !cameraRef.current) return;
    setCapturing(true);
    setCaptureError(false);
    try {
      const picture = await cameraRef.current.takePictureAsync();
      const selection = getRecipeImageSelection({ uri: picture?.uri, mimeType: 'image/jpeg' });
      if (!selection) {
        setCaptureError(true);
        return;
      }
      onCaptured(selection);
    } catch {
      setCaptureError(true);
    } finally {
      setCapturing(false);
    }
  };

  const permissionMessage = permission?.canAskAgain === false
    ? 'Bitte erlaube FitTrack den Kamerazugriff in den Geräteeinstellungen.'
    : 'FitTrack benötigt Kamerazugriff, um ein Rezeptfoto aufzunehmen.';

  return (
    <View style={styles.cameraContainer}>
      {permissionStatus === 'ready' && permission?.granted && (
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      )}

      {permissionStatus === 'ready' && permission?.granted && (
        <>
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View style={[styles.dimPanel, { top: 0, left: 0, right: 0, height: frame.top }]} />
            <View style={[styles.dimPanel, { top: frame.top, left: 0, width: frame.left, height: frame.height }]} />
            <View
              style={[
                styles.dimPanel,
                {
                  top: frame.top,
                  left: frame.left + frame.width,
                  right: 0,
                  height: frame.height,
                },
              ]}
            />
            <View
              style={[
                styles.dimPanel,
                { top: frame.top + frame.height, left: 0, right: 0, bottom: 0 },
              ]}
            />
            <View
              style={[
                styles.heroFrame,
                {
                  left: frame.left,
                  top: frame.top,
                  width: frame.width,
                  height: frame.height,
                },
              ]}
            />
          </View>

          <View style={[styles.cameraTopBar, { paddingTop: insets.top + spacing.sm }]}>
            <TouchableOpacity
              style={styles.cameraCloseButton}
              onPress={onClose}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Kamera schließen"
            >
              <Icon lib="feather" name="x" size="lg" color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.cameraTitle}>Foto aufnehmen</Text>
            <View style={styles.cameraTopSpacer} />
          </View>

          {!captureError && (
            <Text style={[styles.cameraHint, { top: frame.top + frame.height + spacing.sm }]}>
              Motiv im Rahmen platzieren
            </Text>
          )}

          {captureError && (
            <View
              style={[
                styles.captureError,
                { top: frame.top + frame.height + spacing.sm, left: spacing.md, right: spacing.md },
              ]}
            >
              <Text style={styles.captureErrorText}>Das Foto konnte nicht aufgenommen werden.</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => setCaptureError(false)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Fotoaufnahme erneut versuchen"
              >
                <Icon lib="feather" name="refresh-cw" size="sm" color={colors.primaryBright} />
                <Text style={styles.retryButtonText}>Erneut versuchen</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.captureControls, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <TouchableOpacity
              style={styles.captureButton}
              onPress={() => void handleCapture()}
              disabled={capturing}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Foto aufnehmen"
            >
              {capturing ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Icon lib="feather" name="camera" size="lg" color={colors.background} />
              )}
            </TouchableOpacity>
          </View>
        </>
      )}

      {permissionStatus !== 'ready' && (
        <View style={styles.cameraStatusArea}>
          <View style={styles.cameraMessageCard}>
            {permissionStatus === 'checking' ? (
              <>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.cameraMessageTitle}>Kamera wird vorbereitet…</Text>
              </>
            ) : (
              <>
                <Icon lib="feather" name="camera-off" size="lg" color={colors.textMuted} />
                <Text style={styles.cameraMessageTitle}>Kein Kamerazugriff</Text>
                <Text style={styles.cameraMessageBody}>{permissionMessage}</Text>
                <TouchableOpacity
                  style={styles.primaryAction}
                  onPress={handleRetryPermission}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Kameraberechtigung erneut versuchen"
                >
                  <Icon lib="feather" name="refresh-cw" size="sm" color={colors.background} />
                  <Text style={styles.primaryActionText}>Erneut versuchen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryAction}
                  onPress={onClose}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Kamera abbrechen"
                >
                  <Text style={styles.secondaryActionText}>Abbrechen</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sourceModal: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sourceBackdrop: {
    ...StyleSheet.absoluteFillObject,
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
  retryButton: {
    minHeight: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
  },
  retryButtonText: {
    ...typography.button,
    color: colors.primaryBright,
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
  cameraContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  dimPanel: {
    position: 'absolute',
    backgroundColor: colors.background,
    opacity: 0.72,
  },
  heroFrame: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: colors.primaryBright,
    borderRadius: radius.md,
  },
  cameraTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  cameraCloseButton: {
    width: spacing.xxl,
    height: spacing.xxl,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraTitle: {
    ...typography.h3,
    color: colors.text,
  },
  cameraTopSpacer: {
    width: spacing.xxl,
    height: spacing.xxl,
  },
  cameraHint: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    ...typography.body2,
    color: colors.text,
    textAlign: 'center',
  },
  captureError: {
    position: 'absolute',
    alignItems: 'center',
  },
  captureErrorText: {
    ...typography.body2,
    color: colors.text,
    textAlign: 'center',
  },
  captureControls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  captureButton: {
    width: spacing.xxl,
    height: spacing.xxl,
    borderRadius: radius.full,
    backgroundColor: colors.primaryBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraStatusArea: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  cameraMessageCard: {
    width: '100%',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
  },
  cameraMessageTitle: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  cameraMessageBody: {
    ...typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  primaryAction: {
    minHeight: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  primaryActionText: {
    ...typography.button,
    color: colors.background,
  },
  secondaryAction: {
    minHeight: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  secondaryActionText: {
    ...typography.body1,
    color: colors.textSecondary,
  },
});