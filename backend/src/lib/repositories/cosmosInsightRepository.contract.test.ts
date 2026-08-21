import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  type EmulatorContext,
  createTestDatabase,
  destroyTestDatabase,
  setupEmulatorEnv,
} from '../../test-utils/cosmosEmulator';
import { __resetCosmosForTests } from '../cosmos';
import {
  CosmosInsightRepository,
  makeFeedbackId,
  makeWeeklyInsightId,
  type WeeklyInsightDocument,
} from './insightRepository';
import type { InsightDocument } from '@fittrack/shared';

let ctx: EmulatorContext | undefined;
let repo: CosmosInsightRepository;

const USER_A = 'contract-insight-a';
const USER_B = 'contract-insight-b';

beforeAll(async () => {
  const { databaseId } = setupEmulatorEnv();
  ctx = await createTestDatabase(databaseId);
  __resetCosmosForTests();
  repo = new CosmosInsightRepository();
});

afterAll(async () => {
  await destroyTestDatabase(ctx);
  __resetCosmosForTests();
});

async function clearInsights(userIds: string[]): Promise<void> {
  const container = ctx!.database.container('aiInsights');
  for (const userId of userIds) {
    const { resources } = await container.items
      .query<{ id: string }>(
        { query: 'SELECT c.id FROM c WHERE c.userId = @u', parameters: [{ name: '@u', value: userId }] },
        { partitionKey: userId },
      )
      .fetchAll();
    for (const document of resources) {
      await container.item(document.id, userId).delete();
    }
  }
}

function makeWeeklyDocument(
  userId = USER_A,
  periodEnd = '2026-08-13',
): WeeklyInsightDocument & { date: string } {
  return {
    id: makeWeeklyInsightId(userId, periodEnd),
    userId,
    _docType: 'weeklyInsight',
    date: periodEnd,
    referenceDate: '2026-08-14',
    periodStart: '2026-08-07',
    periodEnd,
    inputHash: `hash-${periodEnd}`,
    promptVersion: 'v1',
    model: 'gpt4o-mini',
    response: { status: 'fresh', text: 'Wochenbewertung.', generatedAt: '2026-08-14T10:00:00.000Z' },
    status: 'fresh',
    generatedAt: '2026-08-14T10:00:00.000Z',
    lastAttemptAt: '2026-08-14T10:00:00.000Z',
    expiresAt: '2026-08-21T10:00:00.000Z',
    ttl: 604800,
    tokensUsed: 12,
  };
}

async function seedDailyDocument(id: string, date: string): Promise<void> {
  await ctx!.database.container('aiInsights').items.upsert({
    id,
    userId: USER_A,
    date,
  });
}

function makeDailyDocument(
  userId = USER_A,
  date = '2026-08-20',
): InsightDocument {
  return {
    id: `${userId}:${date}`,
    userId,
    _docType: 'dailyInsight',
    date,
    generatedAt: '2026-08-20T08:30:00.000Z',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    ttl: 3600,
    promptVersion: 'v14',
    promptFingerprint: 'sha256:daily-fingerprint',
    systemPromptHash: 'sha256:system-prompt-hash',
    intent: 'general',
    promptSnapshot: { system: 'system', user: 'user' },
    model: 'gpt4o-mini',
    inputHash: 'hash',
    inputContext: {} as InsightDocument['inputContext'],
    response: {
      title: 'Titel',
      summary: 'Zusammenfassung',
      generatedAt: '2026-08-20T08:30:00.000Z',
      promptVersion: 'v14',
      status: 'fresh',
    },
    dailyGenerations: 1,
    lastGeneratedAt: '2026-08-20T08:30:00.000Z',
    feedbackScore: null,
    tokensUsed: 12,
    intelligenceVersion: 'v1',
  };
}

beforeEach(async () => {
  await clearInsights([USER_A, USER_B]);
});

describe('CosmosInsightRepository weekly documents (contract)', () => {
  it('returns null for an unknown weekly period', async () => {
    await expect(repo.getWeekly(USER_A, '2026-08-13')).resolves.toBeNull();
  });

  it('persists and reads a weekly document with its own discriminator and key', async () => {
    const document = makeWeeklyDocument();
    await repo.upsertWeekly(document);

    await expect(repo.getWeekly(USER_A, '2026-08-13')).resolves.toEqual(document);
    await expect(repo.getWeekly(USER_A, '2026-08-12')).resolves.toBeNull();
    await expect(repo.get(USER_A, '2026-08-13')).resolves.toBeNull();
  });

  it('reads a legacy weekly document with redundant top-level fields', async () => {
    const document = makeWeeklyDocument();
    await ctx!.database.container('aiInsights').items.upsert({
      ...document,
      response: {
        ...document.response,
        status: 'fresh',
        generatedAt: '2026-08-14T10:00:00.000Z',
      },
      status: 'unavailable',
      generatedAt: null,
    });

    await expect(repo.getWeekly(USER_A, '2026-08-13')).resolves.toMatchObject({
      response: {
        status: 'fresh',
        generatedAt: '2026-08-14T10:00:00.000Z',
      },
      status: 'unavailable',
      generatedAt: null,
    });
  });

  it('scopes weekly documents by user and period', async () => {
    await repo.upsertWeekly(makeWeeklyDocument(USER_A, '2026-08-13'));
    await repo.upsertWeekly(makeWeeklyDocument(USER_B, '2026-08-13'));
    await repo.upsertWeekly(makeWeeklyDocument(USER_A, '2026-08-12'));

    expect((await repo.getWeekly(USER_A, '2026-08-13'))?.userId).toBe(USER_A);
    expect((await repo.getWeekly(USER_B, '2026-08-13'))?.userId).toBe(USER_B);
    expect((await repo.getWeekly(USER_A, '2026-08-12'))?.periodEnd).toBe('2026-08-12');
  });
});

describe('CosmosInsightRepository.listRecent (contract)', () => {
  it('excludes weekly documents in the date window and keeps legacy daily documents sorted', async () => {
    await seedDailyDocument(`${USER_A}:2026-08-14`, '2026-08-14');
    await seedDailyDocument(`${USER_A}:2026-08-12`, '2026-08-12');
    await repo.upsertWeekly(makeWeeklyDocument(USER_A, '2026-08-13'));

    const result = await repo.listRecent(USER_A, 7, '2026-08-14');

    expect(result.map((document) => document.id)).toEqual([
      `${USER_A}:2026-08-14`,
      `${USER_A}:2026-08-12`,
    ]);
    expect(result.map((document) => document.date)).toEqual(['2026-08-14', '2026-08-12']);
  });
});

describe('CosmosInsightRepository Daily provenance compatibility (contract)', () => {
  it('reads a legacy Daily without prompt identities', async () => {
    const document = makeDailyDocument();
    const legacy: InsightDocument = { ...document };
    delete legacy.promptFingerprint;
    delete legacy.systemPromptHash;
    await ctx!.database.container('aiInsights').items.upsert(legacy);

    await expect(repo.get(USER_A, document.date)).resolves.toMatchObject({
      id: document.id,
      promptVersion: document.promptVersion,
    });
    const stored = await repo.get(USER_A, document.date);
    expect(stored?.promptFingerprint).toBeUndefined();
    expect(stored?.systemPromptHash).toBeUndefined();
  });
});

describe('CosmosInsightRepository feedback documents (contract)', () => {
  it('creates a no-TTL feedback snapshot and keeps it separate from Daily reads', async () => {
    const document = makeDailyDocument();
    const feedback = {
      id: makeFeedbackId(USER_A, '11111111-1111-4111-8111-111111111111'),
      userId: USER_A,
      _docType: 'insightFeedback' as const,
      processingStatus: 'Open' as const,
      insightId: document.id,
      date: document.date,
      insightGeneratedAt: document.generatedAt,
      submittedAt: '2026-08-20T12:00:00.000Z',
      submissionId: '11111111-1111-4111-8111-111111111111',
      score: 'negative' as const,
      userComment: 'Nicht korrekt.',
      response: document.response,
      promptSnapshot: document.promptSnapshot!,
      promptVersion: document.promptVersion,
      promptFingerprint: document.promptFingerprint,
      systemPromptHash: document.systemPromptHash,
      intent: document.intent!,
      inputContext: document.inputContext,
      inputHash: document.inputHash,
      model: document.model,
      intelligenceVersion: document.intelligenceVersion,
      tokensUsed: document.tokensUsed,
    };

    await repo.createFeedbackIfAbsent(feedback);

    await expect(repo.getFeedbackBySubmissionId(USER_A, feedback.submissionId)).resolves.toEqual(feedback);
    await expect(repo.get(USER_A, document.date)).resolves.toBeNull();
    const raw = await ctx!.database.container('aiInsights').item(feedback.id, USER_A).read<Record<string, unknown>>();
    expect(Object.hasOwn(raw.resource ?? {}, 'ttl')).toBe(false);
    expect(Object.hasOwn(raw.resource ?? {}, 'expiresAt')).toBe(false);
  });

  it('uses Cosmos conflict semantics for an idempotent retry and isolates users', async () => {
    const first = {
      ...makeDailyDocument(),
      id: makeFeedbackId(USER_A, '22222222-2222-4222-8222-222222222222'),
      _docType: 'insightFeedback' as const,
      submissionId: '22222222-2222-4222-8222-222222222222',
      insightId: `${USER_A}:2026-08-20`,
      insightGeneratedAt: '2026-08-20T08:30:00.000Z',
      submittedAt: '2026-08-20T12:00:00.000Z',
      score: 'negative' as const,
      userComment: 'Erster Kommentar.',
    };
    const feedback = {
      id: first.id,
      userId: USER_A,
      _docType: 'insightFeedback' as const,
      processingStatus: 'Open' as const,
      insightId: first.insightId,
      date: first.date,
      insightGeneratedAt: first.insightGeneratedAt,
      submittedAt: first.submittedAt,
      submissionId: first.submissionId,
      score: first.score,
      userComment: first.userComment,
      response: first.response,
      promptSnapshot: first.promptSnapshot!,
      promptVersion: first.promptVersion,
      intent: first.intent!,
      inputContext: first.inputContext,
      inputHash: first.inputHash,
      model: first.model,
      intelligenceVersion: first.intelligenceVersion,
      tokensUsed: first.tokensUsed,
    };
    const changed = { ...feedback, userComment: 'Anderer Kommentar.' };

    await expect(repo.createFeedbackIfAbsent(feedback)).resolves.toMatchObject({ created: true });
    await expect(repo.createFeedbackIfAbsent(changed)).resolves.toMatchObject({
      created: false,
      document: feedback,
    });
    await expect(repo.getFeedbackBySubmissionId(USER_B, feedback.submissionId)).resolves.toBeNull();
  });

  it('conditionally marks the matching Daily instance without extending its expiry', async () => {
    const document = makeDailyDocument();
    await ctx!.database.container('aiInsights').items.upsert(document);
    const before = await ctx!.database.container('aiInsights').item(document.id, USER_A).read<InsightDocument>();
    const originalExpiresAt = before.resource!.expiresAt;

    await expect(repo.markNegativeFeedback(USER_A, document.date, document.generatedAt)).resolves.toBe(true);

    const after = await ctx!.database.container('aiInsights').item(document.id, USER_A).read<InsightDocument>();
    expect(after.resource?.feedbackScore).toBe('negative');
    expect(after.resource?.expiresAt).toBe(originalExpiresAt);
    expect(after.resource?.ttl).toBeLessThanOrEqual(before.resource!.ttl);
    await expect(repo.markNegativeFeedback(USER_A, document.date, 'different-generation')).resolves.toBe(false);
  });

  it('treats a legacy feedback document without processingStatus as Open on reads', async () => {
    const document = makeDailyDocument();
    const submissionId = '44444444-4444-4444-8444-444444444444';
    const feedbackId = makeFeedbackId(USER_A, submissionId);
    await ctx!.database.container('aiInsights').items.upsert({
      id: feedbackId,
      userId: USER_A,
      _docType: 'insightFeedback',
      insightId: document.id,
      date: document.date,
      insightGeneratedAt: document.generatedAt,
      submittedAt: '2026-08-20T12:00:00.000Z',
      submissionId,
      score: 'negative',
      userComment: 'Legacy',
      response: document.response,
      promptSnapshot: document.promptSnapshot,
      promptVersion: document.promptVersion,
      intent: document.intent,
      inputContext: document.inputContext,
      inputHash: document.inputHash,
      model: document.model,
      intelligenceVersion: document.intelligenceVersion,
      tokensUsed: document.tokensUsed,
    });

    await expect(repo.getFeedbackBySubmissionId(USER_A, submissionId)).resolves.toMatchObject({
      id: feedbackId,
      processingStatus: 'Open',
    });
  });

  it('updates processing status with exact partition/id/docType guard and terminal semantics', async () => {
    const document = makeDailyDocument();
    const submissionId = '55555555-5555-4555-8555-555555555555';
    const feedbackId = makeFeedbackId(USER_A, submissionId);
    const feedback = {
      id: feedbackId,
      userId: USER_A,
      _docType: 'insightFeedback' as const,
      processingStatus: 'Open' as const,
      insightId: document.id,
      date: document.date,
      insightGeneratedAt: document.generatedAt,
      submittedAt: '2026-08-20T12:00:00.000Z',
      submissionId,
      score: 'negative' as const,
      userComment: 'Status test',
      response: document.response,
      promptSnapshot: document.promptSnapshot!,
      promptVersion: document.promptVersion,
      intent: document.intent!,
      inputContext: document.inputContext,
      inputHash: document.inputHash,
      model: document.model,
      intelligenceVersion: document.intelligenceVersion,
      tokensUsed: document.tokensUsed,
    };
    await repo.createFeedbackIfAbsent(feedback);

    await expect(repo.updateFeedbackProcessingStatus(USER_A, feedbackId, 'Done')).resolves.toEqual({
      outcome: 'updated',
      status: 'Done',
    });
    await expect(repo.updateFeedbackProcessingStatus(USER_A, feedbackId, 'Done')).resolves.toEqual({
      outcome: 'noop',
      status: 'Done',
    });
    await expect(repo.updateFeedbackProcessingStatus(USER_A, feedbackId, 'Rejected')).resolves.toEqual({
      outcome: 'invalid_transition',
      status: 'Done',
    });
    await expect(repo.updateFeedbackProcessingStatus(USER_A, feedbackId, 'Open')).resolves.toEqual({
      outcome: 'invalid_transition',
      status: 'Done',
    });
    await expect(repo.updateFeedbackProcessingStatus(USER_B, feedbackId, 'Done')).resolves.toEqual({
      outcome: 'not_found',
    });

    await ctx!.database.container('aiInsights').items.upsert({
      id: `${USER_A}:not-feedback`,
      userId: USER_A,
      _docType: 'dailyInsight',
      date: '2026-08-20',
      generatedAt: '2026-08-20T08:30:00.000Z',
      expiresAt: '2026-08-21T00:00:00.000Z',
      ttl: 3600,
      promptVersion: 'v14',
      model: 'gpt4o-mini',
      inputHash: 'x',
      inputContext: {},
      response: { title: 'x', summary: 'x', generatedAt: '2026-08-20T08:30:00.000Z', promptVersion: 'v14', status: 'fresh' },
      dailyGenerations: 1,
      lastGeneratedAt: '2026-08-20T08:30:00.000Z',
      feedbackScore: null,
      tokensUsed: 1,
      intelligenceVersion: 'v1',
    });
    await expect(repo.updateFeedbackProcessingStatus(USER_A, `${USER_A}:not-feedback`, 'Done')).resolves.toEqual({
      outcome: 'not_found',
    });
  });

  it('is deterministic for concurrent repeated writes to the same target status', async () => {
    const document = makeDailyDocument();
    const submissionId = '77777777-7777-4777-8777-777777777777';
    const feedbackId = makeFeedbackId(USER_A, submissionId);
    const feedback = {
      id: feedbackId,
      userId: USER_A,
      _docType: 'insightFeedback' as const,
      processingStatus: 'Open' as const,
      insightId: document.id,
      date: document.date,
      insightGeneratedAt: document.generatedAt,
      submittedAt: '2026-08-20T12:00:00.000Z',
      submissionId,
      score: 'negative' as const,
      userComment: 'Concurrent status update',
      response: document.response,
      promptSnapshot: document.promptSnapshot!,
      promptVersion: document.promptVersion,
      intent: document.intent!,
      inputContext: document.inputContext,
      inputHash: document.inputHash,
      model: document.model,
      intelligenceVersion: document.intelligenceVersion,
      tokensUsed: document.tokensUsed,
    };
    await repo.createFeedbackIfAbsent(feedback);

    const [first, second] = await Promise.all([
      repo.updateFeedbackProcessingStatus(USER_A, feedbackId, 'Done'),
      repo.updateFeedbackProcessingStatus(USER_A, feedbackId, 'Done'),
    ]);

    const outcomes = [first.outcome, second.outcome].sort();
    expect(outcomes).toEqual(['noop', 'updated']);
    await expect(repo.getFeedbackBySubmissionId(USER_A, submissionId)).resolves.toMatchObject({
      id: feedbackId,
      processingStatus: 'Done',
    });
  });

  it('applies unresolved-vs-handled search predicates and excludes unrelated aiInsights doc types', async () => {
    const container = ctx!.database.container('aiInsights');
    const base = makeDailyDocument();
    const legacyId = makeFeedbackId(USER_A, '88888888-8888-4888-8888-888888888888');
    const openId = makeFeedbackId(USER_A, '99999999-9999-4999-8999-999999999999');
    const doneId = makeFeedbackId(USER_A, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    const rejectedId = makeFeedbackId(USER_A, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

    await container.items.upsert({
      id: legacyId,
      userId: USER_A,
      _docType: 'insightFeedback',
      insightId: base.id,
      date: base.date,
      insightGeneratedAt: base.generatedAt,
      submittedAt: '2026-08-20T12:00:00.000Z',
      submissionId: '88888888-8888-4888-8888-888888888888',
      score: 'negative',
      userComment: 'Legacy unresolved',
      response: base.response,
      promptSnapshot: base.promptSnapshot,
      promptVersion: base.promptVersion,
      intent: base.intent,
      inputContext: base.inputContext,
      inputHash: base.inputHash,
      model: base.model,
      intelligenceVersion: base.intelligenceVersion,
      tokensUsed: base.tokensUsed,
    });

    await container.items.upsert({
      id: openId,
      userId: USER_A,
      _docType: 'insightFeedback',
      processingStatus: 'Open',
      insightId: base.id,
      date: base.date,
      insightGeneratedAt: base.generatedAt,
      submittedAt: '2026-08-20T12:01:00.000Z',
      submissionId: '99999999-9999-4999-8999-999999999999',
      score: 'negative',
      userComment: 'Open unresolved',
      response: base.response,
      promptSnapshot: base.promptSnapshot,
      promptVersion: base.promptVersion,
      intent: base.intent,
      inputContext: base.inputContext,
      inputHash: base.inputHash,
      model: base.model,
      intelligenceVersion: base.intelligenceVersion,
      tokensUsed: base.tokensUsed,
    });

    await container.items.upsert({
      id: doneId,
      userId: USER_A,
      _docType: 'insightFeedback',
      processingStatus: 'Done',
      insightId: base.id,
      date: base.date,
      insightGeneratedAt: base.generatedAt,
      submittedAt: '2026-08-20T12:02:00.000Z',
      submissionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      score: 'negative',
      userComment: 'Handled done',
      response: base.response,
      promptSnapshot: base.promptSnapshot,
      promptVersion: base.promptVersion,
      intent: base.intent,
      inputContext: base.inputContext,
      inputHash: base.inputHash,
      model: base.model,
      intelligenceVersion: base.intelligenceVersion,
      tokensUsed: base.tokensUsed,
    });

    await container.items.upsert({
      id: rejectedId,
      userId: USER_A,
      _docType: 'insightFeedback',
      processingStatus: 'Rejected',
      insightId: base.id,
      date: base.date,
      insightGeneratedAt: base.generatedAt,
      submittedAt: '2026-08-20T12:03:00.000Z',
      submissionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      score: 'negative',
      userComment: 'Handled rejected',
      response: base.response,
      promptSnapshot: base.promptSnapshot,
      promptVersion: base.promptVersion,
      intent: base.intent,
      inputContext: base.inputContext,
      inputHash: base.inputHash,
      model: base.model,
      intelligenceVersion: base.intelligenceVersion,
      tokensUsed: base.tokensUsed,
    });

    await container.items.upsert({
      ...base,
      id: `${USER_A}:2026-08-21`,
      date: '2026-08-21',
    });
    await container.items.upsert(makeWeeklyDocument(USER_A, '2026-08-21'));

    const unresolved = await container.items
      .query<{ id: string }>(
        {
          query: `SELECT c.id FROM c
                  WHERE c._docType = 'insightFeedback'
                    AND (
                      NOT IS_DEFINED(c.processingStatus)
                      OR c.processingStatus = 'Open'
                    )`,
        },
        { partitionKey: USER_A },
      )
      .fetchAll();

    const handled = await container.items
      .query<{ id: string }>(
        {
          query: `SELECT c.id FROM c
                  WHERE c._docType = 'insightFeedback'
                    AND IS_DEFINED(c.processingStatus)
                    AND c.processingStatus IN ('Done', 'Rejected')`,
        },
        { partitionKey: USER_A },
      )
      .fetchAll();

    expect(unresolved.resources.map((resource) => resource.id).sort()).toEqual([legacyId, openId].sort());
    expect(handled.resources.map((resource) => resource.id).sort()).toEqual([doneId, rejectedId].sort());
  });
});