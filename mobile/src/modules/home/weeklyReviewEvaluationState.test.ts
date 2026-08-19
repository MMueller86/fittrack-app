import { describe, expect, it } from 'vitest';
import {
  INITIAL_WEEKLY_REVIEW_EVALUATION_STATE,
  getWeeklyReviewEvaluationText,
  getWeeklyReviewEvaluationToggle,
  weeklyReviewEvaluationReducer,
} from './weeklyReviewEvaluationState';

describe('weeklyReviewEvaluationState', () => {
  it('shows the expand control for measured text beyond two lines and collapses again', () => {
    const measured = weeklyReviewEvaluationReducer(
      INITIAL_WEEKLY_REVIEW_EVALUATION_STATE,
      { type: 'MEASURE', lineCount: 3 },
    );

    expect(measured.hasOverflow).toBe(true);
    expect(getWeeklyReviewEvaluationToggle(measured)).toEqual({
      label: 'Mehr anzeigen',
      iconName: 'chevron-down',
    });

    const expanded = weeklyReviewEvaluationReducer(measured, { type: 'TOGGLE' });
    expect(expanded.isExpanded).toBe(true);
    expect(getWeeklyReviewEvaluationToggle(expanded)).toEqual({
      label: 'Weniger anzeigen',
      iconName: 'chevron-up',
    });

    const collapsed = weeklyReviewEvaluationReducer(expanded, { type: 'TOGGLE' });
    expect(collapsed).toEqual(measured);
    expect(getWeeklyReviewEvaluationToggle(collapsed)?.label).toBe('Mehr anzeigen');
  });

  it('does not create a toggle for text measured at two lines or less', () => {
    const state = weeklyReviewEvaluationReducer(
      INITIAL_WEEKLY_REVIEW_EVALUATION_STATE,
      { type: 'MEASURE', lineCount: 2 },
    );

    expect(state).toEqual(INITIAL_WEEKLY_REVIEW_EVALUATION_STATE);
    expect(getWeeklyReviewEvaluationToggle(state)).toBeNull();
    expect(weeklyReviewEvaluationReducer(state, { type: 'TOGGLE' })).toBe(state);
  });

  it('resets expansion and measured overflow when the text or review changes', () => {
    const expanded = weeklyReviewEvaluationReducer(
      weeklyReviewEvaluationReducer(
        INITIAL_WEEKLY_REVIEW_EVALUATION_STATE,
        { type: 'MEASURE', lineCount: 3 },
      ),
      { type: 'TOGGLE' },
    );

    expect(weeklyReviewEvaluationReducer(expanded, { type: 'RESET' })).toEqual(
      INITIAL_WEEKLY_REVIEW_EVALUATION_STATE,
    );
    expect(getWeeklyReviewEvaluationToggle(weeklyReviewEvaluationReducer(expanded, { type: 'RESET' }))).toBeNull();
  });

  it('keeps neutral evaluation statuses without text or a toggle', () => {
    expect(getWeeklyReviewEvaluationText('Text', 'quota_exceeded')).toBeNull();
    expect(getWeeklyReviewEvaluationText('Text', 'unavailable')).toBeNull();
    expect(getWeeklyReviewEvaluationText('   ', 'fresh')).toBeNull();
    expect(getWeeklyReviewEvaluationToggle(INITIAL_WEEKLY_REVIEW_EVALUATION_STATE)).toBeNull();
  });

  it('preserves a complete 750-character evaluation including its end sentinel', () => {
    const evaluationText = `${'A'.repeat(749)}Z`;

    expect(evaluationText).toHaveLength(750);
    expect(getWeeklyReviewEvaluationText(evaluationText, 'fresh')).toBe(evaluationText);
    expect(getWeeklyReviewEvaluationText(evaluationText, 'cached')).toBe(evaluationText);
  });

});