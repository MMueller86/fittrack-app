import type { WeeklyEvaluationStatus } from '@fittrack/shared';

export interface WeeklyReviewEvaluationState {
  isExpanded: boolean;
  hasOverflow: boolean;
}

export type WeeklyReviewEvaluationAction =
  | { type: 'MEASURE'; lineCount: number }
  | { type: 'TOGGLE' }
  | { type: 'RESET' };

export interface WeeklyReviewEvaluationToggle {
  label: 'Mehr anzeigen' | 'Weniger anzeigen';
  iconName: 'chevron-down' | 'chevron-up';
}

export interface WeeklyReviewEvaluationTextPropsContract {
  numberOfLines?: 2;
  ellipsizeMode?: 'tail';
}

export interface WeeklyReviewEvaluationTextStyleContract {
  overflow?: 'visible';
}

export interface WeeklyReviewEvaluationRenderContract {
  textProps: WeeklyReviewEvaluationTextPropsContract;
  textStyle: WeeklyReviewEvaluationTextStyleContract;
  toggle: WeeklyReviewEvaluationToggle | null;
}

export interface WeeklyReviewEvaluationResetInputs {
  evaluationText: string | null;
  review: unknown;
  evaluationStatus: WeeklyEvaluationStatus;
  fontScale: number;
  textContainerWidth: number;
}

export const INITIAL_WEEKLY_REVIEW_EVALUATION_STATE: WeeklyReviewEvaluationState = {
  isExpanded: false,
  hasOverflow: false,
};

export function getWeeklyReviewEvaluationRenderContract(
  evaluationText: string | null,
  state: WeeklyReviewEvaluationState,
): WeeklyReviewEvaluationRenderContract {
  const isExpanded = state.isExpanded;

  return {
    textProps: !evaluationText || isExpanded
      ? {}
      : { numberOfLines: 2, ellipsizeMode: 'tail' },
    textStyle: isExpanded ? { overflow: 'visible' } : {},
    toggle: evaluationText ? getWeeklyReviewEvaluationToggle(state) : null,
  };
}

export function hasWeeklyReviewEvaluationResetInputsChanged(
  previous: WeeklyReviewEvaluationResetInputs | null,
  next: WeeklyReviewEvaluationResetInputs,
): boolean {
  if (!previous) return true;

  return !(
    Object.is(previous.evaluationText, next.evaluationText)
    && Object.is(previous.review, next.review)
    && Object.is(previous.evaluationStatus, next.evaluationStatus)
    && Object.is(previous.fontScale, next.fontScale)
    && Object.is(previous.textContainerWidth, next.textContainerWidth)
  );
}

export function getWeeklyReviewEvaluationText(
  text: string | null,
  status: WeeklyEvaluationStatus,
): string | null {
  if (status !== 'fresh' && status !== 'cached') return null;
  if (text == null || text.length === 0 || !/\S/.test(text)) return null;
  return text;
}

export function weeklyReviewEvaluationReducer(
  state: WeeklyReviewEvaluationState,
  action: WeeklyReviewEvaluationAction,
): WeeklyReviewEvaluationState {
  switch (action.type) {
    case 'MEASURE':
      return { ...state, hasOverflow: action.lineCount > 2 };
    case 'TOGGLE':
      return state.hasOverflow ? { ...state, isExpanded: !state.isExpanded } : state;
    case 'RESET':
      return INITIAL_WEEKLY_REVIEW_EVALUATION_STATE;
    default:
      return state;
  }
}

export function getWeeklyReviewEvaluationToggle(
  state: WeeklyReviewEvaluationState,
): WeeklyReviewEvaluationToggle | null {
  if (!state.hasOverflow) return null;
  return state.isExpanded
    ? { label: 'Weniger anzeigen', iconName: 'chevron-up' }
    : { label: 'Mehr anzeigen', iconName: 'chevron-down' };
}