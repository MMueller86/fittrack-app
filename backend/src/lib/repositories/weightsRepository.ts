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
  /** List changed entries since an inclusive UTC ISO timestamp, within one user partition. */
  listUpdatedSince(userId: string, since: string): Promise<WeightEntry[]>;
  add(entry: WeightEntry): Promise<WeightEntry>;
  updateValue(userId: string, id: string, value: number): Promise<WeightEntry | null>;
  delete(userId: string, id: string): Promise<boolean>;
}

function updateTimestamp(entry: WeightEntry): string {
  return entry.updatedAt ?? entry.createdAt;
}

function sortByUpdateTimestamp(entries: WeightEntry[]): WeightEntry[] {
  return entries.sort((left, right) =>
    updateTimestamp(left).localeCompare(updateTimestamp(right)) || left.id.localeCompare(right.id),
  );
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

  async listUpdatedSince(userId: string, since: string): Promise<WeightEntry[]> {
    const entries = this.entriesByUser.get(userId) ?? [];
    return sortByUpdateTimestamp(entries.filter((entry) => updateTimestamp(entry) >= since));
  }

  async add(entry: WeightEntry): Promise<WeightEntry> {
    const list = this.entriesByUser.get(entry.userId) ?? [];
    const stored = { ...entry, updatedAt: entry.updatedAt ?? entry.createdAt };
    list.push(stored);
    this.entriesByUser.set(entry.userId, list);
    return stored;
  }

  async updateValue(userId: string, id: string, value: number): Promise<WeightEntry | null> {
    const entry = this.entriesByUser.get(userId)?.find((candidate) => candidate.id === id);
    if (!entry) return null;
    entry.value = value;
    entry.updatedAt = new Date().toISOString();
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
