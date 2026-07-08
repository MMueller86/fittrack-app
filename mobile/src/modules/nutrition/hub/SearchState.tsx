// SearchState -- Story 2: Suchergebnisse, 3-Zeilen-Layout, Keyboard-on-Drag.
// MacroAndPortionLine: "251 kcal . EW 8 g . KH 43 g . F 3 g . je 100 g"
// FallbackSection immer als ListFooterComponent sichtbar.
// keyboardDismissMode="on-drag": Tastatur schliesst beim Scrollen.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import type { FoodSearchResult, NutritionValues, PortionInfo, UserFoodRelation } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../../app/theme';
import { foodApi } from '../../../shared/api/foodApi';
import { favoritesApi } from '../../../shared/api/favoritesApi';
import { formatApiError } from '../../../shared/api/apiError';
import { ErrorBanner } from '../../../shared/components/ErrorBanner';
import { Icon } from '../../../shared/components/Icon';
import { RecentItem } from './RecentItem';

interface Props {
  query: string;
  recents: UserFoodRelation[];
  /** Gecachte Ergebnisse aus FoodEntryHub -- verhindert Leerzeile beim Zurueck aus QuantityView */
  initialResults?: FoodSearchResult[];
  onSelect: (item: FoodSearchResult) => void;
  onSelectRelation: (relation: UserFoodRelation) => void;
  onOpenSubflow: (flow: 'barcode' | 'ai' | 'label' | 'manual') => void;
  /** Callback wenn neue Ergebnisse geladen -- fuer Cache-Update in FoodEntryHub */
  onResultsChange?: (results: FoodSearchResult[]) => void;
}

const THUMBNAIL_SIZE = 44;

// ---------------------------------------------------------------------------
// ProductBadge
// ---------------------------------------------------------------------------

type BadgeVariant = 'off' | 'ai' | 'eigen';

function ProductBadge({ label, variant }: { label: string; variant: BadgeVariant }) {
  return (
    <View style={variant === 'eigen' ? styles.badgeEigen : styles.badgeDefault}>
      <Text style={variant === 'eigen' ? styles.badgeTextEigen : styles.badgeTextDefault}>
        {label}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Thumbnail mit Buchstaben-Avatar Fallback
// ---------------------------------------------------------------------------

function Thumbnail({ uri, name }: { uri?: string | null; name: string }) {
  const [imgError, setImgError] = useState(false);
  const letter = name.trim().charAt(0).toUpperCase() || '?';

  if (uri && !imgError) {
    return (
      <Image
        source={{ uri }}
        style={styles.thumbnail}
        resizeMode="cover"
        onError={() => setImgError(true)}
      />
    );
  }
  return (
    <View style={[styles.thumbnail, styles.thumbnailAvatar]}>
      <Text style={styles.thumbnailLetter}>{letter}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// MacroAndPortionLine -- "251 kcal . EW 8 g . KH 43 g . F 3 g . je 100 g"
// Makros und Portionsreferenz in einer Zeile -- kompakteres Layout.
// Nicht rendern wenn keine Kaloriendaten vorhanden.
// ---------------------------------------------------------------------------

function MacroAndPortionLine({
  nutrition,
  nutritionBasis,
  portion,
  isAiEstimate,
}: {
  nutrition?: NutritionValues;
  nutritionBasis: string;
  portion?: PortionInfo;
  isAiEstimate?: boolean;
}) {
  if (!nutrition || nutrition.calories == null) return null;

  const parts: string[] = [`${Math.round(nutrition.calories)} kcal`];
  if (nutrition.protein != null) parts.push(`EW ${Math.round(nutrition.protein)} g`);
  if (nutrition.carbs != null) parts.push(`KH ${Math.round(nutrition.carbs)} g`);
  if (nutrition.fat != null) parts.push(`F ${Math.round(nutrition.fat)} g`);

  // Portionsreferenz ans Ende
  if (!isAiEstimate || portion) {
    if (nutritionBasis === 'per100g' || nutritionBasis === 'both') {
      parts.push('je 100 g');
    } else if (nutritionBasis === 'perPortion' && portion) {
      const portionLabel = portion.weightGrams
        ? `pro ${portion.label} (${Math.round(portion.weightGrams)} g)`
        : `pro ${portion.label}`;
      parts.push(portionLabel);
    }
  }

  return (
    <Text style={styles.macroLine} numberOfLines={1}>{parts.join(' \u00b7 ')}</Text>
  );
}

// ---------------------------------------------------------------------------
// FallbackSection -- immer als ListFooterComponent
// ---------------------------------------------------------------------------

function FallbackSection({
  hasResults,
  query,
  onOpenSubflow,
}: {
  hasResults: boolean;
  query: string;
  onOpenSubflow: (flow: 'barcode' | 'ai' | 'label' | 'manual') => void;
}) {
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
        <TouchableOpacity
          style={[styles.fallbackAction, styles.fallbackActionPrimary]}
          onPress={() => onOpenSubflow('ai')}
          accessibilityRole="button"
          accessibilityLabel="KI-Schaetzung"
        >
          <Icon lib="mci" name="auto-fix" size="md" color={colors.primary} />
          <Text style={[styles.fallbackActionLabel, styles.fallbackActionLabelPrimary]}>KI-Schätzung</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.fallbackAction}
          onPress={() => onOpenSubflow('label')}
          accessibilityRole="button"
          accessibilityLabel="Label scannen"
        >
          <Icon lib="mci" name="text-recognition" size="md" color={colors.textSecondary} />
          <Text style={styles.fallbackActionLabel}>Label scannen</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.fallbackAction}
          onPress={() => onOpenSubflow('manual')}
          accessibilityRole="button"
          accessibilityLabel="Manuell erfassen"
        >
          <Icon lib="feather" name="edit-2" size="md" color={colors.textSecondary} />
          <Text style={styles.fallbackActionLabel}>Manuell</Text>
        </TouchableOpacity>
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

interface ResultRowProps {
  item: FoodSearchResult;
  onPress: (item: FoodSearchResult) => void;
  isFirst?: boolean;
}

const ResultRow = React.memo(function ResultRow({ item, onPress, isFirst }: ResultRowProps) {
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
      setIsFavorite(!next);
    }
  }, [isFavorite, item]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(item);
  }, [item, onPress]);

  const isOFP = item.source === 'openFoodFacts';
  const isPersonal = item.source === 'library' && !item.isAiEstimate;

  return (
    <Pressable
      style={({ pressed }) => [styles.row, isFirst && styles.rowFirst, pressed && styles.rowPressed]}
      onPress={handlePress}
      android_ripple={{ color: colors.surfaceMuted, borderless: false }}
      accessibilityRole="button"
    >
      <Thumbnail uri={item.imageUrl} name={item.name} />

      <View style={styles.rowBody}>
        {/* Zeile 1: Produktname + Herz */}
        <View style={styles.rowLine1}>
          <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
          <TouchableOpacity
            onPress={() => void handleFavoriteToggle()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufuegen'}
          >
            <Icon
              lib="ion"
              name={isFavorite ? 'heart' : 'heart-outline'}
              size="md"
              color={isFavorite ? colors.negative : colors.textMuted}
            />
          </TouchableOpacity>
        </View>

        {/* Zeile 2: Marke + Badges + Warnung */}
        <View style={styles.rowLine2}>
          {item.brand ? (
            <Text style={styles.rowBrand} numberOfLines={1}>{item.brand}</Text>
          ) : null}
          {isOFP ? <ProductBadge label="OFF" variant="off" /> : null}
          {isPersonal ? <ProductBadge label="Eigen" variant="eigen" /> : null}
          {item.isAiEstimate ? <ProductBadge label="KI" variant="ai" /> : null}
          {!item.isComplete ? (
            <Icon lib="feather" name="alert-circle" size="sm" color={colors.neutral} />
          ) : null}
        </View>

        {/* Zeile 3: Makros + Portion (kombiniert) */}
        <MacroAndPortionLine
          nutrition={item.nutritionPer100g}
          nutritionBasis={item.nutritionBasis}
          portion={item.portion}
          isAiEstimate={item.isAiEstimate}
        />
      </View>
    </Pressable>
  );
});

// ---------------------------------------------------------------------------
// SearchState
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 300;

export function SearchState({ query, recents, initialResults, onSelect, onSelectRelation, onOpenSubflow, onResultsChange }: Props) {
  const [results, setResults] = useState<FoodSearchResult[]>(initialResults ?? []);
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
      onResultsChange?.(r);
    } catch (e: unknown) {
      setError(formatApiError(e, 'Suche fehlgeschlagen'));
    } finally {
      setLoading(false);
    }
  }, []);

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
  const showFallback = hasQuery && !loading && !error;

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
          data={results}
          keyExtractor={(item) => `${item.source}-${item.id}`}
          renderItem={({ item, index }) => <ResultRow item={item} onPress={onSelect} isFirst={index === 0} />}
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
              />
            ) : null
          }
        />
      ) : null}

      {!hasQuery && !loading && recents.length > 0 ? (
        <>
          {/* Sticky Label -- scrollt NICHT mit */}
          <Text style={styles.recentsLabel}>Zuletzt hinzugefügt</Text>
          <BottomSheetFlatList
            data={recents}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <RecentItem key={item.id} item={item} onPress={onSelectRelation} isFirst={index === 0} />
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
    paddingVertical: 12,
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

  // Thumbnail -- 48pt mit Buchstaben-Avatar Fallback
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: radius.sm,
    flexShrink: 0,
  },
  thumbnailAvatar: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailLetter: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },

  // Row body
  rowBody: { flex: 1, gap: 3 },

  // Zeile 1: Name + Herz
  rowLine1: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rowName: {
    ...typography.body2,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },

  // Zeile 2: Marke + Badges
  rowLine2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowBrand: {
    ...typography.caption,
    color: colors.textSecondary,
    flexShrink: 1,
  },

  // Badges -- dezenter, nicht dominant
  badgeDefault: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    paddingHorizontal: 5,
    paddingVertical: 2,
    flexShrink: 0,
  },
  badgeTextDefault: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.primary,
    opacity: 0.85,
  },
  badgeEigen: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.full,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 0,
  },
  badgeTextEigen: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textMuted,
  },

  // Zeile 3: Makros + Portion kombiniert
  macroLine: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },

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
    paddingVertical: 12,
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
    fontSize: 10,
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
  recentsLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: colors.textMuted,
    opacity: 0.7,
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
    textTransform: 'uppercase',
  },
});