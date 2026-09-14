import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View',
}));

vi.mock('./TrendPill', () => ({ TrendPill: 'TrendPill' }));

import { daysSince } from './ProgressHeroCard';

describe('ProgressHeroCard date-only display', () => {
  it('counts the next local calendar day across spring-forward', () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = 'America/New_York';

    try {
      expect(daysSince('2026-03-08', new Date('2026-03-09T04:30:00.000Z'))).toBe(1);
    } finally {
      if (previousTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimezone;
    }
  });
});