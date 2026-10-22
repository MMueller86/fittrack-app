import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type EmulatorContext,
  createTestDatabase,
  destroyTestDatabase,
  setupEmulatorEnv,
} from '../../test-utils/cosmosEmulator';
import { __resetCosmosForTests } from '../cosmos';
import { CosmosProfileDeletionRepository } from './profileDeletionRepository';
import { CosmosRecipesRepository } from './cosmosRecipesRepository';

const USER_A = 'profile-delete-a';
const USER_B = 'profile-delete-b';
const USER_CONTAINERS = [
  'nutritionProfiles',
  'profiles',
  'weights',
  'nutritionDiaryMeals',
  'reusableMealItems',
  'recipes',
  'aiUsage',
  'aiInsights',
  'userFoodRelations',
] as const;

let context: EmulatorContext | undefined;

beforeAll(async () => {
  const { databaseId } = setupEmulatorEnv();
  context = await createTestDatabase(databaseId);
  __resetCosmosForTests();
});

afterAll(async () => {
  await destroyTestDatabase(context);
  __resetCosmosForTests();
});

describe('CosmosProfileDeletionRepository (contract)', () => {
  it('deletes active and legacy user partitions without deleting the lock or shared data', async () => {
    const database = context!.database;
    for (const name of USER_CONTAINERS) {
      await database.container(name).items.upsert({
        id: `target-${name}`,
        userId: USER_A,
        marker: 'target',
      });
      await database.container(name).items.upsert({
        id: `foreign-${name}`,
        userId: USER_B,
        marker: 'foreign',
      });
    }
    await database.container('users').items.upsert({ id: USER_A, marker: 'legacy-user' });
    await database.container('users').items.upsert({ id: USER_B, marker: 'foreign-user' });
    await database.container('aiInsights').items.upsert({
      id: 'profile-deletion-lock',
      userId: USER_A,
      _docType: 'profileDeletionLock',
      lockToken: 'contract-token',
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      ttl: 300,
    });
    await database.container('communityRecipes').items.upsert({
      id: 'ownerless-community-recipe',
      visibility: 'community',
      marker: 'shared',
    });
    await database.container('foodProducts').items.upsert({
      id: 'catalog-product',
      marker: 'catalog',
    });

    await new CosmosProfileDeletionRepository().deleteUserData(USER_A);

    const deletedUserResponse = await database.container('users').item(USER_A, USER_A).read();
    expect(deletedUserResponse.statusCode).toBe(404);
    for (const name of USER_CONTAINERS) {
      const { resources } = await database.container(name).items.query<{ id: string }>(
        { query: 'SELECT c.id FROM c WHERE c.userId = @userId', parameters: [{ name: '@userId', value: USER_A }] },
        { partitionKey: USER_A },
      ).fetchAll();
      expect(resources.map(({ id }) => id)).toEqual(name === 'aiInsights' ? ['profile-deletion-lock'] : []);

      await expect(database.container(name).item(`foreign-${name}`, USER_B).read()).resolves.toMatchObject({
        resource: { userId: USER_B, marker: 'foreign' },
      });
    }
    await expect(database.container('communityRecipes').item('ownerless-community-recipe', 'ownerless-community-recipe').read())
      .resolves.toMatchObject({ resource: { marker: 'shared' } });
    await expect(database.container('foodProducts').item('catalog-product', 'catalog-product').read())
      .resolves.toMatchObject({ resource: { marker: 'catalog' } });
  });

  it('deletes only the selected ownerless community recipe by its recipe ID', async () => {
    const container = context!.database.container('communityRecipes');
    await container.items.upsert({ id: 'owned-community-copy', visibility: 'community' });
    await container.items.upsert({ id: 'unrelated-community-copy', visibility: 'community' });

    await new CosmosRecipesRepository().deleteOwnerlessCommunityRecipe('owned-community-copy');

    const deletedRecipeResponse = await container.item('owned-community-copy', 'owned-community-copy').read();
    expect(deletedRecipeResponse.statusCode).toBe(404);
    await expect(container.item('unrelated-community-copy', 'unrelated-community-copy').read())
      .resolves.toMatchObject({ resource: { visibility: 'community' } });
  });
});