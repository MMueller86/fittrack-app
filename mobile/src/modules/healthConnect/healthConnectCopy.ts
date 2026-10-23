// Texte der Health-Connect-Aktivierung: Datenkategorie und Ziel vor jeder Aktivierung.
// Das Ziel ist der Health-Connect-Speicher auf dem Gerät — kein Google-Konto, keine Cloud.

export const HEALTH_CONNECT_TARGET = 'Health Connect auf deinem Gerät';

export const SYNC_STATUS_COPY = {
  title: 'Synchronisationsstatus',
  weight: 'Gewicht',
  nutrition: 'Ernährung',
  enabledLabel: 'Synchronisation',
  enabled: 'Aktiviert',
  disabled: 'Deaktiviert',
  permissionLabel: 'Berechtigung',
  permissionRevoked: 'Entzogen',
  permissionNotRevoked: 'Nicht als entzogen gemeldet',
  pendingDeleteCountLabel: 'Ausstehende Löschungen',
  lastSuccessfulSyncAtLabel: 'Letzter erfolgreicher Abgleich',
  noSuccessfulSync: 'Noch kein erfolgreicher Abgleich',
} as const;

export const WEIGHT_SYNC_NOTICE = {
  category: 'Gewicht',
  body: 'Deine Gewichtseinträge werden in den Health-Connect-Speicher deines Geräts geschrieben. Alle vorhandenen und zukünftigen Einträge werden synchronisiert. Änderungen und Löschungen werden übernommen.',
} as const;

export const NUTRITION_SYNC_NOTICE = {
  category: 'Ernährung',
  body: 'Deine Ernährungseinträge werden in den Health-Connect-Speicher deines Geräts geschrieben. Alle vorhandenen Einträge werden übertragen. Zukünftige Änderungen und Löschungen werden automatisch synchronisiert.',
} as const;
