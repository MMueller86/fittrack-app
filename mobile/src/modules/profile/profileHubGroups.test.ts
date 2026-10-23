import { describe, expect, it } from 'vitest';
import {
  PROFILE_HUB_ENTRIES,
  getProfileHubGroups,
  type ProfileHubEntry,
} from './profileHubGroups';

describe('getProfileHubGroups', () => {
  it('renders only groups with entries in the fixed order', () => {
    const groups = getProfileHubGroups();

    expect(groups.map((g) => g.title)).toEqual([
      'Bibliothek',
      'Integrationen',
      'Rechtliches',
    ]);
    expect(groups.find((g) => g.id === 'library')?.entries.map((e) => e.route)).toEqual(['Library']);
    expect(groups.find((g) => g.id === 'integrations')?.entries.map((e) => e.route)).toEqual(['HealthConnect']);
    expect(groups.find((g) => g.id === 'legal')?.entries.map((e) => e.route)).toEqual(['Imprint', 'PrivacyPolicy']);
  });

  it('keeps profile details outside the navigation groups', () => {
    expect(getProfileHubGroups().flatMap((group) => group.entries.map((entry) => entry.label)))
      .not.toContain('Profil & Tagesziele');
  });

  it('does not register Gemeinsam without entries and keeps Rechtliches last', () => {
    expect(PROFILE_HUB_ENTRIES.shared).toHaveLength(0);
    expect(getProfileHubGroups().map((g) => g.id)).not.toContain('shared');
    expect(getProfileHubGroups().at(-1)?.id).toBe('legal');
  });

  it('inserts a future Gemeinsam group between Integrationen and Rechtliches', () => {
    const extra: ProfileHubEntry = { id: 'x', label: 'X', route: 'Library', iconName: 'users' };
    const groups = getProfileHubGroups({
      entries: { ...PROFILE_HUB_ENTRIES, shared: [extra] },
    });

    expect(groups.map((g) => g.title)).toEqual([
      'Bibliothek',
      'Integrationen',
      'Gemeinsam',
      'Rechtliches',
    ]);
  });
});
