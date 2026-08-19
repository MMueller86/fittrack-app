import { describe, expect, it } from 'vitest';
import { colors, spacing } from '../../app/theme';
import {
  getWeeklyReviewDaySlotLayout,
  getWeeklyReviewMarkerCells,
  getWeeklyReviewMarkerLegend,
  getWeeklyReviewMetricAccessibilityLabel,
  getWeeklyReviewMetricDisplayValue,
  getWeeklyReviewTargetBandColor,
  getWeeklyReviewVisibleWeekdayLabel,
  isWeeklyReviewSpecialActivityDay,
  isWeeklyReviewSpecialActivityMarker,
  WEEKLY_REVIEW_BAR_SLOT_HEIGHT,
  WEEKLY_REVIEW_BAR_SLOT_TOP_MARGIN,
  WEEKLY_REVIEW_DAY_COUNT,
  WEEKLY_REVIEW_MARKER_SLOT_HEIGHT,
  WEEKLY_REVIEW_MARKER_SLOT_TOP_MARGIN,
  WEEKLY_REVIEW_MIN_TOUCH_HEIGHT,
  WEEKLY_REVIEW_SPECIAL_ACTIVITY_FRAME_TOP_OFFSET,
  WEEKLY_REVIEW_VALUE_SLOT_HEIGHT,
  WEEKLY_REVIEW_WEEKDAY_SLOT_HEIGHT,
  WEEKLY_REVIEW_WEEKDAY_SLOT_TOP_MARGIN,
} from './weeklyReviewCardLayout';

describe('weekly review KPI presentation', () => {
  it('renders the shared calorie unit after the target while preserving zero and missing values', () => {
    expect(getWeeklyReviewMetricDisplayValue('2.185 kcal')).toBe('2.185 kcal');
    expect(
      `${getWeeklyReviewMetricDisplayValue('2.185 kcal', { omitUnit: true })} / ${getWeeklyReviewMetricDisplayValue('2.300 kcal')}`,
    ).toBe('2.185 / 2.300 kcal');
    expect(getWeeklyReviewMetricDisplayValue('0 kcal', { omitUnit: true })).toBe('0');
    expect(getWeeklyReviewMetricDisplayValue(null)).toBe('\u2014');
    expect(getWeeklyReviewMetricDisplayValue(null, { omitUnit: true })).toBe('\u2014');
    expect(getWeeklyReviewMetricAccessibilityLabel('7-Tage-Ziel', '0 kcal', '2.300 kcal'))
      .toBe('7-Tage-Ziel: Gegessen 0 kcal / Ziel 2.300 kcal');
    expect(getWeeklyReviewMetricAccessibilityLabel('Ø Ziel / Tag', null, null))
      .toBe('Ø Ziel / Tag: Gegessen Nicht verfügbar / Ziel Nicht verfügbar');
  });

  it('preserves target-band colors and neutral missing semantics', () => {
    expect(getWeeklyReviewTargetBandColor('in_range')).toBe(colors.primary);
    expect(getWeeklyReviewTargetBandColor('outside_range')).toBe(colors.warning);
    expect(getWeeklyReviewTargetBandColor(null)).toBe(colors.neutral);
    expect(WEEKLY_REVIEW_MIN_TOUCH_HEIGHT).toBe(48);
  });
});

describe('weekly review day context', () => {
  it('defines identical explicit slots and y coordinates for all seven day columns', () => {
    const layout = getWeeklyReviewDaySlotLayout();
    const layouts = Array.from({ length: WEEKLY_REVIEW_DAY_COUNT }, () => getWeeklyReviewDaySlotLayout());

    expect(layouts).toHaveLength(7);
    expect(layouts.every((candidate) => candidate != null)).toBe(true);
    expect(layout.value).toEqual({ top: 0, height: WEEKLY_REVIEW_VALUE_SLOT_HEIGHT });
    expect(layout.bar).toEqual({
      top: WEEKLY_REVIEW_VALUE_SLOT_HEIGHT + WEEKLY_REVIEW_BAR_SLOT_TOP_MARGIN,
      height: WEEKLY_REVIEW_BAR_SLOT_HEIGHT,
    });
    expect(layout.weekday).toEqual({
      top: layout.bar.top + WEEKLY_REVIEW_BAR_SLOT_HEIGHT + WEEKLY_REVIEW_WEEKDAY_SLOT_TOP_MARGIN,
      height: WEEKLY_REVIEW_WEEKDAY_SLOT_HEIGHT,
    });
    expect(layout.marker).toEqual({
      top: layout.weekday.top + WEEKLY_REVIEW_WEEKDAY_SLOT_HEIGHT + WEEKLY_REVIEW_MARKER_SLOT_TOP_MARGIN,
      height: WEEKLY_REVIEW_MARKER_SLOT_HEIGHT,
    });
    expect(layouts.slice(1)).toEqual(Array.from({ length: WEEKLY_REVIEW_DAY_COUNT - 1 }, () => layout));
    expect(WEEKLY_REVIEW_SPECIAL_ACTIVITY_FRAME_TOP_OFFSET).toBe(-spacing.xs);
  });

  it('frames only special-activity days, including a positive activity bonus without a marker', () => {
    const trainingOnly = {
      markers: [{
        kind: 'training' as const,
        icon: { lib: 'feather' as const, name: 'activity' as const },
        label: 'Training' as const,
      }],
      activityBonusValueLabel: null,
    };
    const restDay = { markers: [], activityBonusValueLabel: null };
    const missingDay = { markers: [], activityBonusValueLabel: null };
    const specialActivity = {
      markers: [{
        kind: 'activity' as const,
        icon: { lib: 'mci' as const, name: 'bike' as const },
        label: 'Radtour' as const,
      }],
      activityBonusValueLabel: null,
    };
    const bonusOnly = { markers: [], activityBonusValueLabel: '500 kcal' };

    expect(isWeeklyReviewSpecialActivityDay(trainingOnly)).toBe(false);
    expect(isWeeklyReviewSpecialActivityDay(restDay)).toBe(false);
    expect(isWeeklyReviewSpecialActivityDay(missingDay)).toBe(false);
    expect(isWeeklyReviewSpecialActivityDay(specialActivity)).toBe(true);
    expect(isWeeklyReviewSpecialActivityDay(bonusOnly)).toBe(true);
  });

  it('uses only the weekday under the bars and never the date label', () => {
    const day = { weekdayLabel: 'Fr', dateLabel: '7. Aug.' };

    expect(getWeeklyReviewVisibleWeekdayLabel(day)).toBe('Fr');
    expect(getWeeklyReviewVisibleWeekdayLabel(day)).not.toContain(day.dateLabel);
  });
});

describe('getWeeklyReviewMarkerCells', () => {
  it('keeps exactly seven marker cells aligned with the chart days', () => {
    const days = Array.from({ length: WEEKLY_REVIEW_DAY_COUNT }, (_, index) => ({
      date: `2026-01-${String(index + 1).padStart(2, '0')}`,
      markers: index === 0
        ? [{
            kind: 'training' as const,
            icon: { lib: 'feather' as const, name: 'activity' as const },
            label: 'Training' as const,
          }]
        : [],
    }));

    const cells = getWeeklyReviewMarkerCells(days);

    expect(cells).toHaveLength(WEEKLY_REVIEW_DAY_COUNT);
    expect(cells.map((cell) => cell.date)).toEqual(days.map((day) => day.date));
    expect(cells.map((cell) => cell.markers)).toEqual(days.map((day) => day.markers));
  });

  it('does not create a marker cell outside the seven chart columns', () => {
    const days = Array.from({ length: WEEKLY_REVIEW_DAY_COUNT + 1 }, (_, index) => ({
      date: `2026-01-${String(index + 1).padStart(2, '0')}`,
      markers: [],
    }));

    expect(getWeeklyReviewMarkerCells(days)).toHaveLength(WEEKLY_REVIEW_DAY_COUNT);
  });
});

describe('getWeeklyReviewMarkerLegend', () => {
  it('returns one deduplicated special-activity explanation without training entries', () => {
    const legend = getWeeklyReviewMarkerLegend([
      {
        markers: [
          {
            kind: 'activity',
            icon: { lib: 'mci', name: 'hiking' },
            label: 'Wanderung',
          },
          {
            kind: 'training',
            icon: { lib: 'mci', name: 'weight-lifter' },
            label: 'Gym',
          },
        ],
      },
      {
        markers: [
          {
            kind: 'training',
            icon: { lib: 'mci', name: 'run' },
            label: 'Laufen',
          },
          {
            kind: 'activity',
            icon: { lib: 'mci', name: 'bike' },
            label: 'Radtour',
          },
        ],
      },
    ]);

    expect(legend).toEqual([
      {
        kind: 'activity',
        icon: { lib: 'mci', name: 'hiking' },
        label: 'Sonderaktivität',
      },
    ]);
  });

  it('keeps outline semantics limited to special-activity markers', () => {
    const trainingMarker = {
      kind: 'training',
      icon: { lib: 'mci', name: 'weight-lifter' },
      label: 'Gym',
    } as const;
    const activityMarker = {
      kind: 'activity',
      icon: { lib: 'mci', name: 'bike' },
      label: 'Radtour',
    } as const;

    expect(isWeeklyReviewSpecialActivityMarker(trainingMarker)).toBe(false);
    expect(isWeeklyReviewSpecialActivityMarker(activityMarker)).toBe(true);
  });

  it('keeps the marker legend empty when all seven days are marker-free', () => {
    expect(getWeeklyReviewMarkerLegend(
      Array.from({ length: 7 }, () => ({ markers: [] })),
    )).toEqual([]);
  });
});