// SearchState — Suchergebnisse + kompakte Quick-Action-Leiste.
// Wird in FoodEntryHub angezeigt, sobald das Suchfeld fokussiert ist.
// Beinhaltet immer [📷] [✨] [✏️] direkt unter dem Suchfeld.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import type { FoodSearchResult } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../../app/theme';
import { foodApi } from '../../../shared/api/foodApi';
import { formatApiError } from '../../../shared/api/apiError';
import { ErrorBanner } from '../../../shared/components/ErrorBanner';

interface Props {
  query: string;
  onSelect: (item: FoodSearchResult) => void;
  onOpenSubflow: (flow: 'barcode' | 'ai' | 'manual') => void;
}

// ---------------------------------------------------------------------------
// Compact action bar — immer sichtbar bei aktiver Suche
// ---------------------------------------------------------------------------

interface ActionBarProps {
  onOpenSubflow: (flow: 'barcode' | 'ai' | 'manual') => void;
}

function CompactActionBar({ onOpenSubflow }: ActionBarProps) {
  return (
    <View style={styles.actionBar}>
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => onOpenSubflow('barcode')}
        accessibilityRole="button"
        accessibilityLabel="Barcode scannen"
      >
        <Text style={styles.actionBtnIcon}>📷</Text>
        <Text style={styles.actionBtnLabel}>Barcode</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => onOpenSubflow('ai')}
        accessibilityRole="button"
        accessibilityLabel="KI-Schätzung"
      >
        <Text style={styles.actionBtnIcon}>✨</Text>
        <Text style={styles.actionBtnLabel}>KI</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => onOpenSubflow('manual')}
        accessibilityRole="button"
        accessibilityLabel="Manuell eingeben"
      >
        <Text style={styles.actionBtnIcon}>✏️</Text>
        <Text style={styles.actionBtnLabel}>Manuell</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Single result row
// ---------------------------------------------------------------------------

interface ResultRowProps {
  item: FoodSearchResult;
  onPress: (item: FoodSearchResult) => void;
}

function ResultRow({ item, onPress }: ResultRowProps) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      <View style={styles.rowBody}>
        <View style={styles.rowNameRow}>
          <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
          {!item.isComplete && (
            <Text style={styles.warnBadge}>⚠</Text>
          )}
          {item.isAiEstimate && (
            <Text style={styles.aiBadge}>✨</Text>
          )}
        </View>
        {item.brand ? (
          <Text style={styles.rowBrand} numberOfLines={1}>{item.brand}</Text>
        ) : null}
        <Text style={styles.rowMeta}>{item.displayLabel}</Text>
      </View>
      <Text style={styles.rowChevron}>›</Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// SearchState component
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 300;

export function SearchState({ query, onSelect, onOpenSubflow }: Props) {
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchedQuery, setSearchedQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length === 0) {
      setResults([]);
      setError(null);
      setSearchedQuery('');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { results: r } = await foodApi.search(q.trim());
      setResults(r);
      setSearchedQuery(q.trim());
    } catch (e: unknown) {
      setError(formatApiError(e, 'Suche fehlgeschlagen'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce query changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void doSearch(query);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  const hasQuery = query.trim().length > 0;
  const hasResults = results.length > 0;
  const emptyWithQuery = hasQuery && !loading && !error && !hasResults && searchedQuery === query.trim();

  return (
    <View style={styles.container}>
      {/* Kompakte Action-Leiste — immer sichtbar */}
      <CompactActionBar onOpenSubflow={onOpenSubflow} />

      {/* Trennlinie */}
      <View style={styles.divider} />

      {/* Error */}
      {error ? (
        <View style={styles.errorContainer}>
          <ErrorBanner error={error} onRetry={() => void doSearch(query)} />
        </View>
      ) : null}

      {/* Loading */}
      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.spinner} />
      ) : null}

      {/* Suchergebnisse */}
      {!loading && !error && hasResults ? (
        <BottomSheetFlatList
          data={results}
          keyExtractor={(item) => `${item.source}-${item.id}`}
          renderItem={({ item }) => <ResultRow item={item} onPress={onSelect} />}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      ) : null}

      {/* Kein Ergebnis — 3 Quick-Actions statt "Keine Ergebnisse" */}
      {emptyWithQuery ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Kein Treffer für „{query}"</Text>
          <Text style={styles.emptySubtext}>Alternativ:</Text>
          <View style={styles.emptyActions}>
            <TouchableOpacity style={styles.emptyAction} onPress={() => onOpenSubflow('barcode')}>
              <Text style={styles.emptyActionIcon}>📷</Text>
              <Text style={styles.emptyActionLabel}>Barcode scannen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.emptyAction} onPress={() => onOpenSubflow('ai')}>
              <Text style={styles.emptyActionIcon}>✨</Text>
              <Text style={styles.emptyActionLabel}>KI-Schätzung</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.emptyAction} onPress={() => onOpenSubflow('manual')}>
              <Text style={styles.emptyActionIcon}>✏️</Text>
              <Text style={styles.emptyActionLabel}>Manuell eingeben</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Kein Query — Hinweis */}
      {!hasQuery && !loading ? (
        <Text style={styles.hint}>Gib einen Suchbegriff ein…</Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Action bar
  actionBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnIcon: {
    fontSize: 15,
  },
  actionBtnLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600' as const,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },

  // Result rows
  listContent: {
    paddingBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  rowBody: {
    flex: 1,
  },
  rowNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rowName: {
    ...typography.body1,
    color: colors.text,
    flexShrink: 1,
  },
  warnBadge: {
    fontSize: 14,
    color: colors.negative,
  },
  aiBadge: {
    fontSize: 13,
  },
  rowBrand: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },
  rowMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  rowChevron: {
    fontSize: 20,
    color: colors.textMuted,
  },

  // States
  spinner: {
    marginTop: spacing.lg,
  },
  errorContainer: {
    marginBottom: spacing.sm,
  },
  hint: {
    ...typography.body2,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  emptyTitle: {
    ...typography.body1,
    color: colors.textSecondary,
  },
  emptySubtext: {
    ...typography.caption,
    color: colors.textMuted,
  },
  emptyActions: {
    width: '100%',
    gap: spacing.sm,
  },
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyActionIcon: {
    fontSize: 22,
  },
  emptyActionLabel: {
    ...typography.body1,
    color: colors.text,
  },
});
