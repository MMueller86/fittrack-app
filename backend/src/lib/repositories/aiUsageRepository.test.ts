import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryAiUsageRepository } from './aiUsageRepository';

describe('InMemoryAiUsageRepository', () => {
  let repo: InMemoryAiUsageRepository;

  beforeEach(() => {
    repo = new InMemoryAiUsageRepository();
  });

  describe('incrementUsage', () => {
    it('creates a counter on first call', async () => {
      const counter = await repo.incrementUsage('user-1', 'meal-parser', 'free');
      expect(counter.userId).toBe('user-1');
      expect(counter.feature).toBe('meal-parser');
      expect(counter.used).toBe(1);
      expect(counter.limit).toBe(50); // free tier meal-parser limit
      expect(counter.tier).toBe('free');
    });

    it('increments existing counter', async () => {
      await repo.incrementUsage('user-1', 'meal-parser', 'free');
      const counter = await repo.incrementUsage('user-1', 'meal-parser', 'free');
      expect(counter.used).toBe(2);
    });

    it('tracks different features independently', async () => {
      await repo.incrementUsage('user-1', 'meal-parser', 'free');
      await repo.incrementUsage('user-1', 'food-estimate', 'free');
      const mpQuota = await repo.checkQuota('user-1', 'meal-parser', 'free');
      const feQuota = await repo.checkQuota('user-1', 'food-estimate', 'free');
      expect(mpQuota.used).toBe(1);
      expect(feQuota.used).toBe(1);
    });

    it('tracks different users independently', async () => {
      await repo.incrementUsage('user-1', 'meal-parser', 'free');
      await repo.incrementUsage('user-2', 'meal-parser', 'free');
      const q1 = await repo.checkQuota('user-1', 'meal-parser', 'free');
      const q2 = await repo.checkQuota('user-2', 'meal-parser', 'free');
      expect(q1.used).toBe(1);
      expect(q2.used).toBe(1);
    });
  });

  describe('checkQuota', () => {
    it('allows when under limit', async () => {
      const result = await repo.checkQuota('user-1', 'meal-parser', 'free');
      expect(result.allowed).toBe(true);
      expect(result.used).toBe(0);
      expect(result.limit).toBe(50);
      expect(result.remaining).toBe(50);
    });

    it('blocks when at limit', async () => {
      // Exhaust the limit
      for (let i = 0; i < 50; i++) {
        await repo.incrementUsage('user-1', 'meal-parser', 'free');
      }
      const result = await repo.checkQuota('user-1', 'meal-parser', 'free');
      expect(result.allowed).toBe(false);
      expect(result.used).toBe(50);
      expect(result.remaining).toBe(0);
    });

    it('never blocks internal tier', async () => {
      // Internal has Infinity limit — always allowed
      const result = await repo.checkQuota('user-1', 'meal-parser', 'internal');
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(Infinity);
    });
  });

  describe('getCounter', () => {
    it('returns null when no counter exists', async () => {
      const period = new Date().toISOString().slice(0, 7); // current YYYY-MM
      const result = await repo.getCounter('user-1', 'meal-parser', period);
      expect(result).toBeNull();
    });

    it('returns counter after increment', async () => {
      await repo.incrementUsage('user-1', 'meal-parser', 'free');
      const period = new Date().toISOString().slice(0, 7);
      const result = await repo.getCounter('user-1', 'meal-parser', period);
      expect(result).not.toBeNull();
      expect(result!.used).toBe(1);
    });
  });
});
