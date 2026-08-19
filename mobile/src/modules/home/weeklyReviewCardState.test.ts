import { describe, expect, it } from 'vitest';
import { getWeeklyReviewErrorState } from './weeklyReviewCardState';

describe('getWeeklyReviewErrorState', () => {
  it('keeps an existing review visible and exposes a stale refresh error', () => {
    expect(getWeeklyReviewErrorState(true, true)).toBe('stale');
  });

  it('keeps the existing full error state when no review is available', () => {
    expect(getWeeklyReviewErrorState(false, true)).toBe('initial');
  });

  it('does not show an error while the weekly request is healthy', () => {
    expect(getWeeklyReviewErrorState(true, false)).toBe('none');
    expect(getWeeklyReviewErrorState(false, false)).toBe('none');
  });
});