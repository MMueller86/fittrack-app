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
  RecipeVisibilityInput,
} from '@fittrack/shared';
import { DEFAULT_RECIPE_IMAGE_HERO_CROP } from '../../../../shared/types/recipeImageHeroCrop';
import { isCosmosConfigured } from '../cosmos';
import { CosmosRecipesRepository } from './cosmosRecipesRepository';
import { withRecipeExportViewStatus } from './recipeExport';
import { applyRecipeVisibility, communityPageSize, effectiveRecipeVisibility } from './recipePublication';
import { resolveRecipeIngredientProvenance } from './recipeIngredientProvenance';

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

export interface ListCommunityRecipesOptions {
  limit?: number;
  continuationToken?: string;
}

export interface CommunityRecipeRepositoryPage {
  recipes: Recipe[];
  continuationToken?: string;
}

function withEffectiveRecipeProjection(recipe: Recipe): Recipe {
  return withRecipeExportViewStatus({
    ...structuredClone(recipe),
    visibility: effectiveRecipeVisibility(recipe.visibility),
    sharedWithUserIds: structuredClone(recipe.sharedWithUserIds ?? []),
    images: recipe.images.map(({ id, blobName, order, heroCrop }) => ({
      id, blobName, order,
      heroCrop: structuredClone(heroCrop ?? DEFAULT_RECIPE_IMAGE_HERO_CROP),
    })),
  });
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface RecipesRepository {
  list(userId: string, opts?: ListRecipesOptions): Promise<Recipe[]>;
  listCommunity(opts?: ListCommunityRecipesOptions): Promise<CommunityRecipeRepositoryPage>;
  getCommunityById(id: string): Promise<Recipe | null>;
  setVisibility(userId: string, id: string, expectedEtag: string, input: RecipeVisibilityInput): Promise<VersionedRecipe | null>;
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

  async getCommunityById(id: string): Promise<Recipe | null> {
    const matches = [...this.store.values()].filter(({ recipe }) => recipe.id === id);
    return matches.length === 1 && matches[0].recipe.visibility === 'community'
      ? withEffectiveRecipeProjection(matches[0].recipe) : null;
  }

  async listCommunity(opts: ListCommunityRecipesOptions = {}): Promise<CommunityRecipeRepositoryPage> {
    const limit = communityPageSize(opts.limit);
    const offset = opts.continuationToken === undefined ? 0 : Number(opts.continuationToken);
    if (!Number.isSafeInteger(offset) || offset < 0 || (opts.continuationToken !== undefined && String(offset) !== opts.continuationToken)) {
      throw new Error('Invalid community continuation token');
    }
    const all = [...this.store.values()].map(({ recipe }) => recipe)
      .filter((recipe) => recipe.visibility === 'community')
      .filter((recipe) => [...this.store.values()].filter((record) => record.recipe.id === recipe.id).length === 1)
      .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
    return {
      recipes: all.slice(offset, offset + limit).map(withEffectiveRecipeProjection),
      ...(offset + limit < all.length ? { continuationToken: String(offset + limit) } : {}),
    };
  }

  async setVisibility(userId: string, id: string, expectedEtag: string, input: RecipeVisibilityInput): Promise<VersionedRecipe | null> {
    const key = this.key(userId, id);
    const existing = this.store.get(key);
    if (!existing || existing.etag !== expectedEtag) return null;
    const recipe = applyRecipeVisibility(existing.recipe, input);
    const record = { recipe, etag: `"${randomUUID()}"` };
    this.store.set(key, record);
    return { recipe: withEffectiveRecipeProjection(recipe), etag: record.etag };
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
    const ingredients = await resolveRecipeIngredientProvenance(userId, input.ingredients);
    const now = new Date().toISOString();
    const recipe: Recipe = {
      id: randomUUID(),
      ownerUserId: userId,
      name: input.name,
      description: input.description,
      portions: input.portions,
      ingredients,
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
    const record = { recipe: structuredClone(recipe), etag: `"${randomUUID()}"` };
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

    const ingredients = input.ingredients === undefined ? existing.recipe.ingredients
      : await resolveRecipeIngredientProvenance(userId, input.ingredients, existing.recipe.ingredients);
    if (this.store.get(key)?.etag !== expectedEtag) return null;
    const recipe: Recipe = {
      ...existing.recipe,
      ...input,
      id: existing.recipe.id,
      ownerUserId: existing.recipe.ownerUserId,
      visibility: effectiveRecipeVisibility(existing.recipe.visibility),
      communityPublication: existing.recipe.communityPublication,
      sharedWithUserIds: existing.recipe.sharedWithUserIds,
      ingredients,
      images: (input.images ?? existing.recipe.images).map(({ id: imageId, blobName, order, heroCrop }) => ({
        id: imageId, blobName, order, ...(heroCrop !== undefined ? { heroCrop } : {}),
      })),
      updatedAt: new Date().toISOString(),
    };
    const record = { recipe: structuredClone(recipe), etag: `"${randomUUID()}"` };
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
      visibility: effectiveRecipeVisibility(existing.recipe.visibility),
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
