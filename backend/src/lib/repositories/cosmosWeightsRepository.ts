// Cosmos-backed implementation of WeightsRepository.
// Uses the `weights` container (partition key /userId).

import type { WeightEntry } from '@fittrack/shared';
import { getCosmos } from '../cosmos';
import type { WeightsRepository } from './weightsRepository';

export class CosmosWeightsRepository implements WeightsRepository {
  private async queryEntries(
    userId: string,
    query: string,
    parameters: { name: string; value: string }[] = [],
  ): Promise<WeightEntry[]> {
    const { containers } = await getCosmos();
    const { resources } = await containers.weights.items
      .query<WeightEntry>({
        query,
        parameters: [{ name: '@userId', value: userId }, ...parameters],
      }, { partitionKey: userId })
      .fetchAll();
    return resources;
  }

  async list(userId: string): Promise<WeightEntry[]> {
    // Single-partition query — efficient on /userId partition key.
    // NOTE: `value` is a reserved keyword in Cosmos SQL, so we cannot
    // project it via `c.value` or alias it as `value`. SELECT * returns
    // every property (incl. system fields like _rid) which the API layer
    // is fine with.
    // We sort client-side because a multi-property ORDER BY (date,
    // createdAt) would require a composite index. Per-user weight
    // history is small enough that an in-memory sort is fine.
    const resources = await this.queryEntries(userId, 'SELECT * FROM c WHERE c.userId = @userId');
    return resources.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (a.createdAt ?? '') < (b.createdAt ?? '') ? 1 : -1;
    });
  }

  async listUpdatedSince(userId: string, since: string): Promise<WeightEntry[]> {
    const resources = await this.queryEntries(
      userId,
      'SELECT * FROM c WHERE c.userId = @userId AND ((IS_DEFINED(c.updatedAt) AND c.updatedAt >= @since) OR (NOT IS_DEFINED(c.updatedAt) AND c.createdAt >= @since))',
      [{ name: '@since', value: since }],
    );
    return resources.sort((left, right) =>
      (left.updatedAt ?? left.createdAt).localeCompare(right.updatedAt ?? right.createdAt) || left.id.localeCompare(right.id),
    );
  }

  async add(entry: WeightEntry): Promise<WeightEntry> {
    const { containers } = await getCosmos();
    const document = { ...entry, updatedAt: entry.updatedAt ?? entry.createdAt };
    const { resource } = await containers.weights.items.create<WeightEntry>(document);
    return resource ?? document;
  }

  async updateValue(userId: string, id: string, value: number): Promise<WeightEntry | null> {
    const { containers } = await getCosmos();
    try {
      const updatedAt = new Date().toISOString();
      const { resource } = await containers.weights.item(id, userId).patch<WeightEntry>([
        { op: 'set', path: '/value', value },
        { op: 'set', path: '/updatedAt', value: updatedAt },
      ]);
      return resource ?? null;
    } catch (e) {
      if (typeof e === 'object' && e !== null && 'code' in e && (e as { code?: number }).code === 404) {
        return null;
      }
      throw e;
    }
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const { containers } = await getCosmos();
    try {
      await containers.weights.item(id, userId).delete();
      return true;
    } catch (e) {
      // Cosmos throws 404 when the item does not exist.
      if (typeof e === 'object' && e !== null && 'code' in e && (e as { code?: number }).code === 404) {
        return false;
      }
      throw e;
    }
  }
}
