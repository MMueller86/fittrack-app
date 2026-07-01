// Unit tests for insight cache logic:
//   - computeInputHash: stability + sensitivity
//   - shouldRegenerate: all branching conditions
//   - computeTtlUntilMidnight: correct TTL calculation
//   - InMemoryInsightRepository: get + upsert + listRecent

import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeInputHash,
  shouldRegenerate,
  computeTtlUntilMidnight,
  InMemoryInsightRepository,
  MAX_DAILY_GENERATIONS,
  MIN_REGEN_INTERVAL_MS,
} from './insightRepository';
import type { InsightDocument, InsightInputContext, InsightResponse } from '@fittrack/shared';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeContext(overrides: Partial<InsightInputContext> = {}): InsightInputContext {
  return {
    date: '2026-06-30',
    dayType: 'training',
    workoutType: 'gym',
    weight: {
      latestKg: 83.0,
      previousKg: 83.2,
      targetKg: 80.0,
      trend7d: 'losing',
      last7Values: [83.0, 83.2, 83.5, 83.4, 83.6, 83.7, 83.8],
    },
    nutrition: {
      today: { calories: 1600, protein: 120, carbs: 160, fat: 55, fiber: 22 },
      targets: { calories: 2100, proteinG: 160, carbsG: 220, fatG: 70, fiberG: 30 },
      last3Days: [
        { date: '2026-06-29', calories: 2050, protein: 155 },
        { date: '2026-06-28', calories: 1980, protein: 148 },
        { date: '2026-06-27', calories: 2100, protein: 162 },
      ],
    },
    ...overrides,
  };
}

function makeResponse(): InsightResponse {
  return {
    title: 'Guter Tag',
    summary: 'Alles läuft prima.',
    generatedAt: '2026-06-30T10:00:00Z',
    promptVersion: 'v1',
    status: 'fresh',
  };
}

function makeDocument(overrides: Partial<InsightDocument> = {}): InsightDocument {
  const ctx = makeContext();
  return {
    id: `user1:2026-06-30`,
    userId: 'user1',
    date: '2026-06-30',
    generatedAt: '2026-06-30T10:00:00Z',
    expiresAt: '2026-07-01T00:00:00Z',
    ttl: 50400,
    promptVersion: 'v1',
    model: 'gpt4o-mini',
    inputHash: computeInputHash(ctx),
    inputContext: ctx,
    response: makeResponse(),
    dailyGenerations: 1,
    lastGeneratedAt: '2026-06-30T10:00:00Z',
    feedbackScore: null,
    tokensUsed: 280,
    goalAtCalculation: 'maintain',
    intelligenceVersion: 'v1',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeInputHash
// ---------------------------------------------------------------------------

describe('computeInputHash', () => {
  it('returns the same hash for identical context', () => {
    const ctx = makeContext();
    expect(computeInputHash(ctx, 'v4')).toBe(computeInputHash(ctx, 'v4'));
  });

  it('returns same hash when calories differ by < 50 kcal (same rounding bucket)', () => {
    const a = makeContext({ nutrition: { ...makeContext().nutrition, today: { calories: 1600, protein: 120, carbs: 160, fat: 55, fiber: 22 } } });
    // +40 kcal — same bucket (both round to 16)
    const b = makeContext({ nutrition: { ...makeContext().nutrition, today: { calories: 1640, protein: 120, carbs: 160, fat: 55, fiber: 22 } } });
    expect(computeInputHash(a, 'v4')).toBe(computeInputHash(b, 'v4'));
  });

  it('returns different hash when calories differ by >= 100 kcal', () => {
    const a = makeContext({ nutrition: { ...makeContext().nutrition, today: { calories: 1600, protein: 120, carbs: 160, fat: 55, fiber: 22 } } });
    const b = makeContext({ nutrition: { ...makeContext().nutrition, today: { calories: 1700, protein: 120, carbs: 160, fat: 55, fiber: 22 } } });
    expect(computeInputHash(a, 'v4')).not.toBe(computeInputHash(b, 'v4'));
  });

  it('returns different hash when dayType changes', () => {
    const a = makeContext({ dayType: 'training' });
    const b = makeContext({ dayType: 'rest' });
    expect(computeInputHash(a, 'v4')).not.toBe(computeInputHash(b, 'v4'));
  });

  it('returns same hash when weight changes by < 0.25 kg (same rounding bucket)', () => {
    const a = makeContext();
    // +0.2 kg — both round to 83.0 in 0.5-buckets
    const b = makeContext({ weight: { ...makeContext().weight, latestKg: 83.2 } });
    expect(computeInputHash(a, 'v4')).toBe(computeInputHash(b, 'v4'));
  });

  it('returns different hash when weight changes by 0.5 kg', () => {
    const a = makeContext();
    const b = makeContext({ weight: { ...makeContext().weight, latestKg: 83.5 } });
    expect(computeInputHash(a, 'v4')).not.toBe(computeInputHash(b, 'v4'));
  });

  it('handles null nutrition gracefully', () => {
    const ctx = makeContext({ nutrition: { ...makeContext().nutrition, today: null } });
    expect(() => computeInputHash(ctx, 'v4')).not.toThrow();
  });

  it('returns different hash when promptVersion changes', () => {
    const ctx = makeContext();
    expect(computeInputHash(ctx, 'v4')).not.toBe(computeInputHash(ctx, 'v5'));
  });
});

// ---------------------------------------------------------------------------
// shouldRegenerate
// ---------------------------------------------------------------------------

describe('shouldRegenerate', () => {
  const baseHash = computeInputHash(makeContext(), 'v4');
  const now = new Date('2026-06-30T14:00:00Z');

  it('returns true when no cached document exists', () => {
    expect(shouldRegenerate(null, baseHash, now, false)).toBe(true);
  });

  it('returns false when hash is unchanged', () => {
    const doc = makeDocument({ inputHash: baseHash });
    expect(shouldRegenerate(doc, baseHash, now, false)).toBe(false);
  });

  it('returns false when hash changed but min interval not met', () => {
    const recent = new Date(now.getTime() - MIN_REGEN_INTERVAL_MS + 60_000); // 1 min before threshold
    const doc = makeDocument({
      inputHash: 'oldhash',
      lastGeneratedAt: recent.toISOString(),
      dailyGenerations: 1,
    });
    expect(shouldRegenerate(doc, 'newhash', now, false)).toBe(false);
  });

  it('returns false when max daily generations reached (non-admin)', () => {
    const old = new Date(now.getTime() - MIN_REGEN_INTERVAL_MS - 1000);
    const doc = makeDocument({
      inputHash: 'oldhash',
      lastGeneratedAt: old.toISOString(),
      dailyGenerations: MAX_DAILY_GENERATIONS,
    });
    expect(shouldRegenerate(doc, 'newhash', now, false)).toBe(false);
  });

  it('returns true for admin even when max daily generations reached', () => {
    const old = new Date(now.getTime() - MIN_REGEN_INTERVAL_MS - 1000);
    const doc = makeDocument({
      inputHash: 'oldhash',
      lastGeneratedAt: old.toISOString(),
      dailyGenerations: MAX_DAILY_GENERATIONS,
    });
    expect(shouldRegenerate(doc, 'newhash', now, true)).toBe(true);
  });

  it('returns true for admin even when min interval not yet met', () => {
    const recent = new Date(now.getTime() - MIN_REGEN_INTERVAL_MS + 60_000); // 1 min before threshold
    const doc = makeDocument({
      inputHash: 'oldhash',
      lastGeneratedAt: recent.toISOString(),
      dailyGenerations: 1,
    });
    expect(shouldRegenerate(doc, 'newhash', now, true)).toBe(true);
  });

  it('returns true when hash changed, interval met, and under daily limit', () => {
    const old = new Date(now.getTime() - MIN_REGEN_INTERVAL_MS - 1000);
    const doc = makeDocument({
      inputHash: 'oldhash',
      lastGeneratedAt: old.toISOString(),
      dailyGenerations: 1,
    });
    expect(shouldRegenerate(doc, 'newhash', now, false)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeTtlUntilMidnight
// ---------------------------------------------------------------------------

describe('computeTtlUntilMidnight', () => {
  it('returns approximately 10 hours for 14:00 UTC', () => {
    const now = new Date('2026-06-30T14:00:00Z');
    const ttl = computeTtlUntilMidnight(now);
    expect(ttl).toBe(10 * 3600); // exactly 36000 seconds
  });

  it('returns approximately 1 hour for 23:00 UTC', () => {
    const now = new Date('2026-06-30T23:00:00Z');
    const ttl = computeTtlUntilMidnight(now);
    expect(ttl).toBe(3600);
  });

  it('returns at least 1 second even at 23:59:59', () => {
    const now = new Date('2026-06-30T23:59:59Z');
    const ttl = computeTtlUntilMidnight(now);
    expect(ttl).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// InMemoryInsightRepository
// ---------------------------------------------------------------------------

describe('InMemoryInsightRepository', () => {
  let repo: InMemoryInsightRepository;

  beforeEach(() => {
    repo = new InMemoryInsightRepository();
  });

  it('returns null for unknown user/date', async () => {
    const result = await repo.get('user1', '2026-06-30');
    expect(result).toBeNull();
  });

  it('stores and retrieves a document', async () => {
    const doc = makeDocument();
    await repo.upsert(doc);
    const retrieved = await repo.get('user1', '2026-06-30');
    expect(retrieved).toEqual(doc);
  });

  it('replaces document on second upsert (same user + date)', async () => {
    const doc1 = makeDocument({ dailyGenerations: 1 });
    const doc2 = makeDocument({ dailyGenerations: 2 });
    await repo.upsert(doc1);
    await repo.upsert(doc2);
    const retrieved = await repo.get('user1', '2026-06-30');
    expect(retrieved?.dailyGenerations).toBe(2);
  });

  it('isolates different users', async () => {
    const doc1 = makeDocument({ userId: 'user1', id: 'user1:2026-06-30' });
    const doc2 = makeDocument({ userId: 'user2', id: 'user2:2026-06-30' });
    await repo.upsert(doc1);
    await repo.upsert(doc2);
    expect((await repo.get('user1', '2026-06-30'))?.userId).toBe('user1');
    expect((await repo.get('user2', '2026-06-30'))?.userId).toBe('user2');
  });
});

// ---------------------------------------------------------------------------
// InMemoryInsightRepository.listRecent
// ---------------------------------------------------------------------------

describe('InMemoryInsightRepository.listRecent', () => {
  let repo: InMemoryInsightRepository;

  beforeEach(() => {
    repo = new InMemoryInsightRepository();
  });

  it('returns empty array when no documents exist', async () => {
    const result = await repo.listRecent('user1', 7, '2026-06-30');
    expect(result).toEqual([]);
  });

  it('returns documents within the last N days of referenceDate', async () => {
    const recent = makeDocument({ date: '2026-06-28', id: 'user1:2026-06-28' });
    const old = makeDocument({ date: '2026-06-01', id: 'user1:2026-06-01' });
    await repo.upsert(recent);
    await repo.upsert(old);
    const result = await repo.listRecent('user1', 7, '2026-06-30');
    expect(result).toHaveLength(1);
    expect(result[0]?.date).toBe('2026-06-28');
  });

  it('does NOT return documents older than N days before referenceDate', async () => {
    // 8 days before referenceDate — outside the 7-day window
    const old = makeDocument({ date: '2026-06-22', id: 'user1:2026-06-22' });
    await repo.upsert(old);
    const result = await repo.listRecent('user1', 7, '2026-06-30');
    expect(result).toHaveLength(0);
  });

  it('does NOT return documents dated after referenceDate', async () => {
    // Doc is newer than the referenceDate — should be excluded
    // BUG: current code uses new Date() which is 2026-07-01, so doc 2026-06-30
    // would be within 7 days of today and get included — but should not be
    // included when referenceDate is 2026-06-25 (doc is after that date)
    const futureDoc = makeDocument({ date: '2026-06-30', id: 'user1:2026-06-30' });
    await repo.upsert(futureDoc);
    // referenceDate = '2026-06-25': window is June 18–25, doc June 30 is AFTER → exclude
    const result = await repo.listRecent('user1', 7, '2026-06-25');
    expect(result).toHaveLength(0);
  });

  it('is deterministic — same args always return same result regardless of wall-clock', async () => {
    const doc = makeDocument({ date: '2020-06-15', id: 'user1:2020-06-15' });
    await repo.upsert(doc);
    // referenceDate far in the future: doc should not be in the 7-day window
    const result = await repo.listRecent('user1', 7, '2099-01-10');
    expect(result).toHaveLength(0);
  });

  it('returns newest documents first', async () => {
    const d1 = makeDocument({ date: '2026-06-28', id: 'user1:2026-06-28' });
    const d2 = makeDocument({ date: '2026-06-30', id: 'user1:2026-06-30' });
    const d3 = makeDocument({ date: '2026-06-25', id: 'user1:2026-06-25' });
    await repo.upsert(d1); await repo.upsert(d2); await repo.upsert(d3);
    const result = await repo.listRecent('user1', 7, '2026-06-30');
    expect(result[0]?.date).toBe('2026-06-30');
    expect(result[1]?.date).toBe('2026-06-28');
    expect(result[2]?.date).toBe('2026-06-25');
  });

  it('does not return documents for other users', async () => {
    const doc = makeDocument({ userId: 'user2', id: 'user2:2026-06-28', date: '2026-06-28' });
    await repo.upsert(doc);
    const result = await repo.listRecent('user1', 7, '2026-06-30');
    expect(result).toHaveLength(0);
  });
});
