import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  upsertRecord: vi.fn(),
  deleteRecord: vi.fn(),
  initialize: vi.fn(),
  requestPermissions: vi.fn(),
  hasPermissions: vi.fn(),
  updateHealthSync: vi.fn(),
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  getUserId: vi.fn(),
  getWeightChanges: vi.fn(),
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
vi.mock('../../shared/api/profileApi', () => ({ profileApi: { updateHealthSync: mocks.updateHealthSync } }));
vi.mock('../authService', () => ({ authService: { getAuthenticatedUserId: mocks.getUserId } }));
vi.mock('../weightsService', () => ({ getWeightChanges: mocks.getWeightChanges }));
vi.mock('../../shared/api/diaryApi', () => ({
  diaryApi: { listAllMeals: vi.fn(), getMealChanges: mocks.getMealChanges },
}));

import { HealthSyncService } from './healthSyncService';
import { NutritionSyncService } from './nutritionSyncService';
import type { WeightEntry } from '@fittrack/shared';

const SINCE = '2026-10-23T09:00:00.000Z';
const CHECKPOINT = '2026-10-23T10:00:00.000Z';
const FOREGROUND_INTERVAL_MS = 15 * 60 * 1000;

function makeEntry(id: string, updatedAt = CHECKPOINT): WeightEntry {
  return {
    id,
    userId: 'u1',
    date: '2026-10-23',
    value: 81.2,
    unit: 'kg',
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

describe('healthSyncService delta state', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
    mocks.upsertRecord.mockResolvedValue(undefined);
    mocks.deleteRecord.mockResolvedValue(undefined);
    mocks.initialize.mockResolvedValue(true);
    mocks.requestPermissions.mockResolvedValue(true);
    mocks.hasPermissions.mockResolvedValue(true);
    mocks.updateHealthSync.mockResolvedValue(undefined);
    mocks.getItem.mockResolvedValue(null);
    mocks.setItem.mockResolvedValue(undefined);
    mocks.removeItem.mockResolvedValue(undefined);
    mocks.getUserId.mockResolvedValue('u1');
    mocks.getWeightChanges.mockResolvedValue({ entries: [], checkpointAt: CHECKPOINT });
    mocks.getMealChanges.mockResolvedValue({ meals: [], checkpointAt: CHECKPOINT });
  });

  it('purges a legacy snapshot queue without sending any records', async () => {
    mocks.getItem.mockResolvedValue(JSON.stringify({
      enabled: true,
      permissionRevoked: false,
      pendingOperations: [{ entryId: 'w1', type: 'upsert', entry: makeEntry('w1') }],
    }));
    const service = new HealthSyncService();

    await service.loadState();

    expect(mocks.removeItem).toHaveBeenCalledWith('hc:weight:sync');
    expect(service.getSyncStatus().enabled).toBe(false);
    expect(mocks.initialize).not.toHaveBeenCalled();
    expect(mocks.requestPermissions).not.toHaveBeenCalled();
    expect(mocks.hasPermissions).not.toHaveBeenCalled();
    expect(mocks.upsertRecord).not.toHaveBeenCalled();
    expect(mocks.deleteRecord).not.toHaveBeenCalled();
    expect(mocks.getWeightChanges).not.toHaveBeenCalled();
  });

  it('purges enabled state with a missing stored userId without Health Connect writes', async () => {
    const { userId: _userId, ...stateWithoutUserId } = storedState({ pendingDeleteIds: ['w-stale-user'] });
    mocks.getItem.mockResolvedValue(JSON.stringify(stateWithoutUserId));
    const service = new HealthSyncService();

    await service.syncWeightUpsert(makeEntry('w-new'));

    expect(mocks.removeItem).toHaveBeenCalledWith('hc:weight:sync');
    expect(service.getSyncStatus()).toMatchObject({ enabled: false, permissionRevoked: false, pendingDeleteCount: 0 });
    expect(mocks.initialize).not.toHaveBeenCalled();
    expect(mocks.requestPermissions).not.toHaveBeenCalled();
    expect(mocks.hasPermissions).not.toHaveBeenCalled();
    expect(mocks.upsertRecord).not.toHaveBeenCalled();
    expect(mocks.deleteRecord).not.toHaveBeenCalled();
    expect(mocks.getWeightChanges).not.toHaveBeenCalled();
  });

  it('purges numeric epoch timestamps instead of converting them to ISO', async () => {
    mocks.getItem.mockResolvedValue(JSON.stringify(storedState({
      lastForegroundAttemptAt: Date.parse(CHECKPOINT),
    })));
    const service = new HealthSyncService();

    await service.loadState();

    expect(mocks.removeItem).toHaveBeenCalledWith('hc:weight:sync');
    expect(mocks.setItem).not.toHaveBeenCalled();
    expect(service.getSyncStatus().enabled).toBe(false);
    expect(mocks.getWeightChanges).not.toHaveBeenCalled();
  });

  it('persists only the approved per-datatype fields during activation and full export', async () => {
    const service = new HealthSyncService();

    await expect(service.enableSync([makeEntry('w1')])).resolves.toBe('success');

    const saved = latestSavedState();
    expect(Object.keys(saved).sort()).toEqual(['enabled', 'pendingDeleteIds', 'userId', 'watermark']);
    expect(saved).toMatchObject({ enabled: true, userId: 'u1', pendingDeleteIds: [], watermark: CHECKPOINT });
    expect(JSON.stringify(saved)).not.toContain('81.2');
    expect(mocks.upsertRecord).toHaveBeenCalledTimes(1);
    expect(mocks.hasPermissions).toHaveBeenCalledTimes(2);
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
    const service = new HealthSyncService();

    await expect(service.enableSync([makeEntry('w-activation')])).resolves.toBe('success');

    expect(mocks.upsertRecord).toHaveBeenCalledTimes(1);
    expect(mocks.getWeightChanges).not.toHaveBeenCalled();
    expect(latestSavedState().lastForegroundAttemptAt).toBe(previousAttemptAt);
  });

  it('preserves the watermark and delete IDs when deactivated', async () => {
    const state = storedState({ pendingDeleteIds: ['w-deleted'] });
    mocks.getItem.mockResolvedValue(JSON.stringify(state));
    const service = new HealthSyncService();
    await service.loadState();

    await service.disableSync();

    expect(latestSavedState()).toMatchObject({
      enabled: false,
      userId: 'u1',
      watermark: SINCE,
      pendingDeleteIds: ['w-deleted'],
    });
  });

  it('discards state and performs no write when the authenticated user changes', async () => {
    mocks.getItem.mockResolvedValue(JSON.stringify(storedState({ pendingDeleteIds: ['w-old-user'] })));
    mocks.getUserId.mockResolvedValue('u2');
    const service = new HealthSyncService();
    await service.loadState();

    await service.syncWeightUpsert(makeEntry('w2'));

    expect(mocks.removeItem).toHaveBeenCalledWith('hc:weight:sync');
    expect(service.getSyncStatus().enabled).toBe(false);
    expect(mocks.upsertRecord).not.toHaveBeenCalled();
    expect(mocks.deleteRecord).not.toHaveBeenCalled();
  });

  it('checks current permission before every delta write and leaves the watermark unchanged on denial', async () => {
    mocks.getItem.mockResolvedValue(JSON.stringify(storedState()));
    mocks.getWeightChanges.mockResolvedValue({
      entries: [makeEntry('w1'), makeEntry('w2')],
      checkpointAt: CHECKPOINT,
    });
    mocks.hasPermissions.mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const service = new HealthSyncService();
    await service.loadState();

    await service.syncForeground();

    expect(mocks.hasPermissions).toHaveBeenCalledTimes(3);
    expect(mocks.upsertRecord).toHaveBeenCalledTimes(1);
    expect(service.getSyncStatus()).toMatchObject({ enabled: false, permissionRevoked: true, lastSuccessfulSyncAt: SINCE });
  });

  it('persists a failed foreground attempt before requesting changes and counts it toward the throttle', async () => {
    const now = new Date('2026-10-23T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    mocks.getItem.mockResolvedValue(JSON.stringify(storedState()));
    mocks.getWeightChanges.mockImplementation(async () => {
      const saved = latestSavedState();
      expect(saved.lastForegroundAttemptAt).toBe(now.toISOString());
      expect(Object.keys(saved).sort()).toEqual([
        'enabled', 'lastForegroundAttemptAt', 'pendingDeleteIds', 'userId', 'watermark',
      ]);
      throw new Error('offline');
    });
    const service = new HealthSyncService();
    await service.loadState();

    await service.syncForeground();

    expect(service.getSyncStatus().lastSuccessfulSyncAt).toBe(SINCE);
    expect(mocks.getWeightChanges).toHaveBeenCalledTimes(1);

    mocks.getItem.mockResolvedValue(JSON.stringify(latestSavedState()));
    const restartedService = new HealthSyncService();
    await restartedService.syncForeground();

    expect(mocks.getWeightChanges).toHaveBeenCalledTimes(1);
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
    const service = new HealthSyncService();

    await service.syncForeground();

    expect(mocks.getWeightChanges).toHaveBeenCalledTimes(expectedCalls);
    if (expectedCalls === 0) expect(mocks.setItem).not.toHaveBeenCalled();
    else expect(latestSavedState().lastForegroundAttemptAt).toBe(now.toISOString());
  });

  it('throttles weight and nutrition independently using their separate persisted keys', async () => {
    const now = new Date('2026-10-23T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const persisted = new Map<string, string>([
      ['hc:weight:sync', JSON.stringify(storedState({
        lastForegroundAttemptAt: new Date(now.getTime() - 60_000).toISOString(),
      }))],
      ['hc:nutrition:sync', JSON.stringify(storedState({
        lastForegroundAttemptAt: new Date(now.getTime() - FOREGROUND_INTERVAL_MS).toISOString(),
      }))],
    ]);
    mocks.getItem.mockImplementation(async (key: string) => persisted.get(key) ?? null);
    mocks.setItem.mockImplementation(async (key: string, value: string) => { persisted.set(key, value); });

    await Promise.all([
      new HealthSyncService().syncForeground(),
      new NutritionSyncService().syncForeground(),
    ]);

    expect(mocks.getWeightChanges).not.toHaveBeenCalled();
    expect(mocks.getMealChanges).toHaveBeenCalledTimes(1);

    persisted.set('hc:weight:sync', JSON.stringify(storedState({
      lastForegroundAttemptAt: new Date(now.getTime() - FOREGROUND_INTERVAL_MS - 1).toISOString(),
    })));
    persisted.set('hc:nutrition:sync', JSON.stringify(storedState({
      lastForegroundAttemptAt: new Date(now.getTime() - 60_000).toISOString(),
    })));
    await Promise.all([
      new HealthSyncService().syncForeground(),
      new NutritionSyncService().syncForeground(),
    ]);

    expect(mocks.getWeightChanges).toHaveBeenCalledTimes(1);
    expect(mocks.getMealChanges).toHaveBeenCalledTimes(1);
  });

  it('denies a pending delete without calling Health Connect and retains its ID', async () => {
    mocks.getItem.mockResolvedValue(JSON.stringify(storedState()));
    mocks.hasPermissions.mockResolvedValue(false);
    const service = new HealthSyncService();

    await service.syncWeightDelete('w-deleted');

    expect(mocks.hasPermissions).toHaveBeenCalledTimes(1);
    expect(mocks.deleteRecord).not.toHaveBeenCalled();
    expect(service.getSyncStatus()).toMatchObject({ enabled: false, permissionRevoked: true, pendingDeleteCount: 1 });
    expect(latestSavedState()).toMatchObject({ enabled: false, userId: 'u1', pendingDeleteIds: ['w-deleted'] });
  });

  it('runs manual full export from the supplied complete weight list', async () => {
    const now = new Date('2026-10-23T12:00:00.000Z');
    const previousAttemptAt = new Date(now.getTime() - 60_000).toISOString();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    mocks.getItem.mockResolvedValue(JSON.stringify(storedState({ lastForegroundAttemptAt: previousAttemptAt })));
    const entries = [makeEntry('w-manual-1'), makeEntry('w-manual-2', '2026-10-23T10:30:00.000Z')];
    const service = new HealthSyncService();

    await expect(service.runFullExport(entries)).resolves.toBe(true);

    expect(mocks.getWeightChanges).not.toHaveBeenCalled();
    expect(mocks.upsertRecord).toHaveBeenCalledTimes(2);
    expect(mocks.upsertRecord.mock.calls.map(([record]) => record.metadata.clientRecordId))
      .toEqual(['w-manual-1', 'w-manual-2']);
    expect(service.getSyncStatus().lastSuccessfulSyncAt).toBe('2026-10-23T10:30:00.000Z');
    expect(latestSavedState().lastForegroundAttemptAt).toBe(previousAttemptAt);
  });

  it('does not throttle or timestamp weight mutation triggers', async () => {
    const now = new Date('2026-10-23T12:00:00.000Z');
    const previousAttemptAt = new Date(now.getTime() - 60_000).toISOString();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    mocks.getItem.mockResolvedValue(JSON.stringify(storedState({ lastForegroundAttemptAt: previousAttemptAt })));
    const service = new HealthSyncService();

    await service.syncWeightUpsert(makeEntry('w-mutation'));
    await service.syncWeightDelete('w-deleted');

    expect(mocks.upsertRecord).toHaveBeenCalledTimes(1);
    expect(mocks.deleteRecord).toHaveBeenCalledWith('Weight', 'w-deleted');
    expect(mocks.getWeightChanges).not.toHaveBeenCalled();
    expect(latestSavedState().lastForegroundAttemptAt).toBe(previousAttemptAt);
  });

  it('retries failed deletes using only their IDs and removes them after success', async () => {
    const service = new HealthSyncService();
    await service.enableSync([]);
    mocks.deleteRecord.mockRejectedValueOnce(new Error('temporary failure'));

    await service.syncWeightDelete('w-deleted');

    expect(service.getSyncStatus().pendingDeleteCount).toBe(1);
    const pending = latestSavedState();
    expect(Object.keys(pending).sort()).toEqual(['enabled', 'pendingDeleteIds', 'userId']);
    expect(pending.pendingDeleteIds).toEqual(['w-deleted']);
    expect(JSON.stringify(pending)).not.toContain('value');

    mocks.deleteRecord.mockResolvedValue(undefined);
    await service.syncForeground();

    expect(mocks.deleteRecord).toHaveBeenCalledWith('Weight', 'w-deleted');
    expect(service.getSyncStatus().pendingDeleteCount).toBe(0);
  });

  it('keeps the account-deletion reset contract and never touches Health Connect', async () => {
    const service = new HealthSyncService();
    await service.enableSync([makeEntry('w1')]);
    mocks.upsertRecord.mockClear();
    mocks.deleteRecord.mockClear();

    await service.resetForAccountDeletion();

    expect(mocks.removeItem).toHaveBeenCalledWith('hc:weight:sync');
    expect(service.getSyncStatus()).toMatchObject({ enabled: false, permissionRevoked: false, pendingDeleteCount: 0 });
    expect(mocks.upsertRecord).not.toHaveBeenCalled();
    expect(mocks.deleteRecord).not.toHaveBeenCalled();
  });
});
