// IdleState — Idle-Ansicht des FoodEntryHub.
// Favoriten: Wrap-Grid (max 3 Zeilen) mit KI-Kurznamen
// Recents: vertikale Liste mit Zeitstempel + letzter Menge
// Quick Actions: kompakte Icon-Toolbar (textDisabled)
// Skeleton: animiertes Pulsing (Reanimated)

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
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
import * as Haptics from 'expo-haptics';
import type { UserFoodRelation } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../../app/theme';
import { favoritesApi } from '../../../shared/api/favoritesApi';
import { ErrorBanner } from '../../../shared/components/ErrorBanner';
import { Icon } from '../../../shared/components/Icon';
import { FavoriteChip } from '../../../shared/components/FavoriteChip';

// Maximale Anzahl Favoriten-Chips bevor "→ Alle" erscheint
const MAX_CHIP_ROWS = 3;

interface Props {
  onSelectRelation: (relation: UserFoodRelation) => void;
  onOpenSubflow: (flow: 'barcode' | 'ai' | 'manual') => void;
  /** Callback um „Alle Favoriten“ Modal zu öffnen */
  onOpenAllFavorites?: () => void;
  searchFocused: boolean;
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

function SkeletonRow() {
  return <SkeletonPulse style={styles.skeletonRow} />;
}

// ---------------------------------------------------------------------------
// Thumbnail
// ---------------------------------------------------------------------------

function Thumbnail({ uri, size = 36 }: { uri?: string | null; size?: number }) {
  const [imgError, setImgError] = useState(false);

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
// RecentItem
// ---------------------------------------------------------------------------

function relativeTime(isoDate: string | null): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'heute';
  if (diffDays === 1) return 'gestern';
  if (diffDays < 7) {
    return ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'][d.getDay()] ?? '';
  }
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

function RecentItem({ item, onPress }: { item: UserFoodRelation; onPress: (i: UserFoodRelation) => void }) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(item);
  }, [item, onPress]);

  const timeStr = relativeTime(item.lastUsedAt);
  const amountStr = item.lastInputAmount
    ? item.lastInputMode === 'portion'
      ? `${item.lastInputAmount} Port.`
      : `${Math.round(item.lastInputAmount)} g`
    : '';
  const rightLabel = [amountStr, timeStr].filter(Boolean).join(' · ');

  return (
    <TouchableOpacity
      style={styles.recentRow}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={item.displayName}
    >
      <Thumbnail uri={null} size={36} />
      <View style={styles.recentBody}>
        <Text style={styles.recentName} numberOfLines={1}>{item.displayName}</Text>
        {item.displayBrand ? (
          <Text style={styles.recentBrand} numberOfLines={1}>{item.displayBrand}</Text>
        ) : null}
      </View>
      {rightLabel ? (
        <Text style={styles.recentMeta} numberOfLines={1}>{rightLabel}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// QuickAction
// ---------------------------------------------------------------------------

function QuickAction({ iconEl, label, onPress }: { iconEl: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.quickAction}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      {iconEl}
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// IdleState component
// ---------------------------------------------------------------------------

export function IdleState({ onSelectRelation, onOpenSubflow, onOpenAllFavorites, searchFocused, isOpen, onRequestFocus }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  // Chip-Breite: "Haferflocken" ≈ 110pt, mit Padding + Border = ca. 120pt
  // chipsPerRow bestimmt wie viele Chips nebeneinander passen
  const CHIP_APPROX_WIDTH = 120 + spacing.sm;
  const CHIP_PADDING = spacing.md * 2;
  const chipsPerRow = Math.max(2, Math.floor((screenWidth - CHIP_PADDING) / CHIP_APPROX_WIDTH));
  const maxVisibleChips = chipsPerRow * MAX_CHIP_ROWS;
  const [favorites, setFavorites] = useState<UserFoodRelation[]>([]);
  const [recents, setRecents] = useState<UserFoodRelation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoFocusFired = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [favs, recs] = await Promise.all([
        favoritesApi.listFavorites(),
        favoritesApi.listRecent(10),
      ]);
      setFavorites(favs);
      setRecents(recs);

      // UX-1: Auto-focus search when both lists are empty
      if (!autoFocusFired.current && favs.length === 0 && recs.length === 0) {
        autoFocusFired.current = true;
        setTimeout(() => onRequestFocus?.(), 200);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  // onRequestFocus ist optional und stabil — in deps aufnehmen verhindert stale closure bei UX-1
  }, [onRequestFocus]);

  // Reload every time hub opens
  useEffect(() => {
    if (isOpen) {
      autoFocusFired.current = false;
      load();
    }
  }, [isOpen, load]);

  // Don't render while search is active
  if (searchFocused) return null;

  // Error state
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <ErrorBanner error={error} onRetry={load} />
      </View>
    );
  }

  // Loading skeleton
  if (loading) {
    return (
      <View style={{ gap: spacing.md }}>
        <View style={styles.section}>
          <SkeletonPulse style={styles.skeletonLabel} />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <SkeletonPulse style={styles.skeletonChip} />
            <SkeletonPulse style={styles.skeletonChip} />
            <SkeletonPulse style={styles.skeletonChip} />
          </View>
        </View>
        <View style={styles.section}>
          <SkeletonPulse style={styles.skeletonLabel} />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      </View>
    );
  }

  const hasFavorites = favorites.length > 0;
  const hasRecents = recents.length > 0;

  return (
    <BottomSheetScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Favoriten — horizontale Chips */}
      {hasFavorites && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Favoriten</Text>
          {/* Wrap-Grid: max MAX_CHIP_ROWS Zeilen, danach "Alle" Chip */}
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
                onPress={onOpenAllFavorites}
                accessibilityRole="button"
                accessibilityLabel="Alle Favoriten anzeigen"
              >
                <Text style={styles.chipAllText}>Alle{'\n'}{favorites.length} →</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Recents — vertikale Liste mit Zeitstempel + letzter Menge */}
      {hasRecents && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Zuletzt</Text>
          {recents.map((item) => (
            <RecentItem key={item.id} item={item} onPress={onSelectRelation} />
          ))}
        </View>
      )}

      {/* Quick Actions — sehr zur\u00fcckhaltend, textDisabled */}
      <View style={styles.quickActionsRow}>
        <QuickAction
          iconEl={<Icon lib="mci" name="barcode-scan" size="md" color={colors.textDisabled} />}
          label="Barcode"
          onPress={() => onOpenSubflow('barcode')}
        />
        <QuickAction
          iconEl={<Icon lib="mci" name="auto-fix" size="md" color={colors.textDisabled} />}
          label="KI-Analyse"
          onPress={() => onOpenSubflow('ai')}
        />
        <QuickAction
          iconEl={<Icon lib="feather" name="edit-2" size="md" color={colors.textDisabled} />}
          label="Manuell erfassen"
          onPress={() => onOpenSubflow('manual')}
        />
      </View>

      {!hasFavorites && !hasRecents && (
        <View style={styles.emptyHint}>
          <Text style={styles.emptyText}>Noch keine Einträge</Text>
          <Text style={styles.emptySubText}>
            Suche nach einem Lebensmittel oder nutze eine der Optionen oben.
          </Text>
        </View>
      )}

      <View style={{ height: spacing.xl * 2 }} />
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

  // Favoriten Wrap-Grid — max MAX_CHIP_ROWS Zeilen + optionaler "Alle" Chip
  // Chip-Styling jetzt in shared/components/FavoriteChip.tsx
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chipAll: {
    width: 72,
    backgroundColor: 'transparent',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed' as const,
    padding: spacing.xs + 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 72,
  },
  chipAllText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },

  // Thumbnail (für RecentItem)
  thumbnail: { borderRadius: radius.sm },
  thumbnailFallback: {
    borderRadius: radius.sm,
    backgroundColor: 'rgba(103, 178, 62, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Recents — itemRow-Pattern aus DiaryScreen (kein Card-Hintergrund, nur Divider)
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  recentBody: { flex: 1 },
  recentName: {
    ...typography.body2,
    fontWeight: '600' as const,
    color: colors.text,
  },
  recentBrand: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  recentMeta: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'right',
    maxWidth: 90,
    fontVariant: ['tabular-nums'] as const,
  },

  // Quick Actions Toolbar — sehr zurückhaltend (textDisabled, kein Hintergrund)
  quickActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: 4,
  },
  quickActionLabel: {
    fontSize: 10,
    color: colors.textDisabled,
    fontWeight: '500' as const,
    textAlign: 'center',
  },

  // Skeleton
  skeletonRow: {
    height: 52,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
  },
  skeletonChip: {
    width: 110,
    height: 80,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
  },
  skeletonLabel: {
    height: 10,
    width: 60,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
  },

  // Empty State
  emptyHint: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.body1,
    color: colors.textSecondary,
    fontWeight: '600' as const,
  },
  emptySubText: {
    ...typography.body2,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
