// FitTrack Insight — daily AI-generated briefing types.
// Shared between backend (generation) and mobile (display).

import type { GoalType, GoalIntensity } from './profile';

/** How fresh the insight is and whether it could be generated at all. */
export type InsightStatus = 'fresh' | 'cached' | 'quota_exceeded' | 'unavailable';

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
}

// ---------------------------------------------------------------------------
// Input context passed to the AI (and persisted in Cosmos for reproducibility)
// ---------------------------------------------------------------------------

export interface InsightWeightContext {
  latestKg: number | null;
  previousKg: number | null;
  targetKg: number | null;
  /** Simple 7-day direction based on linear trend */
  trend7d: 'gaining' | 'losing' | 'stable' | null;
  /** Up to 7 most recent values, newest first */
  last7Values: number[];
  /**
   * True when `previousKg` is a statistical outlier relative to the surrounding
   * values (spike > 1.5× stdDev of the 7-day window).
   * When true, the AI MUST NOT use previousKg as a reference point for
   * short-term progress — trend7d is the authoritative signal instead.
   */
  isOutlierPrevious: boolean;
  /**
   * True when `latestKg` itself is a spike (> 1.5× stdDev above the 7-day mean).
   * Included for symmetry — prevents praising a drop from a spiked latestKg.
   */
  isOutlierLatest: boolean;
}

export interface InsightNutritionDay {
  date: string;       // YYYY-MM-DD
  calories: number;
  protein: number;
}

export interface InsightNutritionContext {
  today: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  } | null;
  targets: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number;
  } | null;
  /**
   * Remaining daily budget: max(0, target − logged so far).
   * null when no target is set or nothing logged yet.
   * Forward-looking: never use to judge — only to recommend.
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
}

// ---------------------------------------------------------------------------
// Cosmos document — one per user per calendar day
// ---------------------------------------------------------------------------

export interface InsightDocument {
  /** Partition + logical key: `${userId}:${date}` */
  id: string;
  /** Partition key */
  userId: string;
  /** YYYY-MM-DD */
  date: string;
  /** ISO timestamp of most recent generation */
  generatedAt: string;
  /** ISO timestamp — next midnight UTC (informational) */
  expiresAt: string;
  /** Cosmos native TTL in seconds — document auto-deletes at next midnight UTC */
  ttl: number;
  /** e.g. "v1" */
  promptVersion: string;
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
  /** Prepared for future feedback feature — not yet implemented in UI */
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
