// Profil-Hub — feste Gruppenreihenfolge und Einträge.
//
// Reihenfolge (fest): Bibliothek → Integrationen → Gemeinsam → Rechtliches.
// Einfügepositionen für künftige Bereiche (nur Einträge in PROFILE_HUB_ENTRIES ergänzen):
//   - `shared`  (Gemeinsam):   Freunde / gemeinsamer Haushalt — Arbeitsname, [Planned].
//   - `legal`   (Rechtliches): Impressum, Datenschutzerklärung (In-App-Seiten, modules/legal).
// Gruppen ohne Einträge werden nicht gerendert; eine Route wird erst mit ihrem Eintrag registriert.

import type { ComponentProps } from 'react';
import type { Feather } from '@expo/vector-icons';

export type ProfileHubGroupId = 'library' | 'integrations' | 'shared' | 'legal';

export type ProfileHubRoute = 'Library' | 'HealthConnect' | 'Imprint' | 'PrivacyPolicy';

export interface ProfileHubEntry {
  id: string;
  label: string;
  detail?: string;
  route: ProfileHubRoute;
  iconName: ComponentProps<typeof Feather>['name'];
}

export interface ProfileHubGroup {
  id: ProfileHubGroupId;
  title: string;
  entries: readonly ProfileHubEntry[];
}

export const PROFILE_HUB_GROUP_ORDER: readonly { id: ProfileHubGroupId; title: string }[] = [
  { id: 'library', title: 'Bibliothek' },
  { id: 'integrations', title: 'Integrationen' },
  { id: 'shared', title: 'Gemeinsam' },
  { id: 'legal', title: 'Rechtliches' },
];

export const PROFILE_HUB_ENTRIES: Record<ProfileHubGroupId, readonly ProfileHubEntry[]> = {
  library: [
    { id: 'library', label: 'Favoriten & Eigene Lebensmittel', route: 'Library', iconName: 'book-open' },
  ],
  integrations: [
    { id: 'healthConnect', label: 'Health Connect', route: 'HealthConnect', iconName: 'activity' },
  ],
  shared: [],
  legal: [
    { id: 'imprint', label: 'Impressum', route: 'Imprint', iconName: 'info' },
    { id: 'privacy', label: 'Datenschutzerklärung', route: 'PrivacyPolicy', iconName: 'shield' },
  ],
};

export function getProfileHubGroups(
  options: {
    entries?: Record<ProfileHubGroupId, readonly ProfileHubEntry[]>;
  } = {},
): ProfileHubGroup[] {
  const { entries = PROFILE_HUB_ENTRIES } = options;
  return PROFILE_HUB_GROUP_ORDER
    .map(({ id, title }) => ({ id, title, entries: entries[id] }))
    .filter((group) => group.entries.length > 0);
}
