import { describe, expect, it } from 'vitest';
import {
  HEALTH_CONNECT_TARGET,
  NUTRITION_SYNC_NOTICE,
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
});
