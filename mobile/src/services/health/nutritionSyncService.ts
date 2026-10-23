// nutritionSyncService — state machine for Health Connect nutrition sync.
// Stores user-bound delta state in AsyncStorage under 'hc:nutrition:sync'.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Meal, MealItem, MealType } from '@fittrack/shared';
import type { NutritionHealthRecord } from './IHealthPlatformService';
import { healthPlatformService } from './healthPlatformService';
import { diaryApi } from '../../shared/api/diaryApi';
import { authService } from '../authService';
import { syncLogger } from './syncLogger';

const STORAGE_KEY = 'hc:nutrition:sync';
const NUTRITION_PERMISSIONS = [{ accessType: 'write' as const, recordType: 'Nutrition' }];
const BATCH_SIZE = 50;

const MEAL_TYPE_MAP: Record<MealType, number> = {
  breakfast: 1,
  lunch: 2,
  dinner: 3,
  snack: 4,
  preworkout: 0,
  postworkout: 0,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function toNutritionRecord(
  meal: Pick<Meal, 'type' | 'date' | 'createdAt'>,
  item: MealItem,
): NutritionHealthRecord {
  const time = meal.createdAt
    ? new Date(meal.createdAt).toISOString()
    : (() => {
        const [y, m, d] = meal.date.split('-').map(Number);
        return new Date(y, m - 1, d, 12, 0, 0, 0).toISOString();
      })();

  const startIso = time;
  const endIso = new Date(new Date(time).getTime() + 1000).toISOString();

  const offsetMins = -new Date().getTimezoneOffset();
  const sign = offsetMins >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMins);
  const zone = `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;

  const cals   = item.macros.calories;
  const prot   = item.macros.protein;
  const carbs  = item.macros.carbs;
  const fat    = item.macros.fat;
  const fiber  = item.macros.fiber ?? 0;

  return {
    recordType: 'Nutrition',
    metadata: { clientRecordId: item.id, clientRecordVersion: Date.now() },
    startTime: startIso,
    endTime: endIso,
    startZoneOffset: zone,
    endZoneOffset: zone,
    name: item.name,
    mealType: MEAL_TYPE_MAP[meal.type],
    ...(cals  > 0 ? { energy:           { value: cals,  unit: 'kilocalories' as const } } : {}),
    ...(prot  > 0 ? { protein:           { value: prot,  unit: 'grams' as const } } : {}),
    ...(carbs > 0 ? { totalCarbohydrate: { value: carbs, unit: 'grams' as const } } : {}),
    ...(fat   > 0 ? { totalFat:          { value: fat,   unit: 'grams' as const } } : {}),
    ...(fiber > 0 ? { dietaryFiber:      { value: fiber, unit: 'grams' as const } } : {}),
  };
}

function classifyError(e: unknown): 'temporary' | 'permission' {
  const msg = String(e).toUpperCase();
  if (msg.includes('PERMISSION') || msg.includes('PERMISSION_DENIED')) return 'permission';
  return 'temporary';
}

interface NutritionDeltaState {
  enabled: boolean;
  userId?: string;
  watermark?: string;
  pendingDeleteIds: string[];
  lastForegroundAttemptAt?: string;
}

const DEFAULT_DELTA_STATE: NutritionDeltaState = { enabled: false, pendingDeleteIds: [] };
const DELTA_STATE_FIELDS = new Set(['enabled', 'userId', 'watermark', 'pendingDeleteIds', 'lastForegroundAttemptAt']);
const FOREGROUND_INTERVAL_MS = 15 * 60 * 1000;
const INITIAL_WATERMARK = new Date(0).toISOString();

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function isNutritionDeltaState(value: unknown): value is NutritionDeltaState {
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

function effectiveMealTimestamp(meal: Meal): string | undefined {
  const timestamp = Date.parse(meal.updatedAt ?? meal.createdAt);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function newestTimestamp(...values: Array<string | undefined>): string | undefined {
  return values.filter((value): value is string => value !== undefined && isCanonicalTimestamp(value))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
}

class NutritionDeltaSyncService {
  private state: NutritionDeltaState = { ...DEFAULT_DELTA_STATE };
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
            if (isNutritionDeltaState(parsed)) this.state = parsed;
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
      const granted = await healthPlatformService.hasPermissions(NUTRITION_PERMISSIONS);
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
  }

  private async initializePlatform(): Promise<boolean> {
    try { return await healthPlatformService.initialize(); } catch { return false; }
  }

  private async writeNutrition(meal: Meal, item: MealItem, userId: string): Promise<boolean> {
    if (!await this.permissionForWrite(userId)) return false;
    try {
      await healthPlatformService.upsertRecord(toNutritionRecord(meal, item));
      return true;
    } catch (error) {
      syncLogger.error('NutritionSync', 'Health Connect nutrition write failed');
      if (classifyError(error) === 'permission') await this.disableForRevokedPermission();
      return false;
    }
  }

  private async writeDelete(id: string, userId: string): Promise<boolean> {
    if (!await this.permissionForWrite(userId)) return false;
    try {
      await healthPlatformService.deleteRecord('Nutrition', id);
      return true;
    } catch (error) {
      syncLogger.error('NutritionSync', 'Health Connect nutrition deletion failed');
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

  private async fullExport(userId: string): Promise<boolean> {
    if (!await this.initializePlatform() || !await this.permissionForWrite(userId)) return false;
    let succeeded = await this.retryDeletes([...this.state.pendingDeleteIds], userId);
    let latest = this.state.watermark;
    let cursor: string | undefined;
    const seenCursors = new Set<string>();
    try {
      do {
        const page = await diaryApi.listAllMeals(BATCH_SIZE, cursor);
        for (const meal of page.meals) {
          latest = newestTimestamp(latest, effectiveMealTimestamp(meal));
          for (const item of meal.items ?? []) {
            const written = await this.writeNutrition(meal, item, userId);
            if (!written) {
              succeeded = false;
              if (!this.state.enabled || this.permissionRevoked) return false;
            }
          }
        }
        if (page.cursor && seenCursors.has(page.cursor)) throw new Error('Repeated meal export cursor');
        if (page.cursor) seenCursors.add(page.cursor);
        cursor = page.cursor;
      } while (cursor !== undefined);
    } catch {
      syncLogger.error('NutritionSync', 'Nutrition full export failed');
      return false;
    }
    return succeeded && latest ? this.setWatermark(latest) : succeeded;
  }

  private async foregroundDelta(): Promise<void> {
    const userId = await this.activeUserId();
    if (!userId || !await this.initializePlatform() || !await this.permissionForWrite(userId)) return;
    let succeeded = await this.retryDeletes([...this.state.pendingDeleteIds], userId);
    if (!this.state.enabled) return;

    const since = this.state.watermark ?? INITIAL_WATERMARK;
    let cursor: string | undefined;
    let checkpointAt: string | undefined;
    const seenCursors = new Set<string>();
    try {
      do {
        const page = await diaryApi.getMealChanges(since, BATCH_SIZE, cursor);
        if (!isCanonicalTimestamp(page.checkpointAt) || Date.parse(page.checkpointAt) < Date.parse(since)) return;
        if (checkpointAt !== undefined && checkpointAt !== page.checkpointAt) return;
        checkpointAt = page.checkpointAt;
        for (const meal of page.meals) {
          for (const item of meal.items ?? []) {
            const written = await this.writeNutrition(meal, item, userId);
            if (!written) {
              succeeded = false;
              if (!this.state.enabled || this.permissionRevoked) return;
            }
          }
        }
        if (page.cursor && seenCursors.has(page.cursor)) return;
        if (page.cursor) seenCursors.add(page.cursor);
        cursor = page.cursor;
      } while (cursor !== undefined);
      if (succeeded && checkpointAt) await this.setWatermark(checkpointAt);
    } catch {
      syncLogger.error('NutritionSync', 'Nutrition delta reconciliation failed');
    }
  }

  private async foregroundAttempt(): Promise<void> {
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
  }

  async loadState(): Promise<void> { await this.load(); }

  async resetForAccountDeletion(): Promise<void> {
    this.state = { ...DEFAULT_DELTA_STATE };
    this.loaded = true;
    this.permissionRevoked = false;
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  async enableSync(): Promise<'success' | 'permission_denied' | 'user_unavailable'> {
    await this.load();
    const userId = await this.activationUserId();
    if (!userId) return 'user_unavailable';
    try {
      await healthPlatformService.initialize();
      if (!await healthPlatformService.requestPermissions(NUTRITION_PERMISSIONS)) return 'permission_denied';
    } catch { return 'permission_denied'; }
    this.state.enabled = true;
    this.state.userId = userId;
    this.permissionRevoked = false;
    await this.persist();
    await this.fullExport(userId);
    return this.state.enabled ? 'success' : 'permission_denied';
  }

  async disableSync(): Promise<void> {
    await this.load();
    this.state.enabled = false;
    this.permissionRevoked = false;
    await this.persist();
  }

  async runFullExport(): Promise<boolean> {
    await this.load();
    const userId = await this.activeUserId();
    return userId ? this.fullExport(userId) : false;
  }

  async syncNutritionUpsert(meal: Meal, itemIds?: readonly string[]): Promise<void> {
    await this.load();
    const userId = await this.activeUserId();
    if (!userId || !await this.initializePlatform()) return;
    const selectedIds = itemIds === undefined ? undefined : new Set(itemIds);
    for (const item of meal.items ?? []) {
      if (selectedIds && !selectedIds.has(item.id)) continue;
      const written = await this.writeNutrition(meal, item, userId);
      if (!written && (!this.state.enabled || this.permissionRevoked)) return;
    }
  }

  async syncNutritionDeleteMeal(meal: Meal): Promise<void> {
    await this.syncNutritionDeletes((meal.items ?? []).map((item) => item.id));
  }

  async syncNutritionDelete(id: string): Promise<void> {
    await this.syncNutritionDeletes([id]);
  }

  async syncNutritionDeletes(ids: readonly string[]): Promise<void> {
    await this.load();
    const userId = await this.activeUserId();
    if (!userId) return;
    const uniqueIds = [...new Set(ids.filter((id) => id.length > 0))];
    if (uniqueIds.length === 0) return;
    const previous = this.state.pendingDeleteIds;
    const pendingDeleteIds = [...previous, ...uniqueIds.filter((id) => !previous.includes(id))];
    if (pendingDeleteIds.length !== previous.length) {
      this.state.pendingDeleteIds = pendingDeleteIds;
      try { await this.persist(); } catch { this.state.pendingDeleteIds = previous; return; }
    }
    if (await this.initializePlatform()) await this.retryDeletes(uniqueIds, userId);
  }

  async syncForeground(): Promise<void> {
    if (this.foregroundRun) return this.foregroundRun;
    this.foregroundRun = this.foregroundAttempt();
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

export const nutritionSyncService = new NutritionDeltaSyncService();

export { NutritionDeltaSyncService as NutritionSyncService };
