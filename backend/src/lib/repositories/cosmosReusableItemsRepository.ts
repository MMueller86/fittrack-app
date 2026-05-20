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
      // Case-insensitive prefix match on name OR any searchTerms element
      cosmosQuery =
        'SELECT * FROM c WHERE c.userId = @userId AND (STARTSWITH(LOWER(c.name), @q) OR EXISTS(SELECT VALUE t FROM t IN c.searchTerms WHERE STARTSWITH(t, @q))) ORDER BY c.usageCount DESC OFFSET 0 LIMIT 20';
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
      brand: input.brand,
      nutritionBasis: input.nutritionBasis,
      nutritionPer100g: input.nutritionPer100g,
      portion: input.portion,
      isComplete: input.isComplete,
      sourceType: input.sourceType,
      sourceRef: input.sourceRef,
      usageCount: 0,
      createdAt: new Date().toISOString(),
      ...(input.aiConfidence != null && { aiConfidence: input.aiConfidence }),
      ...(input.aiWarnings != null && { aiWarnings: input.aiWarnings }),
      ...(input.searchTerms != null && input.searchTerms.length > 0 && { searchTerms: input.searchTerms }),
    };
    const { resource } = await containers.reusableMealItems.items.create<ReusableItem>(item);
    return resource ?? item;
  }
}
