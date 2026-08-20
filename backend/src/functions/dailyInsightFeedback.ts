import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { z } from 'zod';

import { requireUser } from '../lib/auth';
import { parseBody, withHandler } from '../lib/http';
import { hasFeedbackSnapshot, type FeedbackSnapshotInsight } from '../lib/insightFeedback';
import {
  getInsightRepository,
  makeFeedbackId,
} from '../lib/repositories/insightRepository';
import type {
  InsightFeedbackDocument,
  InsightFeedbackRequest,
  InsightFeedbackResponse,
} from '@fittrack/shared';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN = z.string().uuid();

const isoDate = z
  .string()
  .regex(ISO_DATE_PATTERN, 'must be ISO YYYY-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) return false;
    const [year, month, day] = value.split('-').map(Number);
    return parsed.getUTCFullYear() === year
      && parsed.getUTCMonth() + 1 === month
      && parsed.getUTCDate() === day;
  }, { message: 'must be a real calendar date' });

const canonicalUtcTimestamp = z.string().refine((value) => {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}, { message: 'must be a canonical UTC ISO timestamp' });

const FeedbackRequestSchema = z.object({
  date: isoDate,
  insightGeneratedAt: canonicalUtcTimestamp,
  submissionId: UUID_PATTERN,
  userComment: z.string().trim().min(1, 'must not be empty').max(500, 'must be at most 500 characters'),
}).strict();

function errorResponse(status: 404 | 409, code: string): HttpResponseInit {
  return { status, jsonBody: { code } };
}

function isSameSubmission(
  document: InsightFeedbackDocument,
  request: InsightFeedbackRequest,
): boolean {
  return document.submissionId === request.submissionId
    && document.date === request.date
    && document.insightGeneratedAt === request.insightGeneratedAt
    && document.userComment === request.userComment;
}

function makeFeedbackDocument(
  userId: string,
  request: InsightFeedbackRequest,
  insight: FeedbackSnapshotInsight,
  submittedAt: string,
): InsightFeedbackDocument {
  return {
    id: makeFeedbackId(userId, request.submissionId),
    userId,
    _docType: 'insightFeedback',
    insightId: insight.id,
    date: insight.date,
    insightGeneratedAt: insight.generatedAt,
    submittedAt,
    submissionId: request.submissionId,
    score: 'negative',
    userComment: request.userComment,
    response: insight.response,
    promptSnapshot: insight.promptSnapshot,
    promptVersion: insight.promptVersion,
    intent: insight.intent,
    inputContext: insight.inputContext,
    inputHash: insight.inputHash,
    model: insight.model,
    intelligenceVersion: insight.intelligenceVersion,
    tokensUsed: insight.tokensUsed,
  };
}

export const dailyInsightFeedbackHandler = withHandler(
  'ai.daily-insight.feedback',
  async (request: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const parsed = await parseBody(request, FeedbackRequestSchema);
    if (!parsed.ok) return parsed.response;

    const feedbackRequest: InsightFeedbackRequest = parsed.data;
    const insightRepository = getInsightRepository();

    // The idempotency lookup must happen before reading the expiring Daily document.
    const existingFeedback = await insightRepository.getFeedbackBySubmissionId(
      userId,
      feedbackRequest.submissionId,
    );
    if (existingFeedback) {
      if (isSameSubmission(existingFeedback, feedbackRequest)) {
        const response: InsightFeedbackResponse = {
          feedbackId: existingFeedback.id,
          created: false,
        };
        return { status: 200, jsonBody: response };
      }
      return errorResponse(409, 'feedback_submission_conflict');
    }

    const insight = await insightRepository.get(userId, feedbackRequest.date);
    if (!insight) return errorResponse(404, 'insight_not_found');
    if (insight.generatedAt !== feedbackRequest.insightGeneratedAt) {
      return errorResponse(409, 'insight_generation_changed');
    }
    if (!hasFeedbackSnapshot(insight)) {
      return errorResponse(409, 'feedback_snapshot_unavailable');
    }

    const document = makeFeedbackDocument(
      userId,
      feedbackRequest,
      insight,
      new Date().toISOString(),
    );
    const result = await insightRepository.createFeedbackIfAbsent(document);

    if (!result.created) {
      if (isSameSubmission(result.document, feedbackRequest)) {
        const response: InsightFeedbackResponse = {
          feedbackId: result.document.id,
          created: false,
        };
        return { status: 200, jsonBody: response };
      }
      return errorResponse(409, 'feedback_submission_conflict');
    }

    await insightRepository.markNegativeFeedback(
      userId,
      feedbackRequest.date,
      feedbackRequest.insightGeneratedAt,
    );

    const response: InsightFeedbackResponse = {
      feedbackId: document.id,
      created: true,
    };
    return { status: 201, jsonBody: response };
  },
);

app.http('daily-insight-feedback', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'ai/daily-insight/feedback',
  handler: dailyInsightFeedbackHandler,
});