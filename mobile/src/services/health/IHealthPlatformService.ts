// Health platform service abstraction — generisch für iOS-Erweiterung via HealthKit.

export interface HealthConnectAvailability {
  status: 'available' | 'not_available' | 'update_required' | 'error';
  message?: string;
}

export interface HealthPermission {
  accessType: 'read' | 'write';
  recordType: string;
}

export type HealthRecordType = 'Weight' | 'Nutrition';

export interface NutritionHealthRecord {
  recordType: 'Nutrition';
  metadata: {
    clientRecordId: string;
    clientRecordVersion: number;
  };
  startTime: string;
  endTime: string;
  startZoneOffset?: string;
  endZoneOffset?: string;
  name?: string;
  mealType?: number;
  energy?: { value: number; unit: 'kilocalories' };
  protein?: { value: number; unit: 'grams' };
  totalCarbohydrate?: { value: number; unit: 'grams' };
  totalFat?: { value: number; unit: 'grams' };
  dietaryFiber?: { value: number; unit: 'grams' };
}

export interface WeightHealthRecord {
  recordType: 'Weight';
  metadata: {
    clientRecordId: string;
    clientRecordVersion: number;
  };
  time: string;
  weight: {
    value: number;
    unit: 'kilograms';
  };
}

export type HealthRecord = WeightHealthRecord | NutritionHealthRecord;

export interface ReadOptions {
  timeRangeFilter?: {
    operator: 'between' | 'before' | 'after';
    startTime?: string;
    endTime?: string;
  };
}

export interface IHealthPlatformService {
  getAvailability(): Promise<HealthConnectAvailability>;
  initialize(): Promise<boolean>;
  requestPermissions(permissions: HealthPermission[]): Promise<boolean>;
  hasPermissions(permissions: HealthPermission[]): Promise<boolean>;
  upsertRecord(record: HealthRecord): Promise<void>;
  deleteRecord(recordType: HealthRecordType, clientId: string): Promise<void>;
  readRecords(recordType: HealthRecordType, options: ReadOptions): Promise<HealthRecord[]>;
}
