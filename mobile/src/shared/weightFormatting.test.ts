import { describe, expect, it } from 'vitest';
import { formatKilograms } from './weightFormatting';

describe('formatKilograms', () => {
  it('uses German decimal punctuation and the requested precision', () => {
    expect(formatKilograms(78.5)).toBe('78,5');
    expect(formatKilograms(78.567, 2)).toBe('78,57');
  });
});