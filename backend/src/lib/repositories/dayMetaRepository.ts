// DayMeta repository — stores per-day type (rest/training) for a user.
//
// Selection rule:
//   - COSMOS configured → CosmosDayMetaRepository (same nutritionDiaryMeals container)
//   - Otherwise → InMemoryDayMetaRepository

import type { DayMeta, DayType } from '@fittrack/shared';
import { isCosmosConfigured } from '../cosmos';
import { CosmosDayMetaRepository } from './cosmosDayMetaRepository';

export interface DayMetaRepository {
  get(userId: string, date: string): Promise<DayMeta | null>;
  upsert(userId: string, date: string, dayType: DayType): Promise<DayMeta>;
}

class InMemoryDayMetaRepository implements DayMetaRepository {
  private readonly store = new Map<string, DayMeta>();

  private key(userId: string, date: string): string {
    return `${userId}:${date}`;
  }

  async get(userId: string, date: string): Promise<DayMeta | null> {
    return this.store.get(this.key(userId, date)) ?? null;
  }

  async upsert(userId: string, date: string, dayType: DayType): Promise<DayMeta> {
    const meta: DayMeta = {
      id: `day:${date}`,
      userId,
      date,
      dayType,
      updatedAt: new Date().toISOString(),
      _docType: 'dayMeta',
    };
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
