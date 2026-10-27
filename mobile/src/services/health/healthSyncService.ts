// healthSyncService — state machine for Health Connect weight sync.
// Stores user-bound delta state in AsyncStorage under 'hc:weight:sync'.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WeightEntry } from '@fittrack/shared';
import type { HealthPermission, WeightHealthRecord } from './IHealthPlatformService';
import { healthPlatformService } from './healthPlatformService';
import { profileApi } from '../../shared/api/profileApi';
import { authService } from '../authService';
import { getWeightChanges } from '../weightsService';
import { syncLogger } from './syncLogger';

const STORAGE_KEY = 'hc:weight:sync';
const WEIGHT_PERMISSIONS: HealthPermission[] = [{ accessType: 'write', recordType: 'Weight' }];

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

interface WeightDeltaState {
  enabled: boolean;
  userId?: string;
  watermark?: string;
  pendingDeleteIds: string[];
  lastForegroundAttemptAt?: string;
}

const DEFAULT_DELTA_STATE: WeightDeltaState = { enabled: false, pendingDeleteIds: [] };
const DELTA_STATE_FIELDS = new Set(['enabled', 'userId', 'watermark', 'pendingDeleteIds', 'lastForegroundAttemptAt']);
const FOREGROUND_INTERVAL_MS = 15 * 60 * 1000;
const INITIAL_WATERMARK = new Date(0).toISOString();

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function isWeightDeltaState(value: unknown): value is WeightDeltaState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  if (!Object.keys(state).every((key) => DELTA_STATE_FIELDS.has(key))) return false;
  if (typeof state.enabled !== 'boolean' || !Array.isArray(state.pendingDeleteIds)) return false;
  if (!state.pendingDeleteIds.every((id) => typeof id === 'string' && id.length > 0)) return false;
  if (state.userId !== undefined && (typeof state.userId !== 'string' || !state.userId)) return false;
  if (state.watermark !== undefined && !isCanonicalTimestamp(state.watermark)) return false;
  if (state.lastForegroundAttemptAt !== undefined && !isCanonicalTimestamp(state.lastForegroundAttemptAt)) return false;
  if (state.enabled && typeof state.userId !== 'string') return false;
  if (typeof state.userId !== 'string' && (state.watermark !== undefined || state.lastForegroundAttemptAt !== undefined || state.pendingDeleteIds.length > 0)) return false;
  return true;
}

function effectiveWeightTimestamp(entry: WeightEntry): string | undefined {
  const timestamp = Date.parse(entry.updatedAt ?? entry.createdAt);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function newestTimestamp(...values: Array<string | undefined>): string | undefined {
  return values.filter((value): value is string => value !== undefined && isCanonicalTimestamp(value))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
}

class WeightDeltaSyncService {
  private state: WeightDeltaState = { ...DEFAULT_DELTA_STATE };
  private loaded = false;
  private loading?: Promise<void>;
  private permissionRevoked = false;
  private foregroundRun?: Promise<void>;

  private async load(): Promise<void> {
    if (this.loaded) return;
    if (!this.loading) {
      this.loading = (async () => {
        try {
          const raw = await AsyncStorage.getItem(STORAGE_KEY);
          if (!raw) this.state = { ...DEFAULT_DELTA_STATE };
          else {
            const parsed: unknown = JSON.parse(raw);
            if (isWeightDeltaState(parsed)) this.state = parsed;
            else {
              this.state = { ...DEFAULT_DELTA_STATE };
              await AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
            }
          }
        } catch {
          this.state = { ...DEFAULT_DELTA_STATE };
          await AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
        }
        this.loaded = true;
      })();
    }
    try { await this.loading; } finally { this.loading = undefined; }
  }

  private async persist(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }

  private async discardForUserChange(): Promise<void> {
    this.state = { ...DEFAULT_DELTA_STATE };
    this.permissionRevoked = false;
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
  }

  private async activationUserId(): Promise<string | null> {
    const userId = await authService.getAuthenticatedUserId().catch(() => null);
    if (userId && this.state.userId && this.state.userId !== userId) await this.discardForUserChange();
    return userId;
  }

  private async activeUserId(): Promise<string | null> {
    if (!this.state.enabled) return null;
    const userId = await authService.getAuthenticatedUserId().catch(() => null);
    if (!userId) return null;
    if (!this.state.userId || this.state.userId !== userId) {
      await this.discardForUserChange();
      return null;
    }
    return userId;
  }

  private async permissionForWrite(userId: string): Promise<boolean> {
    const currentUserId = await authService.getAuthenticatedUserId().catch(() => null);
    if (!currentUserId) return false;
    if (currentUserId !== userId || this.state.userId !== userId) {
      await this.discardForUserChange();
      return false;
    }
    if (!this.state.enabled) return false;
    try {
      const granted = await healthPlatformService.hasPermissions(WEIGHT_PERMISSIONS);
      this.permissionRevoked = !granted;
      if (!granted) await this.disableForRevokedPermission();
      return granted;
    } catch (error) {
      if (classifyError(error) === 'permission') await this.disableForRevokedPermission();
      return false;
    }
  }

  private async disableForRevokedPermission(): Promise<void> {
    this.state.enabled = false;
    this.permissionRevoked = true;
    await this.persist().catch(() => undefined);
    void profileApi.updateHealthSync(false).catch(() => undefined);
  }

  private async writeWeight(entry: WeightEntry, userId: string): Promise<boolean> {
    if (!await this.permissionForWrite(userId)) return false;
    try {
      await healthPlatformService.upsertRecord(toWeightRecord(entry));
      return true;
    } catch (error) {
      syncLogger.error('WeightSync', 'Health Connect weight write failed');
      if (classifyError(error) === 'permission') await this.disableForRevokedPermission();
      return false;
    }
  }

  private async writeDelete(id: string, userId: string): Promise<boolean> {
    if (!await this.permissionForWrite(userId)) return false;
    try {
      await healthPlatformService.deleteRecord('Weight', id);
      return true;
    } catch (error) {
      syncLogger.error('WeightSync', 'Health Connect weight deletion failed');
      if (classifyError(error) === 'permission') await this.disableForRevokedPermission();
      return false;
    }
  }

  private async retryDeletes(ids: readonly string[], userId: string): Promise<boolean> {
    let succeeded = true;
    for (const id of ids) {
      if (!this.state.pendingDeleteIds.includes(id)) continue;
      const deleted = await this.writeDelete(id, userId);
      if (!deleted) {
        succeeded = false;
        if (!this.state.enabled || this.permissionRevoked) return false;
        continue;
      }
      const previous = this.state.pendingDeleteIds;
      this.state.pendingDeleteIds = previous.filter((pendingId) => pendingId !== id);
      try { await this.persist(); } catch {
        this.state.pendingDeleteIds = previous;
        succeeded = false;
      }
    }
    return succeeded;
  }

  private async setWatermark(value: string): Promise<boolean> {
    const previous = this.state.watermark;
    this.state.watermark = value;
    try { await this.persist(); return true; } catch {
      this.state.watermark = previous;
      return false;
    }
  }

  private async initializePlatform(): Promise<boolean> {
    try { return await healthPlatformService.initialize(); } catch { return false; }
  }

  private async fullExport(entries: WeightEntry[], userId: string): Promise<boolean> {
    if (!await this.initializePlatform() || !await this.permissionForWrite(userId)) return false;
    let succeeded = await this.retryDeletes([...this.state.pendingDeleteIds], userId);
    let latest = this.state.watermark;
    for (const entry of entries) {
      const written = await this.writeWeight(entry, userId);
      if (!written) {
        succeeded = false;
        if (!this.state.enabled || this.permissionRevoked) return false;
      }
      latest = newestTimestamp(latest, effectiveWeightTimestamp(entry));
    }
    return succeeded && latest ? this.setWatermark(latest) : succeeded;
  }

  private async foregroundDelta(): Promise<void> {
    const userId = await this.activeUserId();
    if (!userId || !await this.initializePlatform() || !await this.permissionForWrite(userId)) return;
    let succeeded = await this.retryDeletes([...this.state.pendingDeleteIds], userId);
    if (!this.state.enabled) return;
    const since = this.state.watermark ?? INITIAL_WATERMARK;
    try {
      const response = await getWeightChanges(since);
      if (!isCanonicalTimestamp(response.checkpointAt) || Date.parse(response.checkpointAt) < Date.parse(since)) return;
      for (const entry of response.entries) {
        const written = await this.writeWeight(entry, userId);
        if (!written) {
          succeeded = false;
          if (!this.state.enabled || this.permissionRevoked) return;
        }
      }
      if (succeeded) await this.setWatermark(response.checkpointAt);
    } catch {
      syncLogger.error('WeightSync', 'Weight delta reconciliation failed');
    }
  }

  async loadState(): Promise<void> { await this.load(); }

  async resetForAccountDeletion(): Promise<void> {
    this.state = { ...DEFAULT_DELTA_STATE };
    this.loaded = true;
    this.permissionRevoked = false;
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  async enableSync(entries: WeightEntry[]): Promise<'success' | 'permission_denied' | 'user_unavailable'> {
    await this.load();
    const userId = await this.activationUserId();
    if (!userId) return 'user_unavailable';
    try {
      await healthPlatformService.initialize();
      if (!await healthPlatformService.requestPermissions(WEIGHT_PERMISSIONS)) return 'permission_denied';
    } catch { return 'permission_denied'; }
    this.state.enabled = true;
    this.state.userId = userId;
    this.permissionRevoked = false;
    await this.persist();
    await this.fullExport(entries, userId);
    if (this.state.enabled) void profileApi.updateHealthSync(true).catch(() => undefined);
    return this.state.enabled ? 'success' : 'permission_denied';
  }

  async disableSync(): Promise<void> {
    await this.load();
    this.state.enabled = false;
    this.permissionRevoked = false;
    await this.persist();
    void profileApi.updateHealthSync(false).catch(() => undefined);
  }

  async runFullExport(entries: WeightEntry[]): Promise<boolean> {
    await this.load();
    const userId = await this.activeUserId();
    return userId ? this.fullExport(entries, userId) : false;
  }

  async syncWeightUpsert(entry: WeightEntry): Promise<void> {
    await this.load();
    const userId = await this.activeUserId();
    if (userId && await this.initializePlatform()) await this.writeWeight(entry, userId);
  }

  async syncWeightDelete(id: string): Promise<void> {
    await this.load();
    const userId = await this.activeUserId();
    if (!userId) return;
    if (!this.state.pendingDeleteIds.includes(id)) {
      const previous = this.state.pendingDeleteIds;
      this.state.pendingDeleteIds = [...previous, id];
      try { await this.persist(); } catch { this.state.pendingDeleteIds = previous; return; }
    }
    if (await this.initializePlatform()) await this.retryDeletes([id], userId);
  }

  async syncForeground(): Promise<void> {
    if (this.foregroundRun) return this.foregroundRun;
    this.foregroundRun = (async () => {
      await this.load();
      if (!await this.activeUserId()) return;
      const now = Date.now();
      const previous = this.state.lastForegroundAttemptAt;
      if (previous && now - Date.parse(previous) < FOREGROUND_INTERVAL_MS) return;
      this.state.lastForegroundAttemptAt = new Date(now).toISOString();
      try { await this.persist(); } catch {
        this.state.lastForegroundAttemptAt = previous;
        return;
      }
      await this.foregroundDelta();
    })();
    try { await this.foregroundRun; } finally { this.foregroundRun = undefined; }
  }

  getSyncStatus(): { enabled: boolean; permissionRevoked: boolean; pendingDeleteCount: number; lastSuccessfulSyncAt?: string } {
    return {
      enabled: this.state.enabled,
      permissionRevoked: this.permissionRevoked,
      pendingDeleteCount: this.state.pendingDeleteIds.length,
      lastSuccessfulSyncAt: this.state.watermark,
    };
  }
}

export const healthSyncService = new WeightDeltaSyncService();

export { WeightDeltaSyncService as HealthSyncService };
