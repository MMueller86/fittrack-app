// Cosmos-backed implementation of RecipesRepository.
// Container: recipes, partition key: /userId (= ownerUserId)
//
// Each document IS a Recipe. Images array is embedded in the document
// (blobName + order only — no transient SAS URLs stored).

import { randomUUID } from 'node:crypto';
import type { Recipe, RecipeImage, RecipeStep } from '@fittrack/shared';
import { DEFAULT_RECIPE_IMAGE_HERO_CROP } from '../../../../shared/types/recipeImageHeroCrop';
import { getCosmos } from '../cosmos';
import type {
  CreateRecipeInput,
  ListRecipesOptions,
  RecipesRepository,
  UpdateRecipeInput,
  VersionedRecipe,
} from './recipesRepository';
import { withRecipeExportViewStatus } from './recipeExport';

// Cosmos stores ownerUserId as the partition key field.
// The document shape mirrors Recipe exactly, plus a `userId` field
// that Cosmos uses as the physical partition key (/userId). SAS URLs are
// response-only and are deliberately excluded from stored image metadata.
type StoredRecipeImage = Pick<RecipeImage, 'id' | 'blobName' | 'order' | 'heroCrop'>;
type CosmosRecipeDoc = Omit<Recipe, 'images' | 'exportViewStatus'> & { images: StoredRecipeImage[]; userId: string };

function isCosmosRecipeDoc(resource: CosmosRecipeDoc | undefined): resource is CosmosRecipeDoc {
  return Boolean(resource?.id && resource.ownerUserId && resource.userId && resource.name);
}

function toStoredImages(images: RecipeImage[] | undefined): StoredRecipeImage[] {
  return (images ?? []).map(({ id, blobName, order, heroCrop }) => ({
    id,
    blobName,
    order,
    ...(heroCrop !== undefined ? { heroCrop } : {}),
  }));
}

function toRecipeSteps(steps: RecipeStep[] | undefined): RecipeStep[] {
  return (steps ?? []).map(({ order, title, description }) => ({
    order,
    ...(title !== undefined ? { title } : {}),
    description,
  }));
}

function toRecipe(doc: CosmosRecipeDoc): Recipe {
  const recipe: Recipe = {
    id: doc.id,
    ownerUserId: doc.ownerUserId,
    name: doc.name,
    description: doc.description,
    portions: doc.portions,
    ingredients: doc.ingredients,
    steps: toRecipeSteps(doc.steps),
    images: toStoredImages(doc.images).map((image) => ({
      ...image,
      heroCrop: image.heroCrop ?? DEFAULT_RECIPE_IMAGE_HERO_CROP,
    })),
    nutritionTotal: doc.nutritionTotal,
    nutritionPerPortion: doc.nutritionPerPortion,
    ...(doc.exportView !== undefined ? { exportView: doc.exportView } : {}),
    visibility: doc.visibility,
    sharedWithUserIds: doc.sharedWithUserIds,
    tags: doc.tags,
    lastUsedAt: doc.lastUsedAt,
    usageCount: doc.usageCount,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
  return withRecipeExportViewStatus(recipe);
}

function toStoredRecipe(recipe: Recipe, userId: string): CosmosRecipeDoc {
  const doc: CosmosRecipeDoc = {
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
  if (recipe.exportView !== undefined) doc.exportView = recipe.exportView;
  return doc;
}

function requireCosmosEtag(etag: string): string {
  if (!etag) throw new Error('Cosmos did not return a recipe ETag');
  return etag;
}

function isPreconditionFailed(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const details = error as { code?: unknown; statusCode?: unknown };
  return details.code === 412 || details.statusCode === 412 || details.code === 'PreconditionFailed';
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
    const versioned = await this.getVersioned(userId, id);
    return versioned?.recipe ?? null;
  }

  async getVersioned(userId: string, id: string): Promise<VersionedRecipe | null> {
    const { containers } = await getCosmos();
    const { resource, etag } = await containers.recipes.item(id, userId).read<CosmosRecipeDoc>();
    if (!isCosmosRecipeDoc(resource)) return null;
    return { recipe: toRecipe(resource), etag: requireCosmosEtag(etag) };
  }

  async create(userId: string, input: CreateRecipeInput): Promise<Recipe> {
    const versioned = await this.createVersioned(userId, input);
    return versioned.recipe;
  }

  async createVersioned(userId: string, input: CreateRecipeInput): Promise<VersionedRecipe> {
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
      ...(input.exportView !== undefined ? { exportView: input.exportView } : {}),
      visibility: 'private',
      sharedWithUserIds: [],
      tags: input.tags,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    const doc = toStoredRecipe(recipe, userId);
    const { resource, etag } = await containers.recipes.items.create<CosmosRecipeDoc>(doc);
    if (!isCosmosRecipeDoc(resource)) throw new Error('Cosmos did not return the created recipe');
    return { recipe: toRecipe(resource), etag: requireCosmosEtag(etag) };
  }

  async update(userId: string, id: string, input: UpdateRecipeInput): Promise<Recipe | null> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const existing = await this.getVersioned(userId, id);
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
    return this.replaceIfMatch(userId, id, updatedRecipe, expectedEtag);
  }

  private async replaceIfMatch(
    userId: string,
    id: string,
    recipe: Recipe,
    expectedEtag: string,
  ): Promise<VersionedRecipe | null> {
    const { containers } = await getCosmos();
    try {
      const { resource, etag } = await containers.recipes.item(id, userId).replace<CosmosRecipeDoc>(
        toStoredRecipe(recipe, userId),
        { accessCondition: { type: 'IfMatch', condition: expectedEtag } },
      );
      if (!isCosmosRecipeDoc(resource)) throw new Error('Cosmos did not return the replaced recipe');
      return { recipe: toRecipe(resource), etag: requireCosmosEtag(etag) };
    } catch (error) {
      if (isPreconditionFailed(error)) return null;
      throw error;
    }
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const { containers } = await getCosmos();
    const { resource: existing } = await containers.recipes.item(id, userId).read<CosmosRecipeDoc>();
    if (!isCosmosRecipeDoc(existing)) return false;
    await containers.recipes.item(id, userId).delete();
    return true;
  }

  async incrementUsage(userId: string, id: string): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const existing = await this.getVersioned(userId, id);
      if (!existing) return;
      const now = new Date().toISOString();
      const updatedRecipe: Recipe = {
        ...existing.recipe,
        usageCount: existing.recipe.usageCount + 1,
        lastUsedAt: now,
        updatedAt: now,
      };
      const updated = await this.replaceIfMatch(userId, id, updatedRecipe, existing.etag);
      if (updated) return;
    }
    throw new Error('Recipe changed repeatedly while incrementing usage');
  }
}
