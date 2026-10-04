// Contract tests for CosmosRecipesRepository.
//
// These tests run against the local Azure Cosmos DB Linux Emulator (Docker)
// and exercise the same code path that runs in production. They MUST NOT be
// pointed at real Azure Cosmos DB — see vitest.contract.config.mts.
//
// What this catches that unit tests cannot:
//   - Cosmos query parameter name typos (e.g. @userId vs @ownerUserId).
//   - Partition-key field presence (/userId) — docs missing the field are
//     stored under a null PK and become unretrievable.
//   - Read-after-write consistency (create → get roundtrip).
//   - Cross-user isolation (user A cannot see user B's recipes).

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  type EmulatorContext,
  createTestDatabase,
  destroyTestDatabase,
  setupEmulatorEnv,
} from '../../test-utils/cosmosEmulator';
import { __resetCosmosForTests } from '../cosmos';
import { CosmosRecipesRepository } from './cosmosRecipesRepository';
import type { CreateRecipeInput } from './recipesRepository';
import { createRecipeExportView } from './recipeExport';
import { DEFAULT_RECIPE_IMAGE_HERO_CROP } from '../../../../shared/types/recipeImageHeroCrop';
import { projectCommunityRecipe, projectRecipeReferenceAccess, resolveRecipeForRead } from '../communityRecipes';
import { getReusableItemsRepository, __resetReusableItemsRepositoryForTests } from './reusableItemsRepository';
import { _resetFoodProductRepository } from './foodProductRepository';
import { getProfileRepository, __resetProfileRepositoryForTests } from './profileRepository';

let ctx: EmulatorContext | undefined;
let repo: CosmosRecipesRepository;

beforeAll(async () => {
  const { databaseId } = setupEmulatorEnv();
  ctx = await createTestDatabase(databaseId);
  __resetCosmosForTests();
  repo = new CosmosRecipesRepository();
});

afterAll(async () => {
  await destroyTestDatabase(ctx);
  __resetCosmosForTests();
});

async function clearRecipes(userIds: string[]): Promise<void> {
  const container = ctx!.database.container('recipes');
  for (const userId of userIds) {
    const { resources } = await container.items
      .query<{ id: string }>(
        { query: 'SELECT c.id FROM c WHERE c.userId = @u', parameters: [{ name: '@u', value: userId }] },
        { partitionKey: userId },
      )
      .fetchAll();
    for (const r of resources) {
      await container.item(r.id, userId).delete();
    }
  }
}

const USER_A = 'contract-recipes-a';
const USER_B = 'contract-recipes-b';

beforeEach(async () => {
  await clearRecipes([USER_A, USER_B]);
  __resetReusableItemsRepositoryForTests();
  _resetFoodProductRepository();
  __resetProfileRepositoryForTests();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseIngredient = {
  id: '00000000-0000-0000-0000-000000000001',
  displayName: 'Mehl',
  inputMode: 'grams' as const,
  inputAmount: 500,
  amountGrams: 500,
  unit: 'g',
  linkedProductId: null,
  linkedReusableItemId: null,
  isAiEstimate: false,
  nutritionPer100g: { calories: 340, protein: 10, carbs: 72, fat: 1, fiber: 3 },
  nutritionContribution: { calories: 1700, protein: 50, carbs: 360, fat: 5, fiber: 15 },
};

const baseExportViewInput = {
  version: 1 as const,
  teaser: 'Einfaches Sauerteigbrot',
  totalTimeMinutes: 90,
  difficulty: 'Einfach',
  steps: [{ order: 1, description: 'Zutaten mischen und backen.' }],
  includedIngredientIds: [baseIngredient.id],
};

function makeInput(overrides: Partial<CreateRecipeInput> = {}): CreateRecipeInput {
  return {
    name: 'Sauerteigbrot',
    description: 'Ein einfaches Brot',
    portions: 4,
    ingredients: [baseIngredient],
    steps: [{ order: 1, description: 'Zutaten mischen und backen.' }],
    tags: ['Brot'],
    nutritionTotal: { calories: 1700, protein: 50, carbs: 360, fat: 5, fiber: 15 },
    nutritionPerPortion: { calories: 425, protein: 12.5, carbs: 90, fat: 1.25, fiber: 3.75 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CosmosRecipesRepository (contract)', () => {
  it('reads legacy missing/unknown visibility as private and never grants access through sharedWithUserIds', async () => {
    for (const visibility of [undefined, 'public', 'PRIVATE']) {
      const created = await repo.create(USER_A, makeInput());
      const container = ctx!.database.container('recipes');
      const { resource } = await container.item(created.id, USER_A).read<Record<string, unknown>>();
      delete resource!.visibility;
      delete resource!.communityPublication;
      delete (resource!.ingredients as Array<Record<string, unknown>>)[0].nutritionSource;
      if (visibility !== undefined) resource!.visibility = visibility;
      resource!.sharedWithUserIds = [USER_B];
      await container.item(created.id, USER_A).replace(resource!);
      const legacy = await repo.get(USER_A, created.id);
      expect(legacy?.visibility).toBe('private');
      expect(legacy?.ingredients[0].nutritionSource).toBeUndefined();
      expect(await repo.getCommunityById(created.id)).toBeNull();
      expect(await resolveRecipeForRead(USER_B, created.id, repo)).toEqual({ access: 'unavailable', recipe: null });
    }
    expect((await repo.listCommunity()).recipes).toEqual([]);
  });

  it('paginates explicit community recipes across two partitions, ordered by updatedAt', async () => {
    const expected: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      const owner = index % 2 === 0 ? USER_A : USER_B;
      const created = await repo.createVersioned(owner, makeInput({ name: `Published ${index}` }));
      await repo.setVisibility(owner, created.recipe.id, created.etag, { visibility: 'community', contentConfirmed: true, displayNameConsent: false });
      const container = ctx!.database.container('recipes');
      const { resource } = await container.item(created.recipe.id, owner).read<Record<string, unknown>>();
      resource!.updatedAt = `2026-10-0${index + 1}T12:00:00.000Z`;
      await container.item(created.recipe.id, owner).replace(resource!);
      expected.unshift(created.recipe.id);
    }
    await repo.create(USER_A, makeInput({ name: 'Private A' }));
    await repo.create(USER_B, makeInput({ name: 'Private B' }));
    const ids: string[] = [];
    let continuationToken: string | undefined;
    let pages = 0;
    do {
      const page = await repo.listCommunity({ limit: 2, continuationToken });
      expect(page.recipes.length).toBeLessThanOrEqual(2);
      ids.push(...page.recipes.map((recipe) => recipe.id));
      continuationToken = page.continuationToken;
      pages += 1;
      if (pages > 20) throw new Error('Community pagination did not terminate');
    } while (continuationToken);
    expect(ids).toEqual(expected);
    expect(pages).toBeGreaterThan(1);
    expect(await repo.get(USER_B, expected[0])).toBeNull();
    expect((await repo.getCommunityById(expected[0]))?.ownerUserId).toBe(USER_A);
  });

  it('rejects foreign/stale publication writes and preserves publication on content, image and usage writes', async () => {
    const created = await repo.createVersioned(USER_A, makeInput());
    expect(created.recipe.visibility).toBe('private');
    expect(await repo.setVisibility(USER_B, created.recipe.id, created.etag, { visibility: 'community', contentConfirmed: true, displayNameConsent: true })).toBeNull();
    const published = await repo.setVisibility(USER_A, created.recipe.id, created.etag, { visibility: 'community', contentConfirmed: true, displayNameConsent: true });
    expect(published?.recipe.communityPublication?.contentConfirmedAt).toBeTruthy();
    expect(await repo.setVisibility(USER_A, created.recipe.id, created.etag, { visibility: 'private' })).toBeNull();
    await repo.update(USER_A, created.recipe.id, { name: 'Changed', images: [{ id: 'image', blobName: 'private/blob', order: 1 }] });
    await repo.incrementUsage(USER_A, created.recipe.id);
    const current = await repo.getVersioned(USER_A, created.recipe.id);
    expect(current?.recipe.communityPublication).toEqual(published?.recipe.communityPublication);
    expect(current?.recipe.visibility).toBe('community');
    expect(await repo.setVisibility(USER_A, created.recipe.id, published!.etag, { visibility: 'private' })).toBeNull();
    const revoked = await repo.setVisibility(USER_A, created.recipe.id, current!.etag, { visibility: 'private' });
    expect(revoked?.recipe.communityPublication).toBeUndefined();
    const { resource } = await ctx!.database.container('recipes').item(created.recipe.id, USER_A).read<Record<string, unknown>>();
    expect(resource).not.toHaveProperty('communityPublication');
    expect(await repo.getCommunityById(created.recipe.id)).toBeNull();
  });

  it('fails closed for duplicate IDs, even when the other partition contains a private recipe', async () => {
    const created = await repo.createVersioned(USER_A, makeInput());
    await repo.setVisibility(USER_A, created.recipe.id, created.etag, { visibility: 'community', contentConfirmed: true, displayNameConsent: false });
    const container = ctx!.database.container('recipes');
    const { resource } = await container.item(created.recipe.id, USER_A).read<Record<string, unknown>>();
    await container.items.create({ ...resource, userId: USER_B, ownerUserId: USER_B, visibility: 'private' });
    expect(await repo.getCommunityById(created.recipe.id)).toBeNull();
    expect((await repo.listCommunity()).recipes).toEqual([]);
    expect((await resolveRecipeForRead(USER_B, created.recipe.id, repo)).access).toBe('owner');
    expect(await repo.get(USER_A, created.recipe.id)).not.toBeNull();
  });

  it('projects missing consent anonymously and reads only the current consenting profile', async () => {
    const created = await repo.createVersioned(USER_A, makeInput());
    const published = await repo.setVisibility(USER_A, created.recipe.id, created.etag, { visibility: 'community', contentConfirmed: true, displayNameConsent: false });
    const imagePath = (recipeId: string, imageId: string) => `/api/test-recipes/${recipeId}/images/${imageId}`;
    await ctx!.database.container('nutritionProfiles').items.upsert({ id: 'profile', userId: USER_A, displayName: 'Current author' });
    expect((await projectCommunityRecipe(published!.recipe, USER_B, imagePath, getProfileRepository())).authorDisplayName).toBe('Anonymous');
    const consented = await repo.setVisibility(USER_A, created.recipe.id, published!.etag, { visibility: 'community', contentConfirmed: true, displayNameConsent: true });
    expect((await projectCommunityRecipe(consented!.recipe, USER_B, imagePath, getProfileRepository())).authorDisplayName).toBe('Current author');
    await ctx!.database.container('nutritionProfiles').items.upsert({ id: 'profile', userId: USER_A, displayName: 'New name' });
    expect((await projectCommunityRecipe(consented!.recipe, USER_B, imagePath, getProfileRepository())).authorDisplayName).toBe('New name');
    const container = ctx!.database.container('recipes');
    const { resource } = await container.item(created.recipe.id, USER_A).read<Record<string, unknown>>();
    delete resource!.communityPublication;
    await container.item(created.recipe.id, USER_A).replace(resource!);
    const legacy = await repo.getCommunityById(created.recipe.id);
    expect((await projectCommunityRecipe(legacy!, USER_B, imagePath, getProfileRepository())).authorDisplayName).toBe('Anonymous');
  });

  it('snapshots provenance from owner-only library, retains legacy unknown and rejects new contradictions', async () => {
    const library = getReusableItemsRepository();
    const manual = await library.create({ userId: USER_A, name: 'Manual', sourceType: 'manual', nutritionBasis: 'per100g', nutritionPer100g: baseIngredient.nutritionPer100g, isComplete: true });
    const foreign = await library.create({ userId: USER_B, name: 'Foreign', sourceType: 'manual', nutritionBasis: 'per100g', nutritionPer100g: baseIngredient.nutritionPer100g, isComplete: true });
    const created = await repo.create(USER_A, makeInput({ ingredients: [
      { ...baseIngredient, linkedProductId: manual.id },
      { ...baseIngredient, id: 'foreign', linkedReusableItemId: foreign.id },
      { ...baseIngredient, id: 'unknown' },
      { ...baseIngredient, id: 'ai', isAiEstimate: true },
    ] }));
    expect(created.ingredients.map((ingredient) => ingredient.nutritionSource)).toEqual(['manual', 'unknown', 'unknown', 'ai']);
    const container = ctx!.database.container('recipes');
    const { resource } = await container.item(created.id, USER_A).read<Record<string, unknown>>();
    const oldIngredients = resource!.ingredients as Array<Record<string, unknown>>;
    delete oldIngredients[0].nutritionSource;
    oldIngredients[3].nutritionSource = 'manual';
    await container.item(created.id, USER_A).replace(resource!);
    const legacy = await repo.getVersioned(USER_A, created.id);
    const updated = await repo.compareAndReplace(USER_A, created.id, legacy!.etag, { ingredients: legacy!.recipe.ingredients });
    expect(updated?.recipe.ingredients.map((ingredient) => ingredient.nutritionSource)).toEqual(['unknown', 'unknown', 'unknown', 'ai']);
    await expect(repo.create(USER_A, makeInput({ ingredients: [{ ...baseIngredient, isAiEstimate: true, nutritionSource: 'manual' }] }))).rejects.toThrow('Contradictory');
  });

  it('keeps recipe references at original IDs and access status response-only', async () => {
    const created = await repo.createVersioned(USER_A, makeInput());
    const relation = { id: `${USER_B}:${created.recipe.id}`, userId: USER_B, foodRefType: 'recipe' as const, foodRef: created.recipe.id, displayName: 'Snapshot', isFavorite: true, lastUsedAt: null, usageCount: 0, createdAt: new Date().toISOString() };
    await ctx!.database.container('userFoodRelations').items.create(relation);
    const projected = await projectRecipeReferenceAccess(USER_B, relation, repo);
    expect(projected.recipeAccess).toBe('unavailable');
    expect(projected.foodRef).toBe(created.recipe.id);
    const raw = await ctx!.database.container('userFoodRelations').item(relation.id, USER_B).read<Record<string, unknown>>();
    expect(raw.resource).not.toHaveProperty('recipeAccess');
  });

  it('resolves existing OFF, AI and label-scan sources and retains their snapshots after library changes', async () => {
    const productId = 'openFoodFacts:contract-community';
    await ctx!.database.container('foodProducts').items.upsert({ id: productId, source: 'openFoodFacts', name: 'Catalog ingredient' });
    const ai = await getReusableItemsRepository().create({ userId: USER_A, name: 'AI', sourceType: 'ai', nutritionBasis: 'per100g', nutritionPer100g: baseIngredient.nutritionPer100g, isComplete: true });
    const label = await getReusableItemsRepository().create({ userId: USER_A, name: 'Label', sourceType: 'label-scan', nutritionBasis: 'per100g', nutritionPer100g: baseIngredient.nutritionPer100g, isComplete: true });
    const created = await repo.create(USER_A, makeInput({ ingredients: [
      { ...baseIngredient, linkedProductId: productId },
      { ...baseIngredient, id: 'ai-source', linkedReusableItemId: ai.id, isAiEstimate: true },
      { ...baseIngredient, id: 'label-source', linkedReusableItemId: label.id },
      { ...baseIngredient, id: 'missing-source', linkedProductId: 'openFoodFacts:missing' },
    ] }));
    expect(created.ingredients.map((ingredient) => ingredient.nutritionSource)).toEqual(['openFoodFacts', 'ai', 'label-scan', 'unknown']);
    await ctx!.database.container('reusableMealItems').item(label.id, USER_A).replace({ ...label, sourceType: 'manual' });
    const updated = await repo.update(USER_A, created.id, { ingredients: created.ingredients });
    expect(updated?.ingredients[2].nutritionSource).toBe('label-scan');
  });

  it('allows exactly one concurrent visibility write against a revision', async () => {
    const created = await repo.createVersioned(USER_A, makeInput());
    const results = await Promise.all([
      repo.setVisibility(USER_A, created.recipe.id, created.etag, { visibility: 'community', contentConfirmed: true, displayNameConsent: true }),
      repo.setVisibility(USER_A, created.recipe.id, created.etag, { visibility: 'community', contentConfirmed: true, displayNameConsent: false }),
    ]);
    expect(results.filter((result) => result !== null)).toHaveLength(1);
    const winner = results.find((result) => result !== null)!;
    expect((await repo.get(USER_A, created.recipe.id))?.communityPublication).toEqual(winner.recipe.communityPublication);
  });

  // ---- create + get roundtrip -------------------------------------------

  it('create stores the recipe and get retrieves it by id', async () => {
    const created = await repo.create(USER_A, makeInput());

    expect(created.id).toBeTruthy();
    expect(created.ownerUserId).toBe(USER_A);
    expect(created.name).toBe('Sauerteigbrot');

    // THIS is the regression test: if userId field is missing as Cosmos PK,
    // get() returns null even though create() returned an id.
    const fetched = await repo.get(USER_A, created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(created.id);
    expect(fetched!.name).toBe('Sauerteigbrot');
  });

  it('reads a historical recipe without category and amountLabel', async () => {
    const historicalRecipe = {
      id: '00000000-0000-0000-0000-000000000101',
      userId: USER_A,
      ownerUserId: USER_A,
      name: 'Historisches Rezept',
      description: 'Vor der Erweiterung des Ingredient-Modells',
      portions: 2,
      ingredients: [{
        id: '00000000-0000-0000-0000-000000000102',
        displayName: 'Reis',
        inputMode: 'grams' as const,
        inputAmount: 200,
        amountGrams: 200,
        unit: 'g',
        linkedProductId: null,
        linkedReusableItemId: null,
        isAiEstimate: false,
        nutritionPer100g: { calories: 350, protein: 7, carbs: 78, fat: 1, fiber: 2 },
        nutritionContribution: { calories: 700, protein: 14, carbs: 156, fat: 2, fiber: 4 },
      }],
      steps: [{ order: 1, description: 'Reis kochen.' }],
      images: [],
      nutritionTotal: { calories: 700, protein: 14, carbs: 156, fat: 2, fiber: 4 },
      nutritionPerPortion: { calories: 350, protein: 7, carbs: 78, fat: 1, fiber: 2 },
      visibility: 'private' as const,
      sharedWithUserIds: [],
      tags: ['Historisch'],
      usageCount: 3,
      createdAt: '2026-01-10T10:00:00.000Z',
      updatedAt: '2026-01-11T10:00:00.000Z',
    };

    await ctx!.database.container('recipes').items.create(historicalRecipe);

    const fetched = await repo.get(USER_A, historicalRecipe.id);

    expect(fetched).not.toBeNull();
    const { userId: partitionKey, ...expectedRecipe } = historicalRecipe;
    expect(partitionKey).toBe(USER_A);
    expect(fetched).toMatchObject(expectedRecipe);
    expect(fetched).not.toHaveProperty('userId');
    expect(fetched!.ingredients[0]).not.toHaveProperty('category');
    expect(fetched!.ingredients[0]).not.toHaveProperty('amountLabel');
    expect(fetched).not.toHaveProperty('exportView');
    expect(fetched).not.toHaveProperty('exportViewStatus');

    const versioned = await repo.getVersioned(USER_A, historicalRecipe.id);
    expect(versioned?.etag).toBeTruthy();
    const updated = await repo.compareAndReplace(USER_A, historicalRecipe.id, versioned!.etag, {
      name: 'Historisches Rezept aktualisiert',
    });
    expect(updated?.recipe.name).toBe('Historisches Rezept aktualisiert');

    const rawAfterUpdate = await ctx!.database.container('recipes')
      .item(historicalRecipe.id, USER_A)
      .read<Record<string, unknown>>();
    expect(rawAfterUpdate.resource).not.toHaveProperty('exportView');
    expect(rawAfterUpdate.resource).not.toHaveProperty('exportViewStatus');
  });

  it('roundtrips exportView and derives status without persisting the status field', async () => {
    const input = makeInput();
    const exportView = createRecipeExportView(baseExportViewInput, input);
    const created = await repo.create(USER_A, { ...input, exportView });

    expect(created.exportView).toEqual(exportView);
    expect(created.exportViewStatus).toBe('current');

    const raw = await ctx!.database.container('recipes').item(created.id, USER_A).read<Record<string, unknown>>();
    expect(raw.resource?.['exportView']).toEqual(exportView);
    expect(raw.resource).not.toHaveProperty('exportViewStatus');

    const fetched = await repo.get(USER_A, created.id);
    expect(fetched?.exportView).toEqual(exportView);
    expect(fetched?.exportViewStatus).toBe('current');
  });

  it('preserves exportView on an update without the field and derives stale after a source change', async () => {
    const input = makeInput();
    const exportView = createRecipeExportView(baseExportViewInput, input);
    const created = await repo.create(USER_A, { ...input, exportView });

    const updated = await repo.update(USER_A, created.id, { name: 'Dinkelbrot' });
    expect(updated?.exportView).toEqual(exportView);
    expect(updated?.exportViewStatus).toBe('stale');

    const fetched = await repo.get(USER_A, created.id);
    expect(fetched?.exportView).toEqual(exportView);
    expect(fetched?.exportViewStatus).toBe('stale');
  });

  it('returns Cosmos ETags and rejects stale compare-and-replace without partial writes', async () => {
    const created = await repo.createVersioned(USER_A, makeInput());
    expect(created.etag).toBeTruthy();

    const committed = await repo.compareAndReplace(USER_A, created.recipe.id, created.etag, {
      name: 'Committed name',
    });
    expect(committed?.recipe.name).toBe('Committed name');
    expect(committed?.etag).toBeTruthy();
    expect(committed?.etag).not.toBe(created.etag);

    const stale = await repo.compareAndReplace(USER_A, created.recipe.id, created.etag, {
      name: 'Must not persist',
    });
    expect(stale).toBeNull();

    const current = await repo.getVersioned(USER_A, created.recipe.id);
    expect(current?.recipe.name).toBe('Committed name');
    expect(current?.etag).toBe(committed?.etag);
  });

  it('applies the deterministic heroCrop default when a legacy image has no metadata', async () => {
    const historicalRecipe = {
      id: '00000000-0000-0000-0000-000000000104',
      userId: USER_A,
      ownerUserId: USER_A,
      name: 'Historisches Bildrezept',
      portions: 2,
      ingredients: [],
      steps: [],
      images: [{
        id: 'legacy-image',
        blobName: `${USER_A}/legacy-image.jpg`,
        order: 1,
      }],
      nutritionTotal: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      nutritionPerPortion: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      visibility: 'private' as const,
      sharedWithUserIds: [],
      tags: [],
      usageCount: 0,
      createdAt: '2026-01-10T10:00:00.000Z',
      updatedAt: '2026-01-10T10:00:00.000Z',
    };

    await ctx!.database.container('recipes').items.create(historicalRecipe);

    const fetched = await repo.get(USER_A, historicalRecipe.id);

    expect(fetched?.images[0]?.heroCrop).toEqual(DEFAULT_RECIPE_IMAGE_HERO_CROP);
  });

  it('stores image order without transient SAS URLs', async () => {
    const created = await repo.create(USER_A, makeInput());
    const images = [
      {
        id: 'image-a',
        blobName: `${USER_A}/${created.id}/image-a.jpg`,
        order: 1,
        url: 'https://blob.example/image-a?sas=temporary',
      },
      {
        id: 'image-b',
        blobName: `${USER_A}/${created.id}/image-b.jpg`,
        order: 2,
        url: 'https://blob.example/image-b?sas=temporary',
      },
    ];

    await repo.update(USER_A, created.id, { images });

    const raw = await ctx!.database.container('recipes').item(created.id, USER_A).read<Record<string, unknown>>();
    expect(raw.resource?.['images']).toEqual([
      { id: 'image-a', blobName: `${USER_A}/${created.id}/image-a.jpg`, order: 1 },
      { id: 'image-b', blobName: `${USER_A}/${created.id}/image-b.jpg`, order: 2 },
    ]);

    const fetched = await repo.get(USER_A, created.id);
    expect(fetched?.images).toEqual([
      {
        id: 'image-a',
        blobName: `${USER_A}/${created.id}/image-a.jpg`,
        order: 1,
        heroCrop: DEFAULT_RECIPE_IMAGE_HERO_CROP,
      },
      {
        id: 'image-b',
        blobName: `${USER_A}/${created.id}/image-b.jpg`,
        order: 2,
        heroCrop: DEFAULT_RECIPE_IMAGE_HERO_CROP,
      },
    ]);
  });

  it('stores and preserves heroCrop metadata without transient SAS URLs', async () => {
    const created = await repo.create(USER_A, makeInput());
    const heroCrop = { ...DEFAULT_RECIPE_IMAGE_HERO_CROP, focusX: 0.18, zoom: 1.4 };
    const images = [{
      id: 'image-crop',
      blobName: `${USER_A}/${created.id}/image-crop.jpg`,
      order: 1,
      heroCrop,
      url: 'https://blob.example/image-crop?sas=temporary',
    }];

    await repo.update(USER_A, created.id, { images });

    const raw = await ctx!.database.container('recipes').item(created.id, USER_A).read<Record<string, unknown>>();
    expect(raw.resource?.['images']).toEqual([{
      id: 'image-crop',
      blobName: `${USER_A}/${created.id}/image-crop.jpg`,
      order: 1,
      heroCrop,
    }]);

    const fetched = await repo.get(USER_A, created.id);
    expect(fetched?.images).toEqual([{
      id: 'image-crop',
      blobName: `${USER_A}/${created.id}/image-crop.jpg`,
      order: 1,
      heroCrop,
    }]);
  });

  it('does not expose or persist root-level notes or step notes', async () => {
    const historicalRecipe = {
      id: '00000000-0000-0000-0000-000000000103',
      userId: USER_A,
      ownerUserId: USER_A,
      name: 'Notizen-Rezept',
      portions: 2,
      ingredients: [],
      steps: [{ order: 1, description: 'Backen.', notes: 'Nicht zu dunkel werden lassen.' }],
      images: [],
      notes: 'Dieses Root-Feld darf nicht persistiert werden.',
      nutritionTotal: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      nutritionPerPortion: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      visibility: 'private' as const,
      sharedWithUserIds: [],
      tags: [],
      usageCount: 0,
      createdAt: '2026-01-10T10:00:00.000Z',
      updatedAt: '2026-01-10T10:00:00.000Z',
    };

    await ctx!.database.container('recipes').items.create(historicalRecipe);

    await repo.update(USER_A, historicalRecipe.id, { name: 'Aktualisiertes Rezept' });

    const raw = await ctx!.database.container('recipes').item(historicalRecipe.id, USER_A).read<Record<string, unknown>>();
    expect(raw.resource).not.toHaveProperty('notes');
    expect(raw.resource?.['steps']).toEqual([
      { order: 1, description: 'Backen.' },
    ]);

    const fetched = await repo.get(USER_A, historicalRecipe.id);
    expect(fetched).not.toHaveProperty('notes');
    expect(fetched?.steps[0]).toEqual({
      order: 1,
      description: 'Backen.',
    });
  });

  // ---- list uses correct query parameter --------------------------------

  it('list returns created recipes for the correct user', async () => {
    // Regression test: if the query uses @ownerUserId but the parameter is
    // named @userId (or vice versa), Cosmos returns 0 rows silently.
    await repo.create(USER_A, makeInput({ name: 'Brot 1' }));
    await repo.create(USER_A, makeInput({ name: 'Brot 2' }));

    const recipes = await repo.list(USER_A);
    expect(recipes).toHaveLength(2);
    expect(recipes.map((r) => r.name).sort()).toEqual(['Brot 1', 'Brot 2'].sort());
  });

  it('list returns empty for a user with no recipes', async () => {
    await repo.create(USER_A, makeInput());

    const recipes = await repo.list(USER_B);
    expect(recipes).toHaveLength(0);
  });

  // ---- cross-user isolation --------------------------------------------

  it('get returns null when the recipe belongs to a different user', async () => {
    const created = await repo.create(USER_A, makeInput());

    const result = await repo.get(USER_B, created.id);
    expect(result).toBeNull();
  });

  // ---- update ----------------------------------------------------------

  it('update changes name and recalculates updated fields', async () => {
    const created = await repo.create(USER_A, makeInput());

    const updated = await repo.update(USER_A, created.id, { name: 'Dinkelbrot' });
    expect(updated).not.toBeNull();
    expect(updated!.name).toBe('Dinkelbrot');

    // Persisted?
    const fetched = await repo.get(USER_A, created.id);
    expect(fetched!.name).toBe('Dinkelbrot');
  });

  it('update returns null for a non-existent recipe', async () => {
    const result = await repo.update(USER_A, '00000000-0000-0000-0000-000000000000', { name: 'X' });
    expect(result).toBeNull();
  });

  // ---- delete ----------------------------------------------------------

  it('delete removes the recipe and get returns null afterward', async () => {
    const created = await repo.create(USER_A, makeInput());

    const deleted = await repo.delete(USER_A, created.id);
    expect(deleted).toBe(true);

    const fetched = await repo.get(USER_A, created.id);
    expect(fetched).toBeNull();
  });

  it('delete returns false for a non-existent recipe', async () => {
    const result = await repo.delete(USER_A, '00000000-0000-0000-0000-000000000000');
    expect(result).toBe(false);
  });

  // ---- incrementUsage --------------------------------------------------

  it('incrementUsage increases usageCount and sets lastUsedAt', async () => {
    const created = await repo.create(USER_A, makeInput());
    expect(created.usageCount).toBe(0);
    expect(created.lastUsedAt).toBeUndefined();

    await repo.incrementUsage(USER_A, created.id);

    const fetched = await repo.get(USER_A, created.id);
    expect(fetched!.usageCount).toBe(1);
    expect(fetched!.lastUsedAt).toBeTruthy();
  });
});
