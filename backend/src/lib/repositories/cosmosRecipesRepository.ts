// Cosmos-backed implementation of RecipesRepository.
// Container: recipes, partition key: /userId (= ownerUserId)
//
// Each document IS a Recipe. Images array is embedded in the document
// (blobName + order only — no transient SAS URLs stored).

import { randomUUID } from 'node:crypto';
import type { Recipe, RecipeImage, RecipeStep } from '@fittrack/shared';
import { getCosmos } from '../cosmos';
import type {
  CreateRecipeInput,
  ListRecipesOptions,
  RecipesRepository,
  UpdateRecipeInput,
} from './recipesRepository';

// Cosmos stores ownerUserId as the partition key field.
// The document shape mirrors Recipe exactly, plus a `userId` field
// that Cosmos uses as the physical partition key (/userId). SAS URLs are
// response-only and are deliberately excluded from stored image metadata.
type StoredRecipeImage = Pick<RecipeImage, 'id' | 'blobName' | 'order'>;
type CosmosRecipeDoc = Omit<Recipe, 'images'> & { images: StoredRecipeImage[]; userId: string };

function isCosmosRecipeDoc(resource: CosmosRecipeDoc | undefined): resource is CosmosRecipeDoc {
  return Boolean(resource?.id && resource.ownerUserId && resource.userId && resource.name);
}

function toStoredImages(images: RecipeImage[] | undefined): StoredRecipeImage[] {
  return (images ?? []).map(({ id, blobName, order }) => ({ id, blobName, order }));
}

function toRecipeSteps(steps: RecipeStep[] | undefined): RecipeStep[] {
  return (steps ?? []).map(({ order, title, description }) => ({
    order,
    ...(title !== undefined ? { title } : {}),
    description,
  }));
}

function toRecipe(doc: CosmosRecipeDoc): Recipe {
  return {
    id: doc.id,
    ownerUserId: doc.ownerUserId,
    name: doc.name,
    description: doc.description,
    portions: doc.portions,
    ingredients: doc.ingredients,
    steps: toRecipeSteps(doc.steps),
    images: toStoredImages(doc.images),
    nutritionTotal: doc.nutritionTotal,
    nutritionPerPortion: doc.nutritionPerPortion,
    visibility: doc.visibility,
    sharedWithUserIds: doc.sharedWithUserIds,
    tags: doc.tags,
    lastUsedAt: doc.lastUsedAt,
    usageCount: doc.usageCount,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function toStoredRecipe(recipe: Recipe, userId: string): CosmosRecipeDoc {
  return {
    id: recipe.id,
    ownerUserId: recipe.ownerUserId,
    name: recipe.name,
    description: recipe.description,
    portions: recipe.portions,
    ingredients: recipe.ingredients,
    steps: toRecipeSteps(recipe.steps),
    images: toStoredImages(recipe.images),
    nutritionTotal: recipe.nutritionTotal,
    nutritionPerPortion: recipe.nutritionPerPortion,
    visibility: recipe.visibility,
    sharedWithUserIds: recipe.sharedWithUserIds,
    tags: recipe.tags,
    lastUsedAt: recipe.lastUsedAt,
    usageCount: recipe.usageCount,
    createdAt: recipe.createdAt,
    updatedAt: recipe.updatedAt,
    userId,
  };
}

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
    return (opts?.limit ? sorted.slice(0, opts.limit) : sorted).map(toRecipe);
  }

  async get(userId: string, id: string): Promise<Recipe | null> {
    const { containers } = await getCosmos();
    const { resource } = await containers.recipes.item(id, userId).read<CosmosRecipeDoc>();
    return isCosmosRecipeDoc(resource) ? toRecipe(resource) : null;
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
    const doc = toStoredRecipe(recipe, userId);
    const { resource } = await containers.recipes.items.create<CosmosRecipeDoc>(doc);
    return isCosmosRecipeDoc(resource) ? toRecipe(resource) : recipe;
  }

  async update(userId: string, id: string, input: UpdateRecipeInput): Promise<Recipe | null> {
    const { containers } = await getCosmos();
    const { resource: existing } = await containers.recipes.item(id, userId).read<CosmosRecipeDoc>();
    if (!isCosmosRecipeDoc(existing)) return null;

    const existingRecipe = toRecipe(existing);
    const updatedRecipe: Recipe = {
      ...existingRecipe,
      ...input,
      images: input.images ?? existingRecipe.images,
      updatedAt: new Date().toISOString(),
    };
    const updated = toStoredRecipe(updatedRecipe, userId);
    const { resource } = await containers.recipes.item(id, userId).replace<CosmosRecipeDoc>(updated);
    return isCosmosRecipeDoc(resource) ? toRecipe(resource) : updatedRecipe;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const { containers } = await getCosmos();
    const { resource: existing } = await containers.recipes.item(id, userId).read<CosmosRecipeDoc>();
    if (!isCosmosRecipeDoc(existing)) return false;
    await containers.recipes.item(id, userId).delete();
    return true;
  }

  async incrementUsage(userId: string, id: string): Promise<void> {
    const { containers } = await getCosmos();
    const { resource: existing } = await containers.recipes.item(id, userId).read<CosmosRecipeDoc>();
    if (!isCosmosRecipeDoc(existing)) return;
    const updatedRecipe: Recipe = {
      ...toRecipe(existing),
      usageCount: existing.usageCount + 1,
      lastUsedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await containers.recipes.item(id, userId).replace<CosmosRecipeDoc>(toStoredRecipe(updatedRecipe, userId));
  }
}
