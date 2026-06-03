// Profile API — wraps all /api/profile endpoints.
// Uses the shared apiClient (auth interceptors, base URL).

import { apiClient } from './client';
import type {
  UserProfile,
  ProfileInput,
  ProfileTargets,
  CalculationMeta,
  DayType,
  DayMeta,
} from '@fittrack/shared';

export interface ProfileResponse {
  profile: UserProfile | null;
  targets: ProfileTargets | null;
}

export interface ProfileMutationResponse {
  profile: UserProfile;
  targets: ProfileTargets;
}

export interface CalculatePreviewResponse {
  targets: ProfileTargets;
  calculationMeta: CalculationMeta;
}

export const profileApi = {
  getMe(): Promise<ProfileResponse> {
    return apiClient.get<ProfileResponse>('/profile/me').then((r) => r.data);
  },

  createProfile(input: ProfileInput): Promise<ProfileMutationResponse> {
    return apiClient
      .post<ProfileMutationResponse>('/profile', input)
      .then((r) => r.data);
  },

  updateProfile(input: ProfileInput): Promise<ProfileMutationResponse> {
    return apiClient
      .put<ProfileMutationResponse>('/profile', input)
      .then((r) => r.data);
  },

  calculatePreview(input: ProfileInput): Promise<CalculatePreviewResponse> {
    return apiClient
      .post<CalculatePreviewResponse>('/profile/calculate-preview', input)
      .then((r) => r.data);
  },

  deleteProfile(): Promise<void> {
    return apiClient.delete('/profile').then(() => undefined);
  },

  setDayType(date: string, dayType: DayType): Promise<{ dayMeta: DayMeta }> {
    return apiClient
      .put<{ dayMeta: DayMeta }>(`/diary/${date}/day-type`, { dayType })
      .then((r) => r.data);
  },
};
