import type { WeeklyTargetBand } from '@fittrack/shared';
import { colors, spacing, typography } from '../../app/theme';
import type { WeeklyReviewDayMarker, WeeklyReviewDayViewModel } from './weeklyReviewViewModel';

export const WEEKLY_REVIEW_DAY_COUNT = 7;
export const WEEKLY_REVIEW_MIN_TOUCH_HEIGHT = spacing.xxl;
export const WEEKLY_REVIEW_VALUE_SLOT_HEIGHT = typography.body2.fontSize + typography.caption.fontSize + spacing.xs;
export const WEEKLY_REVIEW_BAR_SLOT_HEIGHT = spacing.xxl * 3;
export const WEEKLY_REVIEW_WEEKDAY_SLOT_HEIGHT = typography.caption.fontSize;
export const WEEKLY_REVIEW_MARKER_SLOT_HEIGHT = spacing.lg;
export const WEEKLY_REVIEW_BAR_SLOT_TOP_MARGIN = spacing.xs;
export const WEEKLY_REVIEW_WEEKDAY_SLOT_TOP_MARGIN = spacing.sm;
export const WEEKLY_REVIEW_MARKER_SLOT_TOP_MARGIN = spacing.xs;
export const WEEKLY_REVIEW_SPECIAL_ACTIVITY_FRAME_TOP_OFFSET = -spacing.xs;

export interface WeeklyReviewDaySlot {
  top: number;
  height: number;
}

export interface WeeklyReviewDaySlotLayout {
  value: WeeklyReviewDaySlot;
  bar: WeeklyReviewDaySlot;
  weekday: WeeklyReviewDaySlot;
  marker: WeeklyReviewDaySlot;
  totalHeight: number;
}

export function getWeeklyReviewDaySlotLayout(): WeeklyReviewDaySlotLayout {
  const value = { top: 0, height: WEEKLY_REVIEW_VALUE_SLOT_HEIGHT };
  const bar = {
    top: value.top + value.height + WEEKLY_REVIEW_BAR_SLOT_TOP_MARGIN,
    height: WEEKLY_REVIEW_BAR_SLOT_HEIGHT,
  };
  const weekday = {
    top: bar.top + bar.height + WEEKLY_REVIEW_WEEKDAY_SLOT_TOP_MARGIN,
    height: WEEKLY_REVIEW_WEEKDAY_SLOT_HEIGHT,
  };
  const marker = {
    top: weekday.top + weekday.height + WEEKLY_REVIEW_MARKER_SLOT_TOP_MARGIN,
    height: WEEKLY_REVIEW_MARKER_SLOT_HEIGHT,
  };

  return {
    value,
    bar,
    weekday,
    marker,
    totalHeight: marker.top + marker.height,
  };
}

export function getWeeklyReviewMetricDisplayValue(
  value: string | null,
  options: { omitUnit?: boolean } = {},
): string {
  const displayValue = value ?? '\u2014';
  if (!options.omitUnit || !displayValue.endsWith(' kcal')) return displayValue;
  return displayValue.slice(0, -' kcal'.length);
}

export function getWeeklyReviewMetricAccessibilityLabel(
  label: string,
  consumed: string | null,
  target: string | null,
): string {
  return `${label}: Gegessen ${consumed ?? 'Nicht verfügbar'} / Ziel ${target ?? 'Nicht verfügbar'}`;
}

export function getWeeklyReviewTargetBandColor(targetBand: WeeklyTargetBand | null): string {
  if (targetBand === 'in_range') return colors.primary;
  if (targetBand === 'outside_range') return colors.warning;
  return colors.neutral;
}

export function getWeeklyReviewVisibleWeekdayLabel(
  day: Pick<WeeklyReviewDayViewModel, 'weekdayLabel'>,
): string {
  return day.weekdayLabel;
}

export interface WeeklyReviewMarkerCell {
  date: string;
  markers: readonly WeeklyReviewDayMarker[];
}

export function getWeeklyReviewMarkerCells(
  days: readonly WeeklyReviewMarkerCell[],
): WeeklyReviewMarkerCell[] {
  return days.slice(0, WEEKLY_REVIEW_DAY_COUNT);
}

export function isWeeklyReviewSpecialActivityMarker(
  marker: WeeklyReviewDayMarker,
): marker is Extract<WeeklyReviewDayMarker, { kind: 'activity' }> {
  return marker.kind === 'activity';
}

export function isWeeklyReviewSpecialActivityDay(
  day: Pick<WeeklyReviewDayViewModel, 'markers' | 'activityBonusValueLabel'>,
): boolean {
  return day.activityBonusValueLabel != null || day.markers.some(isWeeklyReviewSpecialActivityMarker);
}

export function getWeeklyReviewMarkerLegend(
  days: readonly { markers: readonly WeeklyReviewDayMarker[] }[],
): WeeklyReviewDayMarker[] {
  const specialActivityMarker = days
    .flatMap((day) => day.markers)
    .find(isWeeklyReviewSpecialActivityMarker);

  if (!specialActivityMarker) return [];

  return [{ ...specialActivityMarker, label: 'Sonderaktivität' }];
}