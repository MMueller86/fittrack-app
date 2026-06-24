import { describe, it, expect, beforeEach, vi } from 'vitest';
import { enforceQuota, trackUsage } from './quota';
import type { UserContext } from './auth';

// Mock the repository module
vi.mock('./repositories/aiUsageRepository', () => {
  const mockRepo = {
    checkQuota: vi.fn(),
    incrementUsage: vi.fn(),
    getCounter: vi.fn(),
  };
  return {
    getAiUsageRepository: () => mockRepo,
    InMemoryAiUsageRepository: vi.fn(),
    __mockRepo: mockRepo,
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { __mockRepo: mockRepo } = await import('./repositories/aiUsageRepository') as any;

describe('enforceQuota', () => {
  const freeUser: UserContext = { userId: 'user-1', tier: 'free', isAdmin: false };
  const premiumUser: UserContext = { userId: 'premium-user', tier: 'premium', isAdmin: false };
  const adminUser: UserContext = { userId: 'admin-user', tier: 'free', isAdmin: true };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when quota allows', async () => {
    mockRepo.checkQuota.mockResolvedValue({
      allowed: true,
      used: 5,
      limit: 50,
      remaining: 45,
      feature: 'meal-parser',
      period: '2026-05',
    });

    const result = await enforceQuota(freeUser, 'meal-parser');
    expect(result).toBeNull();
  });

  it('returns 429 response when quota exceeded', async () => {
    mockRepo.checkQuota.mockResolvedValue({
      allowed: false,
      used: 50,
      limit: 50,
      remaining: 0,
      feature: 'meal-parser',
      period: '2026-05',
    });

    const result = await enforceQuota(freeUser, 'meal-parser');
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
    expect((result!.jsonBody as Record<string, unknown>).error).toBe('quota_exceeded');
    expect((result!.jsonBody as Record<string, unknown>).feature).toBe('meal-parser');
    expect((result!.jsonBody as Record<string, unknown>).used).toBe(50);
    expect((result!.jsonBody as Record<string, unknown>).limit).toBe(50);
    expect((result!.jsonBody as Record<string, unknown>).resetsAt).toBe('2026-06-01T00:00:00.000Z');
  });

  it('passes correct userId and tier to checkQuota', async () => {
    mockRepo.checkQuota.mockResolvedValue({
      allowed: true, used: 0, limit: Infinity, remaining: Infinity,
      feature: 'meal-parser', period: '2026-05',
    });

    await enforceQuota(premiumUser, 'meal-parser');
    expect(mockRepo.checkQuota).toHaveBeenCalledWith('premium-user', 'meal-parser', 'premium');
  });

  it('returns null for admin user without calling checkQuota', async () => {
    const result = await enforceQuota(adminUser, 'meal-parser');
    expect(result).toBeNull();
    expect(mockRepo.checkQuota).not.toHaveBeenCalled();
  });

  it('returns null for admin user even when quota would be exceeded', async () => {
    // checkQuota is never called, so mock value here is irrelevant —
    // the test verifies the admin bypass fires before any repo access.
    const result = await enforceQuota(adminUser, 'food-estimate');
    expect(result).toBeNull();
    expect(mockRepo.checkQuota).not.toHaveBeenCalled();
  });
});

describe('trackUsage', () => {
  const freeUser: UserContext = { userId: 'user-1', tier: 'free', isAdmin: false };
  const adminUser: UserContext = { userId: 'admin-user', tier: 'free', isAdmin: true };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls incrementUsage with correct params', async () => {
    mockRepo.incrementUsage.mockResolvedValue({});
    await trackUsage(freeUser, 'food-estimate');
    expect(mockRepo.incrementUsage).toHaveBeenCalledWith('user-1', 'food-estimate', 'free');
  });

  it('calls incrementUsage for admin user (usage is still counted)', async () => {
    mockRepo.incrementUsage.mockResolvedValue({});
    await trackUsage(adminUser, 'meal-parser');
    expect(mockRepo.incrementUsage).toHaveBeenCalledWith('admin-user', 'meal-parser', 'free');
  });
});
