import { describe, expect, it } from 'vitest';
import {
  getWeeklyReviewEvaluationRenderContract,
  getWeeklyReviewEvaluationText,
  hasWeeklyReviewEvaluationResetInputsChanged,
  INITIAL_WEEKLY_REVIEW_EVALUATION_STATE,
  weeklyReviewEvaluationReducer,
  type WeeklyReviewEvaluationResetInputs,
} from './weeklyReviewEvaluationState';

const evaluationText = 'Eine ausführliche Bewertung für die vergangene Woche.';

function getMeasuredState() {
  return weeklyReviewEvaluationReducer(
    INITIAL_WEEKLY_REVIEW_EVALUATION_STATE,
    { type: 'MEASURE', lineCount: 3 },
  );
}

function getResetInputs(
  overrides: Partial<WeeklyReviewEvaluationResetInputs> = {},
): WeeklyReviewEvaluationResetInputs {
  return {
    evaluationText,
    review: {},
    evaluationStatus: 'fresh',
    fontScale: 1,
    textContainerWidth: 280,
    ...overrides,
  };
}

describe('EvaluationSection render contract', () => {
  it('uses the component-facing collapsed contract with two lines and an expand control', () => {
    const collapsedContract = getWeeklyReviewEvaluationRenderContract(
      evaluationText,
      getMeasuredState(),
    );

    expect(collapsedContract).toEqual({
      textProps: { numberOfLines: 2, ellipsizeMode: 'tail' },
      textStyle: {},
      toggle: { label: 'Mehr anzeigen', iconName: 'chevron-down' },
    });
    expect(collapsedContract.textProps.numberOfLines).toBe(2);
  });

  it('uses an unclipped expanded contract and the collapse control', () => {
    const measuredState = getMeasuredState();
    const expandedState = weeklyReviewEvaluationReducer(measuredState, { type: 'TOGGLE' });
    const expandedContract = getWeeklyReviewEvaluationRenderContract(evaluationText, expandedState);

    expect(expandedContract.textProps.numberOfLines).toBeUndefined();
    expect(expandedContract.textProps).not.toHaveProperty('maxHeight');
    expect(expandedContract.textProps).not.toHaveProperty('ellipsizeMode');
    expect(expandedContract.textStyle).not.toHaveProperty('maxHeight');
    expect(expandedContract.textStyle.overflow).toBe('visible');
    expect(expandedContract.textStyle.overflow).not.toBe('hidden');
    expect(expandedContract.toggle).toEqual({ label: 'Weniger anzeigen', iconName: 'chevron-up' });
  });

  it('keeps the complete 750-character text available to the expanded render contract', () => {
    const completeText = `${'B'.repeat(749)}!`;
    const expandedState = weeklyReviewEvaluationReducer(getMeasuredState(), { type: 'TOGGLE' });
    const expandedContract = getWeeklyReviewEvaluationRenderContract(completeText, expandedState);

    expect(getWeeklyReviewEvaluationText(completeText, 'fresh')).toBe(completeText);
    expect(expandedContract.textProps).toEqual({});
    expect(expandedContract.textProps).not.toHaveProperty('numberOfLines');
    expect(expandedContract.textProps).not.toHaveProperty('ellipsizeMode');
    expect(expandedContract.textStyle.overflow).toBe('visible');
  });

  it('resets the component state contract when text, review, width, font scale, or status changes', () => {
    const initialInputs = getResetInputs();

    expect(hasWeeklyReviewEvaluationResetInputsChanged(null, initialInputs)).toBe(true);
    expect(hasWeeklyReviewEvaluationResetInputsChanged(initialInputs, initialInputs)).toBe(false);
    expect(hasWeeklyReviewEvaluationResetInputsChanged(initialInputs, {
      ...initialInputs,
      evaluationText: 'Neue Bewertung',
    })).toBe(true);
    expect(hasWeeklyReviewEvaluationResetInputsChanged(initialInputs, {
      ...initialInputs,
      review: {},
    })).toBe(true);
    expect(hasWeeklyReviewEvaluationResetInputsChanged(initialInputs, {
      ...initialInputs,
      textContainerWidth: 320,
    })).toBe(true);
    expect(hasWeeklyReviewEvaluationResetInputsChanged(initialInputs, {
      ...initialInputs,
      fontScale: 1.2,
    })).toBe(true);
    expect(hasWeeklyReviewEvaluationResetInputsChanged(initialInputs, {
      ...initialInputs,
      evaluationStatus: 'cached',
    })).toBe(true);
  });
});