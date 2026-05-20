// ReusableItems repository abstraction.
//
// ReusableItem = a named food template that users can quickly pick from
// the diary's item-picker. Distinct from MealItem (which is a snapshot
// embedded in a Meal document).

import { randomUUID } from 'node:crypto';
import type {
  ReusableItem,
  NutritionBasis,
  NutritionValues,
  PortionInfo,
  ReusableItemSourceType,
  OFFSourceRef,
} from '@fittrack/shared';
import { isCosmosConfigured } from '../cosmos';
import { CosmosReusableItemsRepository } from './cosmosReusableItemsRepository';

export interface CreateReusableItemInput {
  userId: string;
  name: string;
  brand?: string;
  nutritionBasis: NutritionBasis;
  nutritionPer100g?: NutritionValues;
  portion?: PortionInfo;
  isComplete: boolean;
  sourceType: ReusableItemSourceType;
  sourceRef?: OFFSourceRef;
  /** AI confidence 0.0–1.0; only set when sourceType === 'ai' */
  aiConfidence?: number;
  /** AI-generated warnings stored for traceability; only set when sourceType === 'ai' */
  aiWarnings?: string[];
  /** Lowercase search keywords for improved discoverability */
  searchTerms?: string[];
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
      .filter((i) =>
        i.name.toLowerCase().startsWith(q) ||
        (i.searchTerms ?? []).some((t) => t.startsWith(q)),
      )
      .slice(0, 20);
  }

  async create(input: CreateReusableItemInput): Promise<ReusableItem> {
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

export function _setReusableItemsRepository(repo: ReusableItemsRepository): void {
  singleton = repo;
}

