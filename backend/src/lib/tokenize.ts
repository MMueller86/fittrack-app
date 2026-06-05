/**
 * Tokenizes a product name (and optional brand) into lowercase search tokens.
 * Used to populate the `searchTerms` field on ReusableItems for full-text search.
 *
 * Splits on whitespace and common delimiters, lowercases everything,
 * filters tokens shorter than 2 characters, and deduplicates.
 */
export function tokenizeProduct(name: string, brand?: string | null): string[] {
  const input = brand ? `${name} ${brand}` : name;
  const tokens = input
    .toLowerCase()
    .split(/[\s\-_.,&()/+*:;'"!?%@#]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  return [...new Set(tokens)];
}
