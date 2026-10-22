import { randomUUID } from 'node:crypto';
import { isCosmosConfigured, getCosmos } from '../cosmos';

const DELETION_LOCK_ID = 'profile-deletion-lock';
const DELETION_LOCK_TTL_SECONDS = 300;
const MAX_CAS_ATTEMPTS = 10;
const USER_DATA_CONTAINERS = [
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

interface StoredProfileDeletionLock {
  id: string;
  userId: string;
  _docType: 'profileDeletionLock';
  lockToken?: string;
  expiresAt?: string;
  ttl: number;
}

export interface ProfileDeletionLease {
  userId: string;
  lockToken: string;
}

export class ProfileDeletionInProgressError extends Error {
  constructor() {
    super('Profile deletion is already in progress');
    this.name = 'ProfileDeletionInProgressError';
  }
}

export class ProfileDeletionLeaseLostError extends Error {
  constructor() {
    super('Profile deletion lease was lost');
    this.name = 'ProfileDeletionLeaseLostError';
  }
}

export class ProfileDeletionStorageUnavailableError extends Error {
  constructor() {
    super('Profile deletion requires configured Cosmos DB');
    this.name = 'ProfileDeletionStorageUnavailableError';
  }
}

function isStatus(error: unknown, status: number): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const value = error as { code?: unknown; statusCode?: unknown };
  return value.code === status || value.statusCode === status;
}

function lockExpiry(): { expiresAt: string; ttl: number } {
  const expiresAt = new Date(Date.now() + DELETION_LOCK_TTL_SECONDS * 1000);
  return { expiresAt: expiresAt.toISOString(), ttl: DELETION_LOCK_TTL_SECONDS };
}

function isActiveLock(lock: StoredProfileDeletionLock | undefined): boolean {
  return Boolean(lock?.lockToken && lock.expiresAt && Date.parse(lock.expiresAt) > Date.now());
}

async function readLock(userId: string): Promise<{
  resource: StoredProfileDeletionLock;
  etag: string;
} | null> {
  const { containers } = await getCosmos();
  try {
    const { resource, etag } = await containers.aiInsights
      .item(DELETION_LOCK_ID, userId)
      .read<StoredProfileDeletionLock>();
    if (!resource || !etag) return null;
    return {
      resource: {
        id: resource.id,
        userId: resource.userId,
        _docType: resource._docType,
        ...(resource.lockToken ? { lockToken: resource.lockToken } : {}),
        ...(resource.expiresAt ? { expiresAt: resource.expiresAt } : {}),
        ttl: resource.ttl,
      },
      etag,
    };
  } catch (error) {
    if (isStatus(error, 404)) return null;
    throw error;
  }
}

export class CosmosProfileDeletionRepository {
  async acquireLock(userId: string): Promise<ProfileDeletionLease> {
    const { containers } = await getCosmos();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const lockToken = randomUUID();
      const lock: StoredProfileDeletionLock = {
        id: DELETION_LOCK_ID,
        userId,
        _docType: 'profileDeletionLock',
        lockToken,
        ...lockExpiry(),
      };
      try {
        await containers.aiInsights.items.create(lock);
        return { userId, lockToken };
      } catch (error) {
        if (!isStatus(error, 409)) throw error;
      }

      const existing = await readLock(userId);
      if (!existing) continue;
      if (isActiveLock(existing.resource)) throw new ProfileDeletionInProgressError();

      try {
        await containers.aiInsights.item(DELETION_LOCK_ID, userId).replace(
          { id: DELETION_LOCK_ID, userId, _docType: 'profileDeletionLock', lockToken, ...lockExpiry() },
          { accessCondition: { type: 'IfMatch', condition: existing.etag } },
        );
        return { userId, lockToken };
      } catch (error) {
        if (!isStatus(error, 412)) throw error;
      }
    }
    throw new ProfileDeletionInProgressError();
  }

  async isLocked(userId: string): Promise<boolean> {
    const existing = await readLock(userId);
    return isActiveLock(existing?.resource);
  }

  async renewLock(lease: ProfileDeletionLease): Promise<void> {
    const { containers } = await getCosmos();
    for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
      const existing = await readLock(lease.userId);
      if (!existing || existing.resource.lockToken !== lease.lockToken || !isActiveLock(existing.resource)) {
        throw new ProfileDeletionLeaseLostError();
      }
      try {
        await containers.aiInsights.item(DELETION_LOCK_ID, lease.userId).replace(
          { ...existing.resource, ...lockExpiry() },
          { accessCondition: { type: 'IfMatch', condition: existing.etag } },
        );
        return;
      } catch (error) {
        if (isStatus(error, 412)) continue;
        throw error;
      }
    }
    throw new ProfileDeletionLeaseLostError();
  }

  async releaseLock(lease: ProfileDeletionLease): Promise<void> {
    const existing = await readLock(lease.userId);
    if (!existing || existing.resource.lockToken !== lease.lockToken) return;

    const { containers } = await getCosmos();
    try {
      await containers.aiInsights.item(DELETION_LOCK_ID, lease.userId).delete({
        accessCondition: { type: 'IfMatch', condition: existing.etag },
      });
    } catch (error) {
      if (isStatus(error, 404) || isStatus(error, 412)) return;
      throw error;
    }
  }

  async deleteUserData(userId: string): Promise<void> {
    const { containers } = await getCosmos();

    try {
      await containers.users.item(userId, userId).delete();
    } catch (error) {
      if (!isStatus(error, 404)) throw error;
    }

    for (const name of USER_DATA_CONTAINERS) {
      const container = containers[name];
      while (true) {
        const { resources } = await container.items.query<{ id: string }>(
          {
            query: name === 'aiInsights'
              ? 'SELECT TOP 100 c.id FROM c WHERE c.userId = @userId AND c.id != @lockId'
              : 'SELECT TOP 100 c.id FROM c WHERE c.userId = @userId',
            parameters: [
              { name: '@userId', value: userId },
              ...(name === 'aiInsights' ? [{ name: '@lockId', value: DELETION_LOCK_ID }] : []),
            ],
          },
          { partitionKey: userId, maxItemCount: 100 },
        ).fetchAll();
        if (resources.length === 0) break;
        const results = await Promise.allSettled(
          resources.map(({ id }) => container.item(id, userId).delete()),
        );
        const failure = results.find((result) => result.status === 'rejected');
        if (failure?.status === 'rejected') throw failure.reason;
      }
    }
  }
}

export function getProfileDeletionRepository(): CosmosProfileDeletionRepository {
  if (!isCosmosConfigured()) throw new ProfileDeletionStorageUnavailableError();
  return new CosmosProfileDeletionRepository();
}

export async function isProfileDeletionInProgress(userId: string): Promise<boolean> {
  if (!isCosmosConfigured()) return false;
  return new CosmosProfileDeletionRepository().isLocked(userId);
}

export async function assertProfileDeletionNotActive(userId: string): Promise<void> {
  if (await isProfileDeletionInProgress(userId)) throw new ProfileDeletionInProgressError();
}
