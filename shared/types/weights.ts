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
}
