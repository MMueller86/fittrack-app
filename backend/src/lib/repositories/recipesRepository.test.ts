import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Recipe } from '@fittrack/shared';
import type { CreateRecipeInput, UpdateRecipeInput } from './recipesRepository';
import { __resetRecipesRepositoryForTests, getRecipesRepository } from './recipesRepository';

const zeroNutrition = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

const input: CreateRecipeInput = {
  name: 'Test recipe',
  portions: 1,
  ingredients: [],
  steps: [],
  tags: [],
  nutritionTotal: zeroNutrition,
  nutritionPerPortion: zeroNutrition,
};

beforeEach(() => {
  vi.stubEnv('COSMOS_ENDPOINT', '');
  vi.stubEnv('COSMOS_KEY', '');
  __resetRecipesRepositoryForTests();
});

afterEach(() => {
  __resetRecipesRepositoryForTests();
  vi.unstubAllEnvs();
});

describe('in-memory recipe revisions', () => {
  it('defaults legacy visibility to private and rejects ambiguous historical IDs', async () => {
    const repo = getRecipesRepository();
    const created = await repo.createVersioned('user-1', input);
    const store = Reflect.get(repo, 'store') as Map<string, { recipe: Recipe; etag: string }>;
    const raw = store.get(`user-1:${created.recipe.id}`)!;
    Reflect.deleteProperty(raw.recipe, 'visibility');
    raw.recipe.sharedWithUserIds = ['user-2'];
    expect((await repo.get('user-1', created.recipe.id))?.visibility).toBe('private');
    expect(await repo.getCommunityById(created.recipe.id)).toBeNull();
    expect((await repo.listCommunity()).recipes).toEqual([]);
    Reflect.set(raw.recipe, 'visibility', 'public');
    expect((await repo.get('user-1', created.recipe.id))?.visibility).toBe('private');
    expect((await repo.listCommunity()).recipes).toEqual([]);
    await repo.setVisibility('user-1', created.recipe.id, created.etag, { visibility: 'community', contentConfirmed: true, displayNameConsent: false });
    store.set(`user-2:${created.recipe.id}`, { recipe: { ...created.recipe, ownerUserId: 'user-2' }, etag: 'duplicate' });
    expect(await repo.getCommunityById(created.recipe.id)).toBeNull();
    expect((await repo.listCommunity()).recipes).toEqual([]);
  });

  it('cannot publish by mutating read results or injecting fields into an ordinary write', async () => {
    const repo = getRecipesRepository();
    const created = await repo.createVersioned('user-1', input);
    created.recipe.visibility = 'community';
    expect(await repo.getCommunityById(created.recipe.id)).toBeNull();
    await repo.update('user-1', created.recipe.id, { name: 'Still private', visibility: 'community', ownerUserId: 'user-2', communityPublication: { contentConfirmedAt: 'client-owned', displayNameConsent: true } } as UpdateRecipeInput);
    const current = await repo.get('user-1', created.recipe.id);
    expect(current?.visibility).toBe('private');
    expect(current?.ownerUserId).toBe('user-1');
    expect(current?.communityPublication).toBeUndefined();
    expect(await repo.getCommunityById(created.recipe.id)).toBeNull();
    await expect(repo.listCommunity({ limit: 0 })).rejects.toThrow('page size');
    await expect(repo.listCommunity({ continuationToken: '-1' })).rejects.toThrow('continuation token');
  });

  it('publishes separately, paginates across owners and preserves publication on other writes', async () => {
    const repo = getRecipesRepository();
    const first = await repo.createVersioned('user-1', input);
    const second = await repo.createVersioned('user-2', input);
    const privateRecipe = await repo.create('user-2', input);
    expect(first.recipe.visibility).toBe('private');
    expect(await repo.get('user-1', second.recipe.id)).toBeNull();
    expect(await repo.getCommunityById(privateRecipe.id)).toBeNull();
    expect(await repo.setVisibility('user-2', first.recipe.id, first.etag, { visibility: 'community', contentConfirmed: true, displayNameConsent: true })).toBeNull();
    const published = await repo.setVisibility('user-1', first.recipe.id, first.etag, { visibility: 'community', contentConfirmed: true, displayNameConsent: true });
    await repo.setVisibility('user-2', second.recipe.id, second.etag, { visibility: 'community', contentConfirmed: true, displayNameConsent: false });
    await repo.update('user-1', first.recipe.id, { name: 'Updated', images: [] });
    await repo.incrementUsage('user-1', first.recipe.id);
    expect((await repo.getCommunityById(first.recipe.id))?.communityPublication).toEqual(published?.recipe.communityPublication);
    const page = await repo.listCommunity({ limit: 1 });
    expect(page.recipes).toHaveLength(1);
    const next = await repo.listCommunity({ limit: 1, continuationToken: page.continuationToken });
    expect(next.recipes).toHaveLength(1);
    expect(next.recipes[0].id).not.toBe(page.recipes[0].id);
    expect(next.continuationToken).toBeUndefined();
    expect(await repo.setVisibility('user-1', first.recipe.id, first.etag, { visibility: 'private' })).toBeNull();
    const current = await repo.getVersioned('user-1', first.recipe.id);
    const revoked = await repo.setVisibility('user-1', first.recipe.id, current!.etag, { visibility: 'private' });
    expect(revoked?.recipe.communityPublication).toBeUndefined();
    expect(await repo.getCommunityById(first.recipe.id)).toBeNull();
  });

  it('compares and replaces atomically, rejecting stale revisions without partial writes', async () => {
    const repo = getRecipesRepository();
    const created = await repo.createVersioned('user-1', input);

    expect(created.etag).toMatch(/^".+"$/);

    const committed = await repo.compareAndReplace('user-1', created.recipe.id, created.etag, {
      name: 'Committed name',
    });
    expect(committed?.recipe.name).toBe('Committed name');
    expect(committed?.etag).not.toBe(created.etag);

    const stale = await repo.compareAndReplace('user-1', created.recipe.id, created.etag, {
      name: 'Must not persist',
    });
    expect(stale).toBeNull();

    const current = await repo.getVersioned('user-1', created.recipe.id);
    expect(current?.recipe.name).toBe('Committed name');
    expect(current?.etag).toBe(committed?.etag);
  });
});