// Nutrition Hint Engine — shared types.
//
// Used by backend (rule evaluation, persistence) and mobile (rendering).
// No AI, no quota — purely rule-based.

import type { Meal, DaySummary } from './diary';
import type { DayTargets } from './nutrition';

// ---------------------------------------------------------------------------
// Hint identity
// ---------------------------------------------------------------------------

/**
 * Unique identifier for each hint rule.
 * H1–H17: situational rules in priority order.
 * M0–M9: motivational fallback hints (cyclic rotation).
 */
export type HintId =
  | 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6' | 'H7' | 'H8'
  | 'H9' | 'H10' | 'H11' | 'H12' | 'H13' | 'H14' | 'H15' | 'H16' | 'H17'
  | 'M0' | 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7' | 'M8' | 'M9';

/** Semantic grouping for visual styling in the mobile UI. */
export type HintCategory = 'orientation' | 'daycontext' | 'positive' | 'motivation';

// ---------------------------------------------------------------------------
// Hint result — sent to mobile as part of DiaryDayResponse
// ---------------------------------------------------------------------------

export interface HintResult {
  id: HintId;
  text: string;
  emoji: string;
  category: HintCategory;
}

// ---------------------------------------------------------------------------
// Hint evaluation context — input to the rule engine
// ---------------------------------------------------------------------------

export interface HintContext {
  /** All meals for the day (may be empty). */
  meals: Meal[];
  /** Aggregated macro totals for the day. */
  summary: DaySummary;
  /** Macro targets resolved for the current day type (rest or training). */
  targets: DayTargets;
  /** Whether today is a rest or training day. */
  dayType: 'rest' | 'training';
  /**
   * Local hour of the device at the time the hint was requested (0–23).
   * Used for time-gated rules (breakfast hint, dinner hint).
   * Provided by the mobile client via query param.
   */
  currentHour: number;
}

// ---------------------------------------------------------------------------
// Hint state — persisted in Cosmos (nutritionDiaryMeals, _docType: 'hintState')
// ---------------------------------------------------------------------------

export interface HintState {
  /** Cosmos document id — always 'hintState'. */
  id: 'hintState';
  userId: string;
  _docType: 'hintState';
  /** ID of the hint currently being shown. */
  lastHintId: HintId;
  /** Calendar date (YYYY-MM-DD) when the last hint was generated. */
  lastHintDate: string;
  /** ISO timestamp of last generation (for audit/debugging). */
  lastHintGeneratedAt: string;
  /**
   * Per-hint last-shown date (YYYY-MM-DD).
   * Used for cooldown enforcement on positive and motivational hints.
   */
  cooldownHistory: Partial<Record<HintId, string>>;
  /**
   * Index into the motivational hints array for cyclic rotation.
   * Incremented each time a motivational hint is shown.
   */
  motivationIndex: number;
}
