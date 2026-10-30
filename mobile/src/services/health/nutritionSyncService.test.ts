import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Meal, MealType } from '@fittrack/shared';

const mocks = vi.hoisted(() => ({
  upsertRecord: vi.fn(),
  deleteRecord: vi.fn(),
  initialize: vi.fn(),
  requestPermissions: vi.fn(),
  hasPermissions: vi.fn(),
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  getUserId: vi.fn(),
  listAllMeals: vi.fn(),
  getMealChanges: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: mocks.getItem, setItem: mocks.setItem, removeItem: mocks.removeItem },
}));
vi.mock('./healthPlatformService', () => ({
  healthPlatformService: {
    upsertRecord: mocks.upsertRecord,
    deleteRecord: mocks.deleteRecord,
    initialize: mocks.initialize,
    requestPermissions: mocks.requestPermissions,
    hasPermissions: mocks.hasPermissions,
  },
}));
vi.mock('../../shared/api/diaryApi', () => ({
  diaryApi: { listAllMeals: mocks.listAllMeals, getMealChanges: mocks.getMealChanges },
}));
vi.mock('../authService', () => ({ authService: { getAuthenticatedUserId: mocks.getUserId } }));

import { NutritionSyncService, toNutritionRecord } from './nutritionSyncService';
import { addLocalDays, getLocalIsoDate } from '../../shared/date/localDate';

const SINCE = '2026-10-23T09:00:00.000Z';
const CHECKPOINT = '2026-10-23T10:00:00.000Z';
const FOREGROUND_INTERVAL_MS = 15 * 60 * 1000;

function makeMeal(id: string, itemId = `item-${id}`, type: MealType = 'breakfast', updatedAt = CHECKPOINT): Meal {
  return {
    id,
    userId: 'u1',
    date: '2026-10-23',
    type,
    name: `Meal ${id}`,
    items: [{
      id: itemId,
      name: 'Test food',
      sourceType: 'manual',
      quantity: 100,
      unit: 'g',
      macros: { calories: 250, protein: 20, carbs: 30, fat: 8, fiber: 4 },
    }],
    createdAt: SINCE,
    updatedAt,
  };
}

function storedState(overrides: Record<string, unknown> = {}) {
  return {
    enabled: true,
    userId: 'u1',
    watermark: SINCE,
    pendingDeleteIds: [],
    ...overrides,
  };
}

function latestSavedState(): Record<string, unknown> {
  const calls = mocks.setItem.mock.calls;
  return JSON.parse(calls[calls.length - 1]![1] as string) as Record<string, unknown>;
}

describe('toNutritionRecord', () => {
  it('anchors a retroactively logged meal to its diary date with a neutral local timestamp', () => {
    const now = new Date(2026, 9, 30, 9, 30);
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const diaryDate = addLocalDays(getLocalIsoDate(now), -1);
    const meal = { ...makeMeal('retroactive', 'item-retroactive', 'dinner'), date: diaryDate, createdAt: now.toISOString() };
    const item = meal.items[0]!;

    const record = toNutritionRecord(meal, item);

    expect(getLocalIsoDate(new Date(record.startTime))).toBe(diaryDate);
    expect(new Date(record.startTime).getHours()).toBe(12);
    expect(new Date(record.endTime).getTime() - new Date(record.startTime).getTime()).toBe(1000);
    const [year, month, day] = diaryDate.split('-').map(Number);
    const anchorDate = new Date(year, month - 1, day, 12, 0, 0, 0);
    const offsetMinutes = -anchorDate.getTimezoneOffset();
    const offsetSign = offsetMinutes >= 0 ? '+' : '-';
    const absoluteOffset = Math.abs(offsetMinutes);
    const expectedOffset = `${offsetSign}${String(Math.floor(absoluteOffset / 60)).padStart(2, '0')}:${String(absoluteOffset % 60).padStart(2, '0')}`;
    expect(record.startZoneOffset).toBe(expectedOffset);
    expect(record.endZoneOffset).toBe(expectedOffset);
    expect(record).toMatchObject({
      metadata: { clientRecordId: item.id },
      name: item.name,
      mealType: 3,
      energy: { value: 250, unit: 'kilocalories' },
      protein: { value: 20, unit: 'grams' },
      totalCarbohydrate: { value: 30, unit: 'grams' },
      totalFat: { value: 8, unit: 'grams' },
      dietaryFiber: { value: 4, unit: 'grams' },
    });
  });
});

describe('nutritionSyncService delta state', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
    mocks.upsertRecord.mockResolvedValue(undefined);
    mocks.deleteRecord.mockResolvedValue(undefined);
    mocks.initialize.mockResolvedValue(true);
    mocks.requestPermissions.mockResolvedValue(true);
    mocks.hasPermissions.mockResolvedValue(true);
    mocks.getItem.mockResolvedValue(null);
    mocks.setItem.mockResolvedValue(undefined);
    mocks.removeItem.mockResolvedValue(undefined);
    mocks.getUserId.mockResolvedValue('u1');
    mocks.listAllMeals.mockResolvedValue({ meals: [], cursor: undefined });
    mocks.getMealChanges.mockResolvedValue({ meals: [], checkpointAt: CHECKPOINT });
  });

  it('purges a legacy meal snapshot queue without sending its data', async () => {
    mocks.getItem.mockResolvedValue(JSON.stringify({
      enabled: true,
      exportCursor: 'old-cursor',
      pendingOperations: [{ entryId: 'item-old', type: 'upsert', item: makeMeal('old').items[0] }],
    }));
    const service = new NutritionSyncService();

    await service.loadState();

    expect(mocks.removeItem).toHaveBeenCalledWith('hc:nutrition:sync');
    expect(service.getSyncStatus().enabled).toBe(false);
    expect(mocks.initialize).not.toHaveBeenCalled();
    expect(mocks.requestPermissions).not.toHaveBeenCalled();
    expect(mocks.hasPermissions).not.toHaveBeenCalled();
    expect(mocks.upsertRecord).not.toHaveBeenCalled();
    expect(mocks.deleteRecord).not.toHaveBeenCalled();
    expect(mocks.listAllMeals).not.toHaveBeenCalled();
    expect(mocks.getMealChanges).not.toHaveBeenCalled();
  });

  it('purges enabled state with a missing stored userId without Health Connect writes', async () => {
    const { userId: _userId, ...stateWithoutUserId } = storedState({ pendingDeleteIds: ['item-stale-user'] });
    mocks.getItem.mockResolvedValue(JSON.stringify(stateWithoutUserId));
    const service = new NutritionSyncService();

    await service.syncNutritionUpsert(makeMeal('new'));

    expect(mocks.removeItem).toHaveBeenCalledWith('hc:nutrition:sync');
    expect(service.getSyncStatus()).toMatchObject({ enabled: false, permissionRevoked: false, pendingDeleteCount: 0 });
    expect(mocks.initialize).not.toHaveBeenCalled();
    expect(mocks.requestPermissions).not.toHaveBeenCalled();
    expect(mocks.hasPermissions).not.toHaveBeenCalled();
    expect(mocks.upsertRecord).not.toHaveBeenCalled();
    expect(mocks.deleteRecord).not.toHaveBeenCalled();
    expect(mocks.listAllMeals).not.toHaveBeenCalled();
    expect(mocks.getMealChanges).not.toHaveBeenCalled();
  });

  it('purges numeric epoch timestamps instead of converting them to ISO', async () => {
    mocks.getItem.mockResolvedValue(JSON.stringify(storedState({
      lastForegroundAttemptAt: Date.parse(CHECKPOINT),
    })));
    const service = new NutritionSyncService();

    await service.loadState();

    expect(mocks.removeItem).toHaveBeenCalledWith('hc:nutrition:sync');
    expect(mocks.setItem).not.toHaveBeenCalled();
    expect(service.getSyncStatus().enabled).toBe(false);
    expect(mocks.getMealChanges).not.toHaveBeenCalled();
  });

  it('keeps the existing paginated full export and persists only approved state fields', async () => {
    mocks.listAllMeals
      .mockResolvedValueOnce({ meals: [makeMeal('m1')], cursor: 'page-2' })
      .mockResolvedValueOnce({ meals: [makeMeal('m2', 'item-m2', 'lunch', CHECKPOINT)], cursor: undefined });
    const service = new NutritionSyncService();

    await expect(service.enableSync()).resolves.toBe('success');

    expect(mocks.listAllMeals).toHaveBeenNthCalledWith(1, 50, undefined);
    expect(mocks.listAllMeals).toHaveBeenNthCalledWith(2, 50, 'page-2');
    expect(mocks.upsertRecord).toHaveBeenCalledTimes(2);
    expect(mocks.hasPermissions).toHaveBeenCalledTimes(3);
    const saved = latestSavedState();
    expect(Object.keys(saved).sort()).toEqual(['enabled', 'pendingDeleteIds', 'userId', 'watermark']);
    expect(saved).toMatchObject({ enabled: true, userId: 'u1', pendingDeleteIds: [], watermark: CHECKPOINT });
    expect(JSON.stringify(saved)).not.toContain('Test food');
    expect(JSON.stringify(saved)).not.toContain('250');
  });

  it('does not throttle an activation full export after a recent foreground attempt', async () => {
    const now = new Date('2026-10-23T12:00:00.000Z');
    const previousAttemptAt = new Date(now.getTime() - 60_000).toISOString();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    mocks.getItem.mockResolvedValue(JSON.stringify(storedState({
      enabled: false,
      lastForegroundAttemptAt: previousAttemptAt,
    })));
    mocks.listAllMeals.mockResolvedValue({ meals: [makeMeal('activation')], cursor: undefined });
    const service = new NutritionSyncService();

    await expect(service.enableSync()).resolves.toBe('success');

    expect(mocks.listAllMeals).toHaveBeenCalledTimes(1);
    expect(mocks.getMealChanges).not.toHaveBeenCalled();
    expect(mocks.upsertRecord).toHaveBeenCalledTimes(1);
    expect(latestSavedState().lastForegroundAttemptAt).toBe(previousAttemptAt);
  });

  it('preserves the watermark and outstanding delete IDs when deactivated', async () => {
    mocks.getItem.mockResolvedValue(JSON.stringify(storedState({ pendingDeleteIds: ['item-deleted'] })));
    const service = new NutritionSyncService();
    await service.loadState();

    await service.disableSync();

    expect(latestSavedState()).toMatchObject({
      enabled: false,
      userId: 'u1',
      watermark: SINCE,
      pendingDeleteIds: ['item-deleted'],
    });
  });

  it('clears state and refuses writes when the current user differs from the stored user', async () => {
    mocks.getItem.mockResolvedValue(JSON.stringify(storedState({ pendingDeleteIds: ['item-other-user'] })));
    mocks.getUserId.mockResolvedValue('u2');
    const service = new NutritionSyncService();
    await service.loadState();

    await service.syncNutritionUpsert(makeMeal('m-new'));

    expect(mocks.removeItem).toHaveBeenCalledWith('hc:nutrition:sync');
    expect(service.getSyncStatus().enabled).toBe(false);
    expect(mocks.upsertRecord).not.toHaveBeenCalled();
  });

  it('uses the same since, limit, and checkpoint across all delta pages', async () => {
    mocks.getItem.mockResolvedValue(JSON.stringify(storedState()));
    mocks.getMealChanges
      .mockResolvedValueOnce({ meals: [makeMeal('m1')], checkpointAt: CHECKPOINT, cursor: 'next-page' })
      .mockResolvedValueOnce({ meals: [makeMeal('m2', 'item-m2', 'lunch')], checkpointAt: CHECKPOINT });
    const service = new NutritionSyncService();
    await service.loadState();

    await service.syncForeground();

    expect(mocks.getMealChanges).toHaveBeenNthCalledWith(1, SINCE, 50, undefined);
    expect(mocks.getMealChanges).toHaveBeenNthCalledWith(2, SINCE, 50, 'next-page');
    expect(mocks.upsertRecord).toHaveBeenCalledTimes(2);
    expect(service.getSyncStatus().lastSuccessfulSyncAt).toBe(CHECKPOINT);
  });

  it('does not advance the watermark when a page changes checkpoint or a Health Connect write fails', async () => {
    mocks.getItem.mockResolvedValue(JSON.stringify(storedState()));
    mocks.getMealChanges
      .mockResolvedValueOnce({ meals: [makeMeal('m1')], checkpointAt: CHECKPOINT, cursor: 'next-page' })
      .mockResolvedValueOnce({ meals: [makeMeal('m2')], checkpointAt: '2026-10-23T10:01:00.000Z' });
    const service = new NutritionSyncService();
    await service.loadState();

    await service.syncForeground();

    expect(service.getSyncStatus().lastSuccessfulSyncAt).toBe(SINCE);

    mocks.getItem.mockResolvedValue(JSON.stringify(storedState()));
    mocks.getMealChanges.mockResolvedValue({ meals: [makeMeal('m3')], checkpointAt: CHECKPOINT });
    mocks.upsertRecord.mockRejectedValueOnce(new Error('temporary failure'));
    const freshService = new NutritionSyncService();
    await freshService.loadState();
    await freshService.syncForeground();

    expect(freshService.getSyncStatus().lastSuccessfulSyncAt).toBe(SINCE);
  });

  it('checks current permission before every write and disables without advancing on revocation', async () => {
    mocks.getItem.mockResolvedValue(JSON.stringify(storedState()));
    mocks.getMealChanges.mockResolvedValue({
      meals: [makeMeal('m1'), makeMeal('m2', 'item-m2', 'lunch')],
      checkpointAt: CHECKPOINT,
    });
    mocks.hasPermissions.mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const service = new NutritionSyncService();
    await service.loadState();

    await service.syncForeground();

    expect(mocks.hasPermissions).toHaveBeenCalledTimes(3);
    expect(mocks.upsertRecord).toHaveBeenCalledTimes(1);
    expect(service.getSyncStatus()).toMatchObject({ enabled: false, permissionRevoked: true, lastSuccessfulSyncAt: SINCE });
  });

  it('persists failed foreground attempt time before requesting delta and throttles subsequent attempts', async () => {
    const now = new Date('2026-10-23T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    mocks.getItem.mockResolvedValue(JSON.stringify(storedState()));
    mocks.getMealChanges.mockImplementation(async () => {
      const saved = latestSavedState();
      expect(saved.lastForegroundAttemptAt).toBe(now.toISOString());
      expect(Object.keys(saved).sort()).toEqual([
        'enabled', 'lastForegroundAttemptAt', 'pendingDeleteIds', 'userId', 'watermark',
      ]);
      throw new Error('offline');
    });
    const service = new NutritionSyncService();
    await service.loadState();

    await service.syncForeground();

    expect(mocks.getMealChanges).toHaveBeenCalledTimes(1);
    expect(service.getSyncStatus().lastSuccessfulSyncAt).toBe(SINCE);

    mocks.getItem.mockResolvedValue(JSON.stringify(latestSavedState()));
    const restartedService = new NutritionSyncService();
    await restartedService.syncForeground();

    expect(mocks.getMealChanges).toHaveBeenCalledTimes(1);
  });

  it.each([
    { boundary: 'below', elapsedMs: FOREGROUND_INTERVAL_MS - 1, expectedCalls: 0 },
    { boundary: 'at', elapsedMs: FOREGROUND_INTERVAL_MS, expectedCalls: 1 },
    { boundary: 'above', elapsedMs: FOREGROUND_INTERVAL_MS + 1, expectedCalls: 1 },
  ])('applies the persisted foreground throttle $boundary the 15-minute boundary after cold start', async ({ elapsedMs, expectedCalls }) => {
    const now = new Date('2026-10-23T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    mocks.getItem.mockResolvedValue(JSON.stringify(storedState({
      lastForegroundAttemptAt: new Date(now.getTime() - elapsedMs).toISOString(),
    })));
    const service = new NutritionSyncService();

    await service.syncForeground();

    expect(mocks.getMealChanges).toHaveBeenCalledTimes(expectedCalls);
    if (expectedCalls === 0) expect(mocks.setItem).not.toHaveBeenCalled();
    else expect(latestSavedState().lastForegroundAttemptAt).toBe(now.toISOString());
  });

  it('runs manual full export through every full-list page', async () => {
    const now = new Date('2026-10-23T12:00:00.000Z');
    const previousAttemptAt = new Date(now.getTime() - 60_000).toISOString();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    mocks.getItem.mockResolvedValue(JSON.stringify(storedState({ lastForegroundAttemptAt: previousAttemptAt })));
    mocks.listAllMeals
      .mockResolvedValueOnce({ meals: [makeMeal('manual-1')], cursor: 'page-2' })
      .mockResolvedValueOnce({ meals: [makeMeal('manual-2', 'item-manual-2', 'lunch')], cursor: undefined });
    const service = new NutritionSyncService();

    await expect(service.runFullExport()).resolves.toBe(true);

    expect(mocks.getMealChanges).not.toHaveBeenCalled();
    expect(mocks.listAllMeals).toHaveBeenNthCalledWith(1, 50, undefined);
    expect(mocks.listAllMeals).toHaveBeenNthCalledWith(2, 50, 'page-2');
    expect(mocks.upsertRecord).toHaveBeenCalledTimes(2);
    expect(service.getSyncStatus().lastSuccessfulSyncAt).toBe(CHECKPOINT);
    expect(latestSavedState().lastForegroundAttemptAt).toBe(previousAttemptAt);
  });

  it('does not throttle or timestamp diary mutation triggers', async () => {
    const now = new Date('2026-10-23T12:00:00.000Z');
    const previousAttemptAt = new Date(now.getTime() - 60_000).toISOString();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    mocks.getItem.mockResolvedValue(JSON.stringify(storedState({ lastForegroundAttemptAt: previousAttemptAt })));
    const service = new NutritionSyncService();

    await service.syncNutritionUpsert(makeMeal('mutation-upsert'));
    await service.syncNutritionDelete('item-mutation-delete');

    expect(mocks.upsertRecord).toHaveBeenCalledTimes(1);
    expect(mocks.deleteRecord).toHaveBeenCalledWith('Nutrition', 'item-mutation-delete');
    expect(mocks.getMealChanges).not.toHaveBeenCalled();
    expect(latestSavedState().lastForegroundAttemptAt).toBe(previousAttemptAt);
  });

  it('retries failed deletions with IDs only and preserves the account-deletion reset contract', async () => {
    const service = new NutritionSyncService();
    await service.enableSync();
    mocks.deleteRecord.mockRejectedValueOnce(new Error('temporary failure'));

    await service.syncNutritionDelete('item-deleted');

    expect(service.getSyncStatus().pendingDeleteCount).toBe(1);
    const pending = latestSavedState();
    expect(Object.keys(pending).sort()).toEqual(['enabled', 'pendingDeleteIds', 'userId']);
    expect(pending.pendingDeleteIds).toEqual(['item-deleted']);
    expect(JSON.stringify(pending)).not.toContain('Test food');

    mocks.deleteRecord.mockResolvedValue(undefined);
    mocks.getMealChanges.mockResolvedValue({ meals: [], checkpointAt: CHECKPOINT });
    await service.syncForeground();
    expect(mocks.deleteRecord).toHaveBeenCalledWith('Nutrition', 'item-deleted');
    expect(service.getSyncStatus().pendingDeleteCount).toBe(0);

    mocks.upsertRecord.mockClear();
    mocks.deleteRecord.mockClear();
    await service.resetForAccountDeletion();
    expect(mocks.removeItem).toHaveBeenCalledWith('hc:nutrition:sync');
    expect(service.getSyncStatus()).toMatchObject({ enabled: false, permissionRevoked: false, pendingDeleteCount: 0 });
    expect(mocks.upsertRecord).not.toHaveBeenCalled();
    expect(mocks.deleteRecord).not.toHaveBeenCalled();
  });

  it('persists every meal delete ID before permission-denied deletion and disables sync', async () => {
    mocks.getItem.mockResolvedValue(JSON.stringify(storedState()));
    mocks.hasPermissions.mockResolvedValue(false);
    const service = new NutritionSyncService();
    await service.loadState();
    const meal = {
      ...makeMeal('m-delete', 'item-first'),
      items: [makeMeal('m-delete', 'item-first').items[0]!, makeMeal('m-delete', 'item-second').items[0]!],
    };

    await service.syncNutritionDeleteMeal(meal);

    expect(mocks.hasPermissions).toHaveBeenCalledTimes(1);
    expect(mocks.deleteRecord).not.toHaveBeenCalled();
    expect(service.getSyncStatus()).toMatchObject({ enabled: false, permissionRevoked: true, pendingDeleteCount: 2 });
    expect(latestSavedState()).toMatchObject({
      enabled: false,
      userId: 'u1',
      pendingDeleteIds: ['item-first', 'item-second'],
    });
    expect(JSON.stringify(latestSavedState())).not.toContain('Test food');
  });
});
