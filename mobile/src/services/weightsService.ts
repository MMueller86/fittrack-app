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

// Returns today's date in the device's local timezone as YYYY-MM-DD.
// The backend fallback (todayIso) uses UTC which misreports the date for
// users in UTC+ timezones entering weights between midnight and 2 am.
function localTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function addWeight(input: AddWeightInput): Promise<WeightEntry> {
  const { data } = await apiClient.post<WeightEntry>('/weights', {
    date: localTodayIso(),
    ...input, // explicit date in input takes precedence
  });
  return data;
}

export async function deleteWeight(id: string): Promise<void> {
  await apiClient.delete(`/weights/${encodeURIComponent(id)}`);
}
