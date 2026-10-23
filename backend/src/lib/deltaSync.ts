export function hasOnlyQueryParams(query: URLSearchParams, allowed: readonly string[]): boolean {
  const seen = new Set<string>();
  for (const key of query.keys()) {
    if (!allowed.includes(key) || seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

export function isCanonicalUtcIso(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) return false;
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}

export function effectiveUpdatedAt(record: { createdAt: string; updatedAt?: string }): string {
  return record.updatedAt ?? record.createdAt;
}