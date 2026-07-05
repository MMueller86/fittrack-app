import { describe, it, expect } from 'vitest';
import { rankByQuery, splitQueryTokens } from './searchRanking';

// ─── splitQueryTokens ────────────────────────────────────────────────────────

describe('splitQueryTokens', () => {
  it('lowercases and splits on whitespace', () => {
    expect(splitQueryTokens('Vollkorn Reis')).toEqual(['vollkorn', 'reis']);
  });

  it('drops tokens shorter than 2 characters', () => {
    expect(splitQueryTokens('a bc def')).toEqual(['bc', 'def']);
  });

  it('trims and handles multiple spaces', () => {
    expect(splitQueryTokens('  oats  ')).toEqual(['oats']);
  });

  it('returns empty array for whitespace-only input', () => {
    expect(splitQueryTokens('   ')).toEqual([]);
  });
});

// ─── rankByQuery – single-token ──────────────────────────────────────────────

describe('rankByQuery – single token', () => {
  it('returns 4 for exact name match', () => {
    expect(rankByQuery('Marmelade', [], 'marmelade')).toBe(4);
  });

  it('returns 3 for name starts with token (prefix)', () => {
    expect(rankByQuery('Marmelade extra', [], 'marmelade')).toBe(3);
  });

  it('returns 3 for searchTerm exact match — even when token is also a word in the name', () => {
    // This is the REGRESSION TEST for Bug 1.
    // "Erdbeer Marmelade Weniger Zucker" contains "marmelade" as a whole word
    // → word-boundary check would give 2.5 BEFORE the searchTerms check.
    // After the fix, searchTerms.includes("marmelade") must be evaluated first and return 3.
    const name = 'Erdbeer Marmelade Weniger Zucker';
    const searchTerms = ['erdbeer', 'marmelade', 'weniger', 'zucker'];
    expect(rankByQuery(name, searchTerms, 'marmelade')).toBe(3);
  });

  it('returns 2.5 for word-boundary match when token is NOT in searchTerms', () => {
    // Same multi-word name but WITHOUT the matching searchTerm → falls back to 2.5
    const name = 'Erdbeer Marmelade Weniger Zucker';
    expect(rankByQuery(name, [], 'marmelade')).toBe(2.5);
  });

  it('returns 2 for substring match in name', () => {
    expect(rankByQuery('Vollkornbrot', [], 'korn')).toBe(2);
  });

  it('returns 0.5 when searchTerm starts with token (prefix on searchTerm)', () => {
    expect(rankByQuery('Brot', ['vollkornbrot'], 'vollkorn')).toBe(0.5);
  });

  it('returns -1 when no match at all', () => {
    expect(rankByQuery('Apple', ['apfel'], 'marmelade')).toBe(-1);
  });
});

// ─── rankByQuery – multi-token (AND logic) ───────────────────────────────────

describe('rankByQuery – multi-token', () => {
  it('returns -1 if any token has no match', () => {
    expect(rankByQuery('Erdbeer Marmelade', ['erdbeer', 'marmelade'], 'marmelade banane')).toBe(-1);
  });

  it('returns average score for fully matching multi-token query', () => {
    // token "erdbeer": name starts with "erdbeer" → wait, name is "Erdbeer Marmelade…"
    // "erdbeer" is prefix of name → 3
    // "marmelade" is in searchTerms exactly → 3 (after fix)
    // average = 3
    const name = 'Erdbeer Marmelade Weniger Zucker';
    const searchTerms = ['erdbeer', 'marmelade', 'weniger', 'zucker'];
    expect(rankByQuery(name, searchTerms, 'erdbeer marmelade')).toBe(3);
  });

  it('library item with searchTerms beats catalog exact match when LIBRARY_BONUS applied externally', () => {
    // Simulates what foodSearch does: base score for library item + LIBRARY_BONUS
    // Library item: "Erdbeer Marmelade Weniger Zucker" + searchTerms containing "marmelade"
    // Catalog item: "Marmelade" (exact name → score 4, no bonus)
    const LIBRARY_BONUS = 1.5;
    const libraryScore = rankByQuery(
      'Erdbeer Marmelade Weniger Zucker',
      ['erdbeer', 'marmelade', 'weniger', 'zucker'],
      'marmelade',
    ) + LIBRARY_BONUS;

    const catalogExactScore = rankByQuery('Marmelade', [], 'marmelade'); // 4

    expect(libraryScore).toBeGreaterThan(catalogExactScore);
  });
});
