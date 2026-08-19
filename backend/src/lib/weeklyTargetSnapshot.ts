import type { CalorieTargetSnapshot, DayType, UserProfile } from '@fittrack/shared';

export function resolveCalorieTargetSnapshot(
  profile: Pick<UserProfile, 'targets' | 'updatedAt'> | null | undefined,
  dayType: DayType,
  capturedAt = new Date().toISOString(),
): CalorieTargetSnapshot | null {
  const calories = dayType === 'training'
    ? profile?.targets.trainingDay.calories
    : profile?.targets.restDay.calories;

  if (calories == null || !Number.isFinite(calories) || calories <= 0) return null;

  return {
    calories,
    capturedAt,
    source: 'profile',
    ...(profile?.updatedAt ? { profileUpdatedAt: profile.updatedAt } : {}),
  };
}