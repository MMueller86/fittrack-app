// Special Activity handlers
// PUT    /api/diary/day/{date}/special-activity  — record a special activity (e.g. hiking)
// DELETE /api/diary/day/{date}/special-activity  — remove the special activity for a day

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { z } from 'zod';

import { requireUser } from '../lib/auth';
import { parseBody, withHandler } from '../lib/http';
import { logEvent } from '../lib/log';
import { getDayMetaRepository } from '../lib/repositories/dayMetaRepository';
import { getProfileRepository } from '../lib/repositories/profileRepository';
import { getWeightsRepository } from '../lib/repositories/weightsRepository';
import { calculateActivityBonus } from '../../../shared/lib/activityBonusCalculator';
import { calculateCyclingActivityBonus } from '../../../shared/lib/cyclingBonusCalculator';
import type { SpecialActivity, HikingSpecialActivity, CyclingSpecialActivity } from '@fittrack/shared';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be ISO YYYY-MM-DD')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return false;
    const [y, m, day] = v.split('-').map(Number);
    return d.getUTCFullYear() === y && d.getUTCMonth() + 1 === m && d.getUTCDate() === day;
  }, { message: 'must be a real calendar date' });

const HikingInputSchema = z.object({
  type: z.literal('hiking'),
  movementTimeMinutes: z.number().min(30, 'movementTimeMinutes must be at least 30').max(1200, 'movementTimeMinutes must be at most 1200'),
  distanceKm: z.number().min(0.5, 'distanceKm must be at least 0.5').max(100, 'distanceKm must be at most 100'),
  elevationGainM: z.number().min(0, 'elevationGainM must be at least 0').max(3000, 'elevationGainM must be at most 3000'),
  /** @deprecated Use packCategory instead */
  hasBackpack: z.boolean().optional(),
  elevationLossM: z.number().min(0, 'elevationLossM must be at least 0').max(3000, 'elevationLossM must be at most 3000').optional(),
  packCategory: z.enum(['none', 'small', 'medium', 'heavy']).optional(),
  terrainType: z.enum(['path', 'trail', 'alpine', 'scramble']).optional(),
});

const CyclingInputSchema = z.object({
  type: z.literal('cycling'),
  movementTimeMinutes: z.number().min(15).max(1200),
  distanceKm: z.number().min(1).max(200),
  elevationGainM: z.number().min(0).max(8000),
  elevationLossM: z.number().min(0).max(8000).optional(),
  asphaltShare: z.number().min(0).max(1),
  gravelShare: z.number().min(0).max(1),
  trailShare: z.number().min(0).max(1),
  ebikeSupport: z.enum(['NONE', 'LIGHT', 'HIGH']),
});

const SpecialActivityInputSchema = z.discriminatedUnion('type', [
  HikingInputSchema,
  CyclingInputSchema,
]);

// PUT /api/diary/day/{date}/special-activity
export const setSpecialActivityHandler = withHandler(
  'diary.specialActivity.set',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);

    const date = request.params['date'];
    const dateParseResult = isoDate.safeParse(date);
    if (!dateParseResult.success) {
      return { status: 400, jsonBody: { error: 'Route param "date" must be a valid ISO YYYY-MM-DD date' } };
    }

    const parsed = await parseBody(request, SpecialActivityInputSchema);
    if (!parsed.ok) return parsed.response;

    // Resolve body weight (shared by all activity types)
    const profile = await getProfileRepository().get(userId);
    let weightKg: number | null = profile?.weightKg ?? null;

    if (weightKg == null || weightKg <= 0) {
      const weightEntries = await getWeightsRepository().list(userId);
      weightKg = weightEntries[0]?.value ?? null;
    }

    if (weightKg == null || weightKg <= 0) {
      return {
        status: 422,
        jsonBody: { error: 'Kein Körpergewicht hinterlegt. Bitte Profil oder Gewichtserfassung anlegen.' },
      };
    }

    // Resolve daily calorie target (shared)
    const dayMeta = await getDayMetaRepository().get(userId, date);
    const resolvedDayType = dayMeta?.dayType ?? 'rest';
    const fallbackCalories = 2000;
    const dailyCalorieTarget = profile?.targets
      ? (resolvedDayType === 'training'
        ? profile.targets.trainingDay.calories
        : profile.targets.restDay.calories)
      : fallbackCalories;

    if (parsed.data.type === 'cycling') {
      const { movementTimeMinutes, distanceKm, elevationGainM, elevationLossM, asphaltShare, gravelShare, trailShare, ebikeSupport } = parsed.data;

      // Speed plausibility check
      const movementTimeH = movementTimeMinutes / 60;
      const speedKmh = distanceKm / movementTimeH;
      if (speedKmh < 3 || speedKmh > 80) {
        return {
          status: 422,
          jsonBody: { error: 'Eingaben sind für eine Radfahrt nicht plausibel' },
        };
      }

      const inputs = { movementTimeMinutes, distanceKm, elevationGainM, elevationLossM, asphaltShare, gravelShare, trailShare, ebikeSupport };
      const bonusResult = calculateCyclingActivityBonus(inputs, weightKg, dailyCalorieTarget);

      const specialActivity: CyclingSpecialActivity = {
        type: 'cycling',
        movementTimeMinutes,
        distanceKm,
        elevationGainM,
        elevationLossM,
        asphaltShare,
        gravelShare,
        trailShare,
        ebikeSupport,
        bodyWeightKg: weightKg,
        dailyCalorieTarget,
        calculatedAt: new Date().toISOString(),
        ...bonusResult,
      };

      await getDayMetaRepository().setSpecialActivity(userId, date, specialActivity);

      logEvent(ctx, 'info', 'diary.specialActivity.set', {
        userId,
        date,
        type: 'cycling',
        activityBonus: specialActivity.activityBonus,
      });

      return {
        status: 200,
        jsonBody: {
          specialActivity,
          activityBonus: specialActivity.activityBonus,
          effectiveCalorieTarget: dailyCalorieTarget + specialActivity.activityBonus,
          speedMet: bonusResult.speedMet,
          uphillBonusMet: bonusResult.uphillBonusMet,
          terrainBonusMet: bonusResult.terrainBonusMet,
          effectiveSupport: bonusResult.effectiveSupport,
        },
      };
    }

    // type === 'hiking'
    const { movementTimeMinutes, distanceKm, elevationGainM, hasBackpack, elevationLossM, packCategory, terrainType } = parsed.data;

    // Speed plausibility check
    const movementTimeH = movementTimeMinutes / 60;
    const speedKmh = distanceKm / movementTimeH;
    if (speedKmh < 0.5 || speedKmh > 10.0) {
      return {
        status: 422,
        jsonBody: { error: 'Eingaben sind für eine Wanderung nicht plausibel' },
      };
    }

    const inputs = { movementTimeMinutes, distanceKm, elevationGainM, hasBackpack, elevationLossM, packCategory, terrainType };
    const bonusResult = calculateActivityBonus(inputs, weightKg, dailyCalorieTarget);

    const specialActivity: HikingSpecialActivity = {
      type: 'hiking',
      movementTimeMinutes,
      distanceKm,
      elevationGainM,
      hasBackpack,
      elevationLossM,
      packCategory,
      terrainType,
      bodyWeightKg: weightKg,
      dailyCalorieTarget,
      calculatedAt: new Date().toISOString(),
      ...bonusResult,
    };

    await getDayMetaRepository().setSpecialActivity(userId, date, specialActivity);

    logEvent(ctx, 'info', 'diary.specialActivity.set', {
      userId,
      date,
      type: 'hiking',
      activityBonus: specialActivity.activityBonus,
    });

    return {
      status: 200,
      jsonBody: {
        specialActivity,
        activityBonus: specialActivity.activityBonus,
        effectiveCalorieTarget: dailyCalorieTarget + specialActivity.activityBonus,
        metBase: bonusResult.metBase,
        metLocomotion: bonusResult.metLocomotion,
        terrainFactor: bonusResult.terrainFactor,
        deltaPack: bonusResult.deltaPack,
      },
    };
  },
);

// DELETE /api/diary/day/{date}/special-activity
export const removeSpecialActivityHandler = withHandler(
  'diary.specialActivity.remove',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);

    const date = request.params['date'];
    const dateParseResult = isoDate.safeParse(date);
    if (!dateParseResult.success) {
      return { status: 400, jsonBody: { error: 'Route param "date" must be a valid ISO YYYY-MM-DD date' } };
    }

    await getDayMetaRepository().removeSpecialActivity(userId, date);

    logEvent(ctx, 'info', 'diary.specialActivity.remove', { userId, date });

    return { status: 200, jsonBody: { success: true } };
  },
);

// --- Route registrations ---

app.http('diary-special-activity-set', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'diary/day/{date}/special-activity',
  handler: setSpecialActivityHandler,
});

app.http('diary-special-activity-remove', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'diary/day/{date}/special-activity',
  handler: removeSpecialActivityHandler,
});
