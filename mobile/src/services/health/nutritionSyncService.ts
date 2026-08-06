// nutritionSyncService — state machine for Health Connect nutrition sync.
// Persists state to AsyncStorage under 'hc:nutrition:sync'.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Meal, MealItem, MealType } from '@fittrack/shared';
import type { NutritionHealthRecord } from './IHealthPlatformService';
import { healthPlatformService } from './healthPlatformService';
import { diaryApi } from '../../shared/api/diaryApi';
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
// Types
// ---------------------------------------------------------------------------

export interface NutritionPendingOp {
  entryId: string;       // = item.id
  type: 'upsert' | 'delete';
  item?: MealItem;       // stored for upsert retry
  mealType?: MealType;   // parent meal type (for mealType field in HC)
  mealDate?: string;     // parent meal date (fallback for startTime)
  mealCreatedAt?: string; // parent meal createdAt
  retryCount: number;
  sessionCount: number;
  errorType?: 'temporary' | 'permission' | 'permanent';
  errorMessage?: string;
  errorStack?: string;
  dismissed?: boolean;
}

interface NutritionSyncState {
  enabled: boolean;
  permissionRevoked: boolean;
  lastFullExportAt?: string;
  exportCursor?: string;
  pendingOperations: NutritionPendingOp[];
}

const DEFAULT_STATE: NutritionSyncState = {
  enabled: false,
  permissionRevoked: false,
  pendingOperations: [],
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

class NutritionSyncService {
  private state: NutritionSyncState = { ...DEFAULT_STATE };
  private loaded = false;
  private sessionCountIncremented = false;

  private async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      this.state = raw ? (JSON.parse(raw) as NutritionSyncState) : { ...DEFAULT_STATE };
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

  async enableSync(): Promise<'success' | 'permission_denied'> {
    await this.load();
    syncLogger.info('NutritionSync/enableSync', 'Requesting permissions');
    await healthPlatformService.initialize();
    const granted = await healthPlatformService.requestPermissions(NUTRITION_PERMISSIONS);
    if (!granted) {
      syncLogger.warn('NutritionSync/enableSync', 'Permission denied');
      return 'permission_denied';
    }

    this.state.enabled = true;
    this.state.permissionRevoked = false;
    this.state.exportCursor = undefined;
    await this.runFullExport();
    await this.persist();

    syncLogger.info('NutritionSync/enableSync', 'Sync enabled successfully');
    return 'success';
  }

  async disableSync(): Promise<void> {
    await this.load();
    this.state.enabled = false;
    await this.persist();
  }

  async runFullExport(): Promise<void> {
    await this.load();
    syncLogger.info('NutritionSync/runFullExport', 'Starting full export');
    this.state.pendingOperations = [];
    this.state.exportCursor = undefined;
    await this.persist();

    let cursor: string | undefined = undefined;
    let totalOk = 0;
    let totalFailed = 0;

    do {
      const { meals, cursor: nextCursor } = await diaryApi.listAllMeals(BATCH_SIZE, cursor);
      syncLogger.info('NutritionSync/runFullExport', `Batch: ${meals.length} meals`);

      for (const meal of meals) {
        for (const item of (meal.items ?? [])) {
          try {
            await healthPlatformService.upsertRecord(toNutritionRecord(meal, item));
            totalOk++;
          } catch (e) {
            totalFailed++;
            const errorType = classifyError(e);
            const msg = extractErrorMessage(e);
            syncLogger.error('NutritionSync/runFullExport', `Failed upsert itemId=${item.id} type=${errorType}`, msg);
            this.addOrUpdatePendingOp({ entryId: item.id, type: 'upsert', item, mealType: meal.type, mealDate: meal.date, mealCreatedAt: meal.createdAt, errorType, errorMessage: msg, errorStack: extractErrorStack(e) });
          }
        }
      }

      cursor = nextCursor;
      this.state.exportCursor = cursor;
      if (!cursor) {
        this.state.lastFullExportAt = new Date().toISOString();
      }
      await this.persist();
    } while (cursor !== undefined);

    syncLogger.info('NutritionSync/runFullExport', `Done: ${totalOk} ok, ${totalFailed} failed`);
  }

  async syncNutritionUpsert(meal: Meal): Promise<void> {
    await this.load();
    if (!this.state.enabled) return;
    await healthPlatformService.initialize();
    for (const item of (meal.items ?? [])) {
      syncLogger.info('NutritionSync/upsert', `Upserting itemId=${item.id}`);
      try {
        await healthPlatformService.upsertRecord(toNutritionRecord(meal, item));
        syncLogger.info('NutritionSync/upsert', `OK itemId=${item.id}`);
      } catch (e) {
        const errorType = classifyError(e);
        const msg = extractErrorMessage(e);
        syncLogger.error('NutritionSync/upsert', `Failed itemId=${item.id} type=${errorType}`, msg);
        this.addOrUpdatePendingOp({ entryId: item.id, type: 'upsert', item, mealType: meal.type, mealDate: meal.date, mealCreatedAt: meal.createdAt, errorType, errorMessage: msg, errorStack: extractErrorStack(e) });
      }
    }
    await this.persist();
  }

  async syncNutritionDeleteMeal(meal: Meal): Promise<void> {
    for (const item of (meal.items ?? [])) {
      await this.syncNutritionDelete(item.id);
    }
  }

  async syncNutritionDelete(mealId: string): Promise<void> {
    await this.load();
    if (!this.state.enabled) return;
    syncLogger.info('NutritionSync/delete', `Deleting id=${mealId}`);
    try {
      await healthPlatformService.deleteRecord('Nutrition', mealId);
      syncLogger.info('NutritionSync/delete', `OK id=${mealId}`);
    } catch (e) {
      const errorType = classifyError(e);
      const msg = extractErrorMessage(e);
      syncLogger.error('NutritionSync/delete', `Failed id=${mealId} type=${errorType}`, msg);
      this.addOrUpdatePendingOp({ entryId: mealId, type: 'delete', errorType, errorMessage: msg, errorStack: extractErrorStack(e) });
      await this.persist();
    }
  }

  async drainPendingQueue(): Promise<void> {
    await this.load();
    await healthPlatformService.initialize();
    if (!this.state.enabled) return;

    const pending = this.state.pendingOperations.filter((o) => !o.dismissed && o.errorType !== 'permanent');
    if (pending.length > 0) {
      syncLogger.info('NutritionSync/drain', `Processing ${pending.length} pending ops`);
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
        if (op.type === 'upsert' && op.item && op.mealType !== undefined) {
          await healthPlatformService.upsertRecord(
            toNutritionRecord(
              { type: op.mealType, date: op.mealDate ?? '', createdAt: op.mealCreatedAt ?? '' },
              op.item,
            ),
          );
        } else if (op.type === 'delete') {
          await healthPlatformService.deleteRecord('Nutrition', op.entryId);
        }
        // Success — remove from queue
        this.state.pendingOperations = this.state.pendingOperations.filter(
          (o) => o.entryId !== op.entryId || o.type !== op.type,
        );
      } catch (e) {
        const errorType = classifyError(e);
        if (errorType === 'permission') {
          syncLogger.warn('NutritionSync/drain', 'Permission revoked — disabling sync');
          this.state.enabled = false;
          this.state.permissionRevoked = true;
          await this.persist();
          return;
        }
        const errorMessage = extractErrorMessage(e);
        const errorStack = extractErrorStack(e);
        syncLogger.error('NutritionSync/drain', `Retry failed id=${op.entryId}`, errorMessage);
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
    permanentFailures: NutritionPendingOp[];
    temporaryFailures: NutritionPendingOp[];
    lastFullExportAt?: string;
  } {
    return {
      enabled: this.state.enabled,
      permissionRevoked: this.state.permissionRevoked,
      permanentFailures: this.state.pendingOperations.filter((op) => op.errorType === 'permanent' && !op.dismissed),
      temporaryFailures: this.state.pendingOperations.filter((op) => op.errorType === 'temporary'),
      lastFullExportAt: this.state.lastFullExportAt,
    };
  }

  async dismissPermanentFailures(): Promise<void> {
    await this.load();
    this.state.pendingOperations = this.state.pendingOperations.map((op) =>
      op.errorType === 'permanent' ? { ...op, dismissed: true } : op,
    );
    await this.persist();
  }

  private addOrUpdatePendingOp(
    op: Pick<NutritionPendingOp, 'entryId' | 'type' | 'item' | 'mealType' | 'mealDate' | 'mealCreatedAt' | 'errorType'> & { errorMessage?: string; errorStack?: string },
  ): void {
    const existing = this.state.pendingOperations.findIndex(
      (o) => o.entryId === op.entryId && o.type === op.type,
    );
    if (existing >= 0) {
      this.state.pendingOperations[existing] = {
        ...this.state.pendingOperations[existing],
        item: op.item,
        mealType: op.mealType,
        mealDate: op.mealDate,
        mealCreatedAt: op.mealCreatedAt,
        errorType: op.errorType,
        errorMessage: op.errorMessage,
        errorStack: op.errorStack,
      };
    } else {
      this.state.pendingOperations.push({
        entryId: op.entryId,
        type: op.type,
        item: op.item,
        mealType: op.mealType,
        mealDate: op.mealDate,
        mealCreatedAt: op.mealCreatedAt,
        retryCount: 0,
        sessionCount: 0,
        errorType: op.errorType,
        errorMessage: op.errorMessage,
        errorStack: op.errorStack,
      });
    }
  }
}

export const nutritionSyncService = new NutritionSyncService();

// Export class for unit testing (allows creating fresh instances without AsyncStorage state leakage).
export { NutritionSyncService };
