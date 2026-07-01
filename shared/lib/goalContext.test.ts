// goalContext.test.ts — Unit tests for the goal-context interpretation layer.
// All 4 GoalTypes × positive / negative / neutral delta scenarios.

import { describe, it, expect } from 'vitest';
import {
  evaluateWeightDelta,
  goalLabel,
  goalContextPhrase,
  positiveDirectionArrow,
  isDecreasePositive,
  progressGrowsOnDecrease,
} from './goalContext';

describe('evaluateWeightDelta', () => {
  describe('lose_weight', () => {
    it('returns positive when weight decreases', () => {
      expect(evaluateWeightDelta('lose_weight', -1.0)).toBe('positive');
    });
    it('returns negative when weight increases', () => {
      expect(evaluateWeightDelta('lose_weight', 0.5)).toBe('negative');
    });
    it('returns neutral for micro-fluctuations below threshold', () => {
      expect(evaluateWeightDelta('lose_weight', -0.04)).toBe('neutral');
      expect(evaluateWeightDelta('lose_weight', 0.04)).toBe('neutral');
    });
    it('returns positive at exactly the threshold boundary (0.05)', () => {
      expect(evaluateWeightDelta('lose_weight', -0.05)).toBe('positive');
    });
  });

  describe('gain_muscle', () => {
    it('returns positive when weight increases', () => {
      expect(evaluateWeightDelta('gain_muscle', 1.2)).toBe('positive');
    });
    it('returns negative when weight decreases', () => {
      expect(evaluateWeightDelta('gain_muscle', -0.8)).toBe('negative');
    });
    it('returns neutral for micro-fluctuations', () => {
      expect(evaluateWeightDelta('gain_muscle', 0.03)).toBe('neutral');
    });
  });

  describe('maintain', () => {
    it('returns negative when weight changes significantly (increase)', () => {
      expect(evaluateWeightDelta('maintain', 1.0)).toBe('negative');
    });
    it('returns negative when weight changes significantly (decrease)', () => {
      expect(evaluateWeightDelta('maintain', -1.0)).toBe('negative');
    });
    it('returns neutral for micro-fluctuations', () => {
      expect(evaluateWeightDelta('maintain', 0.03)).toBe('neutral');
    });
  });

  describe('recomposition', () => {
    it('returns neutral regardless of direction', () => {
      expect(evaluateWeightDelta('recomposition', -2.0)).toBe('neutral');
      expect(evaluateWeightDelta('recomposition', 2.0)).toBe('neutral');
    });
    it('returns neutral for zero change', () => {
      expect(evaluateWeightDelta('recomposition', 0)).toBe('neutral');
    });
  });
});

describe('positiveDirectionArrow', () => {
  it('returns down arrow for lose_weight', () => {
    expect(positiveDirectionArrow('lose_weight')).toBe('↓');
  });
  it('returns up arrow for gain_muscle', () => {
    expect(positiveDirectionArrow('gain_muscle')).toBe('↑');
  });
  it('returns neutral dash for maintain', () => {
    expect(positiveDirectionArrow('maintain')).toBe('─');
  });
  it('returns neutral dash for recomposition', () => {
    expect(positiveDirectionArrow('recomposition')).toBe('─');
  });
});

describe('isDecreasePositive', () => {
  it('returns true only for lose_weight', () => {
    expect(isDecreasePositive('lose_weight')).toBe(true);
    expect(isDecreasePositive('gain_muscle')).toBe(false);
    expect(isDecreasePositive('maintain')).toBe(false);
    expect(isDecreasePositive('recomposition')).toBe(false);
  });
});

describe('goalLabel', () => {
  it('returns German labels for all goal types', () => {
    expect(goalLabel('lose_weight')).toBe('Gewichtsreduktion');
    expect(goalLabel('gain_muscle')).toBe('Muskelaufbau');
    expect(goalLabel('maintain')).toBe('Gewicht halten');
    expect(goalLabel('recomposition')).toBe('Body Recomposition');
  });
});

describe('goalContextPhrase', () => {
  it('builds a complete phrase for each goal', () => {
    expect(goalContextPhrase('lose_weight')).toBe(
      'da dein aktuelles Ziel Gewichtsreduktion ist',
    );
    expect(goalContextPhrase('gain_muscle')).toBe(
      'da dein aktuelles Ziel Muskelaufbau ist',
    );
  });
});

describe('progressGrowsOnDecrease', () => {
  it('returns true for lose_weight', () => {
    expect(progressGrowsOnDecrease('lose_weight')).toBe(true);
  });
  it('returns false for gain_muscle', () => {
    expect(progressGrowsOnDecrease('gain_muscle')).toBe(false);
  });
  it('returns null for maintain and recomposition', () => {
    expect(progressGrowsOnDecrease('maintain')).toBeNull();
    expect(progressGrowsOnDecrease('recomposition')).toBeNull();
  });
});
