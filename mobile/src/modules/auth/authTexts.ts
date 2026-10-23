// All user-visible texts of the login flow (German).

export type AuthErrorKind = 'cancelled' | 'provider' | 'exchange' | 'pending' | 'noReturn';

export const authTexts = {
  signIn: 'Mit Google anmelden',
  privacyLink: 'Datenschutz',
  privacyLinkLabel: 'Datenschutzerklärung lesen',
  imprintLink: 'Impressum',
  imprintLinkLabel: 'Impressum lesen',
  cleanupNotice:
    'Einige private App-Daten von FitTrack konnten auf diesem Gerät nicht gelöscht werden. Du kannst die App-Daten in den Android-Einstellungen entfernen.',
  retry: 'Erneut anmelden',
  errors: {
    cancelled: 'Die Anmeldung wurde abgebrochen.',
    provider: 'Die Anmeldung bei Google ist fehlgeschlagen. Bitte versuche es erneut.',
    exchange: 'Die Verbindung zu FitTrack ist fehlgeschlagen. Bitte versuche es erneut.',
    pending: 'Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut.',
    noReturn: 'Die Anmeldung wurde nicht abgeschlossen. Bitte versuche es erneut.',
  } satisfies Record<AuthErrorKind, string>,
} as const;
