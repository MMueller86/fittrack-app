// IdleState — Quick Entry redesign.
// Filter pills: "Für dich" (relevance-sorted hero+grid), "Alle", per-meal-type.
// Long-press removal with 5s undo snackbar.
// Animations: Reanimated v3, reduce motion respected.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { UserFoodRelation, MealType } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../../app/theme';
import { favoritesApi } from '../../../shared/api/favoritesApi';
import { ErrorBanner } from '../../../shared/components/ErrorBanner';
import { QuickEntryCard } from '../../../shared/components/QuickEntryCard';
import { Icon } from '../../../shared/components/Icon';
import { useSnackbar, Snackbar } from '../../../shared/components/Snackbar';
import { HeroCard } from './HeroCard';
import { getSuggestedMealType } from './mealTimeRules';
import { computeRelevanceOrder } from './quickEntryRelevance';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  onSelectRelation: (relation: UserFoodRelation) => void;
  onOpenAllFavorites?: () => void;  // preserved but unused — no breaking change
  isOpen: boolean;
  onRequestFocus?: () => void;
  mealType?: MealType;
  mealId?: string;
  onDirectAdd?: (productName: string, mealId: string, itemId: string) => void;
}

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

type FilterKey = 'fuerDich' | 'alle' | MealType;

const FILTER_PILLS: Array<{ key: FilterKey; label: string }> = [
  { key: 'fuerDich',    label: 'Für dich' },
  { key: 'alle',        label: 'Alle' },
  { key: 'breakfast',   label: '☀️ Frühstück' },
  { key: 'lunch',       label: '🌤️ Mittagessen' },
  { key: 'dinner',      label: '🌙 Abendessen' },
  { key: 'snack',       label: '🍎 Snack' },
  { key: 'preworkout',  label: '⚡ Pre Workout' },
  { key: 'postworkout', label: '💪 Post Workout' },
];

// ---------------------------------------------------------------------------
// Greeting helpers
// ---------------------------------------------------------------------------

function computeGreeting(mealType: MealType): string {
  switch (mealType) {
    case 'breakfast':   return 'Guten Morgen ☀️ — was kommt heute ans Frühstück?';
    case 'lunch':       return 'Mittagszeit 🌤️ — deine Favoriten fürs Mittagessen';
    case 'dinner':      return 'Abendessen 🌙 — was wird es heute?';
    case 'preworkout':  return '⚡ Bereit fürs Training?';
    case 'postworkout': return '💪 Post-Workout — Zeit für Regeneration';
    default:            return 'Dein persönlicher Schnellzugriff';
  }
}

function getDisplayGreeting(filter: FilterKey, sessionGreeting: string): string {
  if (filter === 'fuerDich') return sessionGreeting;
  if (filter === 'alle') return 'Alle Quick-Entry-Einträge';
  const pill = FILTER_PILLS.find(p => p.key === filter);
  return pill ? `Deine ${pill.label}-Favoriten` : sessionGreeting;
}

// ---------------------------------------------------------------------------
// Skeleton helpers
// ---------------------------------------------------------------------------

function SkeletonPulse({ style }: { style: object }) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[style, animStyle]} />;
}

function LoadingSkeleton({ cardWidth, cardHeight }: { cardWidth: number; cardHeight: number }) {
  return (
    <View style={styles.skeletonContainer}>
      {[0, 1].map(rowIdx => (
        <View key={rowIdx} style={styles.skeletonRow}>
          <SkeletonPulse style={[styles.skeletonTile, { width: cardWidth, height: cardHeight }]} />
          <SkeletonPulse style={[styles.skeletonTile, { width: cardWidth, height: cardHeight }]} />
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <View style={emptyStyles.container}>
      <Text style={emptyStyles.icon}>❤️</Text>
      <Text style={emptyStyles.title}>Dein Schnellzugriff wächst mit</Text>
      <Text style={emptyStyles.body}>
        Markiere Lebensmittel oder Rezepte mit ❤️ als Quick Entry. Sie erscheinen
        anschließend automatisch hier und machen dein Ernährungstagebuch jeden Tag
        ein Stück schneller.
      </Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.md,
    marginHorizontal: spacing.xs,
    marginTop: spacing.md,
  },
  icon: { fontSize: 48, opacity: 0.6 },
  title: { ...typography.h3, color: colors.text, textAlign: 'center' },
  body: {
    ...typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

// ---------------------------------------------------------------------------
// AddMoreCTA
// ---------------------------------------------------------------------------

function AddMoreCTA({
  cardWidth,
  onPress,
}: {
  cardWidth: number;
  onPress: () => void;
}) {
  const cardHeight = Math.round(cardWidth * 1.25);
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.addMoreCta, { width: cardWidth, height: cardHeight }]}
      accessibilityRole="button"
      accessibilityLabel="Mehr hinzufügen"
    >
      <Icon lib="feather" name="plus" size={20} color={colors.textMuted} />
      <Text style={styles.addMoreText}>Mehr{'\n'}hinzufügen</Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// IdleState
// ---------------------------------------------------------------------------

export function IdleState({
  onSelectRelation,
  onOpenAllFavorites: _onOpenAllFavorites,
  isOpen,
  onRequestFocus,
  mealType,
  mealId,
  onDirectAdd,
}: Props) {
  const [allFavorites, setAllFavorites] = useState<UserFoodRelation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('fuerDich');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);

  // Refs for session stability
  const sessionOrderRef = useRef<UserFoodRelation[] | null>(null);
  const sessionGreetingRef = useRef<string>('Dein persönlicher Schnellzugriff');
  const initialAnimDone = useRef(false);
  const [shouldAnimate, setShouldAnimate] = useState(false);

  // Removal state
  const removedItemRef = useRef<UserFoodRelation | null>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { ref: snackbarRef, show: showSnackbar } = useSnackbar();
  const reducedMotion = useReducedMotion();

  // Window dimensions
  const { width: windowWidth } = useWindowDimensions();
  const COLUMNS = 2;
  const OUTER_PAD = spacing.md;
  const CARD_GAP = spacing.sm;
  const cardWidth = Math.floor((windowWidth - OUTER_PAD * 2 - CARD_GAP * (COLUMNS - 1)) / COLUMNS);
  const cardHeight = Math.round(cardWidth * 1.25);

  // Effective context meal type
  const effectiveMealType: MealType = mealType ?? getSuggestedMealType();

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await favoritesApi.listFavorites();
      setAllFavorites(data);
      if (sessionOrderRef.current === null) {
        sessionOrderRef.current = computeRelevanceOrder(data, effectiveMealType);
        sessionGreetingRef.current = computeGreeting(effectiveMealType);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }, [effectiveMealType]);

  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen, load]);

  // Reset session on close
  useEffect(() => {
    if (!isOpen) {
      sessionOrderRef.current = null;
      initialAnimDone.current = false;
    }
  }, [isOpen]);

  // Filter reset on open
  useEffect(() => {
    if (isOpen) {
      setActiveFilter('fuerDich');
    }
  }, [isOpen]);

  // Flush pending removal on unmount
  useEffect(() => {
    return () => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
        const item = removedItemRef.current;
        if (item) void favoritesApi.removeFavorite(item.foodRef).catch(() => {});
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Stagger animation trigger
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (allFavorites.length > 0 && !initialAnimDone.current) {
      setShouldAnimate(true);
      const maxDelay = 60 + Math.min(allFavorites.length * 40, 280) + 200;
      const timer = setTimeout(() => {
        initialAnimDone.current = true;
        setShouldAnimate(false);
      }, maxDelay);
      return () => clearTimeout(timer);
    }
  }, [allFavorites]);

  // ---------------------------------------------------------------------------
  // Long-press removal
  // ---------------------------------------------------------------------------

  const handleLongPress = useCallback((item: UserFoodRelation) => {
    // Flush previous
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
      const prev = removedItemRef.current;
      if (prev) void favoritesApi.removeFavorite(prev.foodRef).catch(() => {});
      removedItemRef.current = null;
    }
    // Optimistic remove from session order
    if (sessionOrderRef.current) {
      sessionOrderRef.current = sessionOrderRef.current.filter(r => r.id !== item.id);
    }
    setAllFavorites(prev => prev.filter(r => r.id !== item.id));
    removedItemRef.current = item;

    showSnackbar({
      message: 'Quick Entry entfernt',
      undoLabel: 'Rückgängig',
      onUndo: () => {
        if (pendingTimerRef.current) {
          clearTimeout(pendingTimerRef.current);
          pendingTimerRef.current = null;
        }
        removedItemRef.current = null;
        void load();
      },
      durationMs: 5000,
    });

    pendingTimerRef.current = setTimeout(() => {
      pendingTimerRef.current = null;
      const toRemove = removedItemRef.current;
      removedItemRef.current = null;
      if (toRemove) void favoritesApi.removeFavorite(toRemove.foodRef).catch(() => {});
    }, 5000);
  }, [showSnackbar, load]);

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const ordered = sessionOrderRef.current ?? allFavorites;

  const filteredItems = useMemo(() => {
    if (activeFilter === 'fuerDich' || activeFilter === 'alle') return ordered;
    return ordered.filter(
      item => (item.mealTypeCounts?.[activeFilter as MealType] ?? 0) > 0,
    );
  }, [activeFilter, ordered]);

  const visiblePills = useMemo(() => {
    const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'preworkout', 'postworkout'];
    const withUsage = new Set(
      ordered.flatMap(item =>
        mealTypes.filter(m => (item.mealTypeCounts?.[m] ?? 0) > 0),
      ),
    );
    return FILTER_PILLS.filter(p =>
      p.key === 'fuerDich' || p.key === 'alle' || withUsage.has(p.key as MealType),
    );
  }, [ordered]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const isFuerDich = activeFilter === 'fuerDich';
  const heroItem = isFuerDich && filteredItems.length > 0 ? filteredItems[0]! : null;
  const gridItems = isFuerDich ? filteredItems.slice(1) : filteredItems;
  const showAddMoreCTA = gridItems.length % 2 !== 0;

  // ---------------------------------------------------------------------------
  // Guard: loading + error + empty
  // ---------------------------------------------------------------------------

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <ErrorBanner error={error} onRetry={load} />
      </View>
    );
  }

  if (loading && allFavorites.length === 0) {
    return <LoadingSkeleton cardWidth={cardWidth} cardHeight={cardHeight} />;
  }

  if (!loading && allFavorites.length === 0) {
    return (
      <View style={styles.flex}>
        <EmptyState />
        <Snackbar ref={snackbarRef} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <BottomSheetScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Greeting row with inline filter pill */}
        <View style={styles.greetingRow}>
          <Text style={styles.greetingText} numberOfLines={2}>
            {sessionGreetingRef.current}
          </Text>
          <TouchableOpacity
            style={styles.filterPill}
            onPress={() => { Haptics.selectionAsync(); setFilterDropdownOpen(true); }}
            accessibilityRole="button"
            accessibilityLabel={`Filter: ${FILTER_PILLS.find(p => p.key === activeFilter)?.label ?? 'Für dich'}`}
          >
            <Text style={styles.filterPillText} numberOfLines={1}>
              {FILTER_PILLS.find(p => p.key === activeFilter)?.label ?? 'Für dich'}
            </Text>
            <Icon lib="feather" name="chevron-down" size={11} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Filter selection modal */}
        <Modal
          visible={filterDropdownOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setFilterDropdownOpen(false)}
        >
          <TouchableWithoutFeedback onPress={() => setFilterDropdownOpen(false)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.filterModal}>
                  <Text style={styles.filterModalTitle}>Ansicht wählen</Text>
                  {visiblePills.map(pill => (
                    <TouchableOpacity
                      key={pill.key}
                      style={styles.filterModalItem}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setActiveFilter(pill.key);
                        setFilterDropdownOpen(false);
                      }}
                    >
                      <Text style={[
                        styles.filterModalItemText,
                        activeFilter === pill.key && styles.filterModalItemTextActive,
                      ]}>
                        {pill.label}
                      </Text>
                      {activeFilter === pill.key && (
                        <Icon lib="feather" name="check" size={14} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Hero card (Für dich only) */}
        {heroItem != null && (
          <HeroCard
            relation={heroItem}
            contextMealType={effectiveMealType}
            mealId={mealId}
            onPress={() => onSelectRelation(heroItem)}
            onLongPress={() => handleLongPress(heroItem)}
            onDirectAdd={onDirectAdd}
            animate={shouldAnimate}
          />
        )}

        {/* 2-column grid */}
        <View style={styles.gridContainer}>
          {Array.from({ length: Math.ceil(gridItems.length / 2) }, (_, rowIdx) => {
            const left = gridItems[rowIdx * 2]!;
            const right = gridItems[rowIdx * 2 + 1];
            const isLastRow = rowIdx === Math.ceil(gridItems.length / 2) - 1;

            return (
              <View key={rowIdx} style={styles.gridRow}>
                <QuickEntryCard
                  key={left.id}
                  displayName={left.displayName}
                  shortName={left.shortName}
                  imageUrl={left.imageUrl}
                  foodRefType={left.foodRefType}
                  usageCount={left.usageCount}
                  favoritedAt={left.favoritedAt}
                  cardWidth={cardWidth}
                  animIndex={shouldAnimate ? rowIdx * 2 : undefined}
                  onPress={() => onSelectRelation(left)}
                  onLongPress={() => handleLongPress(left)}
                />
                {right != null ? (
                  <QuickEntryCard
                    key={right.id}
                    displayName={right.displayName}
                    shortName={right.shortName}
                    imageUrl={right.imageUrl}
                    foodRefType={right.foodRefType}
                    usageCount={right.usageCount}
                    favoritedAt={right.favoritedAt}
                    cardWidth={cardWidth}
                    animIndex={shouldAnimate ? rowIdx * 2 + 1 : undefined}
                    onPress={() => onSelectRelation(right)}
                    onLongPress={() => handleLongPress(right)}
                  />
                ) : showAddMoreCTA && isLastRow ? (
                  <AddMoreCTA cardWidth={cardWidth} onPress={() => onRequestFocus?.()} />
                ) : (
                  <View style={{ width: cardWidth }} />
                )}
              </View>
            );
          })}
        </View>
      </BottomSheetScrollView>
      <Snackbar ref={snackbarRef} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  errorContainer: { marginTop: spacing.sm },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  greetingText: {
    ...typography.body2,
    color: colors.textSecondary,
    flex: 1,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    flexShrink: 0,
  },
  filterPillText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.primary,
    maxWidth: 90,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  filterModal: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  filterModalTitle: {
    ...typography.overline,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  filterModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  filterModalItemText: {
    ...typography.body2,
    color: colors.text,
  },
  filterModalItemTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  gridContainer: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  gridRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  addMoreCta: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  addMoreText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  skeletonContainer: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  skeletonTile: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
  },
});
