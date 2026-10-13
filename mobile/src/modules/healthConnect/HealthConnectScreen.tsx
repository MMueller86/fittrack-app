// HealthConnectScreen — Health Connect integration settings and sync control.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { ProfileStackParamList } from '../../app/navigation/RootNavigator';
import { colors, radius, spacing, typography } from '../../app/theme';
import { profileApi } from '../../shared/api/profileApi';
import { listWeights } from '../../services/weightsService';
import type { HealthConnectAvailability } from '../../services/health/IHealthPlatformService';
import { healthPlatformService } from '../../services/health/healthPlatformService';
import { healthSyncService } from '../../services/health/healthSyncService';
import { nutritionSyncService } from '../../services/health/nutritionSyncService';
import { MockHealthPlatformService } from '../../services/health/MockHealthPlatformService';
import { syncLogger, type SyncLogEntry } from '../../services/health/syncLogger';
import type { UserProfile } from '@fittrack/shared';
import { ConfirmSheet, type ConfirmSheetAction } from '../../shared/components/ConfirmSheet';
import { Snackbar, useSnackbar } from '../../shared/components/Snackbar';
import { Icon } from '../../shared/components/Icon';
import { SyncStatusSheet } from './SyncStatusSheet';
import {
  HEALTH_CONNECT_TARGET,
  NUTRITION_SYNC_NOTICE,
  WEIGHT_SYNC_NOTICE,
} from './healthConnectCopy';

const IS_DEV = process.env.EXPO_PUBLIC_APP_VARIANT === 'development';
const IS_DEBUG_BUILD =
  process.env.EXPO_PUBLIC_APP_VARIANT === 'development' ||
  process.env.EXPO_PUBLIC_APP_VARIANT === 'preview';

const PLAY_STORE_URL = 'market://details?id=com.google.android.apps.healthdata';

type Props = NativeStackScreenProps<ProfileStackParamList, 'HealthConnect'>;

// ---------------------------------------------------------------------------
// Status chip
// ---------------------------------------------------------------------------

function StatusChip({
  status,
}: {
  status: HealthConnectAvailability['status'] | 'sync_active' | 'nutrition_sync_active';
}) {
  const config: Record<string, { label: string; bg: string; text: string }> = {
    available: { label: 'Verfügbar', bg: colors.primarySoft, text: colors.primaryBright },
    not_available: { label: 'Nicht unterstützt', bg: colors.surfaceMuted, text: colors.negative },
    update_required: { label: 'Update erforderlich', bg: colors.surfaceMuted, text: colors.warning },
    error: { label: 'Status unbekannt', bg: colors.surfaceMuted, text: colors.textSecondary },
    sync_active: { label: 'Gewichtssync aktiv', bg: colors.primarySoft, text: colors.primaryBright },
    nutrition_sync_active: { label: 'Ernährungssync aktiv', bg: colors.primarySoft, text: colors.primaryBright },
  };
  const c = config[status] ?? config.error;
  return (
    <View style={[styles.chip, { backgroundColor: c.bg }]}>
      <Text style={[styles.chipText, { color: c.text }]}>{c.label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Pre-activation notice: Datenkategorie und Ziel
// ---------------------------------------------------------------------------

function SyncNotice({ category, body }: { category: string; body: string }) {
  return (
    <>
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Datenkategorie</Text>
        <Text style={styles.noticeValue}>{category}</Text>
      </View>
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Ziel</Text>
        <Text style={styles.noticeValue}>{HEALTH_CONNECT_TARGET}</Text>
      </View>
      <Text style={styles.bodyText}>{body}</Text>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function HealthConnectScreen({ navigation }: Props) {
  const [availability, setAvailability] = useState<HealthConnectAvailability | null>(null);
  const [availLoading, setAvailLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [syncStatus, setSyncStatus] = useState(healthSyncService.getSyncStatus());
  const [nutritionSyncStatus, setNutritionSyncStatus] = useState(nutritionSyncService.getSyncStatus());
  const [activating, setActivating] = useState(false);
  const [reexporting, setReexporting] = useState(false);
  const [activatingNutrition, setActivatingNutrition] = useState(false);
  const [reexportingNutrition, setReexportingNutrition] = useState(false);
  const [syncStatusSheetVisible, setSyncStatusSheetVisible] = useState(false);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [logExpanded, setLogExpanded] = useState(false);

  const { ref: snackbarRef, show: showSnackbar } = useSnackbar();

  const [confirmSheet, setConfirmSheet] = useState<{
    visible: boolean;
    title: string;
    subtitle?: string;
    actions: ConfirmSheetAction[];
  }>({ visible: false, title: '', actions: [] });

  const closeConfirmSheet = () => setConfirmSheet((s) => ({ ...s, visible: false }));

  const opacity = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const loadAvailability = useCallback(async () => {
    setAvailLoading(true);
    try {
      const av = await healthPlatformService.getAvailability();
      setAvailability(av);
    } catch {
      setAvailability({ status: 'error' });
    } finally {
      setAvailLoading(false);
    }
  }, []);

  const refreshSyncStatus = useCallback(() => {
    setSyncStatus(healthSyncService.getSyncStatus());
    setNutritionSyncStatus(nutritionSyncService.getSyncStatus());
  }, []);

  useEffect(() => {
    void (async () => {
      await healthSyncService.loadState();
      await nutritionSyncService.loadState();
      refreshSyncStatus();
    })();
    void loadAvailability();
    profileApi.getMe().then((r) => setProfile(r.profile as UserProfile | null)).catch(() => undefined);
    if (IS_DEBUG_BUILD) {
      void syncLogger.readAll().then((entries) => setSyncLog([...entries].reverse()));
    }
    opacity.value = withTiming(1, { duration: 250 });
  }, [loadAvailability, refreshSyncStatus]);

  const handleEnable = useCallback(async () => {
    setActivating(true);
    try {
      const entries = await listWeights();
      const result = await healthSyncService.enableSync(entries);
      if (result === 'permission_denied') {
        showSnackbar({ message: 'Berechtigung nicht erteilt – FitTrack benötigt Schreibzugriff auf Gewichtsdaten.' });
      }
      refreshSyncStatus();
    } catch {
      showSnackbar({ message: 'Synchronisation konnte nicht aktiviert werden.' });
    } finally {
      setActivating(false);
    }
  }, [refreshSyncStatus]);

  const handleDisable = useCallback(() => {
    setConfirmSheet({
      visible: true,
      title: 'Synchronisation deaktivieren?',
      subtitle: 'Deine bisherigen Daten bleiben in Health Connect erhalten.',
      actions: [
        {
          label: 'Deaktivieren',
          destructive: true,
          onPress: async () => {
            await healthSyncService.disableSync();
            refreshSyncStatus();
          },
        },
      ],
    });
  }, [refreshSyncStatus]);

  const handleReexport = useCallback(async () => {
    setReexporting(true);
    try {
      const entries = await listWeights();
      await healthSyncService.runFullExport(entries);
      refreshSyncStatus();
    } catch {
      showSnackbar({ message: 'Re-Export fehlgeschlagen.' });
    } finally {
      setReexporting(false);
    }
  }, [refreshSyncStatus]);

  const handleDismissPermanent = useCallback(async () => {
    await healthSyncService.dismissPermanentFailures();
    refreshSyncStatus();
  }, [refreshSyncStatus]);

  const refreshLog = useCallback(async () => {
    if (!IS_DEBUG_BUILD) return;
    const entries = await syncLogger.readAll();
    setSyncLog([...entries].reverse());
  }, []);

  const clearLog = useCallback(async () => {
    await syncLogger.clear();
    setSyncLog([]);
  }, []);

  const handleReauthorize = useCallback(async () => {
    const entries = await listWeights().catch(() => []);
    const result = await healthSyncService.enableSync(entries);
    if (result === 'permission_denied') {
      showSnackbar({ message: 'Berechtigung nicht erteilt – bitte erteile FitTrack die Berechtigung in Health Connect.' });
    }
    refreshSyncStatus();
  }, [refreshSyncStatus]);

  const handleEnableNutrition = useCallback(async () => {
    setActivatingNutrition(true);
    try {
      const result = await nutritionSyncService.enableSync();
      if (result === 'permission_denied') {
        showSnackbar({ message: 'Berechtigung nicht erteilt – FitTrack benötigt Schreibzugriff auf Ernährungsdaten.' });
      }
      refreshSyncStatus();
    } catch {
      showSnackbar({ message: 'Ernährungssynchronisation konnte nicht aktiviert werden.' });
    } finally {
      setActivatingNutrition(false);
    }
  }, [refreshSyncStatus]);

  const handleDisableNutrition = useCallback(() => {
    setConfirmSheet({
      visible: true,
      title: 'Ernährungssync deaktivieren?',
      subtitle: 'Deine bisherigen Daten bleiben in Health Connect erhalten.',
      actions: [
        {
          label: 'Deaktivieren',
          destructive: true,
          onPress: async () => {
            await nutritionSyncService.disableSync();
            refreshSyncStatus();
          },
        },
      ],
    });
  }, [refreshSyncStatus]);

  const handleReexportNutrition = useCallback(async () => {
    setReexportingNutrition(true);
    try {
      await nutritionSyncService.runFullExport();
      refreshSyncStatus();
    } catch {
      showSnackbar({ message: 'Re-Export fehlgeschlagen.' });
    } finally {
      setReexportingNutrition(false);
    }
  }, [refreshSyncStatus]);

  const handleDismissPermanentNutrition = useCallback(async () => {
    await nutritionSyncService.dismissPermanentFailures();
    refreshSyncStatus();
  }, [refreshSyncStatus]);

  // --- iOS placeholder ---
  if (Platform.OS !== 'android') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {renderHeader(navigation.goBack)}
        <View style={styles.center}>
          <Text style={styles.placeholderTitle}>Nur unter Android verfügbar</Text>
          <Text style={styles.placeholderBody}>
            Health Connect ist eine Android-Plattform. Auf iOS wird diese Funktion nicht unterstützt.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const showSyncWarningBanner =
    !syncStatus.permissionRevoked &&
    (profile?.healthSyncEnabled === true) &&
    !syncStatus.enabled;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader(navigation.goBack)}
      <Animated.View style={[{ flex: 1 }, animStyle]}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Availability section */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Health Connect</Text>
            {availLoading ? (
              <ActivityIndicator color={colors.primary} style={styles.loader} />
            ) : (
              <>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Status</Text>
                  {availability && <StatusChip status={availability.status} />}
                </View>

                {availability?.status === 'update_required' && (
                  <>
                    <Text style={styles.bodyText}>
                      Health Connect muss aktualisiert werden, bevor die Synchronisation genutzt werden kann.
                    </Text>
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => void Linking.openURL(PLAY_STORE_URL)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.secondaryButtonText}>Health Connect aktualisieren</Text>
                    </TouchableOpacity>
                  </>
                )}

                {availability?.status === 'not_available' && (
                  <Text style={styles.bodyText}>
                    Dein Gerät oder Android-Version unterstützt Health Connect nicht. Health Connect erfordert Android 9 oder höher.
                  </Text>
                )}

                {availability?.status === 'error' && (
                  <>
                    <Text style={styles.bodyText}>
                      Der Status von Health Connect konnte nicht ermittelt werden.
                    </Text>
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => void loadAvailability()}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.secondaryButtonText}>Erneut prüfen</Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
          </View>

          {/* Sync section — only when available */}
          {availability?.status === 'available' && (
            <>
              {/* Permission revocation banner */}
              {syncStatus.permissionRevoked && (
                <View style={[styles.banner, styles.bannerAmber]}>
                  <Text style={styles.bannerText}>
                    Berechtigung wurde entzogen — Gewichtssynchronisation deaktiviert.
                  </Text>
                  <TouchableOpacity
                    style={styles.bannerButton}
                    onPress={() => void handleReauthorize()}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.bannerButtonText}>Berechtigung erneut vergeben</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* "Sync war aktiv" banner */}
              {showSyncWarningBanner && (
                <View style={[styles.banner, styles.bannerAmber]}>
                  <Text style={styles.bannerText}>
                    Sync war aktiv — bitte erneut autorisieren, um fortzufahren.
                  </Text>
                </View>
              )}

              {/* Permanent failure warning card */}
              {syncStatus.permanentFailures.length > 0 && (
                <View style={[styles.card, styles.cardWarning]}>
                  <Text style={styles.warningTitle}>
                    {syncStatus.permanentFailures.length} {syncStatus.permanentFailures.length === 1 ? 'Eintrag konnte' : 'Einträge konnten'} nicht synchronisiert werden.
                  </Text>
                  <Text style={styles.bodyText}>
                    FitTrack konnte diese Einträge dauerhaft nicht an Health Connect übertragen. Du kannst alle Gewichtsdaten neu exportieren — das ist sicher und erzeugt keine Duplikate.
                  </Text>
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[styles.primaryButton, reexporting && styles.buttonDisabled]}
                      onPress={() => void handleReexport()}
                      activeOpacity={0.8}
                      disabled={reexporting}
                    >
                      {reexporting
                        ? <ActivityIndicator color={colors.white} size="small" />
                        : <Text style={styles.primaryButtonText}>Alle Gewichtsdaten neu exportieren</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.ghostButton}
                      onPress={() => void handleDismissPermanent()}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.ghostButtonText}>Ignorieren</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Sync status card */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Gewicht synchronisieren</Text>

                {syncStatus.enabled ? (
                  <>
                    <View style={styles.statusRow}>
                      <Text style={styles.statusLabel}>Sync-Status</Text>
                      <StatusChip status="sync_active" />
                    </View>
                    {syncStatus.lastFullExportAt && (
                      <TouchableOpacity
                        onPress={() => setSyncStatusSheetVisible(true)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.metaText}>
                          Letzter Export: {new Date(syncStatus.lastFullExportAt).toLocaleString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.destructiveButton]}
                      onPress={() => void handleDisable()}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.destructiveButtonText}>Deaktivieren</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <SyncNotice category={WEIGHT_SYNC_NOTICE.category} body={WEIGHT_SYNC_NOTICE.body} />
                    <TouchableOpacity
                      style={[styles.primaryButton, activating && styles.buttonDisabled]}
                      onPress={() => void handleEnable()}
                      activeOpacity={0.8}
                      disabled={activating}
                    >
                      {activating
                        ? <ActivityIndicator color={colors.white} size="small" />
                        : <Text style={styles.primaryButtonText}>Gewichtssynchronisation aktivieren</Text>}
                    </TouchableOpacity>
                  </>
                )}
              </View>

              {/* Nutrition permission revocation banner */}
              {nutritionSyncStatus.permissionRevoked && (
                <View style={[styles.banner, styles.bannerAmber]}>
                  <Text style={styles.bannerText}>
                    Berechtigung wurde entzogen — Ernährungssynchronisation deaktiviert.
                  </Text>
                  <TouchableOpacity
                    style={styles.bannerButton}
                    onPress={() => void handleEnableNutrition()}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.bannerButtonText}>Berechtigung erneut vergeben</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Nutrition permanent failure card */}
              {nutritionSyncStatus.permanentFailures.length > 0 && (
                <View style={[styles.card, styles.cardWarning]}>
                  <Text style={styles.warningTitle}>
                    {nutritionSyncStatus.permanentFailures.length} {nutritionSyncStatus.permanentFailures.length === 1 ? 'Eintrag konnte' : 'Einträge konnten'} nicht synchronisiert werden.
                  </Text>
                  <Text style={styles.bodyText}>
                    FitTrack konnte diese Ernährungseinträge dauerhaft nicht an Health Connect übertragen. Du kannst alle Ernährungsdaten neu exportieren — das ist sicher und erzeugt keine Duplikate.
                  </Text>
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[styles.primaryButton, reexportingNutrition && styles.buttonDisabled]}
                      onPress={() => void handleReexportNutrition()}
                      activeOpacity={0.8}
                      disabled={reexportingNutrition}
                    >
                      {reexportingNutrition
                        ? <ActivityIndicator color={colors.white} size="small" />
                        : <Text style={styles.primaryButtonText}>Alle Ernährungsdaten neu exportieren</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.ghostButton}
                      onPress={() => void handleDismissPermanentNutrition()}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.ghostButtonText}>Ignorieren</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Nutrition sync card */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Ernährung synchronisieren</Text>

                {nutritionSyncStatus.enabled ? (
                  <>
                    <View style={styles.statusRow}>
                      <Text style={styles.statusLabel}>Sync-Status</Text>
                      <StatusChip status="nutrition_sync_active" />
                    </View>
                    {nutritionSyncStatus.lastFullExportAt && (
                      <Text style={styles.metaText}>
                        Letzter Export: {new Date(nutritionSyncStatus.lastFullExportAt).toLocaleString('de-DE', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    )}
                    <TouchableOpacity
                      style={[styles.destructiveButton]}
                      onPress={() => void handleDisableNutrition()}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.destructiveButtonText}>Deaktivieren</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <SyncNotice category={NUTRITION_SYNC_NOTICE.category} body={NUTRITION_SYNC_NOTICE.body} />
                    <TouchableOpacity
                      style={[styles.primaryButton, activatingNutrition && styles.buttonDisabled]}
                      onPress={() => void handleEnableNutrition()}
                      activeOpacity={0.8}
                      disabled={activatingNutrition}
                    >
                      {activatingNutrition
                        ? <ActivityIndicator color={colors.white} size="small" />
                        : <Text style={styles.primaryButtonText}>Ernährungssynchronisation aktivieren</Text>}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </>
          )}

          {/* Dev debug area */}
          {IS_DEV && (
            <View style={styles.devCard}>
              <Text style={styles.devLabel}>DEV — Simulierter Availability-Status</Text>
              <View style={styles.buttonRow}>
                {(['available', 'not_available', 'update_required', 'error'] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.devButton,
                      availability?.status === s && styles.devButtonActive,
                    ]}
                    onPress={() => {
                      (healthPlatformService as MockHealthPlatformService).setSimulatedAvailability({ status: s });
                      void loadAvailability();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.devButtonText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Sync diagnostics log — visible in development + preview builds */}
          {IS_DEBUG_BUILD && (
            <View style={styles.devCard}>
              <TouchableOpacity
                style={styles.logHeader}
                onPress={() => {
                  if (!logExpanded) void refreshLog();
                  setLogExpanded((v) => !v);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.devLabel}>SYNC LOG ({syncLog.length} Einträge)</Text>
                <Icon lib="feather" name={logExpanded ? 'chevron-up' : 'chevron-down'} size="sm" color={colors.textSecondary} />
              </TouchableOpacity>

              {logExpanded && (
                <>
                  <View style={styles.logActions}>
                    <TouchableOpacity style={styles.devButton} onPress={() => void refreshLog()} activeOpacity={0.7}>
                      <Text style={styles.devButtonText}>Aktualisieren</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.devButton} onPress={() => void clearLog()} activeOpacity={0.7}>
                      <Text style={[styles.devButtonText, styles.devButtonTextDanger]}>Log leeren</Text>
                    </TouchableOpacity>
                  </View>
                  {syncLog.length === 0 ? (
                    <Text style={styles.logEmpty}>Keine Log-Einträge</Text>
                  ) : (
                    syncLog.map((entry, i) => (
                      <View key={i} style={styles.logEntry}>
                        <Text style={styles.logMeta}>
                          {new Date(entry.ts).toLocaleTimeString('de-DE')} [{entry.tag}]
                        </Text>
                        <Text style={[styles.logMessage, entry.level === 'error' && styles.logError, entry.level === 'warn' && styles.logWarn]}>
                          {entry.message}
                        </Text>
                        {!!entry.detail && (
                          <Text style={styles.logDetail}>{entry.detail}</Text>
                        )}
                      </View>
                    ))
                  )}
                </>
              )}
            </View>
          )}

          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      </Animated.View>
      <ConfirmSheet
        visible={confirmSheet.visible}
        title={confirmSheet.title}
        subtitle={confirmSheet.subtitle}
        actions={confirmSheet.actions}
        onClose={closeConfirmSheet}
      />
      <SyncStatusSheet
        visible={syncStatusSheetVisible}
        syncStatus={syncStatus}
        onClose={() => setSyncStatusSheetVisible(false)}
      />
      <Snackbar ref={snackbarRef} />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Header helper (extracted to reduce JSX nesting)
// ---------------------------------------------------------------------------

function renderHeader(onBack: () => void) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={onBack}
        style={styles.backButton}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Zurück"
      >
        <Icon lib="feather" name="chevron-left" size="lg" color={colors.text} />
      </TouchableOpacity>
      <Text style={styles.title} accessibilityRole="header">Health Connect</Text>
      <View style={styles.backButton} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: { width: spacing.xxl, minHeight: spacing.xxl, alignItems: 'flex-start', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', ...typography.h3, color: colors.text },

  loader: { marginVertical: spacing.md },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardWarning: {
    borderColor: colors.warning,
    backgroundColor: colors.surface,
  },
  cardTitle: {
    ...typography.overline,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },

  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statusLabel: { ...typography.body2, color: colors.textSecondary },
  noticeValue: { ...typography.body2, color: colors.text, fontWeight: '600', flexShrink: 1 },
  metaText: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },

  chip: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chipText: { ...typography.caption },

  bodyText: {
    ...typography.body2,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },

  banner: {
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
  },
  bannerAmber: { backgroundColor: colors.surface, borderColor: colors.warning },
  bannerText: { ...typography.body2, color: colors.warning },
  bannerButton: { marginTop: spacing.sm, minHeight: spacing.xxl, justifyContent: 'center' },
  bannerButtonText: { ...typography.button, color: colors.warning },

  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    minHeight: spacing.xxl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  primaryButtonText: { ...typography.button, color: colors.white, textAlign: 'center' },

  secondaryButton: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    minHeight: spacing.xxl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  secondaryButtonText: { ...typography.button, color: colors.primaryBright, textAlign: 'center' },

  destructiveButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    minHeight: spacing.xxl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.negative,
  },
  destructiveButtonText: { ...typography.button, color: colors.negative },

  ghostButton: {
    minHeight: spacing.xxl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  ghostButtonText: { ...typography.button, color: colors.textMuted },

  buttonDisabled: { opacity: 0.5 },
  buttonRow: { gap: spacing.xs },

  warningTitle: { ...typography.body1, color: colors.warning, fontWeight: '600', marginBottom: spacing.xs },

  placeholderTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm, textAlign: 'center' },
  placeholderBody: { ...typography.body2, color: colors.textSecondary, textAlign: 'center' },

  // Dev debug area
  devCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
  },
  devLabel: { ...typography.overline, color: colors.textSecondary, marginBottom: spacing.sm, textTransform: 'uppercase' },
  devButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    minHeight: spacing.xxl,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  devButtonActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  devButtonText: { ...typography.caption, color: colors.textSecondary },
  devButtonTextDanger: { color: colors.negative },

  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: spacing.xxl },
  logActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  logEntry: { marginBottom: spacing.xs, paddingBottom: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  logMeta: { ...typography.caption, color: colors.textMuted },
  logMessage: { ...typography.caption, color: colors.textSecondary },
  logError: { color: colors.negative },
  logWarn: { color: colors.warning },
  logDetail: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  logEmpty: { ...typography.caption, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.sm },
});
