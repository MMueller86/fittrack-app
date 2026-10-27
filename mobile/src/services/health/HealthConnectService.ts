// Android Health Connect implementation — wraps react-native-health-connect.
// This module is only require()'d on Android non-dev builds via healthPlatformService.ts.

import type {
  IHealthPlatformService,
  HealthConnectAvailability,
  HealthPermission,
  HealthRecord,
  HealthRecordType,
  ReadOptions,
} from './IHealthPlatformService';
import { syncLogger } from './syncLogger';

type HealthConnectModule = typeof import('react-native-health-connect');

const hc = require('react-native-health-connect') as HealthConnectModule;
const { SDK_AVAILABLE, SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED } = hc.SdkAvailabilityStatus;

export class HealthConnectService implements IHealthPlatformService {
  async getAvailability(): Promise<HealthConnectAvailability> {
    try {
      const status = await hc.getSdkStatus();
      if (status === SDK_AVAILABLE) return { status: 'available' };
      if (status === SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return { status: 'update_required' };
      return { status: 'not_available' };
    } catch (e) {
      return { status: 'error', message: String(e) };
    }
  }

  async initialize(): Promise<boolean> {
    return hc.initialize();
  }

  async requestPermissions(permissions: HealthPermission[]): Promise<boolean> {
    const granted = await hc.requestPermission(permissions);
    return granted.length > 0;
  }

  async hasPermissions(permissions: HealthPermission[]): Promise<boolean> {
    const granted = await hc.getGrantedPermissions();
    return permissions.every((p) =>
      granted.some((g) => g.accessType === p.accessType && g.recordType === p.recordType),
    );
  }

  async upsertRecord(record: HealthRecord): Promise<void> {
    syncLogger.info('HealthConnectService', `insertRecords ${record.recordType}`);
    await hc.insertRecords([record]);
    syncLogger.info('HealthConnectService', `insertRecords OK ${record.recordType}`);
  }

  async deleteRecord(recordType: HealthRecordType, clientId: string): Promise<void> {
    syncLogger.info('HealthConnectService', `deleteRecord ${recordType}`);
    await hc.deleteRecordsByUuids(recordType, [], [clientId]);
    syncLogger.info('HealthConnectService', `deleteRecord OK ${recordType}`);
  }

  async readRecords(_recordType: HealthRecordType, _options: ReadOptions): Promise<HealthRecord[]> {
    return [];
  }
}
