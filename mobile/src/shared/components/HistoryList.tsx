// HistoryList — Grouped weight history with section headers.
//
// Groups: Heute / Gestern / Diese Woche / Älter
// Shows delta arrow vs the previous chronological entry.
// Fully memoised — re-renders only when entries change.

import React, { useMemo } from 'react';
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

interface Group {
  title: string;
  items: HistoryItem[];
}

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function weekAgoDate(): Date {
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

function buildGroups(entries: WeightEntry[]): Group[] {
  if (entries.length === 0) return [];

  const tday = todayStr();
  const yday = yesterdayStr();
  const weekAgo = weekAgoDate();

  const buckets: Record<'today' | 'yesterday' | 'week' | 'older', HistoryItem[]> = {
    today: [],
    yesterday: [],
    week: [],
    older: [],
  };

  // entries is newest-first; entry[i+1] is the chronologically previous measurement
  entries.forEach((entry, idx) => {
    const prev = entries[idx + 1];
    const delta = prev ? entry.value - prev.value : null;
    const item: HistoryItem = { entry, delta };

    if (entry.date === tday) {
      buckets.today.push(item);
    } else if (entry.date === yday) {
      buckets.yesterday.push(item);
    } else if (parseDate(entry.date) >= weekAgo) {
      buckets.week.push(item);
    } else {
      buckets.older.push(item);
    }
  });

  const result: Group[] = [];
  if (buckets.today.length > 0) result.push({ title: 'Heute', items: buckets.today });
  if (buckets.yesterday.length > 0) result.push({ title: 'Gestern', items: buckets.yesterday });
  if (buckets.week.length > 0) result.push({ title: 'Diese Woche', items: buckets.week });
  if (buckets.older.length > 0) result.push({ title: 'Älter', items: buckets.older });
  return result;
}

export function HistoryList({ entries, onDelete, deleting }: HistoryListProps) {
  const groups = useMemo(() => buildGroups(entries), [entries]);

  if (groups.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          Noch keine Einträge. Trage deine erste Messung ein.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {groups.map((group) => (
        <View key={group.title} style={styles.group}>
          <Text style={styles.groupTitle}>{group.title}</Text>
          <View style={styles.groupCard}>
            {group.items.map(({ entry, delta }, idx) => {
              const isDown = delta !== null && delta < 0;
              const isUp = delta !== null && delta > 0;
              const isNeutral = delta !== null && Math.abs(delta) < 0.05;
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
                  : `${isDown ? '↓' : '↑'} ${Math.abs(delta).toFixed(1)}`;

              const isLast = idx === group.items.length - 1;

              return (
                <View
                  key={entry.id}
                  style={[styles.row, !isLast && styles.rowBorder]}
                >
                  <View style={styles.dotWrap}>
                    <View style={styles.dot} />
                  </View>
                  <Text style={styles.dateText}>{formatEntryDate(entry.date)}</Text>
                  <Text style={styles.valueText}>
                    {entry.value.toFixed(1)}{' '}
                    <Text style={styles.unitText}>{entry.unit}</Text>
                  </Text>
                  {deltaStr ? (
                    <Text style={[styles.deltaText, { color: deltaColor }]}>
                      {deltaStr}
                    </Text>
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
            })}
          </View>
        </View>
      ))}
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
});
