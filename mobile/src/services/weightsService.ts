// Weights service — wraps the /api/weights endpoints.
// During M2 the apiClient will start attaching the JWT Bearer token; no
// changes here are needed because we already go through apiClient.

import { apiClient } from '../shared/api/client';
import type { WeightEntry, WeightUnit } from '@fittrack/shared';

interface ListWeightsResponse {
  entries: WeightEntry[];
}

export async function listWeights(): Promise<WeightEntry[]> {
  const { data } = await apiClient.get<ListWeightsResponse>('/weights');
  return data.entries;
}

export interface AddWeightInput {
  value: number;
  unit?: WeightUnit;
  date?: string; // YYYY-MM-DD
}

export async function addWeight(input: AddWeightInput): Promise<WeightEntry> {
  const { data } = await apiClient.post<WeightEntry>('/weights', input);
  return data;
}

export async function deleteWeight(id: string): Promise<void> {
  await apiClient.delete(`/weights/${encodeURIComponent(id)}`);
}
