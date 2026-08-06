// SyncStatusSheet — slide-up overlay showing Health Connect sync details.
// Triggered by tapping the "Letzter Sync" row on HealthConnectScreen.

import React, { useState } from 'react';
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
import { healthSyncService } from '../../services/health/healthSyncService';
import type { PendingOp } from '../../services/health/healthSyncService';

interface Props {
  visible: boolean;
  syncStatus: ReturnType<typeof healthSyncService.getSyncStatus>;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Failure row
// ---------------------------------------------------------------------------

function FailureRow({ op }: { op: PendingOp & { errorStack?: string } }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.failureRow}>
      <Text style={styles.failureType}>{op.type === 'upsert' ? 'upsert' : 'delete'}</Text>
      <Text style={styles.failureId} numberOfLines={1}>{op.entryId}</Text>
      {op.errorMessage ? (
        <Text style={styles.failureMessage}>{op.errorMessage}</Text>
      ) : null}
      {op.errorStack ? (
        <>
          <TouchableOpacity
            style={styles.detailsButton}
            onPress={() => setExpanded((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={styles.detailsButtonText}>{expanded ? 'Details ausblenden' : 'Details'}</Text>
          </TouchableOpacity>
          {expanded && (
            <ScrollView style={styles.stackScroll} nestedScrollEnabled>
              <Text style={styles.stackText}>{op.errorStack}</Text>
            </ScrollView>
          )}
        </>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sheet
// ---------------------------------------------------------------------------

export function SyncStatusSheet({ visible, syncStatus, onClose }: Props) {
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
            <Text style={styles.headerTitle}>Sync Status</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Status section */}
            <Text style={styles.sectionTitle}>Status</Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Sync aktiviert</Text>
              <Text style={[styles.rowValue, syncStatus.enabled ? styles.valuePositive : styles.valueMuted]}>
                {syncStatus.enabled ? 'Ja' : 'Nein'}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Berechtigung</Text>
              <Text style={[styles.rowValue, syncStatus.permissionRevoked ? styles.valueNegative : styles.valuePositive]}>
                {syncStatus.permissionRevoked ? 'Entzogen' : 'OK'}
              </Text>
            </View>

            {/* Last export */}
            <Text style={styles.sectionTitle}>Letzter Export</Text>
            <Text style={styles.exportDate}>
              {syncStatus.lastFullExportAt
                ? new Date(syncStatus.lastFullExportAt).toLocaleString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Noch kein Export'}
            </Text>

            {/* Temporary failures */}
            {syncStatus.temporaryFailures.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>
                  Temporäre Fehler ({syncStatus.temporaryFailures.length})
                </Text>
                {syncStatus.temporaryFailures.map((op) => (
                  <FailureRow key={`${op.entryId}:${op.type}`} op={op} />
                ))}
              </>
            )}

            {/* Permanent failures */}
            {syncStatus.permanentFailures.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>
                  Permanente Fehler ({syncStatus.permanentFailures.length})
                </Text>
                {syncStatus.permanentFailures.map((op) => (
                  <FailureRow key={`${op.entryId}:${op.type}`} op={op} />
                ))}
              </>
            )}

            {syncStatus.temporaryFailures.length === 0 && syncStatus.permanentFailures.length === 0 && (
              <Text style={styles.emptyText}>Keine fehlgeschlagenen Operationen.</Text>
            )}

            <View style={{ height: spacing.lg }} />
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
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
  closeButtonText: { ...typography.h3, color: colors.textMuted },

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
    paddingVertical: spacing.xs,
  },
  rowLabel: { ...typography.body2, color: colors.textSecondary },
  rowValue: { ...typography.body2, fontWeight: '600' as const },
  valuePositive: { color: colors.primaryBright },
  valueNegative: { color: colors.negative },
  valueMuted: { color: colors.textMuted },

  exportDate: { ...typography.body1, color: colors.text },

  failureRow: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  failureType: { ...typography.caption, color: colors.textMuted, textTransform: 'uppercase' },
  failureId: { ...typography.body2, color: colors.textSecondary, marginTop: spacing.xs },
  failureMessage: { ...typography.caption, color: colors.negative, marginTop: spacing.xs },

  detailsButton: { marginTop: spacing.xs, alignSelf: 'flex-start' },
  detailsButtonText: { ...typography.caption, color: colors.primaryBright },
  stackScroll: { maxHeight: 200, marginTop: spacing.xs },
  stackText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },

  emptyText: { ...typography.body2, color: colors.textMuted, marginTop: spacing.sm },
});
