import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { WeightEntry } from '@fittrack/shared';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, radius, spacing, typography } from '../../app/theme';
import { Icon } from '../../shared/components/Icon';
import { addLocalDays } from '../../shared/date/localDate';
import { getProgressCalendarDates } from './progressUtils';

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

interface ProgressCalendarProps {
  selectedDate: string;
  today: string;
  entries: WeightEntry[];
  onSelectDate: (date: string) => void;
  onClose?: () => void;
}

function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

function formatMonth(date: string): string {
  const [year, month] = date.split('-').map(Number);
  return new Date(year, month - 1, 1, 12).toLocaleDateString('de-DE', {
    month: 'long',
    year: 'numeric',
  });
}

function formatAccessibleDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const label = new Date(year, month - 1, day, 12).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return label;
}

export function ProgressCalendar({ selectedDate, today, entries, onSelectDate, onClose }: ProgressCalendarProps) {
  const [displayedMonth, setDisplayedMonth] = useState(() => monthStart(selectedDate));
  const gridOpacity = useSharedValue(1);
  const gridAnimatedStyle = useAnimatedStyle(() => ({ opacity: gridOpacity.value }));
  const dates = useMemo(() => getProgressCalendarDates(displayedMonth), [displayedMonth]);
  const datesWithEntries = useMemo(() => new Set(entries.map((entry) => entry.date)), [entries]);
  const isNextMonthDisabled = displayedMonth >= monthStart(today);

  useEffect(() => {
    setDisplayedMonth(monthStart(selectedDate));
  }, [selectedDate]);

  useEffect(() => {
    gridOpacity.value = withTiming(1, { duration: 200 });
  }, [displayedMonth, gridOpacity]);

  const changeMonth = (offset: number) => {
    const nextMonthDate = addLocalDays(displayedMonth, offset < 0 ? -1 : 32);
    const nextMonth = monthStart(nextMonthDate);
    if (nextMonth > monthStart(today)) return;
    gridOpacity.value = 0.35;
    setDisplayedMonth(nextMonth);
  };

  return (
    <View style={styles.card} testID="progress-calendar">
      <View style={styles.sheetTitleRow}>
        <Text style={styles.sheetTitle} accessibilityRole="header">Datum auswählen</Text>
        {onClose ? (
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Kalender schließen"
          >
            <Icon lib="feather" name="x" size="md" color={colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => changeMonth(-1)}
          style={styles.monthButton}
          accessibilityRole="button"
          accessibilityLabel="Vorheriger Monat"
        >
          <Icon lib="feather" name="chevron-left" size="md" color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.monthLabel} accessibilityRole="header">{formatMonth(displayedMonth)}</Text>
        <TouchableOpacity
          onPress={() => changeMonth(1)}
          style={[styles.monthButton, isNextMonthDisabled && styles.monthButtonDisabled]}
          disabled={isNextMonthDisabled}
          accessibilityRole="button"
          accessibilityLabel="Nächster Monat"
          accessibilityState={{ disabled: isNextMonthDisabled }}
        >
          <Icon
            lib="feather"
            name="chevron-right"
            size="md"
            color={isNextMonthDisabled ? colors.textDisabled : colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label) => (
          <View key={label} style={styles.weekdayCell}>
            <Text style={styles.weekdayLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <Animated.View style={[styles.dayGrid, gridAnimatedStyle]}>
        {dates.map((date) => {
          const hasEntry = datesWithEntries.has(date);
          const inDisplayedMonth = date.slice(0, 7) === displayedMonth.slice(0, 7);
          const isSelected = date === selectedDate;
          const isToday = date === today;
          const isFuture = date > today;
          return (
            <TouchableOpacity
              key={date}
              style={styles.dayCell}
              onPress={() => { if (!isFuture) onSelectDate(date); }}
              disabled={isFuture}
              accessibilityRole="button"
              accessibilityLabel={formatAccessibleDate(date)}
              accessibilityState={{ selected: isSelected, disabled: isFuture }}
            >
              <View style={[
                styles.dayNumberWrap,
                isSelected && styles.dayNumberSelected,
                isToday && !isSelected && styles.dayNumberToday,
              ]}>
                <Text style={[
                  styles.dayNumber,
                  !inDisplayedMonth && styles.dayNumberOutside,
                  isSelected && styles.dayNumberSelectedText,
                  isFuture && styles.dayNumberDisabled,
                ]}>
                  {Number(date.slice(-2))}
                </Text>
              </View>
              <View style={styles.markerSlot}>
                {hasEntry ? <View style={styles.measurementMarker} testID="progress-calendar-marker" /> : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  sheetTitleRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.text,
  },
  closeButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  monthButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthButtonDisabled: {
    opacity: 0.45,
  },
  monthLabel: {
    ...typography.h3,
    color: colors.text,
    textTransform: 'capitalize',
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekdayCell: {
    flex: 1,
    minHeight: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    flexBasis: '14.2857%',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  dayNumberSelected: {
    backgroundColor: colors.primarySoft,
  },
  dayNumberToday: {
    borderWidth: 1,
    borderColor: colors.primaryBright,
  },
  dayNumber: {
    ...typography.body2,
    color: colors.text,
  },
  dayNumberOutside: {
    color: colors.textMuted,
  },
  dayNumberSelectedText: {
    color: colors.primaryBright,
    fontWeight: '700',
  },
  dayNumberDisabled: {
    color: colors.textDisabled,
  },
  markerSlot: {
    height: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  measurementMarker: {
    width: spacing.xs,
    height: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.primaryBright,
  },
});