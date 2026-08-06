// healthSyncService — state machine for Health Connect weight sync.
// Persists state to AsyncStorage under 'hc:weight:sync'.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WeightEntry } from '@fittrack/shared';
import type { WeightHealthRecord } from './IHealthPlatformService';
import { healthPlatformService } from './healthPlatformService';
import { profileApi } from '../../shared/api/profileApi';
import { syncLogger } from './syncLogger';

const STORAGE_KEY = 'hc:weight:sync';
const WEIGHT_PERMISSIONS = [{ accessType: 'write' as const, recordType: 'Weight' }];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PendingOp {
  entryId: string;
  type: 'upsert' | 'delete';
  entry?: WeightEntry;
  retryCount: number;
  sessionCount: number;
  errorType?: 'temporary' | 'permission' | 'permanent';
  errorMessage?: string;
  errorStack?: string;
  dismissed?: boolean;
}

interface WeightSyncState {
  enabled: boolean;
  permissionRevoked: boolean;
  lastFullExportAt?: string;
  pendingOperations: PendingOp[];
}

const DEFAULT_STATE: WeightSyncState = {
  enabled: false,
  permissionRevoked: false,
  pendingOperations: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Fallback: maps YYYY-MM-DD to noon in device-local time when createdAt is unavailable.
function toHealthConnectTime(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).toISOString();
}

function toWeightRecord(entry: WeightEntry): WeightHealthRecord {
  const kgValue = entry.unit === 'lbs' ? entry.value * 0.453592 : entry.value;
  const createdAtMs = entry.createdAt ? Date.parse(entry.createdAt) : NaN;
  const time = Number.isFinite(createdAtMs)
    ? new Date(createdAtMs).toISOString()
    : toHealthConnectTime(entry.date);
  return {
    recordType: 'Weight',
    metadata: {
      clientRecordId: entry.id,
      clientRecordVersion: Date.now(),
    },
    time,
    weight: { value: kgValue, unit: 'kilograms' as const },
  };
}

function classifyError(e: unknown): 'temporary' | 'permission' {
  const msg = String(e).toUpperCase();
  if (msg.includes('PERMISSION') || msg.includes('PERMISSION_DENIED')) return 'permission';
  return 'temporary';
}

function extractErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message || e.name;
  return String(e);
}

function extractErrorStack(e: unknown): string | undefined {
  return e instanceof Error ? e.stack : undefined;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class HealthSyncService {
  private state: WeightSyncState = { ...DEFAULT_STATE };
  private loaded = false;
  private sessionCountIncremented = false;

  private async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      this.state = raw ? (JSON.parse(raw) as WeightSyncState) : { ...DEFAULT_STATE };
    } catch {
      this.state = { ...DEFAULT_STATE };
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }

  async loadState(): Promise<void> {
    await this.load();
  }

  async enableSync(allEntries: WeightEntry[]): Promise<'success' | 'permission_denied'> {
    await this.load();
    syncLogger.info('enableSync', `Requesting permissions, ${allEntries.length} entries queued`);
    await healthPlatformService.initialize();
    const granted = await healthPlatformService.requestPermissions(WEIGHT_PERMISSIONS);
    if (!granted) {
      syncLogger.warn('enableSync', 'Permission denied');
      return 'permission_denied';
    }

    this.state.enabled = true;
    this.state.permissionRevoked = false;
    await this.runFullExport(allEntries);
    await this.persist();

    syncLogger.info('enableSync', 'Sync enabled successfully');
    // fire-and-forget — backend sync status
    void profileApi.updateHealthSync(true).catch(() => undefined);
    return 'success';
  }

  async disableSync(): Promise<void> {
    await this.load();
    this.state.enabled = false;
    await this.persist();
    void profileApi.updateHealthSync(false).catch(() => undefined);
  }

  async runFullExport(entries: WeightEntry[]): Promise<void> {
    await this.load();
    syncLogger.info('runFullExport', `Starting full export of ${entries.length} entries`);
    // Full export replaces all pending ops — gives each failure a fresh retry budget.
    this.state.pendingOperations = [];
    let ok = 0;
    for (const entry of entries) {
      try {
        await healthPlatformService.upsertRecord(toWeightRecord(entry));
        ok++;
      } catch (e) {
        const errorType = classifyError(e);
        const msg = extractErrorMessage(e);
        syncLogger.error('runFullExport', `Failed upsert id=${entry.id} type=${errorType}`, msg);
        this.addOrUpdatePendingOp({ entryId: entry.id, type: 'upsert', entry, errorType, errorMessage: msg, errorStack: extractErrorStack(e) });
      }
    }
    syncLogger.info('runFullExport', `Done: ${ok} ok, ${entries.length - ok} failed`);
    this.state.lastFullExportAt = new Date().toISOString();
    await this.persist();
  }

  async syncWeightUpsert(entry: WeightEntry): Promise<void> {
    await this.load();
    await healthPlatformService.initialize();
    if (!this.state.enabled) return;
    syncLogger.info('syncWeightUpsert', `Upserting id=${entry.id} value=${entry.value}${entry.unit}`);
    try {
      await healthPlatformService.upsertRecord(toWeightRecord(entry));
      syncLogger.info('syncWeightUpsert', `OK id=${entry.id}`);
    } catch (e) {
      const errorType = classifyError(e);
      const msg = extractErrorMessage(e);
      syncLogger.error('syncWeightUpsert', `Failed id=${entry.id} type=${errorType}`, msg);
      this.addOrUpdatePendingOp({ entryId: entry.id, type: 'upsert', entry, errorType, errorMessage: msg, errorStack: extractErrorStack(e) });
      await this.persist();
    }
  }

  async syncWeightDelete(entryId: string): Promise<void> {
    await this.load();
    if (!this.state.enabled) return;
    syncLogger.info('syncWeightDelete', `Deleting id=${entryId}`);
    try {
      await healthPlatformService.deleteRecord('Weight', entryId);
      syncLogger.info('syncWeightDelete', `OK id=${entryId}`);
    } catch (e) {
      const errorType = classifyError(e);
      const msg = extractErrorMessage(e);
      syncLogger.error('syncWeightDelete', `Failed id=${entryId} type=${errorType}`, msg);
      this.addOrUpdatePendingOp({ entryId, type: 'delete', errorType, errorMessage: msg, errorStack: extractErrorStack(e) });
      await this.persist();
    }
  }

  async drainPendingQueue(): Promise<void> {
    await this.load();
    await healthPlatformService.initialize();
    if (!this.state.enabled) return;

    const pending = this.state.pendingOperations.filter((o) => !o.dismissed && o.errorType !== 'permanent');
    if (pending.length > 0) {
      syncLogger.info('drainPendingQueue', `Processing ${pending.length} pending ops`);
    }

    // Increment sessionCount once per app foreground session.
    if (!this.sessionCountIncremented) {
      this.sessionCountIncremented = true;
      this.state.pendingOperations = this.state.pendingOperations.map((op) => ({
        ...op,
        sessionCount: op.sessionCount + 1,
      }));
    }

    const ops = [...this.state.pendingOperations];
    for (const op of ops) {
      if (op.dismissed || op.errorType === 'permanent') continue;

      try {
        if (op.type === 'upsert' && op.entry) {
          await healthPlatformService.upsertRecord(toWeightRecord(op.entry));
        } else if (op.type === 'delete') {
          await healthPlatformService.deleteRecord('Weight', op.entryId);
        }
        // Success — remove from queue
        this.state.pendingOperations = this.state.pendingOperations.filter(
          (o) => o.entryId !== op.entryId || o.type !== op.type,
        );
      } catch (e) {
        const errorType = classifyError(e);
        if (errorType === 'permission') {
          syncLogger.warn('drainPendingQueue', 'Permission revoked — disabling sync');
          this.state.enabled = false;
          this.state.permissionRevoked = true;
          await this.persist();
          return;
        }
        const errorMessage = extractErrorMessage(e);
        const errorStack = extractErrorStack(e);
        syncLogger.error('drainPendingQueue', `Retry failed id=${op.entryId}`, errorMessage);
        this.state.pendingOperations = this.state.pendingOperations.map((o) => {
          if (o.entryId !== op.entryId || o.type !== op.type) return o;
          const retryCount = o.retryCount + 1;
          const isPermanent = retryCount >= 10 && o.sessionCount >= 2;
          return { ...o, retryCount, errorType: isPermanent ? ('permanent' as const) : ('temporary' as const), errorMessage, errorStack: errorStack ?? o.errorStack };
        });
      }
    }
    await this.persist();
  }

  getSyncStatus(): {
    enabled: boolean;
    permissionRevoked: boolean;
    permanentFailures: PendingOp[];
    temporaryFailures: PendingOp[];
    lastFullExportAt?: string;
  } {
    return {
      enabled: this.state.enabled,
      permissionRevoked: this.state.permissionRevoked,
      permanentFailures: this.state.pendingOperations
        .filter((op) => op.errorType === 'permanent' && !op.dismissed),
      temporaryFailures: this.state.pendingOperations
        .filter((op) => op.errorType === 'temporary'),
      lastFullExportAt: this.state.lastFullExportAt,
    };
  }

  /** Marks all permanent failures as dismissed. */
  async dismissPermanentFailures(): Promise<void> {
    await this.load();
    this.state.pendingOperations = this.state.pendingOperations.map((op) =>
      op.errorType === 'permanent' ? { ...op, dismissed: true } : op,
    );
    await this.persist();
  }

  private addOrUpdatePendingOp(
    op: Pick<PendingOp, 'entryId' | 'type' | 'entry' | 'errorType'> & { errorMessage?: string; errorStack?: string },
  ): void {
    const existing = this.state.pendingOperations.findIndex(
      (o) => o.entryId === op.entryId && o.type === op.type,
    );
    if (existing >= 0) {
      this.state.pendingOperations[existing] = {
        ...this.state.pendingOperations[existing],
        entry: op.entry,
        errorType: op.errorType,
        errorMessage: op.errorMessage,
        errorStack: op.errorStack,
      };
    } else {
      this.state.pendingOperations.push({
        entryId: op.entryId,
        type: op.type,
        entry: op.entry,
        retryCount: 0,
        sessionCount: 0,
        errorType: op.errorType,
        errorMessage: op.errorMessage,
        errorStack: op.errorStack,
      });
    }
  }
}

export const healthSyncService = new HealthSyncService();

// Export class for unit testing (allows creating fresh instances without AsyncStorage state leakage).
export { HealthSyncService };
