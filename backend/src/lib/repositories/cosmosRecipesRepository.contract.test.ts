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
    expect(fetched).toMatchObject(historicalRecipe);
    expect(fetched!.ingredients[0]).not.toHaveProperty('category');
    expect(fetched!.ingredients[0]).not.toHaveProperty('amountLabel');
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
      { id: 'image-a', blobName: `${USER_A}/${created.id}/image-a.jpg`, order: 1 },
      { id: 'image-b', blobName: `${USER_A}/${created.id}/image-b.jpg`, order: 2 },
    ]);
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
