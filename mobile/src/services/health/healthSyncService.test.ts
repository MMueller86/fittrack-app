import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted ensures these are available when vi.mock factories run.
// ---------------------------------------------------------------------------

const {
  mockUpsertRecord,
  mockDeleteRecord,
  mockInitialize,
  mockRequestPermissions,
  mockUpdateHealthSync,
  mockAsyncStorageGetItem,
  mockAsyncStorageSetItem,
} = vi.hoisted(() => ({
  mockUpsertRecord: vi.fn(),
  mockDeleteRecord: vi.fn(),
  mockInitialize: vi.fn().mockResolvedValue(true),
  mockRequestPermissions: vi.fn().mockResolvedValue(true),
  mockUpdateHealthSync: vi.fn().mockResolvedValue(undefined),
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

vi.mock('../../shared/api/profileApi', () => ({
  profileApi: {
    updateHealthSync: mockUpdateHealthSync,
  },
}));

// ---------------------------------------------------------------------------
// Import HealthSyncService class (not the singleton) for fresh instances.
// ---------------------------------------------------------------------------

import { HealthSyncService } from './healthSyncService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(id: string, value = 80, unit: 'kg' | 'lbs' = 'kg') {
  return {
    id,
    userId: 'u1',
    date: '2026-08-01',
    value,
    unit,
    createdAt: '2026-08-01T10:00:00Z',
  };
}

function makeFreshService() {
  return new HealthSyncService();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('healthSyncService', () => {
  let service: HealthSyncService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsertRecord.mockResolvedValue(undefined);
    mockDeleteRecord.mockResolvedValue(undefined);
    mockRequestPermissions.mockResolvedValue(true);
    mockInitialize.mockResolvedValue(true);
    mockAsyncStorageGetItem.mockResolvedValue(null);
    mockAsyncStorageSetItem.mockResolvedValue(undefined);
    service = makeFreshService();
  });

  describe('enableSync', () => {
    it('calls runFullExport for all provided entries', async () => {
      const entries = [makeEntry('e1'), makeEntry('e2')];
      await service.enableSync(entries);
      expect(mockUpsertRecord).toHaveBeenCalledTimes(2);
    });

    it('returns success when permissions granted', async () => {
      const result = await service.enableSync([]);
      expect(result).toBe('success');
    });

    it('returns permission_denied when permissions refused', async () => {
      mockRequestPermissions.mockResolvedValueOnce(false);
      const result = await service.enableSync([]);
      expect(result).toBe('permission_denied');
      expect(mockUpsertRecord).not.toHaveBeenCalled();
    });

    it('fires profileApi.updateHealthSync(true) as fire-and-forget', async () => {
      await service.enableSync([]);
      await Promise.resolve();
      expect(mockUpdateHealthSync).toHaveBeenCalledWith(true);
    });
  });

  describe('disableSync', () => {
    it('sets enabled to false', async () => {
      await service.enableSync([]);
      await service.disableSync();
      const status = service.getSyncStatus();
      expect(status.enabled).toBe(false);
    });

    it('fires profileApi.updateHealthSync(false)', async () => {
      await service.enableSync([]);
      await service.disableSync();
      await Promise.resolve();
      expect(mockUpdateHealthSync).toHaveBeenCalledWith(false);
    });
  });

  describe('syncWeightUpsert', () => {
    it('does nothing when sync is disabled', async () => {
      await service.syncWeightUpsert(makeEntry('e1'));
      expect(mockUpsertRecord).not.toHaveBeenCalled();
    });

    it('calls upsertRecord when enabled', async () => {
      await service.enableSync([]);
      mockUpsertRecord.mockClear();
      await service.syncWeightUpsert(makeEntry('e1'));
      expect(mockUpsertRecord).toHaveBeenCalledTimes(1);
    });

    it('queues a pendingOp on upsert failure, retried on drain', async () => {
      await service.enableSync([]);
      mockUpsertRecord.mockRejectedValueOnce(new Error('IO error'));
      await service.syncWeightUpsert(makeEntry('e1'));
      mockUpsertRecord.mockResolvedValue(undefined);
      await service.drainPendingQueue();
      // The drain retried the op (proves it was queued)
      expect(mockUpsertRecord.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('drainPendingQueue', () => {
    it('disables sync on permission error during drain', async () => {
      await service.enableSync([]);
      mockUpsertRecord.mockRejectedValueOnce(new Error('IO error'));
      await service.syncWeightUpsert(makeEntry('e1'));
      mockUpsertRecord.mockRejectedValueOnce(new Error('PERMISSION_DENIED'));
      await service.drainPendingQueue();
      const status = service.getSyncStatus();
      expect(status.enabled).toBe(false);
      expect(status.permissionRevoked).toBe(true);
    });

    it('marks op as permanent after retryCount>=10 and sessionCount>=2', async () => {
      const storedState = JSON.stringify({
        enabled: true,
        permissionRevoked: false,
        pendingOperations: [
          {
            entryId: 'e-perm',
            type: 'upsert',
            entry: makeEntry('e-perm'),
            retryCount: 9,
            sessionCount: 1,
            errorType: 'temporary',
          },
        ],
      });
      mockAsyncStorageGetItem.mockResolvedValue(storedState);
      const freshService = makeFreshService();

      mockUpsertRecord.mockRejectedValue(new Error('IO error'));
      // First drain: increments sessionCount 1→2, retry fails → retryCount 9→10, sessionCount=2 → permanent
      await freshService.drainPendingQueue();

      const status = freshService.getSyncStatus();
      expect(status.permanentFailures.length).toBe(1);
    });

    it('does not mark op as permanent when sessionCount < 2', async () => {
      const storedState = JSON.stringify({
        enabled: true,
        permissionRevoked: false,
        pendingOperations: [
          {
            entryId: 'e-temp',
            type: 'upsert',
            entry: makeEntry('e-temp'),
            retryCount: 9,
            sessionCount: 0,
            errorType: 'temporary',
          },
        ],
      });
      mockAsyncStorageGetItem.mockResolvedValue(storedState);
      const freshService = makeFreshService();

      mockUpsertRecord.mockRejectedValue(new Error('IO error'));
      // sessionCount 0→1, retry → retryCount 9→10 but sessionCount=1 < 2 → not permanent
      await freshService.drainPendingQueue();

      const status = freshService.getSyncStatus();
      expect(status.permanentFailures.length).toBe(0);
    });
  });

  describe('kg/lbs conversion', () => {
    it('converts lbs to kg when upserting', async () => {
      await service.enableSync([]);
      mockUpsertRecord.mockClear();
      await service.syncWeightUpsert(makeEntry('e1', 176, 'lbs'));
      const record = mockUpsertRecord.mock.calls[0][0];
      expect(record.weight.value).toBeCloseTo(176 * 0.453592, 3);
      expect(record.weight.unit).toBe('kilograms');
    });

    it('passes kg value unchanged', async () => {
      await service.enableSync([]);
      mockUpsertRecord.mockClear();
      await service.syncWeightUpsert(makeEntry('e1', 80, 'kg'));
      const record = mockUpsertRecord.mock.calls[0][0];
      expect(record.weight.value).toBe(80);
      expect(record.weight.unit).toBe('kilograms');
    });
  });

  describe('WeightRecord structure', () => {
    it('includes all required fields with correct types', async () => {
      await service.enableSync([]);
      mockUpsertRecord.mockClear();
      const entry = makeEntry('my-uuid');
      await service.syncWeightUpsert(entry);
      const record = mockUpsertRecord.mock.calls[0][0];
      expect(record.recordType).toBe('Weight');
      expect(record.metadata.clientRecordId).toBe('my-uuid');
      expect(typeof record.metadata.clientRecordVersion).toBe('number');
      const [y, m, d] = entry.date.split('-').map(Number);
      expect(record.time).toBe(new Date(y, m - 1, d, 12, 0, 0, 0).toISOString());
      expect(record.weight.value).toBe(80);
      expect(record.weight.unit).toBe('kilograms');
    });
  });

  describe('idempotency', () => {
    it('uses the same clientRecordId for the same entry across multiple syncs', async () => {
      await service.enableSync([]);
      mockUpsertRecord.mockClear();
      const entry = makeEntry('e-idempotent', 80, 'kg');
      await service.syncWeightUpsert(entry);
      await service.syncWeightUpsert(entry);
      const ids = mockUpsertRecord.mock.calls.map((c) => c[0].metadata.clientRecordId);
      expect(ids).toEqual(['e-idempotent', 'e-idempotent']);
    });

    it('runFullExport with same entries produces same clientRecordIds', async () => {
      const entries = [makeEntry('e1'), makeEntry('e2')];
      await service.enableSync(entries);
      mockUpsertRecord.mockClear();
      await service.runFullExport(entries);
      const ids = mockUpsertRecord.mock.calls.map((c) => c[0].metadata.clientRecordId);
      expect(ids).toEqual(['e1', 'e2']);
    });
  });

  describe('deleteRecord', () => {
    it('calls healthPlatformService.deleteRecord with clientId', async () => {
      await service.enableSync([]);
      await service.syncWeightDelete('delete-id');
      expect(mockDeleteRecord).toHaveBeenCalledWith('Weight', 'delete-id');
    });

    it('queues a pending delete op on failure and retries on drain', async () => {
      await service.enableSync([]);
      mockDeleteRecord.mockRejectedValueOnce(new Error('IO error'));
      await service.syncWeightDelete('del-fail');
      mockDeleteRecord.mockResolvedValue(undefined);
      await service.drainPendingQueue();
      const calls = mockDeleteRecord.mock.calls.filter((c) => c[1] === 'del-fail');
      expect(calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('loadState()', () => {
    it('loads persisted state — getSyncStatus() returns non-default enabled value', async () => {
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

  describe('getSyncStatus() temporaryFailures', () => {
    it('includes temporary failures after a failed upsert', async () => {
      await service.enableSync([]);
      mockUpsertRecord.mockRejectedValueOnce(new Error('Network error'));
      await service.syncWeightUpsert(makeEntry('e1'));
      const status = service.getSyncStatus();
      expect(status.temporaryFailures.length).toBe(1);
      expect(status.temporaryFailures[0].entryId).toBe('e1');
    });

    it('does not include successful ops in temporaryFailures', async () => {
      await service.enableSync([]);
      await service.syncWeightUpsert(makeEntry('e1'));
      const status = service.getSyncStatus();
      expect(status.temporaryFailures.length).toBe(0);
    });
  });

  describe('errorMessage on PendingOp', () => {
    it('sets errorMessage after a caught upsert error', async () => {
      await service.enableSync([]);
      mockUpsertRecord.mockRejectedValueOnce(new Error('Disk full'));
      await service.syncWeightUpsert(makeEntry('e1'));
      const status = service.getSyncStatus();
      expect(status.temporaryFailures[0].errorMessage).toBeTruthy();
      expect(status.temporaryFailures[0].errorMessage).toBe('Disk full');
    });

    it('errorMessage survives a load() round-trip (persisted)', async () => {
      let persisted: string | null = null;
      mockAsyncStorageSetItem.mockImplementation((_key: string, val: string) => {
        persisted = val;
        return Promise.resolve();
      });
      await service.enableSync([]);
      mockUpsertRecord.mockRejectedValueOnce(new Error('Disk full'));
      await service.syncWeightUpsert(makeEntry('e1'));

      mockAsyncStorageGetItem.mockResolvedValue(persisted);
      const fresh = makeFreshService();
      await fresh.loadState();
      const status = fresh.getSyncStatus();
      expect(status.temporaryFailures[0].errorMessage).toBe('Disk full');
    });

    it('non-Error throw → errorMessage equals the thrown string', async () => {
      await service.enableSync([]);
      mockUpsertRecord.mockRejectedValueOnce('plain string');
      await service.syncWeightUpsert(makeEntry('e1'));
      const status = service.getSyncStatus();
      expect(status.temporaryFailures[0].errorMessage).toBe('plain string');
    });
  });

  describe('errorStack in-memory only', () => {
    it('errorStack present in getSyncStatus() after a failure', async () => {
      await service.enableSync([]);
      const err = new Error('Stack error');
      err.stack = 'Error: Stack error\n  at test:1:1';
      mockUpsertRecord.mockRejectedValueOnce(err);
      await service.syncWeightUpsert(makeEntry('e1'));
      const status = service.getSyncStatus();
      expect(status.temporaryFailures[0].errorStack).toBeTruthy();
    });

    it('errorStack survives a load() round-trip (persisted)', async () => {
      let persisted: string | null = null;
      mockAsyncStorageSetItem.mockImplementation((_key: string, val: string) => {
        persisted = val;
        return Promise.resolve();
      });
      await service.enableSync([]);
      const err = new Error('Stack error');
      err.stack = 'Error: Stack error\n  at test:1:1';
      mockUpsertRecord.mockRejectedValueOnce(err);
      await service.syncWeightUpsert(makeEntry('e1'));

      mockAsyncStorageGetItem.mockResolvedValue(persisted);
      const fresh = makeFreshService();
      await fresh.loadState();
      const status = fresh.getSyncStatus();
      expect(status.temporaryFailures[0].errorMessage).toBeTruthy();
      expect(status.temporaryFailures[0].errorStack).toBeTruthy();
    });

    it('errorStack is persisted and survives a fresh load', async () => {
      let persisted: string | null = null;
      mockAsyncStorageSetItem.mockImplementation((_key: string, val: string) => {
        persisted = val;
        return Promise.resolve();
      });
      await service.enableSync([]);
      const err = new Error('Stack error');
      err.stack = 'Error: Stack error\n  at test:1:1';
      mockUpsertRecord.mockRejectedValueOnce(err);
      await service.syncWeightUpsert(makeEntry('e1'));

      mockAsyncStorageGetItem.mockResolvedValue(persisted);
      const fresh = makeFreshService();
      await fresh.loadState();
      const status = fresh.getSyncStatus();
      expect(status.temporaryFailures[0].errorStack).toBeTruthy();
    });
  });

  describe('drainPendingQueue calls initialize()', () => {
    it('calls initialize() before draining', async () => {
      await service.enableSync([]);
      mockUpsertRecord.mockRejectedValueOnce(new Error('IO error'));
      // add a pending op
      await service.syncWeightUpsert(makeEntry('e1'));
      mockInitialize.mockClear();
      await service.drainPendingQueue();
      expect(mockInitialize).toHaveBeenCalled();
    });

    it('calls initialize() in syncWeightUpsert', async () => {
      await service.enableSync([]);
      mockInitialize.mockClear();
      await service.syncWeightUpsert(makeEntry('e1'));
      expect(mockInitialize).toHaveBeenCalled();
    });
  });

  describe('runFullExport resets retry state', () => {
    it('clears all pending ops before export', async () => {
      const persisted = JSON.stringify({
        enabled: true,
        permissionRevoked: false,
        lastFullExportAt: undefined,
        pendingOperations: [{
          entryId: 'old', type: 'upsert', retryCount: 10, sessionCount: 2,
          errorType: 'permanent', errorMessage: 'old error',
        }],
      });
      mockAsyncStorageGetItem.mockResolvedValue(persisted);
      const fresh = makeFreshService();
      await fresh.loadState();

      await fresh.runFullExport([]);
      const status = fresh.getSyncStatus();
      expect(status.permanentFailures).toHaveLength(0);
      expect(status.temporaryFailures).toHaveLength(0);
    });

    it('after runFullExport failure, entry has retryCount 0 (not immediately permanent)', async () => {
      const persisted = JSON.stringify({
        enabled: true,
        permissionRevoked: false,
        pendingOperations: [{
          entryId: 'e1', type: 'upsert', retryCount: 10, sessionCount: 2,
          errorType: 'permanent', errorMessage: 'old error',
        }],
      });
      mockAsyncStorageGetItem.mockResolvedValue(persisted);
      const fresh = makeFreshService();
      await fresh.loadState();

      mockUpsertRecord.mockRejectedValueOnce(new Error('HC error'));
      await fresh.runFullExport([makeEntry('e1')]);

      const status = fresh.getSyncStatus();
      expect(status.permanentFailures).toHaveLength(0);
      expect(status.temporaryFailures).toHaveLength(1);
      expect(status.temporaryFailures[0].retryCount).toBe(0);
      expect(status.temporaryFailures[0].errorMessage).toBe('HC error');
    });
  });
});

