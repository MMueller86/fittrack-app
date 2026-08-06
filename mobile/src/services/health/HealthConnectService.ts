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

// Typed surface of react-native-health-connect that this service uses.
type HCLib = {
  getSdkStatus: () => Promise<number>;
  initialize: () => Promise<boolean>;
  requestPermission: (
    permissions: { accessType: string; recordType: string }[],
  ) => Promise<{ accessType: string; recordType: string }[]>;
  getGrantedPermissions: () => Promise<{ accessType: string; recordType: string }[]>;
  insertRecords: (records: object[]) => Promise<string[]>; // v4: still insertRecords, Mass type changed to { value, unit }
  deleteRecordsByUuids: (
    recordType: string,
    recordIdsList: string[],
    clientRecordIdsList: string[],
  ) => Promise<void>;
  SdkAvailabilityStatus: {
    SDK_AVAILABLE: number;
    SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: number;
    SDK_UNAVAILABLE: number;
  };
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const hc = require('react-native-health-connect') as HCLib;
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
    syncLogger.info('HealthConnectService', `insertRecords ${record.recordType} id=${record.metadata.clientRecordId}`);
    await hc.insertRecords([record]);
    syncLogger.info('HealthConnectService', `insertRecords OK id=${record.metadata.clientRecordId}`);
  }

  async deleteRecord(recordType: HealthRecordType, clientId: string): Promise<void> {
    syncLogger.info('HealthConnectService', `deleteRecord ${recordType} id=${clientId}`);
    await hc.deleteRecordsByUuids(recordType, [], [clientId]);
    syncLogger.info('HealthConnectService', `deleteRecord OK id=${clientId}`);
  }

  async readRecords(_recordType: HealthRecordType, _options: ReadOptions): Promise<HealthRecord[]> {
    return [];
  }
}
