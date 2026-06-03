// Cosmos-backed implementation of RecipesRepository.
// Container: recipes, partition key: /userId (= ownerUserId)
//
// Each document IS a Recipe. Images array is embedded in the document
// (blobName + order only — no transient SAS URLs stored).

import { randomUUID } from 'node:crypto';
import type { Recipe } from '@fittrack/shared';
import { getCosmos } from '../cosmos';
import type {
  CreateRecipeInput,
  ListRecipesOptions,
  RecipesRepository,
  UpdateRecipeInput,
} from './recipesRepository';

// Cosmos stores ownerUserId as the partition key field.
// The document shape mirrors Recipe exactly, plus a `userId` field
// that Cosmos uses as the physical partition key (/userId).
type CosmosRecipeDoc = Recipe & { userId: string };

export class CosmosRecipesRepository implements RecipesRepository {
  async list(userId: string, opts?: ListRecipesOptions): Promise<Recipe[]> {
    const { containers } = await getCosmos();
    const { resources } = await containers.recipes.items
      .query<CosmosRecipeDoc>(
        {
          query: 'SELECT * FROM c WHERE c.ownerUserId = @userId',
          parameters: [{ name: '@userId', value: userId }],
        },
        { partitionKey: userId },
      )
      .fetchAll();
    // Sort in application code — avoids a Cosmos composite index requirement.
    const sorted = resources.sort((a, b) => {
      const aKey = a.lastUsedAt ?? a.updatedAt;
      const bKey = b.lastUsedAt ?? b.updatedAt;
      return bKey.localeCompare(aKey);
    });
    return opts?.limit ? sorted.slice(0, opts.limit) : sorted;
  }

  async get(userId: string, id: string): Promise<Recipe | null> {
    const { containers } = await getCosmos();
    const { resource } = await containers.recipes.item(id, userId).read<CosmosRecipeDoc>();
    return resource ?? null;
  }

  async create(userId: string, input: CreateRecipeInput): Promise<Recipe> {
    const { containers } = await getCosmos();
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
    // Store with `userId` field so Cosmos can use it as partition key (/userId)
    const doc: CosmosRecipeDoc = { ...recipe, userId };
    const { resource } = await containers.recipes.items.create<CosmosRecipeDoc>(doc);
    return resource ?? recipe;
  }

  async update(userId: string, id: string, input: UpdateRecipeInput): Promise<Recipe | null> {
    const { containers } = await getCosmos();
    const { resource: existing } = await containers.recipes.item(id, userId).read<CosmosRecipeDoc>();
    if (!existing) return null;

    const updated: CosmosRecipeDoc = {
      ...existing,
      ...input,
      userId,
      updatedAt: new Date().toISOString(),
    };
    const { resource } = await containers.recipes.item(id, userId).replace<CosmosRecipeDoc>(updated);
    return resource ?? updated;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const { containers } = await getCosmos();
    const { resource: existing } = await containers.recipes.item(id, userId).read<CosmosRecipeDoc>();
    if (!existing) return false;
    await containers.recipes.item(id, userId).delete();
    return true;
  }

  async incrementUsage(userId: string, id: string): Promise<void> {
    const { containers } = await getCosmos();
    const { resource: existing } = await containers.recipes.item(id, userId).read<CosmosRecipeDoc>();
    if (!existing) return;
    const updated: CosmosRecipeDoc = {
      ...existing,
      userId,
      usageCount: existing.usageCount + 1,
      lastUsedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await containers.recipes.item(id, userId).replace<CosmosRecipeDoc>(updated);
  }
}
