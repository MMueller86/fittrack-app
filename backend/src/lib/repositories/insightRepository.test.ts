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
  getCurrentLocalDate,
  getNextLocalMidnightUtc,
  isCurrentDayForOffset,
  normalizeTimezoneOffsetMinutes,
  InMemoryInsightRepository,
  MAX_DAILY_GENERATIONS,
  MIN_REGEN_INTERVAL_MS,
  makeFeedbackId,
  makeWeeklyInsightId,
} from './insightRepository';
import type {
  InsightDocument,
  InsightFeedbackDocument,
  InsightInputContext,
  InsightResponse,
  WeeklyEvaluation,
} from '@fittrack/shared';
import type { WeeklyInsightDocument } from './insightRepository';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeContext(overrides: Partial<InsightInputContext> = {}): InsightInputContext {
  const context: InsightInputContext = {
    date: '2026-06-30',
    dayType: 'training',
    workoutType: 'gym',
    currentHourLocal: 10,
    specialActivity: null,
    activityCompletionStatus: null,
    activityStatusSource: null,
    weight: {
      latestKg: 83.0,
      previousKg: 83.2,
      targetKg: 80.0,
      weeklyTrend30d: 'losing',
      last7Values: [83.0, 83.2, 83.5, 83.4, 83.6, 83.7, 83.8],
      isOutlierPrevious: false,
      isOutlierLatest: false,
      daysSinceLastMeasurement: 0,
      lastMeasurementDate: '2026-06-30',
    },
    nutrition: {
      today: { calories: 1600, protein: 120, carbs: 160, fat: 55, fiber: 22, hasMealItem: true },
      targets: {
        calories: 2100,
        proteinG: 160,
        carbsG: 220,
        fatG: 70,
        fiberG: 30,
        baseCalories: 2100,
        activityBonusCalories: 0,
        targetSource: 'profile_fallback',
      },
      remainingCalories: 500,
      remainingProteinG: 40,
      last3Days: [
        {
          date: '2026-06-29',
          calories: 2050,
          protein: 155,
          carbs: 210,
          fat: 65,
          hasMealItem: true,
          baseTargetCalories: 2100,
          effectiveTargetCalories: 2100,
          activityBonusCalories: 0,
          targetSource: 'profile_fallback',
        },
        { date: '2026-06-28', calories: 1980, protein: 148 },
        { date: '2026-06-27', calories: 2100, protein: 162 },
      ],
    },
    userGoal: 'maintain',
    userGoalIntensity: null,
    displayName: 'Sportler',
    progressIntelligence: {
      version: 'v1',
      primarySignal: { type: 'daily_context', confidence: 0.5, freshnessScore: 0 },
      contextSignals: [],
      progress: null,
      phase: null,
      plateau: null,
      milestone: null,
      monthlyTrend: null,
      dayCompleteness: 1,
      goalAtCalculation: 'maintain',
    },
  };

  return {
    ...context,
    ...overrides,
    userGoal: overrides.userGoal ?? context.userGoal,
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
    inputHash: computeInputHash(ctx, 'v1'),
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

function makeWeeklyDocument(overrides: Partial<WeeklyInsightDocument> = {}): WeeklyInsightDocument {
  const response: WeeklyEvaluation = {
    status: 'fresh',
    text: 'Deine Woche liegt insgesamt nah an deinen individuellen Zielen.',
    generatedAt: '2026-06-30T10:00:00Z',
  };
  return {
    id: makeWeeklyInsightId('user1', '2026-06-29'),
    userId: 'user1',
    _docType: 'weeklyInsight',
    referenceDate: '2026-06-30',
    periodStart: '2026-06-23',
    periodEnd: '2026-06-29',
    inputHash: 'weekly-hash',
    promptVersion: 'v1',
    model: 'gpt4o-mini',
    response,
    status: 'fresh',
    generatedAt: response.generatedAt,
    lastAttemptAt: response.generatedAt!,
    expiresAt: '2026-07-07T10:00:00Z',
    ttl: 604800,
    tokensUsed: 120,
    ...overrides,
  };
}

function makeFeedbackDocument(overrides: Partial<InsightFeedbackDocument> = {}): InsightFeedbackDocument {
  const insight = makeDocument({
    _docType: 'dailyInsight',
    intent: 'general',
    promptSnapshot: { system: 'system', user: 'user' },
  });
  return {
    id: makeFeedbackId('user1', '11111111-1111-4111-8111-111111111111'),
    userId: 'user1',
    _docType: 'insightFeedback',
    processingStatus: 'Open',
    insightId: insight.id,
    date: insight.date,
    insightGeneratedAt: insight.generatedAt,
    submittedAt: '2026-06-30T11:00:00Z',
    submissionId: '11111111-1111-4111-8111-111111111111',
    score: 'negative',
    userComment: 'Nicht korrekt.',
    response: insight.response,
    promptSnapshot: insight.promptSnapshot!,
    promptVersion: insight.promptVersion,
    intent: insight.intent!,
    inputContext: insight.inputContext,
    inputHash: insight.inputHash,
    model: insight.model,
    intelligenceVersion: insight.intelligenceVersion,
    tokensUsed: insight.tokensUsed,
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

  it('returns different hash when the activity status or local-time bucket changes', () => {
    const a = makeContext({
      currentHourLocal: 19,
      activityCompletionStatus: 'planned',
      activityStatusSource: 'local_time_heuristic',
    });
    const b = makeContext({
      currentHourLocal: 20,
      activityCompletionStatus: 'likely_completed',
      activityStatusSource: 'local_time_heuristic',
    });
    expect(computeInputHash(a, 'v4')).not.toBe(computeInputHash(b, 'v4'));
  });

  it('returns different hash when the current target source changes', () => {
    const nutrition = makeContext().nutrition;
    const a = makeContext({
      nutrition: {
        ...nutrition,
        targets: { ...nutrition.targets!, targetSource: 'profile_fallback' },
      },
    });
    const b = makeContext({
      nutrition: {
        ...nutrition,
        targets: { ...nutrition.targets!, targetSource: 'day_target_snapshot' },
      },
    });
    expect(computeInputHash(a, 'v4')).not.toBe(computeInputHash(b, 'v4'));
  });

  it('returns different hash when a historical target changes', () => {
    const nutrition = makeContext().nutrition;
    const a = makeContext({ nutrition });
    const b = makeContext({
      nutrition: {
        ...nutrition,
        last3Days: [
          { ...nutrition.last3Days[0]!, effectiveTargetCalories: 1900 },
          ...nutrition.last3Days.slice(1),
        ],
      },
    });
    expect(computeInputHash(a, 'v4')).not.toBe(computeInputHash(b, 'v4'));
  });

  it('distinguishes a valid zero-kcal day from a day without meal items', () => {
    const nutrition = makeContext().nutrition;
    const withZeroKcalItem = makeContext({
      nutrition: {
        ...nutrition,
        today: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, hasMealItem: true },
      },
    });
    const withoutMealItems = makeContext({ nutrition: { ...nutrition, today: null } });
    expect(computeInputHash(withZeroKcalItem, 'v4')).not.toBe(computeInputHash(withoutMealItems, 'v4'));
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

  it('includes the global prompt fingerprint and concrete system-prompt hash', () => {
    const ctx = makeContext();
    const base = computeInputHash(ctx, 'v14', 'general', 'sha256:fingerprint-a', 'sha256:system-a');
    expect(base).not.toBe(computeInputHash(ctx, 'v14', 'general', 'sha256:fingerprint-b', 'sha256:system-a'));
    expect(base).not.toBe(computeInputHash(ctx, 'v14', 'general', 'sha256:fingerprint-a', 'sha256:system-b'));
  });

  it('keeps semantic calorie and protein boundary changes visible to the hash', () => {
    const base = makeContext();
    const justOverBudget = makeContext({
      nutrition: { ...base.nutrition, remainingCalories: -0.01 },
    });
    const justUnderBudget = makeContext({
      nutrition: { ...base.nutrition, remainingCalories: 0.01 },
    });
    const exactlyAtBudget = makeContext({
      nutrition: { ...base.nutrition, remainingCalories: 0 },
    });
    const unknownBudget = makeContext({
      nutrition: { ...base.nutrition, remainingCalories: null },
    });
    const belowProteinBoundary = makeContext({
      nutrition: { ...base.nutrition, remainingProteinG: 19.99 },
    });
    const nearlyCompleteProtein = makeContext({
      nutrition: { ...base.nutrition, remainingProteinG: 20 },
    });
    const proteinGap = makeContext({
      nutrition: { ...base.nutrition, remainingProteinG: 20.01 },
    });

    const overBudgetHash = computeInputHash(justOverBudget, 'v14');
    const atBudgetHash = computeInputHash(exactlyAtBudget, 'v14');
    const underBudgetHash = computeInputHash(justUnderBudget, 'v14');
    expect(overBudgetHash).not.toBe(atBudgetHash);
    expect(atBudgetHash).not.toBe(underBudgetHash);
    expect(computeInputHash(unknownBudget, 'v14')).not.toBe(atBudgetHash);

    const belowProteinHash = computeInputHash(belowProteinBoundary, 'v14');
    const atProteinHash = computeInputHash(nearlyCompleteProtein, 'v14');
    const gapProteinHash = computeInputHash(proteinGap, 'v14');
    expect(belowProteinHash).not.toBe(atProteinHash);
    expect(atProteinHash).not.toBe(gapProteinHash);
    expect(computeInputHash(makeContext({ nutrition: { ...base.nutrition, remainingProteinG: null } }), 'v14'))
      .not.toBe(atProteinHash);
  });

  it('includes the selected intent and activity status bucket in the hash', () => {
    const ctx = makeContext({
      specialActivity: {} as InsightInputContext['specialActivity'],
      activityCompletionStatus: 'planned',
      activityStatusSource: 'local_time_heuristic',
    });
    const planned = computeInputHash(ctx, 'v10', 'activity_focus');
    const unknown = computeInputHash({ ...ctx, activityCompletionStatus: 'unknown', activityStatusSource: 'unavailable' }, 'v10', 'activity_focus');
    const otherIntent = computeInputHash(ctx, 'v10', 'general');
    expect(planned).not.toBe(unknown);
    expect(planned).not.toBe(otherIntent);
  });

  it('does not hash an unvalidated offset value', () => {
    const withoutOffset = makeContext({ timezoneOffsetMinutes: null });
    const invalidOffset = makeContext({ timezoneOffsetMinutes: 900 });

    expect(computeInputHash(withoutOffset, 'v10', 'general'))
      .toBe(computeInputHash(invalidOffset, 'v10', 'general'));
  });

  it('invalidates changes to complete prompt-relevant nutrition and progress inputs', () => {
    const base = makeContext({
      progressIntelligence: {
        version: 'v1',
        primarySignal: { type: 'daily_context', confidence: 0.5, freshnessScore: 0 },
        contextSignals: [],
        progress: null,
        phase: null,
        plateau: null,
        milestone: null,
        monthlyTrend: null,
        dayCompleteness: 1,
        goalAtCalculation: 'maintain',
      },
    });
    const nutritionChanged = makeContext({
      nutrition: {
        ...base.nutrition,
        today: { ...base.nutrition.today!, carbs: 190, fat: 70, fiber: 28 },
      },
    });
    const progressChanged = makeContext({
      progressIntelligence: {
        ...base.progressIntelligence,
        primarySignal: { ...base.progressIntelligence.primarySignal, type: 'phase_context' },
      },
    });
    expect(computeInputHash(base, 'v10', 'general')).not.toBe(computeInputHash(nutritionChanged, 'v10', 'general'));
    expect(computeInputHash(base, 'v10', 'general')).not.toBe(computeInputHash(progressChanged, 'v10', 'general'));
  });
});

describe('Daily timezone offset helpers', () => {
  it.each([
    ['-840', -840],
    ['0', 0],
    ['840', 840],
    [null, null],
    ['', null],
    ['1.5', null],
    ['not-a-number', null],
    ['841', null],
    ['-841', null],
  ] as const)('normalizes %s to %s without clamping', (value, expected) => {
    expect(normalizeTimezoneOffsetMinutes(value)).toBe(expected);
  });

  it.each([
    [new Date('2026-08-20T23:30:00.000Z'), 120, '2026-08-21'],
    [new Date('2026-08-20T00:30:00.000Z'), -840, '2026-08-19'],
    [new Date('2026-08-20T23:30:00.000Z'), 0, '2026-08-20'],
    [new Date('2026-08-20T10:30:00.000Z'), 840, '2026-08-21'],
  ] as const)('computes the local date for offset %s', (now, offset, expected) => {
    expect(getCurrentLocalDate(now, offset)).toBe(expected);
  });

  it.each([
    ['2026-08-21', new Date('2026-08-20T23:30:00.000Z'), 120, true],
    ['2026-08-20', new Date('2026-08-20T23:30:00.000Z'), 120, false],
    ['2026-08-19', new Date('2026-08-20T00:30:00.000Z'), -840, true],
    ['2026-08-21', new Date('2026-08-20T10:30:00.000Z'), 840, true],
    ['2026-08-20', new Date('2026-08-20T23:30:00.000Z'), null, false],
  ] as const)('checks current local day for %s', (requestedDate, now, offset, expected) => {
    expect(isCurrentDayForOffset(requestedDate, now, offset)).toBe(expected);
  });

  it.each([
    [new Date('2026-08-20T23:30:00.000Z'), 120, '2026-08-21T22:00:00.000Z'],
    [new Date('2026-08-20T00:30:00.000Z'), -840, '2026-08-20T14:00:00.000Z'],
    [new Date('2026-08-20T23:30:00.000Z'), 840, '2026-08-21T10:00:00.000Z'],
    [new Date('2026-08-20T12:00:00.000Z'), null, '2026-08-21T00:00:00.000Z'],
    [new Date('2026-08-20T12:00:00.000Z'), 900, '2026-08-21T00:00:00.000Z'],
  ] as const)('computes the next midnight boundary for offset %s', (now, offset, expected) => {
    expect(getNextLocalMidnightUtc(now, offset).toISOString()).toBe(expected);
  });

  it('rounds TTL upward so it cannot expire before the boundary', () => {
    const now = new Date('2026-08-20T23:59:58.100Z');

    expect(computeTtlUntilMidnight(now, 0)).toBe(2);
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

  it('hard-invalidates a legacy or older prompt instance regardless of cache limits', () => {
    const recentLegacy = makeDocument({
      promptVersion: 'v9',
      inputHash: 'newhash',
      lastGeneratedAt: now.toISOString(),
      dailyGenerations: MAX_DAILY_GENERATIONS,
    });
    expect(shouldRegenerate(recentLegacy, 'newhash', now, false, 'v10')).toBe(true);

    const incompleteV10 = makeDocument({
      promptVersion: 'v10',
      inputHash: baseHash,
      intent: undefined,
      promptSnapshot: undefined,
    });
    expect(shouldRegenerate(incompleteV10, baseHash, now, false, 'v10')).toBe(true);
  });

  it('serves a complete current prompt instance when its hash is unchanged', () => {
    const doc = makeDocument({
      promptVersion: 'v10',
      inputHash: baseHash,
      intent: 'general',
      promptSnapshot: { system: 'system', user: 'user' },
    });
    expect(shouldRegenerate(doc, baseHash, now, false, 'v10')).toBe(false);
  });

  it('hard-invalidates missing or changed prompt identities before cache limits', () => {
    const old = new Date(now.getTime() - MIN_REGEN_INTERVAL_MS + 60_000);
    const base = makeDocument({
      inputHash: baseHash,
      promptVersion: 'v14',
      intent: 'general',
      promptSnapshot: { system: 'system', user: 'user' },
      promptFingerprint: 'sha256:fingerprint-a',
      systemPromptHash: 'sha256:system-a',
      lastGeneratedAt: old.toISOString(),
      dailyGenerations: MAX_DAILY_GENERATIONS,
    });

    expect(shouldRegenerate(base, baseHash, now, false, 'v14', 'sha256:fingerprint-a', 'sha256:system-a')).toBe(false);
    expect(shouldRegenerate({ ...base, promptFingerprint: undefined }, baseHash, now, false, 'v14', 'sha256:fingerprint-a', 'sha256:system-a')).toBe(true);
    expect(shouldRegenerate(base, baseHash, now, false, 'v14', 'sha256:fingerprint-b', 'sha256:system-a')).toBe(true);
    expect(shouldRegenerate(base, baseHash, now, false, 'v14', 'sha256:fingerprint-a', 'sha256:system-b')).toBe(true);
  });

  it('hard-invalidates mismatched intent and exact prompt snapshot before cache limits', () => {
    const recent = new Date(now.getTime() - MIN_REGEN_INTERVAL_MS + 60_000);
    const expectedIntent = 'general' as const;
    const expectedPromptSnapshot = { system: 'expected system', user: 'expected user' };
    const base = makeDocument({
      inputHash: baseHash,
      promptVersion: 'v14',
      promptFingerprint: 'sha256:fingerprint-a',
      systemPromptHash: 'sha256:system-a',
      intent: expectedIntent,
      promptSnapshot: expectedPromptSnapshot,
      lastGeneratedAt: recent.toISOString(),
      dailyGenerations: MAX_DAILY_GENERATIONS,
    });
    const shouldRegenerateWithCurrentIdentity = (document: InsightDocument) => shouldRegenerate(
      document,
      baseHash,
      now,
      false,
      'v14',
      'sha256:fingerprint-a',
      'sha256:system-a',
      expectedIntent,
      expectedPromptSnapshot,
    );

    expect(shouldRegenerateWithCurrentIdentity(base)).toBe(false);
    expect(shouldRegenerateWithCurrentIdentity({ ...base, intent: 'phase_progress' })).toBe(true);
    expect(shouldRegenerateWithCurrentIdentity({
      ...base,
      promptSnapshot: { ...expectedPromptSnapshot, system: 'changed system' },
    })).toBe(true);
    expect(shouldRegenerateWithCurrentIdentity({
      ...base,
      promptSnapshot: { ...expectedPromptSnapshot, user: 'changed user' },
    })).toBe(true);
    expect(shouldRegenerateWithCurrentIdentity({ ...base, intent: undefined })).toBe(true);
    expect(shouldRegenerateWithCurrentIdentity({ ...base, promptSnapshot: undefined })).toBe(true);
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

  it('does not interpret a foreign document discriminator as a daily insight', async () => {
    await repo.upsert({
      ...makeDocument(),
      _docType: 'feedback' as never,
    });
    expect(await repo.get('user1', '2026-06-30')).toBeNull();
    expect(await repo.listRecent('user1', 7, '2026-06-30')).toEqual([]);
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

describe('InMemoryInsightRepository feedback documents', () => {
  let repo: InMemoryInsightRepository;

  beforeEach(() => {
    repo = new InMemoryInsightRepository();
  });

  it('creates a feedback document only once for a submission id', async () => {
    const first = makeFeedbackDocument();
    const second = makeFeedbackDocument({ userComment: 'Anderer Kommentar.' });

    await expect(repo.createFeedbackIfAbsent(first)).resolves.toEqual({ created: true, document: first });
    await expect(repo.createFeedbackIfAbsent(second)).resolves.toEqual({ created: false, document: first });
    await expect(repo.getFeedbackBySubmissionId('user1', first.submissionId)).resolves.toEqual(first);
  });

  it('treats missing legacy processingStatus as Open when reading feedback', async () => {
    const legacy = makeFeedbackDocument({ processingStatus: undefined });
    await repo.createFeedbackIfAbsent(legacy);

    await expect(repo.getFeedbackBySubmissionId('user1', legacy.submissionId)).resolves.toMatchObject({
      id: legacy.id,
      processingStatus: 'Open',
    });
  });

  it('isolates feedback lookups by user and discriminator', async () => {
    const feedback = makeFeedbackDocument();
    await repo.createFeedbackIfAbsent(feedback);

    await expect(repo.getFeedbackBySubmissionId('user2', feedback.submissionId)).resolves.toBeNull();
    await expect(repo.get('user1', feedback.date)).resolves.toBeNull();
  });

  it('marks only the exact Daily instance as negative', async () => {
    const daily = makeDocument({ feedbackScore: null });
    await repo.upsert(daily);

    await expect(repo.markNegativeFeedback(daily.userId, daily.date, 'wrong-generation')).resolves.toBe(false);
    expect((await repo.get(daily.userId, daily.date))?.feedbackScore).toBeNull();

    await expect(repo.markNegativeFeedback(daily.userId, daily.date, daily.generatedAt)).resolves.toBe(true);
    expect((await repo.get(daily.userId, daily.date))?.feedbackScore).toBe('negative');
  });

  it('updates feedback processing status with terminal-state semantics', async () => {
    const open = makeFeedbackDocument();
    const done = makeFeedbackDocument({
      id: makeFeedbackId('user1', '22222222-2222-4222-8222-222222222222'),
      submissionId: '22222222-2222-4222-8222-222222222222',
      processingStatus: 'Done',
    });
    const rejected = makeFeedbackDocument({
      id: makeFeedbackId('user1', '33333333-3333-4333-8333-333333333333'),
      submissionId: '33333333-3333-4333-8333-333333333333',
      processingStatus: 'Rejected',
    });
    await repo.createFeedbackIfAbsent(open);
    await repo.createFeedbackIfAbsent(done);
    await repo.createFeedbackIfAbsent(rejected);

    await expect(repo.updateFeedbackProcessingStatus('user1', open.id, 'Done')).resolves.toEqual({
      outcome: 'updated',
      status: 'Done',
    });
    await expect(repo.updateFeedbackProcessingStatus('user1', done.id, 'Done')).resolves.toEqual({
      outcome: 'noop',
      status: 'Done',
    });
    await expect(repo.updateFeedbackProcessingStatus('user1', done.id, 'Open')).resolves.toEqual({
      outcome: 'invalid_transition',
      status: 'Done',
    });
    await expect(repo.updateFeedbackProcessingStatus('user1', rejected.id, 'Done')).resolves.toEqual({
      outcome: 'invalid_transition',
      status: 'Rejected',
    });
    await expect(repo.updateFeedbackProcessingStatus('user2', open.id, 'Done')).resolves.toEqual({
      outcome: 'not_found',
    });
  });
});

describe('InMemoryInsightRepository weekly documents', () => {
  let repo: InMemoryInsightRepository;

  beforeEach(() => {
    repo = new InMemoryInsightRepository();
  });

  it('stores weekly documents under a separate key and discriminator', async () => {
    const daily = makeDocument();
    const weekly = makeWeeklyDocument();
    await repo.upsert(daily);
    await repo.upsertWeekly(weekly);

    expect(await repo.get('user1', '2026-06-30')).toEqual(daily);
    expect(await repo.getWeekly('user1', '2026-06-29')).toEqual(weekly);
    expect(await repo.getWeekly('user1', '2026-06-30')).toBeNull();
  });

  it('replaces only the matching weekly period', async () => {
    const first = makeWeeklyDocument();
    const second = makeWeeklyDocument({
      periodEnd: '2026-07-06',
      id: makeWeeklyInsightId('user1', '2026-07-06'),
    });
    await repo.upsertWeekly(first);
    await repo.upsertWeekly(second);

    expect((await repo.getWeekly('user1', '2026-06-29'))?.periodEnd).toBe('2026-06-29');
    expect((await repo.getWeekly('user1', '2026-07-06'))?.periodEnd).toBe('2026-07-06');
  });
});
