// Weights repository abstraction.
//
// Provides a storage-agnostic interface for weight entries so HTTP handlers
// don't need to know whether data lives in memory or Cosmos DB.
//
// Selection rule:
//   - If COSMOS_ENDPOINT and COSMOS_KEY are set, use CosmosWeightsRepository.
//   - Otherwise, fall back to InMemoryWeightsRepository (process-local,
//     lost on restart) so the app still runs without Azure.

import type { WeightEntry } from '@fittrack/shared';
import { isCosmosConfigured } from '../cosmos';
import { CosmosWeightsRepository } from './cosmosWeightsRepository';

export interface WeightsRepository {
  list(userId: string): Promise<WeightEntry[]>;
  add(entry: WeightEntry): Promise<WeightEntry>;
  delete(userId: string, id: string): Promise<boolean>;
}

class InMemoryWeightsRepository implements WeightsRepository {
  private readonly entriesByUser = new Map<string, WeightEntry[]>();

  async list(userId: string): Promise<WeightEntry[]> {
    const entries = this.entriesByUser.get(userId) ?? [];
    // Newest first by date, then by createdAt.
    return [...entries].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.createdAt < b.createdAt ? 1 : -1;
    });
  }

  async add(entry: WeightEntry): Promise<WeightEntry> {
    const list = this.entriesByUser.get(entry.userId) ?? [];
    list.push(entry);
    this.entriesByUser.set(entry.userId, list);
    return entry;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const list = this.entriesByUser.get(userId);
    if (!list) return false;
    const idx = list.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    list.splice(idx, 1);
    return true;
  }
}

let singleton: WeightsRepository | undefined;

export function getWeightsRepository(): WeightsRepository {
  if (!singleton) {
    singleton = isCosmosConfigured()
      ? new CosmosWeightsRepository()
      : new InMemoryWeightsRepository();
  }
  return singleton;
}

/**
 * Test-only: clear the cached singleton so a subsequent `getWeightsRepository()`
 * call re-evaluates env vars and picks a fresh repository. Do not call this
 * from production code.
 */
export function __resetWeightsRepositoryForTests(): void {
  singleton = undefined;
}
