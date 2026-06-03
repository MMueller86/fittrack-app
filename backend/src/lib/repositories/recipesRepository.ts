// Recipes repository abstraction.
//
// Provides a storage-agnostic interface for recipes so HTTP handlers
// don't need to know whether data lives in memory or Cosmos DB.
//
// Selection rule:
//   - If COSMOS_ENDPOINT and COSMOS_KEY are set → CosmosRecipesRepository
//   - Otherwise → InMemoryRecipesRepository (lost on restart)

import { randomUUID } from 'node:crypto';
import type { Recipe, RecipeIngredient, RecipeStep, RecipeImage, RecipeNutrition } from '@fittrack/shared';
import { isCosmosConfigured } from '../cosmos';
import { CosmosRecipesRepository } from './cosmosRecipesRepository';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateRecipeInput {
  name: string;
  description?: string;
  portions: number;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  tags: string[];
  nutritionTotal: RecipeNutrition;
  nutritionPerPortion: RecipeNutrition;
}

export interface UpdateRecipeInput {
  name?: string;
  description?: string;
  portions?: number;
  ingredients?: RecipeIngredient[];
  steps?: RecipeStep[];
  tags?: string[];
  nutritionTotal?: RecipeNutrition;
  nutritionPerPortion?: RecipeNutrition;
  images?: RecipeImage[];
}

export interface ListRecipesOptions {
  limit?: number;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface RecipesRepository {
  list(userId: string, opts?: ListRecipesOptions): Promise<Recipe[]>;
  get(userId: string, id: string): Promise<Recipe | null>;
  create(userId: string, input: CreateRecipeInput): Promise<Recipe>;
  update(userId: string, id: string, input: UpdateRecipeInput): Promise<Recipe | null>;
  delete(userId: string, id: string): Promise<boolean>;
  /** Increment usageCount and set lastUsedAt = now. */
  incrementUsage(userId: string, id: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// In-memory implementation (dev / tests)
// ---------------------------------------------------------------------------

class InMemoryRecipesRepository implements RecipesRepository {
  private readonly store = new Map<string, Recipe>();

  private key(userId: string, id: string): string {
    return `${userId}:${id}`;
  }

  async list(userId: string, opts?: ListRecipesOptions): Promise<Recipe[]> {
    const all: Recipe[] = [];
    for (const recipe of this.store.values()) {
      if (recipe.ownerUserId === userId) all.push(recipe);
    }
    // Sort: lastUsedAt desc, then updatedAt desc
    all.sort((a, b) => {
      const aKey = a.lastUsedAt ?? a.updatedAt;
      const bKey = b.lastUsedAt ?? b.updatedAt;
      return bKey.localeCompare(aKey);
    });
    return opts?.limit ? all.slice(0, opts.limit) : all;
  }

  async get(userId: string, id: string): Promise<Recipe | null> {
    const recipe = this.store.get(this.key(userId, id));
    return recipe ?? null;
  }

  async create(userId: string, input: CreateRecipeInput): Promise<Recipe> {
    const now = new Date().toISOString();
    const recipe: Recipe = {
      id: randomUUID(),
      ownerUserId: userId,
      name: input.name,
      description: input.description,
      portions: input.portions,
      ingredients: input.ingredients,
      steps: input.steps,
      images: [],
      nutritionTotal: input.nutritionTotal,
      nutritionPerPortion: input.nutritionPerPortion,
      visibility: 'private',
      sharedWithUserIds: [],
      tags: input.tags,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(this.key(userId, recipe.id), recipe);
    return recipe;
  }

  async update(userId: string, id: string, input: UpdateRecipeInput): Promise<Recipe | null> {
    const existing = this.store.get(this.key(userId, id));
    if (!existing) return null;
    const updated: Recipe = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };
    this.store.set(this.key(userId, id), updated);
    return updated;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    return this.store.delete(this.key(userId, id));
  }

  async incrementUsage(userId: string, id: string): Promise<void> {
    const recipe = this.store.get(this.key(userId, id));
    if (!recipe) return;
    recipe.usageCount += 1;
    recipe.lastUsedAt = new Date().toISOString();
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let singleton: RecipesRepository | undefined;

export function getRecipesRepository(): RecipesRepository {
  if (!singleton) {
    singleton = isCosmosConfigured()
      ? new CosmosRecipesRepository()
      : new InMemoryRecipesRepository();
  }
  return singleton;
}

export function __resetRecipesRepositoryForTests(): void {
  singleton = undefined;
}
