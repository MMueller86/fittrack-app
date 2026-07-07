// SearchState — Rich Suchergebnisse + sticky CompactActionBar.
// P-5: Produktbild, Typographie-Hierarchie, Inline-Favoriten-Toggle, Source-Badge.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import type { FoodSearchResult } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../../app/theme';
import { foodApi } from '../../../shared/api/foodApi';
import { favoritesApi } from '../../../shared/api/favoritesApi';
import { formatApiError } from '../../../shared/api/apiError';
import { ErrorBanner } from '../../../shared/components/ErrorBanner';
import { Icon } from '../../../shared/components/Icon';

interface Props {
  query: string;
  onSelect: (item: FoodSearchResult) => void;
  onOpenSubflow: (flow: 'barcode' | 'ai' | 'manual') => void;
}

// ---------------------------------------------------------------------------
// Thumbnail
// ---------------------------------------------------------------------------

function Thumbnail({ uri, size = 48 }: { uri?: string | null; size?: number }) {
  const [imgError, setImgError] = React.useState(false);

  if (uri && !imgError) {
    return (
      <Image
        source={{ uri }}
        style={[styles.thumbnail, { width: size, height: size }]}
        resizeMode="cover"
        onError={() => setImgError(true)}
      />
    );
  }
  return (
    <View style={[styles.thumbnailFallback, { width: size, height: size }]}>
      <Icon lib="feather" name="database" size="sm" color={colors.textMuted} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// CompactActionBar — sticky über den Suchergebnissen
// ---------------------------------------------------------------------------

function CompactActionBar({ onOpenSubflow }: { onOpenSubflow: (flow: 'barcode' | 'ai' | 'manual') => void }) {
  return (
    <View style={styles.actionBar}>
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => onOpenSubflow('barcode')}
        accessibilityRole="button"
        accessibilityLabel="Barcode scannen"
      >
        <Icon lib="mci" name="barcode-scan" size="md" color={colors.textDisabled} />
        <Text style={styles.actionBtnLabel}>Barcode</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => onOpenSubflow('ai')}
        accessibilityRole="button"
        accessibilityLabel="KI-Analyse"
      >
        <Icon lib="mci" name="auto-fix" size="md" color={colors.textDisabled} />
        <Text style={styles.actionBtnLabel}>KI-Analyse</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => onOpenSubflow('manual')}
        accessibilityRole="button"
        accessibilityLabel="Manuell erfassen"
      >
        <Icon lib="feather" name="edit-2" size="md" color={colors.textDisabled} />
        <Text style={styles.actionBtnLabel}>Manuell</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Rich ResultRow — Thumbnail + Name/Brand-Hierarchie + Favoriten-Toggle + Source
// ---------------------------------------------------------------------------

function ResultRow({ item, onPress }: { item: FoodSearchResult; onPress: (i: FoodSearchResult) => void }) {
  const [isFavorite, setIsFavorite] = useState(item.isFavorite ?? false);

  const handleFavoriteToggle = useCallback(async () => {
    const next = !isFavorite;
    setIsFavorite(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (next) {
        await favoritesApi.addFavorite({
          foodRef: item.id,
          foodRefType: item.source === 'openFoodFacts' ? 'catalog' : 'personal',
          displayName: item.name,
          displayBrand: item.brand,
          imageUrl: item.imageUrl ?? null,
        });
      } else {
        await favoritesApi.removeFavorite(item.id);
      }
    } catch {
      setIsFavorite(!next); // revert on error
    }
  }, [isFavorite, item]);

  const calories = item.nutritionPer100g?.calories;
  const isOFP = item.source === 'openFoodFacts';

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onPress(item)}
      activeOpacity={0.75}
      accessibilityRole="button"
    >
      {/* Thumbnail */}
      <Thumbnail uri={item.imageUrl} size={48} />

      {/* Body */}
      <View style={styles.rowBody}>
        <View style={styles.rowTopRow}>
          <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
          {/* Inline Favoriten-Toggle */}
          <TouchableOpacity
            onPress={() => void handleFavoriteToggle()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
          >
            <Icon
              lib="ion"
              name={isFavorite ? 'heart' : 'heart-outline'}
              size="md"
              color={isFavorite ? colors.negative : colors.textMuted}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.rowBottomRow}>
          <View style={styles.rowMeta}>
            {item.brand ? (
              <Text style={styles.rowBrand} numberOfLines={1}>{item.brand}</Text>
            ) : null}
            {isOFP ? (
              <Text style={styles.sourceBadge}>OFP</Text>
            ) : null}
            {item.isAiEstimate ? (
              <Icon lib="mci" name="auto-fix" size="sm" color={colors.textMuted} />
            ) : null}
            {!item.isComplete ? (
              <Icon lib="feather" name="alert-circle" size="sm" color={colors.neutral} />
            ) : null}
          </View>
          {calories != null ? (
            <Text style={styles.rowCalories}>{Math.round(calories)} kcal</Text>
          ) : null}
        </View>
      </View>
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
      {/* CompactActionBar — STICKY über den Ergebnissen */}
      <CompactActionBar onOpenSubflow={onOpenSubflow} />
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

      {/* Rich Suchergebnisse */}
      {!loading && !error && hasResults ? (
        <BottomSheetFlatList
          data={results}
          keyExtractor={(item) => `${item.source}-${item.id}`}
          renderItem={({ item }) => <ResultRow item={item} onPress={onSelect} />}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      ) : null}

      {/* Kein Ergebnis — kompakte Quick Actions */}
      {emptyWithQuery ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Kein Treffer für „{query}"</Text>
          <View style={styles.emptyActions}>
            <TouchableOpacity style={styles.emptyAction} onPress={() => onOpenSubflow('barcode')}>
              <Icon lib="mci" name="barcode-scan" size="md" color={colors.textSecondary} />
              <Text style={styles.emptyActionLabel}>Barcode scannen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.emptyAction} onPress={() => onOpenSubflow('ai')}>
              <Icon lib="mci" name="auto-fix" size="md" color={colors.textSecondary} />
              <Text style={styles.emptyActionLabel}>KI-Analyse</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.emptyAction} onPress={() => onOpenSubflow('manual')}>
              <Icon lib="feather" name="edit-2" size="md" color={colors.textSecondary} />
              <Text style={styles.emptyActionLabel}>Manuell erfassen</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

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
  container: { flex: 1 },

  // Action bar — sehr diskret, textDisabled (tertiäre Aktionen)
  actionBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.xs,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  actionBtnLabel: {
    ...typography.caption,
    color: colors.textDisabled,
    fontWeight: '500' as const,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },

  // Rich Result rows — mealCard-Pattern aus DiaryScreen
  listContent: { paddingBottom: spacing.xl * 2 },
  separator: { height: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
    gap: spacing.sm,
  },

  // Thumbnail
  thumbnail: { borderRadius: radius.sm },
  thumbnailFallback: {
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Row body
  rowBody: { flex: 1, gap: 3 },
  rowTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rowName: {
    ...typography.body1,
    fontWeight: '600' as const,
    color: colors.text,
    flex: 1,
  },
  rowBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  rowBrand: {
    ...typography.caption,
    color: colors.textMuted,
  },
  // Source badge — aiBadge-Pattern (primarySoft BG + primary Text)
  sourceBadge: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: '600' as const,
    letterSpacing: 0.3,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden' as const,
  },
  // Kalorien — primary-Farbe (aktive Information), tabular-nums für Ausrichtung
  rowCalories: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600' as const,
    fontVariant: ['tabular-nums'] as const,
  },

  // States
  spinner: { marginTop: spacing.lg },
  errorContainer: { marginBottom: spacing.sm },
  hint: {
    ...typography.body2,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  emptyTitle: {
    ...typography.body1,
    color: colors.textSecondary,
    fontWeight: '600' as const,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  emptyAction: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
  },
  emptyActionLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '500' as const,
    textAlign: 'center',
  },
});
