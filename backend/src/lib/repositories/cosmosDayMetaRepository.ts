// Cosmos DB implementation of the DayMeta repository.
// DayMeta documents are stored in the nutritionDiaryMeals container,
// discriminated by _docType: 'dayMeta'.

import type {
  CalorieTargetSnapshot,
  DayMeta,
  DayType,
  WorkoutType,
  SpecialActivity,
} from '@fittrack/shared';
import { getCosmos } from '../cosmos';
import type { DayMetaRepository } from './dayMetaRepository';

export class CosmosDayMetaRepository implements DayMetaRepository {
  async get(userId: string, date: string): Promise<DayMeta | null> {
    const { containers } = await getCosmos();
    try {
      const { resource } = await containers.nutritionDiaryMeals
        .item(`day:${date}`, userId)
        .read<DayMeta>();
      return resource ?? null;
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 404) return null;
      throw err;
    }
  }

  async upsert(
    userId: string,
    date: string,
    dayType: DayType,
    workoutType?: WorkoutType | null,
    calorieTargetSnapshot?: CalorieTargetSnapshot | null,
  ): Promise<DayMeta> {
    const { containers } = await getCosmos();
    // Read existing doc first to preserve any fields not being updated
    const existing = await this.get(userId, date);
    const meta: DayMeta = {
      ...(existing ?? {}),
      id: `day:${date}`,
      userId,
      date,
      dayType,
      updatedAt: new Date().toISOString(),
      _docType: 'dayMeta',
    };
    // workoutType: explicitly null means clear it; undefined means don't change
    if (workoutType === null) {
      delete meta.workoutType;
    } else if (workoutType != null) {
      meta.workoutType = workoutType;
    }
    if (calorieTargetSnapshot === null) {
      delete meta.calorieTargetSnapshot;
    } else if (calorieTargetSnapshot !== undefined) {
      meta.calorieTargetSnapshot = calorieTargetSnapshot;
    }
    const { resource } = await containers.nutritionDiaryMeals.items.upsert<DayMeta>(meta);
    if (!resource) throw new Error('Cosmos upsert returned no resource');
    return resource;
  }

  async setSpecialActivity(userId: string, date: string, activity: SpecialActivity): Promise<DayMeta> {
    const { containers } = await getCosmos();
    const existing = await this.get(userId, date);
    const meta: DayMeta = {
      ...(existing ?? {
        id: `day:${date}`,
        userId,
        date,
        dayType: 'rest',
        _docType: 'dayMeta',
      }),
      specialActivity: activity,
      updatedAt: new Date().toISOString(),
    };
    const { resource } = await containers.nutritionDiaryMeals.items.upsert<DayMeta>(meta);
    if (!resource) throw new Error('Cosmos upsert returned no resource');
    return resource;
  }

  async removeSpecialActivity(userId: string, date: string): Promise<DayMeta> {
    const { containers } = await getCosmos();
    const existing = await this.get(userId, date);
    const meta: DayMeta = {
      ...(existing ?? {
        id: `day:${date}`,
        userId,
        date,
        dayType: 'rest',
        _docType: 'dayMeta',
      }),
      updatedAt: new Date().toISOString(),
    };
    delete meta.specialActivity;
    const { resource } = await containers.nutritionDiaryMeals.items.upsert<DayMeta>(meta);
    if (!resource) throw new Error('Cosmos upsert returned no resource');
    return resource;
  }
}
