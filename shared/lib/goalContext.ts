// goalContext.ts — Single Source of Truth for goal-dependent interpretations.
//
// Every module that needs to evaluate whether a weight change is "good" or "bad",
// what "progress" means, or what direction is positive, MUST use these functions.
//
// This prevents divergent logic between Progress, Home Insight, future AI Coach,
// weekly/monthly analyses, and any other consumer.
//
// Pure functions — no I/O, no side effects. Fully testable.

import type { GoalType } from '../types/profile';

// ---------------------------------------------------------------------------
// Core evaluation
// ---------------------------------------------------------------------------

/**
 * Semantic evaluation of a weight change relative to a user's goal.
 *
 * - 'positive'  → change aligns with the goal (show green, celebrate)
 * - 'negative'  → change works against the goal (show red, flag)
 * - 'neutral'   → no meaningful change, or goal makes direction irrelevant
 */
export type WeightDeltaEvaluation = 'positive' | 'negative' | 'neutral';

/**
 * Evaluate whether a weight delta is positive, negative, or neutral
 * for a given goal. The delta is in the same unit as the entries
 * (negative = weight lost, positive = weight gained).
 *
 * @param goal     - The user's GoalType from their profile
 * @param deltaKg  - Weight change: negative = lost, positive = gained
 */
export function evaluateWeightDelta(
  goal: GoalType,
  deltaKg: number,
): WeightDeltaEvaluation {
  const THRESHOLD = 0.05; // kg — ignore micro-fluctuations
  if (Math.abs(deltaKg) < THRESHOLD) return 'neutral';

  switch (goal) {
    case 'lose_weight':
      return deltaKg < 0 ? 'positive' : 'negative';

    case 'gain_muscle':
      return deltaKg > 0 ? 'positive' : 'negative';

    case 'maintain':
      // Any movement away from stable is a slight negative signal.
      // We return 'neutral' for small deviations (handled by THRESHOLD above),
      // 'negative' for larger ones — maintain users don't want big swings.
      return 'negative';

    case 'recomposition':
      // Body recomposition: weight is less meaningful than composition.
      // Small changes in either direction are expected. Never evaluate as bad.
      return 'neutral';
  }
}

// ---------------------------------------------------------------------------
// Direction helpers
// ---------------------------------------------------------------------------

/**
 * The "positive" direction arrow symbol for a given goal.
 * Use this for trend indicators so all screens use identical symbols.
 */
export function positiveDirectionArrow(goal: GoalType): '↓' | '↑' | '─' {
  switch (goal) {
    case 'lose_weight': return '↓';
    case 'gain_muscle': return '↑';
    case 'maintain':    return '─';
    case 'recomposition': return '─';
  }
}

/**
 * Whether weight loss (delta < 0) is the positive direction for this goal.
 * Convenience for components that need a boolean rather than the full evaluation.
 */
export function isDecreasePositive(goal: GoalType): boolean {
  return goal === 'lose_weight';
}

// ---------------------------------------------------------------------------
// Display labels
// ---------------------------------------------------------------------------

/**
 * Human-readable German label for a GoalType.
 * Used in AI prompts and tooltips.
 */
export function goalLabel(goal: GoalType): string {
  switch (goal) {
    case 'lose_weight':    return 'Gewichtsreduktion';
    case 'gain_muscle':    return 'Muskelaufbau';
    case 'maintain':       return 'Gewicht halten';
    case 'recomposition':  return 'Body Recomposition';
  }
}

/**
 * Sentence fragment for AI prompts that clarifies the evaluation context.
 * Example: "da dein aktuelles Ziel Gewichtsreduktion ist"
 */
export function goalContextPhrase(goal: GoalType): string {
  return `da dein aktuelles Ziel ${goalLabel(goal)} ist`;
}

// ---------------------------------------------------------------------------
// Progress direction for goal progress bar
// ---------------------------------------------------------------------------

/**
 * Returns whether the progress bar should grow when weight DECREASES.
 * - lose_weight: decreasing toward target = progress → true
 * - gain_muscle: increasing toward target = progress → false
 * - maintain / recomposition: no directional progress concept → null
 */
export function progressGrowsOnDecrease(goal: GoalType): boolean | null {
  switch (goal) {
    case 'lose_weight':   return true;
    case 'gain_muscle':   return false;
    case 'maintain':      return null;
    case 'recomposition': return null;
  }
}
