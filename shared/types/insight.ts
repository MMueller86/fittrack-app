// FitTrack Insight — daily AI-generated briefing types.
// Shared between backend (generation) and mobile (display).

import type { GoalType, GoalIntensity } from './profile';
import type { DayType, SpecialActivity, WorkoutType } from './diary';
import type { WeeklyTargetSource } from './weeklyReview';

/** How fresh the insight is and whether it could be generated at all. */
export type InsightStatus = 'fresh' | 'cached' | 'quota_exceeded' | 'unavailable';

/** Server-selected focus for a Daily Insight generation. */
export type InsightIntent =
  | 'activity_focus'
  | 'weight_signal'
  | 'phase_progress'
  | 'morning_orientation'
  | 'nutrition_guidance'
  | 'general';

/** Activity completion is inferred only when a local-time heuristic is available. */
export type ActivityCompletionStatus = 'planned' | 'likely_completed' | 'unknown';

export type ActivityStatusSource = 'local_time_heuristic' | 'unavailable';

export interface InsightPromptSnapshot {
  system: string;
  user: string;
}

/** Which tab/screen the CTA button should navigate to. */
export type InsightCtaTarget = 'Nutrition' | 'Weight' | 'Training' | 'Recipe' | null;

/**
 * The insight payload returned to the mobile client.
 * All fields except title + summary + generatedAt are optional
 * so the AI can omit them when not applicable.
 */
export interface InsightResponse {
  /** Short headline, max ~40 chars, no emoji */
  title: string;
  /** 60–120 words, friendly tone, interpretation not facts */
  summary: string;
  /** Optional single-sentence action hint */
  recommendation?: string;
  /** Optional CTA button label, e.g. "Mahlzeit hinzufügen" */
  cta?: string;
  /** Navigation target for the CTA */
  ctaTarget?: InsightCtaTarget;
  /** ISO timestamp of generation */
  generatedAt: string;
  /** Prompt version used, e.g. "v1" */
  promptVersion: string;
  /** Whether this is freshly generated, served from cache, etc. */
  status: InsightStatus;
  /** Server-owned feedback capability; emitted by the Daily GET response. */
  feedbackAvailable?: boolean;
}

export interface InsightFeedbackRequest {
  date: string;
  insightGeneratedAt: string;
  submissionId: string;
  userComment: string;
}

export interface InsightFeedbackResponse {
  feedbackId: string;
  created: boolean;
}

export type InsightFeedbackProcessingStatus = 'Open' | 'Done' | 'Rejected';

// ---------------------------------------------------------------------------
// Input context passed to the AI (and persisted in Cosmos for reproducibility)
// ---------------------------------------------------------------------------

export interface InsightWeightContext {
  latestKg: number | null;
  previousKg: number | null;
  targetKg: number | null;
  /** 30-day linear-regression direction projected to a weekly change. */
  weeklyTrend30d: 'gaining' | 'losing' | 'stable' | null;
  /** Up to 7 most recent values, newest first */
  last7Values: number[];
  /**
   * True when `previousKg` is a statistical outlier relative to the surrounding
   * values (spike > 1.5× stdDev of the 7-day window).
   * When true, the AI MUST NOT use previousKg as a reference point for
  * short-term progress — weeklyTrend30d is the authoritative signal instead.
   */
  isOutlierPrevious: boolean;
  /**
   * True when `latestKg` itself is a spike (> 1.5× stdDev above the 7-day mean).
   * Included for symmetry — prevents praising a drop from a spiked latestKg.
   */
  isOutlierLatest: boolean;
  /**
   * How many calendar days ago the last weight was measured (0 = today, 1 = yesterday, …).
   * null when no weight entries exist.
   * Use to detect stale data: values older than 14 days are not representative of current weight.
   */
  daysSinceLastMeasurement: number | null;
  /**
   * ISO date string (YYYY-MM-DD) of the last weight measurement.
   * null when no weight entries exist.
   */
  lastMeasurementDate: string | null;
}

export interface InsightNutritionDay {
  date: string;       // YYYY-MM-DD
  calories: number | null;
  protein: number | null;
  /** Optional historical macro snapshots; absent on legacy daily contexts. */
  carbs?: number | null;
  fat?: number | null;
  /** Distinguishes a real zero-kcal item from a day without meal items. */
  hasMealItem?: boolean;
  mealItemCount?: number;
  dayType?: DayType | null;
  workoutType?: WorkoutType | null;
  baseTargetCalories?: number | null;
  effectiveTargetCalories?: number | null;
  activityBonusCalories?: number | null;
  targetSource?: WeeklyTargetSource;
  /** Historical activity snapshot; it is never a completion fact. */
  specialActivity?: SpecialActivity | null;
}

export interface InsightNutritionContext {
  today: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    hasMealItem?: boolean;
  } | null;
  targets: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number;
    /** Current base target before a special-activity bonus, when resolvable. */
    baseCalories?: number | null;
    activityBonusCalories?: number | null;
    targetSource?: WeeklyTargetSource;
  } | null;
  /**
   * Remaining daily budget: target − logged so far (can be negative when over budget).
   * null when no target is set or nothing logged yet.
   * Negative value = calories exceeded; positive = budget remaining.
   * Forward-looking: use to recommend next steps, not to judge past behaviour.
   */
  remainingCalories: number | null;
  remainingProteinG: number | null;
  /** Last 3 completed diary days for trend context */
  last3Days: InsightNutritionDay[];
}

/** Structured context sent to the AI — serialised as the user message. */
export interface InsightInputContext {
  date: string;       // YYYY-MM-DD
  dayType: 'rest' | 'training' | null;
  workoutType: string | null;
  weight: InsightWeightContext;
  nutrition: InsightNutritionContext;
  /** User's primary goal — determines how weight changes are evaluated. */
  userGoal: GoalType;
  /** Intensity modifier for the goal (gentle / moderate / aggressive). Null for maintain/recomposition. */
  userGoalIntensity: GoalIntensity | null;
  /** User's display name for personalised AI output. Defaults to "Sportler". */
  displayName: string;
  /** Pre-computed behavioural intelligence — Backend calculates, AI formulates. */
  progressIntelligence: ProgressIntelligence;
  /**
   * Local hour of the user's device at the time of the request (0–23).
   * null when the client did not send it (treat as unknown / end-of-day).
   * Used to determine whether the day is still in progress.
   */
  currentHourLocal: number | null;
  /** Normalized local-minus-UTC offset used for local-day and cache semantics. */
  timezoneOffsetMinutes?: number | null;
  /** Special activity logged for this day (e.g. hiking), or null when absent. */
  specialActivity?: SpecialActivity | null;
  /** Server-owned status derived from the local-time heuristic. */
  activityCompletionStatus: ActivityCompletionStatus | null;
  activityStatusSource: ActivityStatusSource | null;
}

// ---------------------------------------------------------------------------
// Cosmos document — one per user per calendar day
// ---------------------------------------------------------------------------

export interface InsightDocument {
  /** New Daily documents use this discriminator; absent is a legacy Daily document. */
  _docType?: 'dailyInsight';
  /** Partition + logical key: `${userId}:${date}` */
  id: string;
  /** Partition key */
  userId: string;
  /** YYYY-MM-DD */
  date: string;
  /** ISO timestamp of most recent generation */
  generatedAt: string;
  /** ISO timestamp — next local midnight as UTC, or next UTC midnight for legacy requests. */
  expiresAt: string;
  /** Cosmos native TTL in seconds — document auto-deletes at the matching midnight boundary */
  ttl: number;
  /** e.g. "v1" */
  promptVersion: string;
  /** Global content identity of the active prompt bundle; absent on legacy documents. */
  promptFingerprint?: string;
  /** Hash of the exact system prompt sent for this intent/context; absent on legacy documents. */
  systemPromptHash?: string;
  /** Server-selected focus of the generation; absent on legacy documents. */
  intent?: InsightIntent;
  /** Exact prompts sent to the provider; absent on legacy documents. */
  promptSnapshot?: InsightPromptSnapshot;
  /** e.g. "gpt-4o-mini" */
  model: string;
  /** SHA-256 of rounded input context — used to detect meaningful data changes */
  inputHash: string;
  /** Full context snapshot for reproducibility and debugging */
  inputContext: InsightInputContext;
  /** The generated response persisted for caching */
  response: InsightResponse;
  /** How many times the insight was regenerated today (max 3 for non-admin) */
  dailyGenerations: number;
  /** ISO timestamp of most recent generation attempt */
  lastGeneratedAt: string;
  /** Compatibility marker set when a matching negative feedback is stored. */
  feedbackScore: 'positive' | 'negative' | null;
  /** Tokens consumed — for cost observability */
  tokensUsed: number;
  /**
   * Goal active when this insight was generated — for retrospective analysis.
   * @deprecated Use `progressIntelligence.goalAtCalculation` instead.
   * Field is retained for backwards compatibility with existing Cosmos documents.
   */
  goalAtCalculation?: GoalType;
  /** Schema version of progressIntelligence — for forward compatibility */
  intelligenceVersion: string;
  /** Pre-computed behavioural signals used for AI prompt construction */
  progressIntelligence?: ProgressIntelligence;
}

export interface InsightFeedbackDocument {
  id: string;
  userId: string;
  _docType: 'insightFeedback';
  /** Canonical processing status. Missing legacy values are treated as Open on read/query. */
  processingStatus?: InsightFeedbackProcessingStatus;
  insightId: string;
  date: string;
  insightGeneratedAt: string;
  submittedAt: string;
  submissionId: string;
  score: 'negative';
  userComment: string;
  response: InsightResponse;
  promptSnapshot: InsightPromptSnapshot;
  promptVersion: string;
  /** Global content identity copied from the exact Daily instance; absent on legacy feedback. */
  promptFingerprint?: string;
  /** Exact system-prompt identity copied from the exact Daily instance; absent on legacy feedback. */
  systemPromptHash?: string;
  intent: InsightIntent;
  inputContext: InsightInputContext;
  inputHash: string;
  model: string;
  intelligenceVersion: string;
  tokensUsed: number;
}

// ---------------------------------------------------------------------------
// Progress Intelligence — pre-computed behavioural signals passed to the AI
// ---------------------------------------------------------------------------

export const PROGRESS_INTELLIGENCE_VERSION = 'v1' as const;

export type PrimarySignalType =
  | 'plateau_broken'
  | 'milestone_reached'
  | 'bad_phase_recovered'
  | 'plateau_active'
  | 'phase_context'
  | 'daily_context';

export interface IntelligenceSignal {
  type: PrimarySignalType;
  /** 0.0 = low confidence, 1.0 = high confidence */
  confidence: number;
  /** 0.0 = brand new signal, 1.0 = shown every day last 7 days */
  freshnessScore: number;
}

export interface ProgressPhaseIntelligence {
  /** progressing = moving toward goal; regressing = moving away; stable = < 0.3 kg/week */
  type: 'progressing' | 'regressing' | 'stable';
}

export interface PlateauIntelligence {
  active: boolean;
  /** True when this plateau was broken in the last 7 days */
  brokenRecently: boolean;
  durationWeeks: number;
}

export interface MilestoneIntelligence {
  /** The threshold value crossed (e.g. 80 for "under 80 kg") */
  value: number;
  unit: 'kg' | 'lbs';
  /** YYYY-MM-DD when it was first crossed */
  reachedAt: string;
  /**
   * Stufe 2: true when the 7-day moving average (≥4 measurements) also confirms
   * the threshold is crossed. false = Stufe 1 (single measurement only).
   */
  confirmed: boolean;
  /**
   * The actual 7-day moving average at the time of detection.
   * null when fewer than 4 measurements exist in the 7-day window (Stufe 1).
   */
  movingAvgAtThreshold: number | null;
}

export interface MonthlyDataPoint {
  /** e.g. "Juni 2026" */
  label: string;
  avgValue: number;
  unit: 'kg' | 'lbs';
  /** Number of measurements this month — indicates data quality */
  measurementCount: number;
}

export interface ProgressValueIntelligence {
  startValue: number;
  achievedValue: number;
  remainingValue: number;
  /** 0–100 integer */
  progressPct: number;
  unit: 'kg' | 'lbs';
}

export interface ProgressIntelligence {
  /** Schema version — increment when interface changes structurally */
  version: typeof PROGRESS_INTELLIGENCE_VERSION;
  /** The single most relevant signal to focus the insight around */
  primarySignal: IntelligenceSignal;
  /** Additional available signals (context only — not primary topic) */
  contextSignals: IntelligenceSignal[];
  /** Null when goal has no directional progress concept (maintain, recomposition) */
  progress: ProgressValueIntelligence | null;
  /** Null when < 3 measurements in last 14 days */
  phase: ProgressPhaseIntelligence | null;
  /** Null when < 6 measurements in last 28 days */
  plateau: PlateauIntelligence | null;
  /** Null when no threshold crossed in last 7 days or goal has no milestones */
  milestone: MilestoneIntelligence | null;
  /** Null when < 2 months with sufficient data available */
  monthlyTrend: {
    months: MonthlyDataPoint[];
    /** True when current month is better than previous, which was worse than the one before. */
    improvementAfterRegression: boolean;
  } | null;
  /** 0.0–1.0 completeness of today's data across all active tracking dimensions */
  dayCompleteness: number;
  /** Goal active at calculation time — for context-aware prompt interpretation */
  goalAtCalculation: GoalType;
}
