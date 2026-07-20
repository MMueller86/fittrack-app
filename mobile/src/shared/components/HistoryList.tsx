// HistoryList — Grouped weight history with section headers.
//
// Groups: Heute / Gestern / Diese Woche / Älter
// Shows delta arrow vs the previous chronological entry.
// Fully memoised — re-renders only when entries change.

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

function buildWeekGroups(items: HistoryItem[]): WeekGroup[] {
  const map = new Map<string, HistoryItem[]>();
  for (const item of items) {
    const monday = getMondayOf(item.entry.date);
    const bucket = map.get(monday) ?? [];
    bucket.push(item);
    map.set(monday, bucket);
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

export function HistoryList({ entries, onDelete, deleting }: HistoryListProps) {
  const groups = useMemo(() => buildGroups(entries), [entries]);
  const weekGroups = useMemo(() => {
    const older = groups.find((g) => g.title === 'Älter');
    return older ? buildWeekGroups(older.items) : [];
  }, [groups]);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());

  if (groups.length === 0) {
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

  return (
    <View>
      {groups
        .filter((g) => g.title !== 'Älter')
        .map((group) => (
          <View key={group.title} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            <View style={styles.groupCard}>
              {group.items.map(({ entry, delta }, idx) =>
                renderRow(entry, delta, idx === group.items.length - 1)
              )}
            </View>
          </View>
        ))}

      {weekGroups.length > 0 && (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Älter</Text>
          <View style={styles.groupCard}>
            {weekGroups.map((wg, wi) => {
              const isExpanded = expandedWeeks.has(wg.key);
              const isLastWeek = wi === weekGroups.length - 1;
              return (
                <View key={wg.key}>
                  <TouchableOpacity
                    onPress={() => toggleWeek(wg.key)}
                    style={[styles.weekHeader, (!isLastWeek || isExpanded) && styles.rowBorder]}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isExpanded }}
                  >
                    <View style={styles.weekHeaderLeft}>
                      <Text style={styles.weekLabel}>{wg.label}</Text>
                      <Text style={styles.weekMeta}>
                        Ø {wg.avgValue.toFixed(2)} {wg.unit} · {wg.count}{' '}
                        {wg.count === 1 ? 'Messung' : 'Messungen'}
                      </Text>
                    </View>
                    <Text style={styles.chevron}>{isExpanded ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                  {isExpanded &&
                    wg.items.map(({ entry, delta }, idx) =>
                      renderRow(entry, delta, isLastWeek && idx === wg.items.length - 1)
                    )}
                </View>
              );
            })}
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
