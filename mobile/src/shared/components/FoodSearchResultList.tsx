// Shared food search-result list.
import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { FoodSearchResult } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';

interface Props {
  results: FoodSearchResult[];
  loading: boolean;
  query: string;
  onSelect: (item: FoodSearchResult) => void;
  /** Show library / web source badges next to each name. Defaults false. */
  showSourceBadges?: boolean;
  /** Slot rendered when query is non-empty but results are empty (e.g. "Mit KI schaetzen" button). */
  footer?: React.ReactNode;
}

export function FoodSearchResultList({
  results,
  loading,
  query,
  onSelect,
  showSourceBadges,
  footer,
}: Props) {
  if (loading) {
    return <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />;
  }

  const hasQuery = query.trim().length > 0;

  return (
    <>
      {results.length > 0 && (
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {results.map((item) => (
            <TouchableOpacity
              key={`${item.source}-${item.id}`}
              style={styles.row}
              onPress={() => onSelect(item)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {showSourceBadges && (
                    <Text style={styles.sourceBadge}>
                      {item.source === 'library' ? '\uD83D\uDCDA' : '\uD83C\uDF0D'}
                    </Text>
                  )}
                  {!item.isComplete && <Text style={styles.warnBadge}>{'\u26A0'}</Text>}
                </View>
                {item.brand ? (
                  <Text style={styles.brand} numberOfLines={1}>
                    {item.brand}
                  </Text>
                ) : null}
                <Text style={styles.meta}>{item.displayLabel}</Text>
              </View>
              <Text style={styles.chevron}>{'\u203A'}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {results.length === 0 && hasQuery && footer}

      {results.length === 0 && !hasQuery && (
        <Text style={styles.hint}>Tippe einen Suchbegriff ein\u2026</Text>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  name: {
    ...typography.body1,
    color: colors.text,
    fontWeight: '600',
    flexShrink: 1,
  },
  sourceBadge: { fontSize: 13 },
  warnBadge: { fontSize: 13, color: colors.negative },
  brand: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  chevron: { ...typography.h2, color: colors.textMuted, marginLeft: spacing.sm },
  hint: {
    ...typography.body2,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
