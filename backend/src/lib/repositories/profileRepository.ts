// Profile repository abstraction.
//
// Selection rule:
//   - If COSMOS_ENDPOINT and COSMOS_KEY are set, use CosmosProfileRepository.
//   - Otherwise, fall back to InMemoryProfileRepository.

import type { UserProfile } from '@fittrack/shared';
import { isCosmosConfigured } from '../cosmos';
import { CosmosProfileRepository } from './cosmosProfileRepository';

export interface ProfileRepository {
  get(userId: string): Promise<UserProfile | null>;
  upsert(profile: UserProfile): Promise<UserProfile>;
  delete(userId: string): Promise<void>;
}

class InMemoryProfileRepository implements ProfileRepository {
  private readonly profiles = new Map<string, UserProfile>();

  async get(userId: string): Promise<UserProfile | null> {
    return this.profiles.get(userId) ?? null;
  }

  async upsert(profile: UserProfile): Promise<UserProfile> {
    this.profiles.set(profile.userId, profile);
    return profile;
  }

  async delete(userId: string): Promise<void> {
    this.profiles.delete(userId);
  }
}

let singleton: ProfileRepository | undefined;

export function getProfileRepository(): ProfileRepository {
  if (!singleton) {
    singleton = isCosmosConfigured()
      ? new CosmosProfileRepository()
      : new InMemoryProfileRepository();
  }
  return singleton;
}

/** Test-only: reset singleton so each test starts clean. */
export function __resetProfileRepositoryForTests(): void {
  singleton = undefined;
}
