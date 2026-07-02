// Cosmos DB implementation of the HintState repository.
// Documents are stored in the nutritionDiaryMeals container,
// discriminated by _docType: 'hintState'.
// id: 'hintState', partition key: userId

import type { HintState } from '../../../../shared/types/hint';
import { getCosmos } from '../cosmos';
import type { HintStateRepository } from './hintStateRepository';

export class CosmosHintStateRepository implements HintStateRepository {
  async get(userId: string): Promise<HintState | null> {
    const { containers } = await getCosmos();
    try {
      const { resource } = await containers.nutritionDiaryMeals
        .item('hintState', userId)
        .read<HintState>();
      return resource ?? null;
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 404) return null;
      throw err;
    }
  }

  async upsert(userId: string, state: HintState): Promise<void> {
    const { containers } = await getCosmos();
    const doc: HintState = { ...state, userId };
    await containers.nutritionDiaryMeals.items.upsert<HintState>(doc);
  }
}
