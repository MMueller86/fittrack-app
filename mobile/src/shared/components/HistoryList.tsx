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
import type { WeightEntry, WeightUnit } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';

export interface HistoryListProps {
  entries: WeightEntry[];
  unit: WeightUnit;
  onDelete: (entry: WeightEntry) => void;
  /** Set of entry IDs currently being deleted (disables their delete button). */
  deleting?: Set<string>;
}

interface HistoryItem {
  entry: WeightEntry;
  /** Delta vs previous chronological entry. Null for the oldest entry. */
  delta: number | null;
}

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function last7CutoffDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatEntryDate(iso: string): string {
  return parseDate(iso).toLocaleDateString(undefined, {
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

/** Rolling last-7-days window (today inclusive, going 6 days back). */
function buildLast7DaysItems(allItems: HistoryItem[]): HistoryItem[] {
  const cutoff = last7CutoffDate();
  return allItems.filter((item) => parseDate(item.entry.date) >= cutoff);
}

function getMondayOf(iso: string): string {
  const d = parseDate(iso);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function formatWeekRange(mondayIso: string): string {
  const monday = parseDate(mondayIso);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (dt: Date) =>
    `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.`;
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

interface WeekGroup {
  key: string;
  label: string;
  avgValue: number;
  unit: string;
  count: number;
  items: HistoryItem[];
}

/**
 * Groups all items into completed Mon–Sun calendar weeks.
 * A week is "completed" when its Sunday is strictly before today.
 * Items from the last-7-days window may also appear here — intentional overlap.
 */
function buildCompletedWeekGroups(allItems: HistoryItem[]): WeekGroup[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const map = new Map<string, HistoryItem[]>();
  for (const item of allItems) {
    const monday = getMondayOf(item.entry.date);
    const mondayDate = parseDate(monday);
    const sundayDate = new Date(mondayDate);
    sundayDate.setDate(mondayDate.getDate() + 6);
    // Only include closed weeks (Sunday < today)
    if (sundayDate < today) {
      const bucket = map.get(monday) ?? [];
      bucket.push(item);
      map.set(monday, bucket);
    }
  }

  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, weekItems]) => ({
      key,
      label: formatWeekRange(key),
      avgValue: weekItems.reduce((s, i) => s + i.entry.value, 0) / weekItems.length,
      unit: weekItems[0]?.entry.unit ?? 'kg',
      count: weekItems.length,
      items: weekItems,
    }));
}

const LAST7_KEY = '__last7__';

export function HistoryList({ entries, onDelete, deleting }: HistoryListProps) {
  const allItems = useMemo(() => buildAllItems(entries), [entries]);
  const last7Items = useMemo(() => buildLast7DaysItems(allItems), [allItems]);
  const completedWeekGroups = useMemo(() => buildCompletedWeekGroups(allItems), [allItems]);
  // "Die letzten 7 Tage" starts expanded; calendar weeks start collapsed
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set([LAST7_KEY]));

  if (entries.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          Noch keine Einträge. Trage deine erste Messung ein.
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
    const isUp = delta !== null && delta > 0;
    const isNeutral = delta !== null && parseFloat(Math.abs(delta).toFixed(2)) === 0;
    const deltaColor = isNeutral
      ? colors.textMuted
      : isDown
      ? colors.positive
      : isUp
      ? colors.negative
      : colors.textMuted;
    const deltaStr =
      delta === null
        ? null
        : isNeutral
        ? '─'
        : `${isDown ? '↓' : '↑'} ${Math.abs(delta).toFixed(2)}`;
    return (
      <View key={entry.id} style={[styles.row, !isLast && styles.rowBorder]}>
        <View style={styles.dotWrap}>
          <View style={styles.dot} />
        </View>
        <Text style={styles.dateText}>{formatEntryDate(entry.date)}</Text>
        <Text style={styles.valueText}>
          {entry.value.toFixed(2)}{' '}
          <Text style={styles.unitText}>{entry.unit}</Text>
        </Text>
        {deltaStr ? (
          <Text style={[styles.deltaText, { color: deltaColor }]}>{deltaStr}</Text>
        ) : (
          <View style={styles.deltaPlaceholder} />
        )}
        <TouchableOpacity
          onPress={() => onDelete(entry)}
          hitSlop={{ top: 8, bottom: 8, left: 12, right: 8 }}
          disabled={deleting?.has(entry.id)}
          accessibilityRole="button"
          accessibilityLabel={`Eintrag vom ${entry.date} löschen`}
        >
          <Text style={styles.deleteText}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Build the synthetic "last 7 days" section
  const last7Avg = last7Items.length > 0
    ? last7Items.reduce((s, i) => s + i.entry.value, 0) / last7Items.length
    : 0;
  const last7Unit = last7Items[0]?.entry.unit ?? 'kg';

  const renderSection = (key: string, label: string, avg: number, unit: string, count: number, items: HistoryItem[], isLast: boolean) => {
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
              Ø {avg.toFixed(2)} {unit} · {count}{' '}
              {count === 1 ? 'Messung' : 'Messungen'}
            </Text>
          </View>
          <Text style={styles.chevron}>{isExpanded ? '▲' : '▼'}</Text>
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
              last7Unit,
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
                wg.unit,
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
    flex: 1,
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
    fontWeight: '700',
    width: 52,
    textAlign: 'right',
  },
  deltaPlaceholder: {
    width: 52,
  },
  deleteText: {
    ...typography.caption,
    color: colors.textDisabled,
    paddingLeft: spacing.sm,
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
  chevron: {
    fontSize: 10,
    color: colors.textMuted,
  },
});
