// Recipes repository abstraction.
//
// Provides a storage-agnostic interface for recipes so HTTP handlers
// don't need to know whether data lives in memory or Cosmos DB.
//
// Selection rule:
//   - If COSMOS_ENDPOINT and COSMOS_KEY are set → CosmosRecipesRepository
//   - Otherwise → InMemoryRecipesRepository (lost on restart)

import { randomUUID } from 'node:crypto';
import type {
  Recipe,
  RecipeExportView,
  RecipeIngredient,
  RecipeStep,
  RecipeImage,
  RecipeNutrition,
} from '@fittrack/shared';
import { DEFAULT_RECIPE_IMAGE_HERO_CROP } from '../../../../shared/types/recipeImageHeroCrop';
import { isCosmosConfigured } from '../cosmos';
import { CosmosRecipesRepository } from './cosmosRecipesRepository';
import { withRecipeExportViewStatus } from './recipeExport';

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
  exportView?: RecipeExportView;
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
  exportView?: RecipeExportView;
  images?: RecipeImage[];
}

export interface VersionedRecipe {
  recipe: Recipe;
  etag: string;
}

export interface ListRecipesOptions {
  limit?: number;
}

function withEffectiveRecipeProjection(recipe: Recipe): Recipe {
  return withRecipeExportViewStatus({
    ...recipe,
    images: recipe.images.map((image) => ({
      ...image,
      heroCrop: image.heroCrop ?? DEFAULT_RECIPE_IMAGE_HERO_CROP,
    })),
  });
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface RecipesRepository {
  list(userId: string, opts?: ListRecipesOptions): Promise<Recipe[]>;
  get(userId: string, id: string): Promise<Recipe | null>;
  getVersioned(userId: string, id: string): Promise<VersionedRecipe | null>;
  create(userId: string, input: CreateRecipeInput): Promise<Recipe>;
  createVersioned(userId: string, input: CreateRecipeInput): Promise<VersionedRecipe>;
  update(userId: string, id: string, input: UpdateRecipeInput): Promise<Recipe | null>;
  compareAndReplace(
    userId: string,
    id: string,
    expectedEtag: string,
    input: UpdateRecipeInput,
  ): Promise<VersionedRecipe | null>;
  delete(userId: string, id: string): Promise<boolean>;
  /** Increment usageCount and set lastUsedAt = now. */
  incrementUsage(userId: string, id: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// In-memory implementation (dev / tests)
// ---------------------------------------------------------------------------

class InMemoryRecipesRepository implements RecipesRepository {
  private readonly store = new Map<string, { recipe: Recipe; etag: string }>();

  private key(userId: string, id: string): string {
    return `${userId}:${id}`;
  }

  async list(userId: string, opts?: ListRecipesOptions): Promise<Recipe[]> {
    const all: Recipe[] = [];
    for (const { recipe } of this.store.values()) {
      if (recipe.ownerUserId === userId) all.push(recipe);
    }
    // Sort: lastUsedAt desc, then updatedAt desc
    all.sort((a, b) => {
      const aKey = a.lastUsedAt ?? a.updatedAt;
      const bKey = b.lastUsedAt ?? b.updatedAt;
      return bKey.localeCompare(aKey);
    });
    return (opts?.limit ? all.slice(0, opts.limit) : all).map(withEffectiveRecipeProjection);
  }

  async get(userId: string, id: string): Promise<Recipe | null> {
    const versioned = await this.getVersioned(userId, id);
    return versioned?.recipe ?? null;
  }

  async create(userId: string, input: CreateRecipeInput): Promise<Recipe> {
    const versioned = await this.createVersioned(userId, input);
    return versioned.recipe;
  }

  async createVersioned(userId: string, input: CreateRecipeInput): Promise<VersionedRecipe> {
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
      ...(input.exportView !== undefined ? { exportView: input.exportView } : {}),
      visibility: 'private',
      sharedWithUserIds: [],
      tags: input.tags,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    const record = { recipe, etag: `"${randomUUID()}"` };
    this.store.set(this.key(userId, recipe.id), record);
    return { recipe: withEffectiveRecipeProjection(recipe), etag: record.etag };
  }

  async getVersioned(userId: string, id: string): Promise<VersionedRecipe | null> {
    const record = this.store.get(this.key(userId, id));
    return record
      ? { recipe: withEffectiveRecipeProjection(record.recipe), etag: record.etag }
      : null;
  }

  async update(userId: string, id: string, input: UpdateRecipeInput): Promise<Recipe | null> {
    const key = this.key(userId, id);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const existing = this.store.get(key);
      if (!existing) return null;
      const updated = await this.compareAndReplace(userId, id, existing.etag, input);
      if (updated) return updated.recipe;
    }
    throw new Error('Recipe changed repeatedly while updating');
  }

  async compareAndReplace(
    userId: string,
    id: string,
    expectedEtag: string,
    input: UpdateRecipeInput,
  ): Promise<VersionedRecipe | null> {
    const key = this.key(userId, id);
    const existing = this.store.get(key);
    if (!existing || existing.etag !== expectedEtag) return null;

    const recipe: Recipe = {
      ...existing.recipe,
      ...input,
      updatedAt: new Date().toISOString(),
    };
    const record = { recipe, etag: `"${randomUUID()}"` };
    this.store.set(key, record);
    return { recipe: withEffectiveRecipeProjection(recipe), etag: record.etag };
  }

  async delete(userId: string, id: string): Promise<boolean> {
    return this.store.delete(this.key(userId, id));
  }

  async incrementUsage(userId: string, id: string): Promise<void> {
    const key = this.key(userId, id);
    const existing = this.store.get(key);
    if (!existing) return;
    const now = new Date().toISOString();
    const recipe: Recipe = {
      ...existing.recipe,
      usageCount: existing.recipe.usageCount + 1,
      lastUsedAt: now,
      updatedAt: now,
    };
    this.store.set(key, { recipe, etag: `"${randomUUID()}"` });
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
