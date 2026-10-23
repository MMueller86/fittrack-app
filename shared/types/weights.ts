// Weight tracking types — stub
// Will be populated in M3 (Weight Tracking milestone)

export type WeightUnit = 'kg' | 'lbs';

export interface WeightEntry {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  value: number;
  unit: WeightUnit;
  createdAt: string;
  /** Last persisted change; absent on legacy documents until they are updated. */
  updatedAt?: string;
}

export interface WeightChangesResponse {
  entries: WeightEntry[];
  checkpointAt: string;
}
