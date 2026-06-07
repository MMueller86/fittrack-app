/**
 * Shared search ranking utilities — used by food search across library and catalog.
 *
 * Kept in a separate module so it is not accidentally auto-mocked in unit tests
 * that mock the repository layer.
 */

/**
 * Splits a query into lowercase tokens on whitespace.
 * Tokens shorter than 2 characters are dropped.
 * Used by both the JS ranking layer and the Cosmos query builders.
 */
export function splitQueryTokens(query: string): string[] {
  return query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

/**
 * Scores a single token against a product name and search terms.
 *
 * Tiers (higher = more relevant):
 *   4   — exact name match
 *   3   — name starts with token (prefix)  |  searchTerm equals token exactly
 *   2.5 — token equals a complete word within name (word-boundary match)
 *   2   — token appears anywhere in name (substring)
 *   0.5 — any searchTerm starts with token
 *  -1   — no match
 *
 * Rationale for searchTerm-exact = 3:
 *   An AI-generated keyword exactly matching the query means the product IS
 *   semantically this term (e.g. "Ei" has keyword "eier"). This is equivalent
 *   in relevance to a product whose name starts with the query.
 *   Combined with the +0.5 library bonus, own products reliably beat catalog
 *   items that merely share the same name prefix.
 */
function rankSingleToken(name: string, searchTerms: string[], token: string): number {
  const n = name.toLowerCase();
  if (n === token) return 4;
  if (n.startsWith(token)) return 3;
  if (n.split(/\s+/).some((word) => word === token)) return 2.5;
  if (n.includes(token)) return 2;
  if (searchTerms.includes(token)) return 3;
  if (searchTerms.some((t) => t.startsWith(token))) return 0.5;
  return -1;
}

/**
 * Ranks a product against a query string.
 *
 * Single-token queries: delegates directly to rankSingleToken.
 *
 * Multi-token queries (e.g. "vollkorn reis"):
 *   - AND logic: ALL tokens must match somewhere in name or searchTerms.
 *   - If any token produces no match → returns -1 (excluded from results).
 *   - Score = average of per-token scores, so more specific multi-word
 *     queries don't artificially outrank exact single-word matches.
 */
export function rankByQuery(name: string, searchTerms: string[], query: string): number {
  const tokens = splitQueryTokens(query);
  if (tokens.length === 0) return -1;
  if (tokens.length === 1) return rankSingleToken(name, searchTerms, tokens[0]!);

  let total = 0;
  for (const token of tokens) {
    const score = rankSingleToken(name, searchTerms, token);
    if (score < 0) return -1; // one token unmatched → whole query fails
    total += score;
  }
  return total / tokens.length;
}
