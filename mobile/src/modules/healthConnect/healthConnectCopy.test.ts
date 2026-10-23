import { describe, expect, it } from 'vitest';
import {
  HEALTH_CONNECT_TARGET,
  NUTRITION_SYNC_NOTICE,
  SYNC_STATUS_COPY,
  WEIGHT_SYNC_NOTICE,
} from './healthConnectCopy';

describe('Health Connect activation copy', () => {
  it('names the data category and the on-device Health Connect target', () => {
    expect(WEIGHT_SYNC_NOTICE.category).toBe('Gewicht');
    expect(NUTRITION_SYNC_NOTICE.category).toBe('Ernährung');
    expect(HEALTH_CONNECT_TARGET).toBe('Health Connect auf deinem Gerät');
    expect(WEIGHT_SYNC_NOTICE.body).toContain('Health-Connect-Speicher deines Geräts');
    expect(NUTRITION_SYNC_NOTICE.body).toContain('Health-Connect-Speicher deines Geräts');
  });

  it('does not suggest a Google cloud or Google account transfer', () => {
    const all = [
      HEALTH_CONNECT_TARGET,
      WEIGHT_SYNC_NOTICE.category,
      WEIGHT_SYNC_NOTICE.body,
      NUTRITION_SYNC_NOTICE.category,
      NUTRITION_SYNC_NOTICE.body,
    ].join(' ');

    expect(all).not.toMatch(/google|cloud|konto/i);
  });

  it('uses German labels for the existing sync fields without confirming permission', () => {
    expect(SYNC_STATUS_COPY.enabledLabel).toBe('Synchronisation');
    expect(SYNC_STATUS_COPY.permissionLabel).toBe('Berechtigung');
    expect(SYNC_STATUS_COPY.pendingDeleteCountLabel).toBe('Ausstehende Löschungen');
    expect(SYNC_STATUS_COPY.lastSuccessfulSyncAtLabel).toBe('Letzter erfolgreicher Abgleich');
    expect(SYNC_STATUS_COPY.permissionNotRevoked).toBe('Nicht als entzogen gemeldet');
    expect(SYNC_STATUS_COPY.permissionNotRevoked).not.toMatch(/erteilt|bestätigt|aktiv/i);
  });

  it('keeps every aggregate status label in German and free of emoji', () => {
    const statusCopy = Object.values(SYNC_STATUS_COPY);

    expect(statusCopy).toEqual([
      'Synchronisationsstatus',
      'Gewicht',
      'Ernährung',
      'Synchronisation',
      'Aktiviert',
      'Deaktiviert',
      'Berechtigung',
      'Entzogen',
      'Nicht als entzogen gemeldet',
      'Ausstehende Löschungen',
      'Letzter erfolgreicher Abgleich',
      'Noch kein erfolgreicher Abgleich',
    ]);
    expect(statusCopy.join(' ')).not.toMatch(/[\p{Extended_Pictographic}\p{Regional_Indicator}]/u);
  });
});
