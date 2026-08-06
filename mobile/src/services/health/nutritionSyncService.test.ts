import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Meal, MealType } from '@fittrack/shared';

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted ensures these are available when vi.mock factories run.
// ---------------------------------------------------------------------------

const {
  mockUpsertRecord,
  mockDeleteRecord,
  mockInitialize,
  mockRequestPermissions,
  mockListAllMeals,
  mockAsyncStorageGetItem,
  mockAsyncStorageSetItem,
} = vi.hoisted(() => ({
  mockUpsertRecord: vi.fn(),
  mockDeleteRecord: vi.fn(),
  mockInitialize: vi.fn().mockResolvedValue(true),
  mockRequestPermissions: vi.fn().mockResolvedValue(true),
  mockListAllMeals: vi.fn(),
  mockAsyncStorageGetItem: vi.fn().mockResolvedValue(null),
  mockAsyncStorageSetItem: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: mockAsyncStorageGetItem,
    setItem: mockAsyncStorageSetItem,
  },
}));

vi.mock('./healthPlatformService', () => ({
  healthPlatformService: {
    initialize: mockInitialize,
    requestPermissions: mockRequestPermissions,
    hasPermissions: vi.fn().mockResolvedValue(true),
    upsertRecord: mockUpsertRecord,
    deleteRecord: mockDeleteRecord,
    getAvailability: vi.fn().mockResolvedValue({ status: 'available' }),
    readRecords: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../shared/api/diaryApi', () => ({
  diaryApi: {
    listAllMeals: mockListAllMeals,
  },
}));

// ---------------------------------------------------------------------------
// Import NutritionSyncService class (not the singleton) for fresh instances.
// ---------------------------------------------------------------------------

import { NutritionSyncService, toNutritionRecord } from './nutritionSyncService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMeal(id: string, type: MealType = 'breakfast', items: Meal['items'] = []): Meal {
  return {
    id,
    userId: 'u1',
    date: '2026-08-01',
    type,
    name: `Meal ${id}`,
    items,
    createdAt: '2026-08-01T10:00:00Z',
  };
}

function makeItem(calories: number, protein = 0, carbs = 0, fat = 0, fiber = 0): Meal['items'][number] {
  return {
    id: `item-${Math.random()}`,
    name: 'Test Item',
    sourceType: 'manual',
    quantity: 100,
    unit: 'g',
    macros: { calories, protein, carbs, fat, fiber },
  };
}

function makeFreshService() {
  return new NutritionSyncService();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('nutritionSyncService', () => {
  let service: NutritionSyncService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsertRecord.mockResolvedValue(undefined);
    mockDeleteRecord.mockResolvedValue(undefined);
    mockRequestPermissions.mockResolvedValue(true);
    mockInitialize.mockResolvedValue(true);
    mockAsyncStorageGetItem.mockResolvedValue(null);
    mockAsyncStorageSetItem.mockResolvedValue(undefined);
    mockListAllMeals.mockResolvedValue({ meals: [], cursor: undefined });
    service = makeFreshService();
  });

  // -------------------------------------------------------------------------
  // toNutritionRecord
  // -------------------------------------------------------------------------

  describe('toNutritionRecord', () => {
    it.each<[MealType, number]>([
      ['breakfast', 1],
      ['lunch', 2],
      ['dinner', 3],
      ['snack', 4],
      ['preworkout', 0],
      ['postworkout', 0],
    ])('maps %s to mealType=%i', (type, expectedMealType) => {
      const meal = makeMeal('m1', type);
      const record = toNutritionRecord(meal);
      expect(record.mealType).toBe(expectedMealType);
    });

    it('aggregates macros across all items', () => {
      const meal = makeMeal('m1', 'lunch', [
        makeItem(300, 25, 40, 10, 5),
        makeItem(200, 15, 20, 8, 3),
      ]);
      const record = toNutritionRecord(meal);
      expect(record.energy?.value).toBeCloseTo(500);
      expect(record.protein?.value).toBeCloseTo(40);
      expect(record.totalCarbohydrate?.value).toBeCloseTo(60);
      expect(record.totalFat?.value).toBeCloseTo(18);
      expect(record.dietaryFiber?.value).toBeCloseTo(8);
    });

    it('emits no energy field for empty meal (0 calories)', () => {
      const meal = makeMeal('m1', 'breakfast');
      const record = toNutritionRecord(meal);
      expect(record.energy).toBeUndefined();
      expect(record.protein).toBeUndefined();
      expect(record.totalCarbohydrate).toBeUndefined();
      expect(record.totalFat).toBeUndefined();
      expect(record.dietaryFiber).toBeUndefined();
    });

    it('omits dietaryFiber when total fiber is 0', () => {
      const meal = makeMeal('m1', 'lunch', [makeItem(500, 30, 60, 20, 0)]);
      const record = toNutritionRecord(meal);
      expect(record.energy?.value).toBeCloseTo(500);
      expect(record.dietaryFiber).toBeUndefined();
    });

    it('falls back to noon local time when createdAt is absent', () => {
      const meal: Meal = {
        id: 'm-fallback',
        userId: 'u1',
        date: '2026-08-01',
        type: 'breakfast',
        name: 'Test',
        items: [],
        createdAt: '',
      };
      const record = toNutritionRecord(meal);
      const [y, m, d] = meal.date.split('-').map(Number);
      expect(record.startTime).toBe(new Date(y, m - 1, d, 12, 0, 0, 0).toISOString());
    });

    it('uses clientRecordId = meal.id', () => {
      const meal = makeMeal('unique-id');
      const record = toNutritionRecord(meal);
      expect(record.metadata.clientRecordId).toBe('unique-id');
      expect(record.recordType).toBe('Nutrition');
      expect(typeof record.metadata.clientRecordVersion).toBe('number');
    });

    it('sets endTime equal to startTime', () => {
      const meal = makeMeal('m1');
      const record = toNutritionRecord(meal);
      expect(record.endTime).toBe(record.startTime);
    });
  });

  // -------------------------------------------------------------------------
  // enableSync
  // -------------------------------------------------------------------------

  describe('enableSync', () => {
    it('returns success when permissions granted', async () => {
      const result = await service.enableSync();
      expect(result).toBe('success');
    });

    it('sets state.enabled=true on success', async () => {
      await service.enableSync();
      expect(service.getSyncStatus().enabled).toBe(true);
    });

    it('returns permission_denied when permissions refused', async () => {
      mockRequestPermissions.mockResolvedValueOnce(false);
      const result = await service.enableSync();
      expect(result).toBe('permission_denied');
      expect(service.getSyncStatus().enabled).toBe(false);
    });

    it('does not call listAllMeals when permission denied', async () => {
      mockRequestPermissions.mockResolvedValueOnce(false);
      await service.enableSync();
      expect(mockListAllMeals).not.toHaveBeenCalled();
    });

    it('performs paginated export across 2 batches', async () => {
      mockListAllMeals
        .mockResolvedValueOnce({ meals: [makeMeal('m1'), makeMeal('m2')], cursor: 'cursor-page2' })
        .mockResolvedValueOnce({ meals: [makeMeal('m3')], cursor: undefined });

      await service.enableSync();

      expect(mockListAllMeals).toHaveBeenCalledTimes(2);
      expect(mockListAllMeals).toHaveBeenNthCalledWith(1, 50, undefined);
      expect(mockListAllMeals).toHaveBeenNthCalledWith(2, 50, 'cursor-page2');
      expect(mockUpsertRecord).toHaveBeenCalledTimes(3);
    });

    it('persists exportCursor after first batch', async () => {
      mockListAllMeals
        .mockResolvedValueOnce({ meals: [makeMeal('m1')], cursor: 'mid-cursor' })
        .mockResolvedValueOnce({ meals: [], cursor: undefined });

      await service.enableSync();

      const calls = mockAsyncStorageSetItem.mock.calls.map((c) => JSON.parse(c[1] as string));
      const cursorPersisted = calls.some((s) => s.exportCursor === 'mid-cursor');
      expect(cursorPersisted).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // syncNutritionUpsert
  // -------------------------------------------------------------------------

  describe('syncNutritionUpsert', () => {
    it('does nothing when sync is disabled', async () => {
      await service.syncNutritionUpsert(makeMeal('m1'));
      expect(mockUpsertRecord).not.toHaveBeenCalled();
    });

    it('calls upsertRecord when enabled', async () => {
      await service.enableSync();
      mockUpsertRecord.mockClear();
      await service.syncNutritionUpsert(makeMeal('m1'));
      expect(mockUpsertRecord).toHaveBeenCalledTimes(1);
    });

    it('queues a pendingOp on upsert failure', async () => {
      await service.enableSync();
      mockUpsertRecord.mockRejectedValueOnce(new Error('IO error'));
      await service.syncNutritionUpsert(makeMeal('m1'));
      const status = service.getSyncStatus();
      expect(status.temporaryFailures.length).toBe(1);
    });

    it('retries queued op on drain after failure', async () => {
      await service.enableSync();
      mockUpsertRecord.mockRejectedValueOnce(new Error('IO error'));
      await service.syncNutritionUpsert(makeMeal('m1'));
      mockUpsertRecord.mockResolvedValue(undefined);
      await service.drainPendingQueue();
      expect(mockUpsertRecord.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  // -------------------------------------------------------------------------
  // syncNutritionDelete
  // -------------------------------------------------------------------------

  describe('syncNutritionDelete', () => {
    it('does nothing when sync is disabled', async () => {
      await service.syncNutritionDelete('meal-id');
      expect(mockDeleteRecord).not.toHaveBeenCalled();
    });

    it('calls deleteRecord with correct type and id', async () => {
      await service.enableSync();
      await service.syncNutritionDelete('meal-del');
      expect(mockDeleteRecord).toHaveBeenCalledWith('Nutrition', 'meal-del');
    });

    it('queues a pendingOp on delete failure', async () => {
      await service.enableSync();
      mockDeleteRecord.mockRejectedValueOnce(new Error('IO error'));
      await service.syncNutritionDelete('meal-fail');
      const status = service.getSyncStatus();
      expect(status.temporaryFailures.length).toBe(1);
    });

    it('retries queued delete op on drain', async () => {
      await service.enableSync();
      mockDeleteRecord.mockRejectedValueOnce(new Error('IO error'));
      await service.syncNutritionDelete('meal-fail');
      mockDeleteRecord.mockResolvedValue(undefined);
      await service.drainPendingQueue();
      const deleteCalls = mockDeleteRecord.mock.calls.filter((c) => c[1] === 'meal-fail');
      expect(deleteCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------------------
  // drainPendingQueue
  // -------------------------------------------------------------------------

  describe('drainPendingQueue', () => {
    it('disables sync on permission error during drain', async () => {
      await service.enableSync();
      mockUpsertRecord.mockRejectedValueOnce(new Error('IO error'));
      await service.syncNutritionUpsert(makeMeal('m1'));
      mockUpsertRecord.mockRejectedValueOnce(new Error('PERMISSION_DENIED'));
      await service.drainPendingQueue();
      const status = service.getSyncStatus();
      expect(status.enabled).toBe(false);
      expect(status.permissionRevoked).toBe(true);
    });

    it('removes op from queue on successful retry', async () => {
      await service.enableSync();
      mockUpsertRecord.mockRejectedValueOnce(new Error('IO error'));
      await service.syncNutritionUpsert(makeMeal('m1'));
      expect(service.getSyncStatus().temporaryFailures.length).toBe(1);
      mockUpsertRecord.mockResolvedValue(undefined);
      await service.drainPendingQueue();
      expect(service.getSyncStatus().temporaryFailures.length).toBe(0);
    });

    it('marks op as permanent after retryCount>=10 and sessionCount>=2', async () => {
      const storedState = JSON.stringify({
        enabled: true,
        permissionRevoked: false,
        pendingOperations: [
          {
            entryId: 'm-perm',
            type: 'upsert',
            meal: makeMeal('m-perm'),
            retryCount: 9,
            sessionCount: 1,
            errorType: 'temporary',
          },
        ],
      });
      mockAsyncStorageGetItem.mockResolvedValue(storedState);
      const freshService = makeFreshService();

      mockUpsertRecord.mockRejectedValue(new Error('IO error'));
      // Drain: sessionCount 1→2, retry fails → retryCount 9→10, sessionCount=2 → permanent
      await freshService.drainPendingQueue();

      expect(freshService.getSyncStatus().permanentFailures.length).toBe(1);
    });

    it('does not mark op as permanent when sessionCount < 2', async () => {
      const storedState = JSON.stringify({
        enabled: true,
        permissionRevoked: false,
        pendingOperations: [
          {
            entryId: 'm-temp',
            type: 'upsert',
            meal: makeMeal('m-temp'),
            retryCount: 9,
            sessionCount: 0,
            errorType: 'temporary',
          },
        ],
      });
      mockAsyncStorageGetItem.mockResolvedValue(storedState);
      const freshService = makeFreshService();

      mockUpsertRecord.mockRejectedValue(new Error('IO error'));
      // sessionCount 0→1, retryCount 9→10 but sessionCount=1 < 2 → not permanent
      await freshService.drainPendingQueue();

      expect(freshService.getSyncStatus().permanentFailures.length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // loadState
  // -------------------------------------------------------------------------

  describe('loadState', () => {
    it('loads persisted state — getSyncStatus returns stored enabled value', async () => {
      const stored = JSON.stringify({
        enabled: true,
        permissionRevoked: false,
        lastFullExportAt: '2026-08-01T10:00:00Z',
        pendingOperations: [],
      });
      mockAsyncStorageGetItem.mockResolvedValue(stored);
      const fresh = makeFreshService();
      await fresh.loadState();
      const status = fresh.getSyncStatus();
      expect(status.enabled).toBe(true);
      expect(status.lastFullExportAt).toBe('2026-08-01T10:00:00Z');
    });

    it('is idempotent — calling twice does not re-read AsyncStorage', async () => {
      mockAsyncStorageGetItem.mockResolvedValue(null);
      const fresh = makeFreshService();
      await fresh.loadState();
      await fresh.loadState();
      expect(mockAsyncStorageGetItem).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // disableSync
  // -------------------------------------------------------------------------

  describe('disableSync', () => {
    it('sets enabled to false', async () => {
      await service.enableSync();
      await service.disableSync();
      expect(service.getSyncStatus().enabled).toBe(false);
    });

    it('does not call upsertRecord after disable', async () => {
      await service.enableSync();
      await service.disableSync();
      mockUpsertRecord.mockClear();
      await service.syncNutritionUpsert(makeMeal('m1'));
      expect(mockUpsertRecord).not.toHaveBeenCalled();
    });
  });
});
