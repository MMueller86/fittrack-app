// Mock implementation — used in development builds (EXPO_PUBLIC_APP_VARIANT=development).
// Never writes to real Health Connect.

import type {
  IHealthPlatformService,
  HealthConnectAvailability,
  HealthPermission,
  HealthRecord,
  HealthRecordType,
  ReadOptions,
} from './IHealthPlatformService';
import { syncLogger } from './syncLogger';

export class MockHealthPlatformService implements IHealthPlatformService {
  private simulatedAvailability: HealthConnectAvailability = { status: 'available' };
  private permissionsGranted = false;

  /** Dev-only: switch the simulated availability state for UI testing. */
  setSimulatedAvailability(availability: HealthConnectAvailability): void {
    this.simulatedAvailability = availability;
  }

  async getAvailability(): Promise<HealthConnectAvailability> {
    return this.simulatedAvailability;
  }

  async initialize(): Promise<boolean> {
    return true;
  }

  async requestPermissions(_permissions: HealthPermission[]): Promise<boolean> {
    this.permissionsGranted = true;
    return true;
  }

  async hasPermissions(_permissions: HealthPermission[]): Promise<boolean> {
    return this.permissionsGranted;
  }

  async upsertRecord(record: HealthRecord): Promise<void> {
    syncLogger.warn('MockHC', `upsertRecord ${record.recordType} id=${record.metadata.clientRecordId}`);
  }

  async deleteRecord(recordType: HealthRecordType, clientId: string): Promise<void> {
    syncLogger.warn('MockHC', `deleteRecord ${recordType} id=${clientId}`);
  }

  async readRecords(_recordType: HealthRecordType, _options: ReadOptions): Promise<HealthRecord[]> {
    return [];
  }
}
