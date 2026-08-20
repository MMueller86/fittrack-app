// InsightCard — täglich einmalig generiertes KI-Briefing.
// Zeigt Skeleton während geladen wird, Fade-In nach Ankunft.
// Keine Chatblasen, keine Konversation — strukturiertes Briefing.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import * as Crypto from 'expo-crypto';
import { colors, radius, spacing, typography } from '../../app/theme';
import { Icon } from '../../shared/components/Icon';
import { aiApi, getInsightFeedbackApiError } from '../../shared/api/aiApi';
import type { InsightCtaTarget } from '@fittrack/shared';
import type { DailyInsightResponse } from '../../services/insightService';

// ---------------------------------------------------------------------------
// Skeleton (Lade-Zustand)
// ---------------------------------------------------------------------------

function SkeletonBlock({ width, height, style }: { width: string | number; height: number; style?: object }) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        skeletonStyles.block,
        { width, height, opacity: pulse },
        style,
      ]}
    />
  );
}

const skeletonStyles = StyleSheet.create({
  block: {
    backgroundColor: colors.border,
    borderRadius: radius.sm,
  },
});

function InsightSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <SkeletonBlock width={16} height={16} />
        <SkeletonBlock width={160} height={14} style={{ marginLeft: spacing.sm }} />
      </View>
      <View style={styles.bodyRows}>
        <SkeletonBlock width="100%" height={12} />
        <SkeletonBlock width="88%" height={12} style={{ marginTop: 6 }} />
        <SkeletonBlock width="72%" height={12} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// CTA navigation target mapping
// ---------------------------------------------------------------------------

interface Props {
  insight: DailyInsightResponse | null;
  date?: string | null;
  onCtaPress?: (target: InsightCtaTarget) => void;
  onFeedbackSuccess?: () => void;
}

interface FeedbackTarget {
  date: string;
  insightGeneratedAt: string;
}

interface FeedbackSubmission {
  id: string;
  comment: string;
}

const FEEDBACK_SNAP_POINTS = ['60%'];

function canSubmitFeedback(insight: DailyInsightResponse): boolean {
  return (insight.status === 'fresh' || insight.status === 'cached')
    && insight.feedbackAvailable !== false;
}

function getFeedbackErrorMessage(error: unknown): string {
  const apiError = getInsightFeedbackApiError(error);

  switch (apiError?.code) {
    case 'insight_not_found':
      return 'Diese Analyse ist nicht mehr verfügbar. Dein Kommentar bleibt erhalten.';
    case 'insight_generation_changed':
      return 'Diese Analyse wurde inzwischen neu erzeugt. Dein Kommentar wurde nicht an die neue Analyse gebunden.';
    case 'feedback_snapshot_unavailable':
      return 'Für diese Analyse ist kein vollständiger Feedback-Snapshot verfügbar. Dein Kommentar wurde nicht gesendet.';
    case 'feedback_submission_conflict':
      return 'Diese Feedback-ID ist bereits mit einem anderen Kommentar verknüpft. Dein Kommentar bleibt erhalten; beim nächsten Versuch wird eine neue ID verwendet.';
    default:
      break;
  }

  if (apiError?.status === 400) {
    return 'Die Eingabe konnte nicht verarbeitet werden. Bitte öffne das Feedback erneut.';
  }
  if (apiError?.status === 401) {
    return 'Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an.';
  }

  return 'Feedback konnte nicht gesendet werden. Prüfe deine Verbindung und versuche es erneut.';
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function InsightCard({ insight, date, onCtaPress, onFeedbackSuccess }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const feedbackSheetRef = useRef<BottomSheetModal>(null);
  const submissionRef = useRef<FeedbackSubmission | null>(null);
  const lastAttemptedCommentRef = useRef<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [feedbackTarget, setFeedbackTarget] = useState<FeedbackTarget | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [snapshotUnavailable, setSnapshotUnavailable] = useState(false);
  const [feedbackUnavailable, setFeedbackUnavailable] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.1}
      />
    ),
    [],
  );

  // Fade in when insight arrives
  useEffect(() => {
    if (insight) {
      opacity.setValue(0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();
    }
  }, [insight?.generatedAt]);

  useEffect(() => {
    setFeedbackUnavailable(false);
  }, [date, insight?.generatedAt]);

  const openFeedback = useCallback(() => {
    if (!insight || !date || feedbackUnavailable || !canSubmitFeedback(insight)) return;

    setMenuVisible(false);
    setFeedbackTarget({ date, insightGeneratedAt: insight.generatedAt });
    setFeedbackComment('');
    setFeedbackError(null);
    setSnapshotUnavailable(false);
    setFeedbackSubmitting(false);
    submissionRef.current = { id: Crypto.randomUUID(), comment: '' };
    lastAttemptedCommentRef.current = null;
    feedbackSheetRef.current?.present();
  }, [date, feedbackUnavailable, insight]);

  const handleCommentChange = (value: string) => {
    setFeedbackComment(value);
    if (lastAttemptedCommentRef.current !== null && value.trim() !== lastAttemptedCommentRef.current) {
      submissionRef.current = { id: Crypto.randomUUID(), comment: value.trim() };
      lastAttemptedCommentRef.current = null;
      setFeedbackError(null);
    }
  };

  const handleSubmitFeedback = async () => {
    const trimmedComment = feedbackComment.trim();
    if (!feedbackTarget || !trimmedComment || feedbackSubmitting || snapshotUnavailable) return;

    let submission = submissionRef.current;
    if (!submission) {
      submission = { id: Crypto.randomUUID(), comment: trimmedComment };
    }
    if (lastAttemptedCommentRef.current !== null && trimmedComment !== lastAttemptedCommentRef.current) {
      submission = { id: Crypto.randomUUID(), comment: trimmedComment };
    }

    submissionRef.current = { id: submission.id, comment: trimmedComment };
    lastAttemptedCommentRef.current = trimmedComment;
    setFeedbackError(null);
    setFeedbackSubmitting(true);

    try {
      await aiApi.submitDailyInsightFeedback({
        date: feedbackTarget.date,
        insightGeneratedAt: feedbackTarget.insightGeneratedAt,
        submissionId: submission.id,
        userComment: trimmedComment,
      });
      setFeedbackSubmitting(false);
      feedbackSheetRef.current?.dismiss();
      onFeedbackSuccess?.();
    } catch (error: unknown) {
      setFeedbackSubmitting(false);
      setFeedbackError(getFeedbackErrorMessage(error));
      const apiError = getInsightFeedbackApiError(error);
      if (apiError?.code === 'feedback_snapshot_unavailable') {
        setSnapshotUnavailable(true);
        setFeedbackUnavailable(true);
      }
      if (apiError?.code === 'feedback_submission_conflict') {
        submissionRef.current = null;
        lastAttemptedCommentRef.current = null;
      }
    }
  };

  const trimmedComment = feedbackComment.trim();
  const feedbackSubmitEnabled = trimmedComment.length >= 1
    && trimmedComment.length <= 500
    && !feedbackSubmitting
    && !snapshotUnavailable;

  let cardContent: React.ReactNode;

  if (!insight) {
    cardContent = <InsightSkeleton />;
  } else if (insight.status === 'quota_exceeded' || insight.status === 'unavailable') {
    cardContent = (
      <Animated.View style={[styles.card, styles.muted, { opacity }]}>
        <Text style={styles.mutedText}>{insight.summary}</Text>
      </Animated.View>
    );
  } else {
    const feedbackAvailable = date != null && !feedbackUnavailable && canSubmitFeedback(insight);

    cardContent = (
      <Animated.View style={[styles.card, { opacity }]}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerIdentity}>
            <Text style={styles.badge}>🧠</Text>
            <Text style={styles.badgeLabel}>FitTrack Insight</Text>
          </View>
          {feedbackAvailable ? (
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => setMenuVisible(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Weitere Optionen"
              accessibilityState={{ expanded: menuVisible }}
            >
              <Icon lib="feather" name="more-vertical" size="md" color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Title */}
        <Text style={styles.title}>{insight.title}</Text>

        {/* Summary */}
        <Text style={styles.summary}>{insight.summary}</Text>

        {/* Recommendation */}
        {insight.recommendation ? (
          <Text style={styles.recommendation}>{insight.recommendation}</Text>
        ) : null}

        {/* CTA */}
        {insight.cta && insight.ctaTarget && onCtaPress ? (
          <TouchableOpacity
            style={styles.cta}
            onPress={() => onCtaPress(insight.ctaTarget!)}
            activeOpacity={0.75}
          >
            <Text style={styles.ctaText}>{insight.cta}</Text>
          </TouchableOpacity>
        ) : null}
      </Animated.View>
    );
  }

  return (
    <>
      {cardContent}

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <View style={styles.menuLayer}>
          <TouchableOpacity
            style={styles.menuBackdrop}
            activeOpacity={1}
            onPress={() => setMenuVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Menü schließen"
          />
          <View style={styles.menu}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={openFeedback}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Feedback geben"
            >
              <Icon lib="feather" name="message-square" size="sm" color={colors.textSecondary} />
              <Text style={styles.menuItemText}>Feedback geben</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <BottomSheetModal
        ref={feedbackSheetRef}
        index={0}
        snapPoints={FEEDBACK_SNAP_POINTS}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.feedbackSheetBackground}
        handleIndicatorStyle={styles.feedbackHandle}
        onDismiss={() => {
          setFeedbackTarget(null);
          setFeedbackError(null);
          setSnapshotUnavailable(false);
          setFeedbackSubmitting(false);
        }}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.feedbackContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.feedbackTitle}>Feedback geben</Text>
          <Text style={styles.feedbackSubtitle}>
            Was war an dieser Analyse nicht hilfreich?
          </Text>
          <Text style={styles.feedbackLabel}>Kommentar</Text>
          <BottomSheetTextInput
            style={styles.feedbackInput}
            value={feedbackComment}
            onChangeText={handleCommentChange}
            placeholder="Beschreibe kurz, was nicht passt …"
            placeholderTextColor={colors.textMuted}
            maxLength={500}
            multiline
            editable={!feedbackSubmitting && !snapshotUnavailable}
            textAlignVertical="top"
            accessibilityLabel="Kommentar"
          />
          <View style={styles.characterRow}>
            <Text style={styles.characterCount}>{feedbackComment.length}/500</Text>
          </View>

          {feedbackError ? <Text style={styles.feedbackError}>{feedbackError}</Text> : null}

          <TouchableOpacity
            style={[styles.submitButton, !feedbackSubmitEnabled && styles.submitButtonDisabled]}
            onPress={() => { void handleSubmitFeedback(); }}
            disabled={!feedbackSubmitEnabled}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={feedbackError ? 'Feedback erneut senden' : 'Feedback senden'}
          >
            {feedbackSubmitting ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.submitButtonText}>
                {feedbackError ? 'Erneut senden' : 'Feedback senden'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => feedbackSheetRef.current?.dismiss()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Feedback schließen"
          >
            <Text style={styles.cancelButtonText}>Abbrechen</Text>
          </TouchableOpacity>
        </BottomSheetScrollView>
      </BottomSheetModal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    marginHorizontal: spacing.md,
    gap: spacing.sm,
  },
  muted: {
    borderColor: colors.border,
  },
  // Header row
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  menuButton: {
    width: spacing.xl + spacing.md,
    height: spacing.xl + spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.xs,
  },
  badge: {
    fontSize: 14,
  },
  badgeLabel: {
    ...typography.overline,
    color: colors.primary,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  // Content
  title: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '700' as const,
  },
  summary: {
    ...typography.body2,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  recommendation: {
    ...typography.body2,
    color: colors.text,
    fontWeight: '500' as const,
    fontStyle: 'italic',
  },
  // CTA
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  ctaText: {
    ...typography.caption,
    color: colors.background,
    fontWeight: '600' as const,
  },
  // Muted text (quota / unavailable)
  mutedText: {
    ...typography.body2,
    color: colors.textMuted,
    lineHeight: 20,
  },
  // Body skeleton rows
  bodyRows: {
    gap: 0,
    paddingTop: spacing.xs,
  },
  menuLayer: {
    flex: 1,
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    opacity: 0.6,
  },
  menu: {
    position: 'absolute',
    top: spacing.xxl,
    right: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: spacing.xxl * 4,
  },
  menuItem: {
    minHeight: spacing.xl + spacing.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  menuItemText: {
    ...typography.body2,
    color: colors.text,
  },
  feedbackSheetBackground: {
    backgroundColor: colors.surface,
  },
  feedbackHandle: {
    backgroundColor: colors.border,
  },
  feedbackContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  feedbackTitle: {
    ...typography.h3,
    color: colors.text,
  },
  feedbackSubtitle: {
    ...typography.body2,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  feedbackLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  feedbackInput: {
    ...typography.body1,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: spacing.xxl + spacing.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  characterRow: {
    alignItems: 'flex-end',
    marginTop: spacing.xs,
  },
  characterCount: {
    ...typography.caption,
    color: colors.textMuted,
  },
  feedbackError: {
    ...typography.body2,
    color: colors.negative,
    marginTop: spacing.sm,
  },
  submitButton: {
    minHeight: spacing.xl + spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    marginTop: spacing.lg,
  },
  submitButtonDisabled: {
    opacity: 0.45,
  },
  submitButtonText: {
    ...typography.button,
    color: colors.background,
  },
  cancelButton: {
    minHeight: spacing.xl + spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  cancelButtonText: {
    ...typography.button,
    color: colors.textSecondary,
  },
});
