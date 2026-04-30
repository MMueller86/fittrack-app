// Cosmos-backed implementation of WeightsRepository.
// Uses the `weights` container (partition key /userId).

import type { WeightEntry } from '@fittrack/shared';
import { getCosmos } from '../cosmos';
import type { WeightsRepository } from './weightsRepository';

export class CosmosWeightsRepository implements WeightsRepository {
  async list(userId: string): Promise<WeightEntry[]> {
    const { containers } = await getCosmos();
    // Single-partition query — efficient on /userId partition key.
    const { resources } = await containers.weights.items
      .query<WeightEntry>({
        // NOTE: `value` is a reserved keyword in Cosmos SQL, so we cannot
        // project it via `c.value` or alias it as `value`. SELECT * returns
        // every property (incl. system fields like _rid) which the API layer
        // is fine with.
        // We sort client-side because a multi-property ORDER BY (date,
        // createdAt) would require a composite index. Per-user weight
        // history is small enough that an in-memory sort is fine.
        query: 'SELECT * FROM c WHERE c.userId = @userId',
        parameters: [{ name: '@userId', value: userId }],
      }, { partitionKey: userId })
      .fetchAll();
    return resources.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (a.createdAt ?? '') < (b.createdAt ?? '') ? 1 : -1;
    });
    return resources;
  }

  async add(entry: WeightEntry): Promise<WeightEntry> {
    const { containers } = await getCosmos();
    const { resource } = await containers.weights.items.create<WeightEntry>(entry);
    return resource ?? entry;
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
