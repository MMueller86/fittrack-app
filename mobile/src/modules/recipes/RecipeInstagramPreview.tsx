import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../../app/theme';
import { Icon } from '../../shared/components/Icon';
import type {
  RecipeShareAssetStatus,
  RecipeShareRenderStage,
  RecipeShareRenderStatus,
  RecipeShareStatus,
} from './recipeShareDraftState';

const INSTAGRAM_PREVIEW_ASPECT_RATIO = 1080 / 1350;

export interface RecipeInstagramPreviewProps {
  visible: boolean;
  previewUri: string | null;
  renderStatus: RecipeShareRenderStatus;
  renderStage: RecipeShareRenderStage;
  assetStatus: RecipeShareAssetStatus;
  shareStatus: RecipeShareStatus;
  canAdjustCrop: boolean;
  canChangeOptions: boolean;
  busy: boolean;
  onClose: () => void;
  onAdjustCrop: () => void;
  onChangeOptions: () => void;
  onRetryRender: () => void;
  onSaveAndShare: () => void;
}

export function RecipeInstagramPreview({
  visible,
  previewUri,
  renderStatus,
  renderStage,
  assetStatus,
  shareStatus,
  canAdjustCrop,
  canChangeOptions,
  busy,
  onClose,
  onAdjustCrop,
  onChangeOptions,
  onRetryRender,
  onSaveAndShare,
}: RecipeInstagramPreviewProps) {
  const insets = useSafeAreaInsets();
  const isRendering = renderStatus === 'loading';
  const isSaving = busy || assetStatus === 'loading' || shareStatus === 'loading';
  const canSave = Boolean(previewUri) && renderStatus === 'ready' && !isSaving;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={[
          styles.overlay,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.sm },
        ]}
      >
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Vorschau schließen"
        />

        <Animated.View
          style={styles.card}
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Instagram-Vorschau</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              disabled={isSaving}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Vorschau schließen"
              accessibilityState={{ disabled: isSaving }}
            >
              <Icon lib="feather" name="x" size="lg" color={colors.text} />
            </TouchableOpacity>
          </View>

          <View
            style={styles.previewFrame}
            accessible={Boolean(previewUri)}
            accessibilityRole="image"
            accessibilityLabel="Gerenderte Instagram-Vorschau im Format 1080 mal 1350"
          >
            {previewUri ? (
              <Animated.Image
                key={previewUri}
                source={{ uri: previewUri }}
                resizeMode="contain"
                style={styles.previewImage}
                entering={FadeIn.duration(180)}
                exiting={FadeOut.duration(150)}
              />
            ) : null}

            {!previewUri && isRendering ? (
              <View style={styles.loadingState}>
                <ActivityIndicator color={colors.primaryBright} />
                <Text style={styles.loadingText}>Vorschau wird erstellt…</Text>
              </View>
            ) : null}

            {previewUri && isRendering ? (
              <View style={styles.renderingOverlay} pointerEvents="none">
                <ActivityIndicator color={colors.primaryBright} />
                <Text style={styles.renderingText}>
                  {renderStage === 'final' ? 'Ausschnitt wird übernommen…' : 'Vorschau wird aktualisiert…'}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.secondaryButton, (!previewUri || isSaving || isRendering) && styles.disabledButton]}
              onPress={onAdjustCrop}
              disabled={!previewUri || isSaving || isRendering || !canAdjustCrop}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Ausschnitt anpassen"
              accessibilityState={{ disabled: !previewUri || isSaving || isRendering || !canAdjustCrop }}
            >
              <Icon lib="feather" name="crop" size="md" color={colors.primaryBright} />
              <Text style={styles.secondaryButtonText}>Ausschnitt anpassen</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, (isSaving || isRendering) && styles.disabledButton]}
              onPress={onChangeOptions}
              disabled={isSaving || isRendering || !canChangeOptions}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Instagram-Optionen ändern"
              accessibilityState={{ disabled: isSaving || isRendering || !canChangeOptions }}
            >
              <Icon lib="feather" name="sliders" size="md" color={colors.primaryBright} />
              <Text style={styles.secondaryButtonText}>Optionen ändern</Text>
            </TouchableOpacity>

            {renderStatus === 'error' ? (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={onRetryRender}
                disabled={isSaving}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Vorschau erneut rendern"
                accessibilityState={{ disabled: isSaving }}
              >
                <Icon lib="feather" name="refresh-cw" size="md" color={colors.primaryBright} />
                <Text style={styles.secondaryButtonText}>Erneut versuchen</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryButton, !canSave && styles.primaryButtonDisabled]}
              onPress={onSaveAndShare}
              disabled={!canSave}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Bild speichern und teilen"
              accessibilityState={{ disabled: !canSave, busy: isSaving }}
            >
              {isSaving ? <ActivityIndicator color={colors.background} size="small" /> : null}
              <Text style={styles.primaryButtonText}>
                {isSaving ? 'Wird gespeichert und geteilt…' : 'Speichern & teilen'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    opacity: 0.8,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '94%',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h3,
    color: colors.text,
  },
  closeButton: {
    width: spacing.xl,
    height: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewFrame: {
    width: '100%',
    aspectRatio: INSTAGRAM_PREVIEW_ASPECT_RATIO,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  loadingState: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.body2,
    color: colors.textSecondary,
  },
  renderingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    opacity: 0.86,
  },
  renderingText: {
    ...typography.body2,
    color: colors.text,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  secondaryButton: {
    minHeight: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  retryButton: {
    minHeight: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  disabledButton: {
    opacity: 0.5,
  },
  secondaryButtonText: {
    ...typography.button,
    color: colors.primaryBright,
  },
  primaryButton: {
    minHeight: spacing.xl,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  primaryButtonDisabled: {
    backgroundColor: colors.primaryDark,
    opacity: 0.65,
  },
  primaryButtonText: {
    ...typography.button,
    color: colors.background,
  },
});