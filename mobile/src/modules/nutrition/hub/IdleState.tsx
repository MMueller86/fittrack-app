// IdleState — Idle-Ansicht des FoodEntryHub.
// Zeigt ausschließlich Schnellzugriff (Favoriten-Chips, max 4 Zeilen).
// Recents und Quick Actions sind in dieser Story entfernt worden.
// Bei leeren Favoriten: Auto-Focus auf das Suchfeld.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import type { UserFoodRelation } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../../app/theme';
import { favoritesApi } from '../../../shared/api/favoritesApi';
import { ErrorBanner } from '../../../shared/components/ErrorBanner';
import { FavoriteChip } from '../../../shared/components/FavoriteChip';

// Maximale Anzahl Favoriten-Chips bevor "→ Alle" erscheint
const MAX_CHIP_ROWS = 4;

interface Props {
  onSelectRelation: (relation: UserFoodRelation) => void;
  /** Callback um „Alle Favoriten" Modal zu öffnen */
  onOpenAllFavorites?: () => void;
  isOpen: boolean;
  onRequestFocus?: () => void;
}

// ---------------------------------------------------------------------------
// Skeleton helpers — animiertes Pulsing statt statischer grauer Boxen
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

// ---------------------------------------------------------------------------
// IdleState component
// ---------------------------------------------------------------------------

export function IdleState({ onSelectRelation, onOpenAllFavorites, isOpen, onRequestFocus }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const CHIP_APPROX_WIDTH = 120 + spacing.sm;
  const CHIP_PADDING = spacing.md * 2;
  const chipsPerRow = Math.max(2, Math.floor((screenWidth - CHIP_PADDING) / CHIP_APPROX_WIDTH));
  const maxVisibleChips = chipsPerRow * MAX_CHIP_ROWS;
  const [favorites, setFavorites] = useState<UserFoodRelation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoFocusFired = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const favs = await favoritesApi.listFavorites();
      setFavorites(favs);
      // Auto-focus: wenn keine Favoriten vorhanden, direkt Tastatur öffnen
      if (!autoFocusFired.current && favs.length === 0) {
        autoFocusFired.current = true;
        setTimeout(() => onRequestFocus?.(), 200);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }, [onRequestFocus]);

  useEffect(() => {
    if (isOpen) {
      autoFocusFired.current = false;
      load();
    }
  }, [isOpen, load]);

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <ErrorBanner error={error} onRetry={load} />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.skeletonContainer}>
        <SkeletonPulse style={styles.skeletonLabel} />
        <View style={styles.skeletonChipsRow}>
          <SkeletonPulse style={styles.skeletonChip} />
          <SkeletonPulse style={styles.skeletonChip} />
          <SkeletonPulse style={styles.skeletonChip} />
        </View>
      </View>
    );
  }

  const hasFavorites = favorites.length > 0;

  return (
    <BottomSheetScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {hasFavorites && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Schnellzugriff</Text>
          <View style={styles.chipsGrid}>
            {favorites.slice(0, maxVisibleChips).map((item) => (
              <FavoriteChip
                key={item.id}
                displayName={item.displayName}
                shortName={item.shortName}
                imageUrl={item.imageUrl ?? null}
                onPress={() => onSelectRelation(item)}
                accessibilityLabel={item.shortName ?? item.displayName}
              />
            ))}
            {favorites.length > maxVisibleChips && (
              <TouchableOpacity
                style={styles.chipAll}
                onPress={() => onOpenAllFavorites?.()}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Alle ${favorites.length} Favoriten anzeigen`}
              >
                <Text style={styles.chipAllCount}>{favorites.length - maxVisibleChips}+</Text>
                <Text style={styles.chipAllLabel}>Alle</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
      <View style={{ height: spacing.xl }} />
    </BottomSheetScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.lg, gap: spacing.md },
  errorContainer: { marginTop: spacing.sm },

  section: { gap: spacing.xs },
  sectionLabel: {
    ...typography.overline,
    color: colors.textMuted,
    paddingHorizontal: spacing.xs,
    paddingBottom: 2,
  },

  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  // "Alle"-Chip — selber Stil wie FavoriteChip, aber mit Badge-Zahl + Label
  chipAll: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  chipAllCount: {
    ...typography.caption,
    fontWeight: '700' as const,
    color: colors.primary,
    minWidth: 20,
    textAlign: 'center',
  },
  chipAllLabel: {
    ...typography.caption,
    fontWeight: '600' as const,
    color: colors.textSecondary,
  },

  // Skeleton
  skeletonContainer: { gap: spacing.md, paddingTop: spacing.sm },
  skeletonChipsRow: { flexDirection: 'row', gap: spacing.sm },
  skeletonChip: {
    width: 110,
    height: 80,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
  },
  skeletonLabel: {
    height: 10,
    width: 80,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
  },
});
