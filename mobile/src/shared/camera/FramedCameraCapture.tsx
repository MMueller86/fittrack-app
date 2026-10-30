import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  type LayoutChangeEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../../app/theme';
import { Icon } from '../components/Icon';
import { getCaptureFrame, getPreviewSourceRect, type SourceRect } from './frameCropMath';

export interface CapturedPhoto {
  uri: string;
  mime: 'image/jpeg';
  width: number;
  height: number;
  /** Pixel rectangle of the photo that was visible inside the frame. */
  frameRect: SourceRect;
}

interface Props {
  aspectRatio: number;
  /** Completes "FitTrack benötigt Kamerazugriff, um …", e.g. "ein Rezeptfoto aufzunehmen". */
  permissionPurpose: string;
  title?: string;
  hint?: string;
  onClose: () => void;
  onCaptured: (photo: CapturedPhoto) => void | Promise<void>;
}

type CameraStatus = 'checking' | 'ready' | 'denied';

export function FramedCameraCapture({
  aspectRatio,
  permissionPurpose,
  title = 'Foto aufnehmen',
  hint = 'Motiv im Rahmen platzieren',
  onClose,
  onCaptured,
}: Props) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [layout, setLayout] = useState({ width: window.width, height: window.height });
  const [permission, requestPermission] = useCameraPermissions();
  const [permissionStatus, setPermissionStatus] = useState<CameraStatus>('checking');
  const [permissionRequested, setPermissionRequested] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const frame = getCaptureFrame(aspectRatio, layout.width, layout.height, insets.top, insets.bottom);

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

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) setLayout({ width, height });
  };

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
      if (!picture?.uri || !(picture.width > 0) || !(picture.height > 0)) {
        setCaptureError(true);
        return;
      }
      const photo = { width: picture.width, height: picture.height };
      await onCaptured({
        uri: picture.uri,
        mime: 'image/jpeg',
        ...photo,
        frameRect: getPreviewSourceRect(photo, layout, frame),
      });
    } catch {
      setCaptureError(true);
    } finally {
      setCapturing(false);
    }
  };

  const permissionMessage = permission?.canAskAgain === false
    ? 'Bitte erlaube FitTrack den Kamerazugriff in den Geräteeinstellungen.'
    : `FitTrack benötigt Kamerazugriff, um ${permissionPurpose}.`;
  const ready = permissionStatus === 'ready' && permission?.granted;

  return (
    <View style={styles.cameraContainer} onLayout={handleLayout}>
      {ready && <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />}

      {ready && (
        <>
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View style={[styles.dimPanel, { top: 0, left: 0, right: 0, height: frame.top }]} />
            <View style={[styles.dimPanel, { top: frame.top, left: 0, width: frame.left, height: frame.height }]} />
            <View
              style={[
                styles.dimPanel,
                { top: frame.top, left: frame.left + frame.width, right: 0, height: frame.height },
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
                styles.frameBorder,
                { left: frame.left, top: frame.top, width: frame.width, height: frame.height },
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
            <Text style={styles.cameraTitle}>{title}</Text>
            <View style={styles.cameraTopSpacer} />
          </View>

          {!captureError && (
            <Text style={[styles.cameraHint, { top: frame.top + frame.height + spacing.sm }]}>{hint}</Text>
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
  cameraContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  dimPanel: {
    position: 'absolute',
    backgroundColor: colors.background,
    opacity: 0.72,
  },
  frameBorder: {
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
    ...StyleSheet.absoluteFill,
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
