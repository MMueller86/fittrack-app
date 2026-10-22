// SearchState -- Story 2: Suchergebnisse, 3-Zeilen-Layout, Keyboard-on-Drag.
// Zeilenaufbau (Thumbnail 52 pt, Nährwertzeile) kommt aus shared/components/FoodProductSummary.
// FallbackSection immer als ListFooterComponent sichtbar.
// keyboardDismissMode="on-drag": Tastatur schliesst beim Scrollen.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import type { FoodSearchResult, UserFoodRelation } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../../app/theme';
import { foodApi } from '../../../shared/api/foodApi';
import { favoritesApi } from '../../../shared/api/favoritesApi';
import { formatApiError } from '../../../shared/api/apiError';
import { ErrorBanner } from '../../../shared/components/ErrorBanner';
import { Icon } from '../../../shared/components/Icon';
import { FoodProductSummary, type FoodProductBadge } from '../../../shared/components/FoodProductSummary';
import { isRemoteImageUri } from '../../../shared/components/foodProductSummaryUtils';
import { RelationRow } from './RelationRow';

interface Props {
  query: string;
  recents: UserFoodRelation[];
  /** Gecachte Ergebnisse aus FoodEntryHub -- verhindert Leerzeile beim Zurueck aus QuantityView */
  initialResults?: FoodSearchResult[];
  initialResultsQuery?: string;
  onSelect: (item: FoodSearchResult) => void;
  onSelectRelation: (relation: UserFoodRelation) => void;
  onOpenSubflow: (flow: 'barcode' | 'ai' | 'label' | 'manual') => void;
  allowedSubflows?: ReadonlyArray<'barcode' | 'ai' | 'label' | 'manual'>;
  /** Callback wenn neue Ergebnisse geladen -- fuer Cache-Update in FoodEntryHub */
  onResultsChange?: (results: FoodSearchResult[], query: string) => void;
  /** Recipe mode: label for the quick-accept pill on each ResultRow */
  quickAcceptLabel?: string;
  /** Recipe mode: called when user taps the quick-accept pill */
  onQuickAccept?: (product: FoodSearchResult) => void;
}

// ---------------------------------------------------------------------------
// Herkunfts-Badges (Zeile 2 des geteilten FoodProductSummary)
// ---------------------------------------------------------------------------

function resultBadges(item: FoodSearchResult): FoodProductBadge[] {
  const badges: FoodProductBadge[] = [];
  if (item.source === 'openFoodFacts') badges.push({ label: 'OFF', tone: 'accent' });
  if (item.source === 'library' && !item.isAiEstimate) badges.push({ label: 'Eigen', tone: 'neutral' });
  if (item.isAiEstimate) badges.push({ label: 'KI', tone: 'accent' });
  return badges;
}

// ---------------------------------------------------------------------------
// FallbackSection -- immer als ListFooterComponent
// ---------------------------------------------------------------------------

function FallbackSection({
  hasResults,
  query,
  onOpenSubflow,
  allowedSubflows,
}: {
  hasResults: boolean;
  query: string;
  onOpenSubflow: (flow: 'barcode' | 'ai' | 'label' | 'manual') => void;
  allowedSubflows: ReadonlyArray<'barcode' | 'ai' | 'label' | 'manual'>;
}) {
  const canUseAi = allowedSubflows.includes('ai');
  const canUseLabel = allowedSubflows.includes('label');
  const canUseManual = allowedSubflows.includes('manual');

  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackTitle}>
        {hasResults ? 'Nicht das passende dabei?' : `Kein Treffer fuer "${query}"`}
      </Text>
      {!hasResults ? (
        <Text style={styles.fallbackSubtitle}>Wir haben ein paar andere Ideen:</Text>
      ) : null}
      <View style={styles.fallbackActions}>
        {/* KI als bevorzugter Workflow — primary hervorgehoben */}
        {canUseAi ? (
          <TouchableOpacity
            style={[styles.fallbackAction, styles.fallbackActionPrimary]}
            onPress={() => onOpenSubflow('ai')}
            accessibilityRole="button"
            accessibilityLabel="KI-Schaetzung"
          >
            <Icon lib="mci" name="auto-fix" size="md" color={colors.primary} />
            <Text style={[styles.fallbackActionLabel, styles.fallbackActionLabelPrimary]}>KI-Schätzung</Text>
          </TouchableOpacity>
        ) : null}
        {canUseLabel ? (
          <TouchableOpacity
            style={styles.fallbackAction}
            onPress={() => onOpenSubflow('label')}
            accessibilityRole="button"
            accessibilityLabel="Label scannen"
          >
            <Icon lib="mci" name="text-recognition" size="md" color={colors.textSecondary} />
            <Text style={styles.fallbackActionLabel}>Label scannen</Text>
          </TouchableOpacity>
        ) : null}
        {canUseManual ? (
          <TouchableOpacity
            style={styles.fallbackAction}
            onPress={() => onOpenSubflow('manual')}
            accessibilityRole="button"
            accessibilityLabel="Manuell erfassen"
          >
            <Icon lib="feather" name="edit-2" size="md" color={colors.textSecondary} />
            <Text style={styles.fallbackActionLabel}>Manuell</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ResultRow -- 3 Zeilen, React.memo
// Zeile 1: Produktname + Herz
// Zeile 2: Marke + Badges
// Zeile 3: Makros + Portionsreferenz (kombiniert)
// ---------------------------------------------------------------------------

export interface ResultRowProps {
  item: FoodSearchResult;
  onPress: (item: FoodSearchResult) => void;
  isFirst?: boolean;
  /** Recipe mode: label shown on the quick-accept pill */
  quickAcceptLabel?: string;
  /** Recipe mode: called when user taps the quick-accept pill */
  onQuickAccept?: (product: FoodSearchResult) => void;
}

export const ResultRow = React.memo(function ResultRow({ item, onPress, isFirst, quickAcceptLabel, onQuickAccept }: ResultRowProps) {
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
          // Blob-Pfade eigener Produkte sind keine URL; das Backend lehnt sie ab (z.string().url()).
          imageUrl: isRemoteImageUri(item.imageUrl) ? item.imageUrl : null,
          nutritionPer100g: item.nutritionPer100g,
          portion: item.portion ?? null,
        });
      } else {
        await favoritesApi.removeFavorite(item.id);
      }
    } catch {
      setIsFavorite(!next);
    }
  }, [isFavorite, item]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(item);
  }, [item, onPress]);

  return (
    <Pressable
      style={({ pressed }) => [styles.row, isFirst && styles.rowFirst, pressed && styles.rowPressed]}
      onPress={handlePress}
      android_ripple={{ color: colors.surfaceMuted, borderless: false }}
      accessibilityRole="button"
    >
      <FoodProductSummary
        name={item.name}
        brand={item.brand}
        imageUri={item.imageUrl}
        badges={resultBadges(item)}
        incomplete={!item.isComplete}
        nutrition={item.nutritionPer100g}
        nutritionBasis={item.nutritionBasis}
        portion={item.portion}
        isAiEstimate={item.isAiEstimate}
        trailing={
          <TouchableOpacity
            onPress={() => void handleFavoriteToggle()}
            hitSlop={{ top: spacing.sm, bottom: spacing.sm, left: spacing.sm, right: spacing.sm }}
            accessibilityLabel={isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufuegen'}
          >
            <Icon
              lib="ion"
              name={isFavorite ? 'heart' : 'heart-outline'}
              size="md"
              color={isFavorite ? colors.negative : colors.textMuted}
            />
          </TouchableOpacity>
        }
        footer={
          quickAcceptLabel && onQuickAccept ? (
            <View style={styles.rowLineQuickAccept}>
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                style={styles.quickAcceptPill}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onQuickAccept(item); }}
                hitSlop={{ top: spacing.xs, bottom: spacing.xs, left: spacing.xs, right: spacing.xs }}
                accessibilityRole="button"
                accessibilityLabel={`Sofort hinzufügen: ${quickAcceptLabel}`}
              >
                <Icon lib="feather" name="plus" size="sm" color={colors.primary} />
                <Text style={styles.quickAcceptText}>{quickAcceptLabel}</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />
    </Pressable>
  );
});

// ---------------------------------------------------------------------------
// SearchState
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 500;

// ---------------------------------------------------------------------------
// Relative usage helper
// ---------------------------------------------------------------------------

function relativeUsage(isoDate: string): string {
  const days = Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000);
  if (days === 0) return 'Heute verwendet';
  if (days === 1) return 'Gestern verwendet';
  if (days < 7) return `Vor ${days} Tagen verwendet`;
  if (days < 14) return 'Vor einer Woche verwendet';
  return `Vor ${Math.floor(days / 7)} Wochen verwendet`;
}

export function SearchState({ query, recents, initialResults, initialResultsQuery, onSelect, onSelectRelation, onOpenSubflow, allowedSubflows = ['barcode', 'ai', 'label', 'manual'], onResultsChange, quickAcceptLabel, onQuickAccept }: Props) {
  const hasMatchingCache = initialResultsQuery === query.trim();
  const [results, setResults] = useState<FoodSearchResult[]>(hasMatchingCache ? initialResults ?? [] : []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchedQuery, setSearchedQuery] = useState(hasMatchingCache ? query.trim() : '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestIdRef = useRef(0);

  const doSearch = useCallback(async (q: string) => {
    const requestId = ++searchRequestIdRef.current;
    const normalizedQuery = q.trim();
    if (normalizedQuery.length === 0) {
      setResults([]);
      setError(null);
      setSearchedQuery('');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { results: r } = await foodApi.search(normalizedQuery);
      if (requestId !== searchRequestIdRef.current) return;
      setResults(r);
      setSearchedQuery(normalizedQuery);
      onResultsChange?.(r, normalizedQuery);
    } catch (e: unknown) {
      if (requestId !== searchRequestIdRef.current) return;
      setError(formatApiError(e, 'Suche fehlgeschlagen'));
    } finally {
      if (requestId === searchRequestIdRef.current) setLoading(false);
    }
  }, [onResultsChange]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    searchRequestIdRef.current += 1;
    const normalizedQuery = query.trim();
    if (initialResultsQuery === normalizedQuery) {
      setResults(initialResults ?? []);
      setSearchedQuery(normalizedQuery);
      setError(null);
      setLoading(false);
      return () => { searchRequestIdRef.current += 1; };
    }

    setError(null);
    setLoading(false);
    if (normalizedQuery.length === 0) {
      setResults([]);
      setSearchedQuery('');
      return () => { searchRequestIdRef.current += 1; };
    }

    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void doSearch(query);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      searchRequestIdRef.current += 1;
    };
  }, [query, doSearch, initialResults, initialResultsQuery]);

  const hasQuery = query.trim().length > 0;
  const resultsMatchQuery = searchedQuery === query.trim();
  const visibleResults = resultsMatchQuery ? results : [];
  const hasResults = visibleResults.length > 0;
  const showFallback = hasQuery && resultsMatchQuery && !loading && !error;

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.errorContainer}>
          <ErrorBanner error={error} onRetry={() => void doSearch(query)} />
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.spinner} />
      ) : null}

      {!loading && !error && hasQuery ? (
        <BottomSheetFlatList
          data={visibleResults}
          keyExtractor={(item) => `${item.source}-${item.id}`}
          renderItem={({ item, index }) => <ResultRow item={item} onPress={onSelect} isFirst={index === 0} quickAcceptLabel={quickAcceptLabel} onQuickAccept={onQuickAccept} />}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          nestedScrollEnabled={true}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            showFallback ? (
              <FallbackSection
                hasResults={hasResults}
                query={searchedQuery || query}
                onOpenSubflow={onOpenSubflow}
                allowedSubflows={allowedSubflows}
              />
            ) : null
          }
        />
      ) : null}

      {!hasQuery && !loading && recents.length > 0 ? (
        <>
          <BottomSheetFlatList
            data={recents}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <RelationRow
                key={item.id}
                relation={item}
                onPress={() => onSelectRelation(item)}
                isFirst={index === 0}
                getSecondaryText={(r) => r.lastUsedAt ? relativeUsage(r.lastUsedAt) : null}
              />
            )}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.recentsListContent}
          />
        </>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingBottom: spacing.lg },

  // Row -- Separator-Liste
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  rowFirst: {
    borderTopWidth: 0,
  },

  // Thumbnail/Name/Marke/Badges/Nährwerte: shared/components/FoodProductSummary

  // States
  spinner: { marginTop: spacing.lg },
  errorContainer: { marginBottom: spacing.sm },

  // FallbackSection -- konsistente Sprache mit Row-Separatoren
  fallback: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
  },
  fallbackDivider: {
    height: 0,
  },
  fallbackTitle: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  fallbackSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  fallbackActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  fallbackAction: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fallbackActionPrimary: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fallbackActionLabel: {
    fontSize: typography.overline.fontSize,
    color: colors.textMuted,
    fontWeight: '500',
    textAlign: 'center',
  },
  fallbackActionLabelPrimary: {
    color: colors.primary,
    fontWeight: '600',
  },

  // Recents -- via BottomSheetFlatList (gleiche Gesture-Integration wie Suchergebnisse)
  recentsListContent: { paddingBottom: spacing.xl },

  // Rezept-Modus: Schnellauswahl-Pill (visuell identisch zu RelationRow directAddPill)
  rowLineQuickAccept: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickAcceptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  quickAcceptText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.primary,
  },
});