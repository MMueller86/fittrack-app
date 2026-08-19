export type WeeklyReviewErrorState = 'none' | 'initial' | 'stale';

export function getWeeklyReviewErrorState(
  hasReview: boolean,
  hasError: boolean,
): WeeklyReviewErrorState {
  if (!hasError) return 'none';
  return hasReview ? 'stale' : 'initial';
}