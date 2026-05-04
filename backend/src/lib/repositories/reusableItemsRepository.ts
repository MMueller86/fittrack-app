// ReusableItems repository abstraction.
//
// ReusableItem = a named food template that users can quickly pick from
// the diary's item-picker. Distinct from MealItem (which is a snapshot
// embedded in a Meal document).

import { randomUUID } from 'node:crypto';
import type { ReusableItem } from '@fittrack/shared';
import { isCosmosConfigured } from '../cosmos';
import { CosmosReusableItemsRepository } from './cosmosReusableItemsRepository';

export interface CreateReusableItemInput {
  userId: string;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}

export interface ReusableItemsRepository {
  search(userId: string, query: string): Promise<ReusableItem[]>;
  create(input: CreateReusableItemInput): Promise<ReusableItem>;
}

class InMemoryReusableItemsRepository implements ReusableItemsRepository {
  private readonly itemsByUser = new Map<string, ReusableItem[]>();

  async search(userId: string, query: string): Promise<ReusableItem[]> {
    const items = this.itemsByUser.get(userId) ?? [];
    if (!query.trim()) return items.slice(0, 20);
    const q = query.toLowerCase();
    return items
      .filter((i) => i.name.toLowerCase().startsWith(q))
      .slice(0, 20);
  }

  async create(input: CreateReusableItemInput): Promise<ReusableItem> {
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
    const list = this.itemsByUser.get(input.userId) ?? [];
    list.push(item);
    this.itemsByUser.set(input.userId, list);
    return item;
  }
}

let singleton: ReusableItemsRepository | undefined;

export function getReusableItemsRepository(): ReusableItemsRepository {
  if (!singleton) {
    singleton = isCosmosConfigured()
      ? new CosmosReusableItemsRepository()
      : new InMemoryReusableItemsRepository();
  }
  return singleton;
}

export function __resetReusableItemsRepositoryForTests(): void {
  singleton = undefined;
}
