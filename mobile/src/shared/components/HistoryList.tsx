// HistoryList — Grouped weight history with section headers.
//
// Sections:
//   1. "Die letzten 7 Tage" — rolling 7-day window (starts expanded)
//   2. Completed Mon–Sun calendar weeks, newest-first (starts collapsed)
//
// Entries may appear in both sections (e.g. last Sunday is in the 7-day
// window AND in the prior completed week average). This is intentional.
// Shows delta arrow vs the previous chronological entry.

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { WeightEntry } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { Icon } from './Icon';
import { SwipeableRow } from './SwipeableRow';
import { formatKilograms } from '../weightFormatting';
import { buildCompletedWeekGroups, buildLast7DaysItems } from '../weightHistory';

export interface HistoryListProps {
  entries: WeightEntry[];
  onDelete: (entry: WeightEntry) => void;
  onEdit?: (entry: WeightEntry) => void;
  /** Set of entry IDs currently being deleted (disables row editing). */
  deleting?: Set<string>;
}

interface HistoryItem {
  entry: WeightEntry;
  /** Delta vs previous chronological entry. Null for the oldest entry. */
  delta: number | null;
}

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

function formatEntryDate(iso: string): string {
  return parseDate(iso).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

/** Assigns delta vs. previous chronological entry to every entry. */
function buildAllItems(entries: WeightEntry[]): HistoryItem[] {
  return entries.map((entry, idx) => {
    const prev = entries[idx + 1];
    return { entry, delta: prev ? entry.value - prev.value : null };
  });
}

const LAST7_KEY = '__last7__';

export function HistoryList({ entries, onDelete, onEdit, deleting }: HistoryListProps) {
  const allItems = useMemo(() => buildAllItems(entries), [entries]);
  const last7Items = useMemo(() => buildLast7DaysItems(allItems), [allItems]);
  const completedWeekGroups = useMemo(() => buildCompletedWeekGroups(allItems), [allItems]);
  // "Die letzten 7 Tage" starts expanded; calendar weeks start collapsed
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set([LAST7_KEY]));

  if (entries.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          Deine Messungen erscheinen hier.
        </Text>
      </View>
    );
  }

  const toggleWeek = (key: string) =>
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const renderRow = (entry: WeightEntry, delta: number | null, isLast: boolean) => {
    const isDown = delta !== null && delta < 0;
    const isNeutral = delta !== null && Number(Math.abs(delta).toFixed(1)) === 0;
    const deltaStr =
      delta === null
        ? null
        : isNeutral
        ? '─'
        : `${isDown ? '↓' : '↑'} ${formatKilograms(Math.abs(delta))}`;
    return (
      <SwipeableRow key={entry.id} onDelete={() => onDelete(entry)}>
        <TouchableOpacity
          style={[styles.row, !isLast && styles.rowBorder]}
          onPress={onEdit ? () => onEdit(entry) : undefined}
          activeOpacity={onEdit ? 0.7 : 1}
          disabled={!onEdit || deleting?.has(entry.id)}
          accessibilityRole={onEdit ? 'button' : undefined}
          accessibilityLabel={onEdit
            ? `Gewicht vom ${entry.date}, ${formatKilograms(entry.value)} ${entry.unit} bearbeiten`
            : undefined}
        >
          <View style={styles.dotWrap}>
            <View style={styles.dot} />
          </View>
          <Text style={styles.dateText}>{formatEntryDate(entry.date)}</Text>
          <Text style={styles.valueText}>
            {formatKilograms(entry.value)}{' '}
            <Text style={styles.unitText}>{entry.unit}</Text>
          </Text>
          {deltaStr ? (
            <Text style={styles.deltaText}>{deltaStr}</Text>
          ) : (
            <View style={styles.deltaPlaceholder} />
          )}
        </TouchableOpacity>
      </SwipeableRow>
    );
  };

  // Build the synthetic "last 7 days" section
  const last7Avg = last7Items.length > 0
    ? last7Items.reduce((s, i) => s + i.entry.value, 0) / last7Items.length
    : 0;

  const renderSection = (key: string, label: string, avg: number, count: number, items: HistoryItem[], isLast: boolean) => {
    const isExpanded = expandedWeeks.has(key);
    return (
      <View key={key}>
        <TouchableOpacity
          onPress={() => toggleWeek(key)}
          style={[styles.weekHeader, (!isLast || isExpanded) && styles.rowBorder]}
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded }}
        >
          <View style={styles.weekHeaderLeft}>
            <Text style={styles.weekLabel}>{label}</Text>
            <Text style={styles.weekMeta}>
              Ø {formatKilograms(avg)} kg · {count}{' '}
              {count === 1 ? 'Messung' : 'Messungen'}
            </Text>
          </View>
          <Icon
            lib="feather"
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size="md"
            color={colors.textMuted}
          />
        </TouchableOpacity>
        {isExpanded &&
          items.map(({ entry, delta }, idx) =>
            renderRow(entry, delta, isLast && idx === items.length - 1)
          )}
      </View>
    );
  };

  const hasLast7 = last7Items.length > 0;
  const hasWeeks = completedWeekGroups.length > 0;
  const totalSections = (hasLast7 ? 1 : 0) + (hasWeeks ? 1 : 0);

  return (
    <View>
      {hasLast7 && (
        <View style={styles.group}>
          <View style={styles.groupCard}>
            {renderSection(
              LAST7_KEY,
              'Die letzten 7 Tage',
              last7Avg,
              last7Items.length,
              last7Items,
              totalSections === 1,
            )}
          </View>
        </View>
      )}

      {hasWeeks && (
        <View style={styles.group}>
          <View style={styles.groupCard}>
            {completedWeekGroups.map((wg, wi) =>
              renderSection(
                wg.key,
                wg.label,
                wg.avgValue,
                wg.count,
                wg.items,
                wi === completedWeekGroups.length - 1,
              )
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    paddingVertical: spacing.lg,
  },
  emptyText: {
    ...typography.body2,
    color: colors.textMuted,
    textAlign: 'center',
  },
  group: {
    marginBottom: spacing.lg,
  },
  groupTitle: {
    ...typography.overline,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  groupCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dotWrap: {
    width: 20,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primaryBright,
  },
  dateText: {
    ...typography.body2,
    color: colors.textSecondary,
    flexGrow: 1,
    flexBasis: 64,
    minWidth: 0,
  },
  valueText: {
    ...typography.body1,
    color: colors.text,
    fontWeight: '600',
  },
  unitText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '400',
  },
  deltaText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
    width: 52,
    textAlign: 'right',
  },
  deltaPlaceholder: {
    width: 52,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  weekHeaderLeft: {
    flex: 1,
  },
  weekLabel: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text,
  },
  weekMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
});
