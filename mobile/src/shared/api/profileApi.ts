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
  WorkoutType,
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

export interface ProfileDeletionRequest {
  confirmation: 'DELETE';
  deleteCommunityRecipes: boolean;
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

  async deleteProfile(request: ProfileDeletionRequest): Promise<void> {
    const response = await apiClient.delete('/profile', { data: request });
    if (response.status !== 204) {
      throw new Error('Profile deletion did not complete successfully.');
    }
  },

  /** Persists healthSyncEnabled without requiring the caller to pass the full profile. */
  async updateHealthSync(enabled: boolean): Promise<void> {
    const res = await apiClient.get<ProfileResponse>('/profile/me');
    const existing = res.data.profile;
    if (!existing) return;
    await apiClient.put('/profile', {
      gender: existing.gender,
      age: existing.age,
      heightCm: existing.heightCm,
      weightKg: existing.weightKg,
      targetWeightKg: existing.targetWeightKg,
      stepsPerDay: existing.stepsPerDay,
      activityLevel: existing.activityLevel,
      trainingFrequencyPerWeek: existing.trainingFrequencyPerWeek,
      trainingDurationMinutes: existing.trainingDurationMinutes,
      sports: existing.sports,
      goal: existing.goal,
      goalIntensity: existing.goalIntensity,
      displayName: existing.displayName,
      healthSyncEnabled: enabled,
    });
  },

  setDayType(date: string, dayType: DayType, workoutType?: WorkoutType | null): Promise<{ dayMeta: DayMeta }> {
    return apiClient
      .put<{ dayMeta: DayMeta }>(`/diary/${date}/day-type`, { dayType, workoutType: workoutType ?? undefined })
      .then((r) => r.data);
  },
};
