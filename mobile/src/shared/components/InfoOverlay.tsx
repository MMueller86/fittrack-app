import React, { type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../../app/theme';
import { Icon } from './Icon';
import {
  INFO_OVERLAY_CONTENT_MAX_HEIGHT,
  INFO_OVERLAY_FOOTER_MARGIN_TOP,
  INFO_OVERLAY_MIN_TOUCH_HEIGHT,
  INFO_OVERLAY_PANEL_BOTTOM_PADDING,
} from './infoOverlayLayout';

export interface InfoOverlaySecondaryAction {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

interface Props {
  visible: boolean;
  title: string;
  body: string;
  onClose: () => void;
  children?: ReactNode;
  secondaryAction?: InfoOverlaySecondaryAction;
}

export function InfoOverlay({
  visible,
  title,
  body,
  onClose,
  children,
  secondaryAction,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.sm }]}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Overlay schließen"
        />
        <View style={styles.card}>
          {secondaryAction ? (
            <View style={styles.header}>
              <Text style={[styles.title, styles.headerTitle]}>{title}</Text>
              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={secondaryAction.onPress}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={secondaryAction.accessibilityLabel ?? secondaryAction.label}
                accessibilityHint={secondaryAction.accessibilityHint}
              >
                <Text style={styles.secondaryActionText}>{secondaryAction.label}</Text>
                <Icon lib="feather" name="chevron-right" size="sm" color={colors.primary} />
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.title}>{title}</Text>
          )}
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator
            nestedScrollEnabled
          >
            {body ? <Text style={styles.body}>{body}</Text> : null}
            {children}
          </ScrollView>
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Schließen"
              accessibilityHint="Schließt dieses Informationsfenster."
            >
              <Text style={styles.closeButtonText}>Schließen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    opacity: 0.75,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '82%',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: INFO_OVERLAY_PANEL_BOTTOM_PADDING,
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  headerTitle: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    marginBottom: 0,
  },
  contentScroll: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0,
    maxHeight: INFO_OVERLAY_CONTENT_MAX_HEIGHT,
  },
  contentContainer: {
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  body: {
    ...typography.body2,
    color: colors.textSecondary,
  },
  footer: {
    alignItems: 'stretch',
    flexShrink: 0,
    marginTop: INFO_OVERLAY_FOOTER_MARGIN_TOP,
  },
  secondaryAction: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: spacing.xs,
    minHeight: INFO_OVERLAY_MIN_TOUCH_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  secondaryActionText: {
    ...typography.button,
    color: colors.primary,
    flexShrink: 1,
  },
  closeButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    minHeight: INFO_OVERLAY_MIN_TOUCH_HEIGHT,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  closeButtonText: {
    ...typography.button,
    color: colors.background,
  },
});