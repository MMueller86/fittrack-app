import { calculateMacroRanges } from '../../../shared/lib/macroRanges';
import type { DayTargets } from '../../../shared/types/nutrition';
import type { UserProfile } from '@fittrack/shared';

function resolveDayTargets(weightKg: number, targets: DayTargets): DayTargets {
  if (targets.macroRanges != null) return targets;

  return {
    ...targets,
    macroRanges: calculateMacroRanges(weightKg, targets.calories, targets.fatG),
  };
}

/** Derives missing legacy ranges on read; callers must not persist this result as a migration. */
export function resolveProfileMacroRanges(profile: UserProfile): UserProfile {
  const profileTargets = profile.targets;
  if (!profileTargets?.restDay || !profileTargets?.trainingDay) return profile;

  const restDay = resolveDayTargets(profile.weightKg, profileTargets.restDay);
  const trainingDay = resolveDayTargets(profile.weightKg, profileTargets.trainingDay);

  if (restDay === profileTargets.restDay && trainingDay === profileTargets.trainingDay) {
    return profile;
  }

  return {
    ...profile,
    targets: {
      ...profileTargets,
      restDay,
      trainingDay,
    },
  };
}