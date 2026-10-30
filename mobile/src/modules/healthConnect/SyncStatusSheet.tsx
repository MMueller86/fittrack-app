// SyncStatusSheet — slide-up overlay showing Health Connect sync details.
// Triggered by tapping the "Letzter Sync" row on HealthConnectScreen.

import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing, typography } from '../../app/theme';
import { Icon } from '../../shared/components/Icon';
import type { healthSyncService } from '../../services/health/healthSyncService';
import type { nutritionSyncService } from '../../services/health/nutritionSyncService';
import { SYNC_STATUS_COPY } from './healthConnectCopy';

interface Props {
  visible: boolean;
  weightSyncStatus: ReturnType<typeof healthSyncService.getSyncStatus>;
  nutritionSyncStatus: ReturnType<typeof nutritionSyncService.getSyncStatus>;
  onClose: () => void;
}

type SyncStatus = ReturnType<typeof healthSyncService.getSyncStatus>;

function StatusSection({ title, syncStatus }: { title: string; syncStatus: SyncStatus }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{SYNC_STATUS_COPY.enabledLabel}</Text>
        <Text style={[styles.rowValue, syncStatus.enabled ? styles.valuePositive : styles.valueMuted]}>
          {syncStatus.enabled ? SYNC_STATUS_COPY.enabled : SYNC_STATUS_COPY.disabled}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{SYNC_STATUS_COPY.permissionLabel}</Text>
        <Text style={[styles.rowValue, syncStatus.permissionRevoked ? styles.valueNegative : styles.valueMuted]}>
          {syncStatus.permissionRevoked
            ? SYNC_STATUS_COPY.permissionRevoked
            : SYNC_STATUS_COPY.permissionNotRevoked}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{SYNC_STATUS_COPY.pendingDeleteCountLabel}</Text>
        <Text style={[styles.rowValue, syncStatus.pendingDeleteCount > 0 ? styles.valueNegative : styles.valueMuted]}>
          {syncStatus.pendingDeleteCount}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{SYNC_STATUS_COPY.lastSuccessfulSyncAtLabel}</Text>
        <Text style={[styles.rowValue, styles.dateValue]}>
          {syncStatus.lastSuccessfulSyncAt
            ? new Date(syncStatus.lastSuccessfulSyncAt).toLocaleString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : SYNC_STATUS_COPY.noSuccessfulSync}
        </Text>
      </View>
    </View>
  );
}

// Sheet
// ---------------------------------------------------------------------------

export function SyncStatusSheet({ visible, weightSyncStatus, nutritionSyncStatus, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <SafeAreaView style={styles.sheetWrapper} edges={['bottom']}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{SYNC_STATUS_COPY.title}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: spacing.sm, bottom: spacing.sm, left: spacing.sm, right: spacing.sm }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Schließen"
            >
              <Icon lib="feather" name="x" size="md" color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <StatusSection title={SYNC_STATUS_COPY.weight} syncStatus={weightSyncStatus} />
            <StatusSection title={SYNC_STATUS_COPY.nutrition} syncStatus={nutritionSyncStatus} />
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
  },
  sheetWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.h3, color: colors.text },
  closeButton: { padding: spacing.xs },

  scroll: { flexShrink: 1 },
  scrollContent: { padding: spacing.md },

  sectionTitle: {
    ...typography.overline,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  rowLabel: { ...typography.body2, color: colors.textSecondary, flexShrink: 1 },
  rowValue: { ...typography.body2, fontWeight: '600' as const, textAlign: 'right' as const, flexShrink: 1 },
  valuePositive: { color: colors.primaryBright },
  valueNegative: { color: colors.negative },
  valueMuted: { color: colors.textMuted },
  dateValue: { flex: 1, color: colors.text },
});
