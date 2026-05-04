// Cosmos-backed implementation of ReusableItemsRepository.
// Container: reusableMealItems, partition key: /userId

import { randomUUID } from 'node:crypto';
import type { ReusableItem } from '@fittrack/shared';
import { getCosmos } from '../cosmos';
import type { CreateReusableItemInput, ReusableItemsRepository } from './reusableItemsRepository';

export class CosmosReusableItemsRepository implements ReusableItemsRepository {
  async search(userId: string, query: string): Promise<ReusableItem[]> {
    const { containers } = await getCosmos();
    let cosmosQuery: string;
    let parameters: { name: string; value: string }[];

    if (!query.trim()) {
      cosmosQuery =
        'SELECT * FROM c WHERE c.userId = @userId ORDER BY c.usageCount DESC OFFSET 0 LIMIT 20';
      parameters = [{ name: '@userId', value: userId }];
    } else {
      // Case-insensitive startsWith via LOWER + STARTSWITH
      cosmosQuery =
        'SELECT * FROM c WHERE c.userId = @userId AND STARTSWITH(LOWER(c.name), @q) ORDER BY c.usageCount DESC OFFSET 0 LIMIT 20';
      parameters = [
        { name: '@userId', value: userId },
        { name: '@q', value: query.toLowerCase() },
      ];
    }

    const { resources } = await containers.reusableMealItems.items
      .query<ReusableItem>({ query: cosmosQuery, parameters }, { partitionKey: userId })
      .fetchAll();
    return resources;
  }

  async create(input: CreateReusableItemInput): Promise<ReusableItem> {
    const { containers } = await getCosmos();
    const item: ReusableItem = {
      id: randomUUID(),
      userId: input.userId,
      name: input.name,
      calories: input.calories,
      proteinG: input.proteinG,
      carbsG: input.carbsG,
      fatG: input.fatG,
      fiberG: input.fiberG,
      usageCount: 0,
      createdAt: new Date().toISOString(),
    };
    const { resource } = await containers.reusableMealItems.items.create<ReusableItem>(item);
    return resource ?? item;
  }
}
