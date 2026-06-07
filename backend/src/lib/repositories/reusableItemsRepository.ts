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

export interface UpdateReusableItemInput {
  name?: string;
  brand?: string;
  nutritionPer100g?: NutritionValues;
  portion?: PortionInfo | null;
  searchTerms?: string[];
  aiKeywords?: string[];
  searchTermsEnriched?: boolean;
}

export interface ReusableItemsRepository {
  search(userId: string, query: string): Promise<ReusableItem[]>;
  getById(userId: string, id: string): Promise<ReusableItem | null>;
  create(input: CreateReusableItemInput): Promise<ReusableItem>;
  update(userId: string, id: string, input: UpdateReusableItemInput): Promise<ReusableItem | null>;
  remove(userId: string, id: string): Promise<boolean>;
  /** Increment usageCount by 1. Called when a product is added to the diary. Fire-and-forget safe. */
  incrementUsageCount(userId: string, id: string): Promise<void>;
}

class InMemoryReusableItemsRepository implements ReusableItemsRepository {
  private readonly itemsByUser = new Map<string, ReusableItem[]>();

  async search(userId: string, query: string): Promise<ReusableItem[]> {
    const items = this.itemsByUser.get(userId) ?? [];
    if (!query.trim()) return [...items].sort((a, b) => b.usageCount - a.usageCount).slice(0, 20);
    const q = query.toLowerCase();
    return items
      .filter((i) =>
        i.name.toLowerCase().startsWith(q) ||
        (i.searchTerms ?? []).some((t) => t.startsWith(q)),
      )
      .slice(0, 20);
  }

  async getById(userId: string, id: string): Promise<ReusableItem | null> {
    const items = this.itemsByUser.get(userId) ?? [];
    return items.find((i) => i.id === id) ?? null;
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

  async update(userId: string, id: string, input: UpdateReusableItemInput): Promise<ReusableItem | null> {
    const items = this.itemsByUser.get(userId) ?? [];
    const item = items.find((i) => i.id === id);
    if (!item) return null;
    if (input.name !== undefined) item.name = input.name;
    if (input.brand !== undefined) item.brand = input.brand ?? undefined;
    if (input.nutritionPer100g !== undefined) {
      item.nutritionPer100g = input.nutritionPer100g;
      item.nutritionBasis = item.portion ? 'both' : 'per100g';
    }
    if (input.portion !== undefined) {
      item.portion = input.portion ?? undefined;
      item.nutritionBasis = input.portion
        ? (item.nutritionPer100g ? 'both' : 'perPortion')
        : (item.nutritionPer100g ? 'per100g' : 'perPortion');
    }
    if (input.searchTerms !== undefined) item.searchTerms = input.searchTerms;
    if (input.aiKeywords !== undefined) item.aiKeywords = input.aiKeywords;
    if (input.searchTermsEnriched !== undefined) (item as ReusableItem & { searchTermsEnriched?: boolean }).searchTermsEnriched = input.searchTermsEnriched;
    (item as ReusableItem & { updatedAt?: string }).updatedAt = new Date().toISOString();
    return item;
  }

  async remove(userId: string, id: string): Promise<boolean> {
    const items = this.itemsByUser.get(userId) ?? [];
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return false;
    items.splice(idx, 1);
    this.itemsByUser.set(userId, items);
    return true;
  }

  async incrementUsageCount(userId: string, id: string): Promise<void> {
    const items = this.itemsByUser.get(userId) ?? [];
    const item = items.find((i) => i.id === id);
    if (item) item.usageCount = (item.usageCount ?? 0) + 1;
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

