import { beforeEach, describe, expect, it, vi } from 'vitest';

const cosmosState = vi.hoisted(() => ({
  documents: new Map<string, { document: Record<string, unknown>; etag: string }>(),
}));

vi.mock('../cosmos', () => ({
  isCosmosConfigured: () => true,
  getCosmos: async () => ({
    containers: {
      aiInsights: {
        items: {
          create: async (document: Record<string, unknown>) => {
            const key = `${document.userId}:${document.id}`;
            if (cosmosState.documents.has(key)) throw { code: 409 };
            cosmosState.documents.set(key, { document, etag: 'etag-1' });
          },
        },
        item: (id: string, userId: string) => ({
          read: async () => {
            const record = cosmosState.documents.get(`${userId}:${id}`);
            if (!record) throw { code: 404 };
            return { resource: { ...record.document, _etag: 'system-managed' }, etag: record.etag };
          },
          replace: async (document: Record<string, unknown>) => {
            cosmosState.documents.set(`${userId}:${id}`, { document, etag: 'etag-2' });
          },
          delete: async () => {
            cosmosState.documents.delete(`${userId}:${id}`);
          },
        }),
      },
    },
  }),
}));

import {
  CosmosProfileDeletionRepository,
  ProfileDeletionInProgressError,
  assertProfileDeletionNotActive,
} from './profileDeletionRepository';

describe('CosmosProfileDeletionRepository lease', () => {
  beforeEach(() => cosmosState.documents.clear());

  it('creates a short-lived TTL lock and reports it as active', async () => {
    const repository = new CosmosProfileDeletionRepository();
    const lease = await repository.acquireLock('user-1');
    const stored = cosmosState.documents.get('user-1:profile-deletion-lock')?.document;

    expect(stored).toMatchObject({
      id: 'profile-deletion-lock',
      userId: 'user-1',
      _docType: 'profileDeletionLock',
      lockToken: lease.lockToken,
      ttl: 300,
    });
    expect(stored).not.toHaveProperty('activeOperations');
    expect(await repository.isLocked('user-1')).toBe(true);
  });

  it('renews the lease without sending Cosmos system fields back in the replacement', async () => {
    const repository = new CosmosProfileDeletionRepository();
    const lease = await repository.acquireLock('user-1');

    await repository.renewLock(lease);

    expect(cosmosState.documents.get('user-1:profile-deletion-lock')?.document).not.toHaveProperty('_etag');
  });

  it('rejects a concurrent deletion and releases only its own lock', async () => {
    const repository = new CosmosProfileDeletionRepository();
    const lease = await repository.acquireLock('user-1');

    await expect(repository.acquireLock('user-1')).rejects.toBeInstanceOf(ProfileDeletionInProgressError);
    await repository.releaseLock({ userId: 'user-1', lockToken: 'other-token' });
    expect(await repository.isLocked('user-1')).toBe(true);

    await repository.releaseLock(lease);
    expect(await repository.isLocked('user-1')).toBe(false);
  });

  it('blocks admission while the lease is active', async () => {
    const repository = new CosmosProfileDeletionRepository();
    const lease = await repository.acquireLock('user-1');

    await expect(assertProfileDeletionNotActive('user-1'))
      .rejects.toBeInstanceOf(ProfileDeletionInProgressError);

    await repository.releaseLock(lease);
  });
});