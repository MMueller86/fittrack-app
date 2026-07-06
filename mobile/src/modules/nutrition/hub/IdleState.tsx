// IdleState — Idle-Ansicht des FoodEntryHub.
// Zeigt Favoriten + Recents (wenn vorhanden), sonst Quick-Actions.
// Skeleton während des Ladens, ErrorBanner bei Fehler.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import type { UserFoodRelation, FoodSearchResult } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../../app/theme';
import { favoritesApi } from '../../../shared/api/favoritesApi';
import { ErrorBanner } from '../../../shared/components/ErrorBanner';

interface Props {
  /** Called when user taps a favorite or recent item */
  onSelectRelation: (relation: UserFoodRelation) => void;
  /** Called when user taps Barcode / KI / Manuell */
  onOpenSubflow: (flow: 'barcode' | 'ai' | 'manual') => void;
  /** Search field is focused — hide idle content */
  searchFocused: boolean;
  /** Hub just opened — trigger data load */
  isOpen: boolean;
  /** Auto-focus search when both favorites and recents are empty */
  onRequestFocus?: () => void;
}

// ---------------------------------------------------------------------------
// Skeleton helpers
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return <View style={styles.skeletonRow} />;
}

function SkeletonSection() {
  return (
    <View style={styles.section}>
      <View style={styles.skeletonLabel} />
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Single food-relation row
// ---------------------------------------------------------------------------

interface RelationRowProps {
  item: UserFoodRelation;
  onPress: (item: UserFoodRelation) => void;
}

function RelationRow({ item, onPress }: RelationRowProps) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(item);
  }, [item, onPress]);

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={item.displayName}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={1}>{item.displayName}</Text>
        {item.displayBrand ? (
          <Text style={styles.rowBrand} numberOfLines={1}>{item.displayBrand}</Text>
        ) : null}
      </View>
      <Text style={styles.rowChevron}>›</Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Quick-Action button
// ---------------------------------------------------------------------------

interface QuickActionProps {
  icon: string;
  label: string;
  onPress: () => void;
}

function QuickAction({ icon, label, onPress }: QuickActionProps) {
  return (
    <TouchableOpacity
      style={styles.quickAction}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      <Text style={styles.quickActionIcon}>{icon}</Text>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// IdleState component
// ---------------------------------------------------------------------------

export function IdleState({ onSelectRelation, onOpenSubflow, searchFocused, isOpen, onRequestFocus }: Props) {
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
  }, []);

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
      <>
        <SkeletonSection />
        <SkeletonSection />
      </>
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
      {/* Favorites */}
      {hasFavorites && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Favoriten</Text>
          {favorites.map((item) => (
            <RelationRow key={item.id} item={item} onPress={onSelectRelation} />
          ))}
        </View>
      )}

      {/* Recents */}
      {hasRecents && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Zuletzt</Text>
          {recents.map((item) => (
            <RelationRow key={item.id} item={item} onPress={onSelectRelation} />
          ))}
        </View>
      )}

      {/* Quick Actions — immer sichtbar */}
      <View style={styles.section}>
        <View style={styles.quickActions}>
          <QuickAction icon="📷" label="Barcode" onPress={() => onOpenSubflow('barcode')} />
          <QuickAction icon="✨" label="KI-Analyse" onPress={() => onOpenSubflow('ai')} />
          <QuickAction icon="✏️" label="Manuell erfassen" onPress={() => onOpenSubflow('manual')} />
        </View>
      </View>

      {/* Empty-state hint */}
      {!hasFavorites && !hasRecents && (
        <View style={styles.emptyHint}>
          <Text style={styles.emptyText}>Noch keine Einträge</Text>
          <Text style={styles.emptySubText}>
            Suche nach einem Lebensmittel oder nutze eine der Optionen oben.
          </Text>
        </View>
      )}
    </BottomSheetScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  errorContainer: {
    marginTop: spacing.sm,
  },

  // Sections
  section: {
    gap: spacing.xs,
  },
  sectionLabel: {
    ...typography.overline,
    color: colors.textMuted,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },

  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    ...typography.body1,
    color: colors.text,
  },
  rowBrand: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },
  rowChevron: {
    fontSize: 20,
    color: colors.textMuted,
  },

  // Quick actions
  quickActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickActionIcon: {
    fontSize: 22,
  },
  quickActionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // Skeleton
  skeletonRow: {
    height: 48,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
  },
  skeletonLabel: {
    height: 12,
    width: 80,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
  },

  // Empty state
  emptyHint: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.body1,
    color: colors.textSecondary,
  },
  emptySubText: {
    ...typography.body2,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
});
