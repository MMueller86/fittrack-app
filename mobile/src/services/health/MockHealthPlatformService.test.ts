import { describe, it, expect, beforeEach } from 'vitest';
import { MockHealthPlatformService } from './MockHealthPlatformService';

describe('MockHealthPlatformService', () => {
  let service: MockHealthPlatformService;

  beforeEach(() => {
    service = new MockHealthPlatformService();
  });

  describe('getAvailability', () => {
    it('returns available by default', async () => {
      const result = await service.getAvailability();
      expect(result.status).toBe('available');
    });

    it('returns not_available after setSimulatedAvailability', async () => {
      service.setSimulatedAvailability({ status: 'not_available' });
      const result = await service.getAvailability();
      expect(result.status).toBe('not_available');
    });

    it('returns update_required', async () => {
      service.setSimulatedAvailability({ status: 'update_required' });
      const result = await service.getAvailability();
      expect(result.status).toBe('update_required');
    });

    it('returns error with message', async () => {
      service.setSimulatedAvailability({ status: 'error', message: 'SDK missing' });
      const result = await service.getAvailability();
      expect(result.status).toBe('error');
      expect(result.message).toBe('SDK missing');
    });
  });

  describe('permissions', () => {
    it('hasPermissions returns false initially', async () => {
      const result = await service.hasPermissions([{ accessType: 'write', recordType: 'Weight' }]);
      expect(result).toBe(false);
    });

    it('requestPermissions always returns true and grants permissions', async () => {
      const granted = await service.requestPermissions([{ accessType: 'write', recordType: 'Weight' }]);
      expect(granted).toBe(true);
      const has = await service.hasPermissions([{ accessType: 'write', recordType: 'Weight' }]);
      expect(has).toBe(true);
    });
  });

  describe('record operations', () => {
    it('upsertRecord does not throw', async () => {
      await expect(
        service.upsertRecord({
          recordType: 'Weight',
          metadata: { clientRecordId: 'id-1', clientRecordVersion: 1 },
          time: '2026-08-01T10:00:00Z',
          weight: { value: 80, unit: 'kilograms' as const },
        }),
      ).resolves.toBeUndefined();
    });

    it('deleteRecord does not throw', async () => {
      await expect(service.deleteRecord('Weight', 'id-1')).resolves.toBeUndefined();
    });

    it('readRecords returns empty array', async () => {
      const result = await service.readRecords('Weight', {});
      expect(result).toEqual([]);
    });
  });

  describe('initialize', () => {
    it('returns true', async () => {
      const result = await service.initialize();
      expect(result).toBe(true);
    });
  });
});
