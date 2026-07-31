// DayMeta repository — stores per-day type (rest/training) for a user.
//
// Selection rule:
//   - COSMOS configured → CosmosDayMetaRepository (same nutritionDiaryMeals container)
//   - Otherwise → InMemoryDayMetaRepository

import type { DayMeta, DayType, WorkoutType, SpecialActivity } from '@fittrack/shared';
import { isCosmosConfigured } from '../cosmos';
import { CosmosDayMetaRepository } from './cosmosDayMetaRepository';

export interface DayMetaRepository {
  get(userId: string, date: string): Promise<DayMeta | null>;
  upsert(userId: string, date: string, dayType: DayType, workoutType?: WorkoutType | null): Promise<DayMeta>;
  setSpecialActivity(userId: string, date: string, activity: SpecialActivity): Promise<DayMeta>;
  removeSpecialActivity(userId: string, date: string): Promise<DayMeta>;
}

class InMemoryDayMetaRepository implements DayMetaRepository {
  private readonly store = new Map<string, DayMeta>();

  private key(userId: string, date: string): string {
    return `${userId}:${date}`;
  }

  async get(userId: string, date: string): Promise<DayMeta | null> {
    return this.store.get(this.key(userId, date)) ?? null;
  }

  async upsert(userId: string, date: string, dayType: DayType, workoutType?: WorkoutType | null): Promise<DayMeta> {
    const existing = this.store.get(this.key(userId, date));
    const meta: DayMeta = {
      ...(existing ?? {}),
      id: `day:${date}`,
      userId,
      date,
      dayType,
      updatedAt: new Date().toISOString(),
      _docType: 'dayMeta',
    };
    if (workoutType === null) {
      delete meta.workoutType;
    } else if (workoutType != null) {
      meta.workoutType = workoutType;
    }
    this.store.set(this.key(userId, date), meta);
    return meta;
  }

  async setSpecialActivity(userId: string, date: string, activity: SpecialActivity): Promise<DayMeta> {
    const existing = this.store.get(this.key(userId, date));
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
    this.store.set(this.key(userId, date), meta);
    return meta;
  }

  async removeSpecialActivity(userId: string, date: string): Promise<DayMeta> {
    const existing = this.store.get(this.key(userId, date));
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
    this.store.set(this.key(userId, date), meta);
    return meta;
  }
}

let singleton: DayMetaRepository | undefined;

export function getDayMetaRepository(): DayMetaRepository {
  if (!singleton) {
    singleton = isCosmosConfigured()
      ? new CosmosDayMetaRepository()
      : new InMemoryDayMetaRepository();
  }
  return singleton;
}

/** Test-only: reset singleton. */
export function __resetDayMetaRepositoryForTests(): void {
  singleton = undefined;
}
