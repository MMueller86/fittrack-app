// HintState repository — persists the hint engine state per user.
//
// Selection rule:
//   - COSMOS configured → CosmosHintStateRepository (nutritionDiaryMeals container)
//   - Otherwise → InMemoryHintStateRepository
//
// Document shape in Cosmos: id='hintState', partitionKey=userId, _docType='hintState'

import type { HintState } from '../../../../shared/types/hint';
import { isCosmosConfigured } from '../cosmos';
import { CosmosHintStateRepository } from './cosmosHintStateRepository';

export interface HintStateRepository {
  get(userId: string): Promise<HintState | null>;
  upsert(userId: string, state: HintState): Promise<void>;
}

class InMemoryHintStateRepository implements HintStateRepository {
  private readonly store = new Map<string, HintState>();

  async get(userId: string): Promise<HintState | null> {
    return this.store.get(userId) ?? null;
  }

  async upsert(userId: string, state: HintState): Promise<void> {
    this.store.set(userId, { ...state, userId });
  }
}

let singleton: HintStateRepository | undefined;

export function getHintStateRepository(): HintStateRepository {
  if (!singleton) {
    singleton = isCosmosConfigured()
      ? new CosmosHintStateRepository()
      : new InMemoryHintStateRepository();
  }
  return singleton;
}

/** Reset singleton — for testing only. */
export function __resetHintStateRepositoryForTests(): void {
  singleton = undefined;
}
