import type { InsightDocument } from '@fittrack/shared';

export type FeedbackSnapshotInsight = InsightDocument & {
  intent: NonNullable<InsightDocument['intent']>;
  promptSnapshot: NonNullable<InsightDocument['promptSnapshot']>;
  promptFingerprint: string;
  systemPromptHash: string;
};

export function hasFeedbackSnapshot(
  document: InsightDocument,
): document is FeedbackSnapshotInsight {
  return typeof document.intent === 'string'
    && typeof document.promptSnapshot?.system === 'string'
    && document.promptSnapshot.system.length > 0
    && typeof document.promptSnapshot.user === 'string'
    && document.promptSnapshot.user.length > 0
    && typeof document.inputContext === 'object'
    && document.inputContext !== null
    && typeof document.inputHash === 'string'
    && document.inputHash.length > 0
    && typeof document.promptVersion === 'string'
    && document.promptVersion.length > 0
    && typeof document.promptFingerprint === 'string'
    && document.promptFingerprint.length > 0
    && typeof document.systemPromptHash === 'string'
    && document.systemPromptHash.length > 0
    && typeof document.model === 'string'
    && document.model.length > 0
    && typeof document.intelligenceVersion === 'string'
    && document.intelligenceVersion.length > 0
    && Number.isFinite(document.tokensUsed)
    && typeof document.response === 'object'
    && document.response !== null;
}