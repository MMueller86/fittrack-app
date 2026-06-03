// Cosmos DB implementation of the profile repository.

import type { UserProfile } from '@fittrack/shared';
import { getCosmos } from '../cosmos';
import type { ProfileRepository } from './profileRepository';

export class CosmosProfileRepository implements ProfileRepository {
  async get(userId: string): Promise<UserProfile | null> {
    const { containers } = await getCosmos();
    try {
      const { resource } = await containers.profiles
        .item('profile', userId)
        .read<UserProfile>();
      return resource ?? null;
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 404) return null;
      throw err;
    }
  }

  async upsert(profile: UserProfile): Promise<UserProfile> {
    const { containers } = await getCosmos();
    const { resource } = await containers.profiles.items.upsert<UserProfile>(profile);
    if (!resource) throw new Error('Cosmos upsert returned no resource');
    return resource;
  }

  async delete(userId: string): Promise<void> {
    const { containers } = await getCosmos();
    try {
      await containers.profiles.item('profile', userId).delete();
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 404) return;
      throw err;
    }
  }
}
