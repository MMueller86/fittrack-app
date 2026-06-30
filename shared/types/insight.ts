// FitTrack Insight — daily AI-generated briefing types.
// Shared between backend (generation) and mobile (display).

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
}
