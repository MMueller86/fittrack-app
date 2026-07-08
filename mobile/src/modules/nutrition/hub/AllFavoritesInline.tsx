// AllFavoritesInline — zeigt alle Favoriten als scrollbare Liste direkt im Hub.
// Ersetzt AlleFavoritenModal (kein zweites BottomSheetModal nötig → keine Gesture-Konflikte).
// Design: itemRow-Pattern aus DiaryScreen — Trennlinie, kein Card-Hintergrund.

import React, { useCallback, useEffect, useState } from 'react';
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
import type { UserFoodRelation } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../../app/theme';
import { favoritesApi } from '../../../shared/api/favoritesApi';
import { ErrorBanner } from '../../../shared/components/ErrorBanner';
import { Icon } from '../../../shared/components/Icon';

interface Props {
  onBack: () => void;
  onSelectRelation: (relation: UserFoodRelation) => void;
}

// ---------------------------------------------------------------------------
// Thumbnail
// ---------------------------------------------------------------------------

function Thumbnail({ uri }: { uri?: string | null }) {
  const [error, setError] = useState(false);
  if (uri && !error) {
    return (
      <Image
        source={{ uri }}
        style={styles.thumbnail}
        resizeMode="cover"
        onError={() => setError(true)}
      />
    );
  }
  return (
    <View style={[styles.thumbnail, styles.thumbnailFallback]}>
      <Icon lib="feather" name="database" size="sm" color={colors.textMuted} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// FavoriteRow
// ---------------------------------------------------------------------------

function FavoriteRow({
  item,
  onSelect,
  onRemove,
}: {
  item: UserFoodRelation;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const showShortName = item.shortName && item.shortName !== item.displayName;

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onSelect}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={item.displayName}
    >
      <Thumbnail uri={item.imageUrl} />

      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>{item.displayName}</Text>
        {showShortName ? (
          <Text style={styles.rowShortName} numberOfLines={1}>{item.shortName}</Text>
        ) : null}
        {item.displayBrand ? (
          <Text style={styles.rowBrand} numberOfLines={1}>{item.displayBrand}</Text>
        ) : null}
      </View>

      <TouchableOpacity
        style={styles.removeButton}
        onPress={onRemove}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={`${item.displayName} aus Favoriten entfernen`}
      >
        <Icon lib="ion" name="heart" size="md" color={colors.negative} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// AllFavoritesInline
// ---------------------------------------------------------------------------

export function AllFavoritesInline({ onBack, onSelectRelation }: Props) {
  const [favorites, setFavorites] = useState<UserFoodRelation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const favs = await favoritesApi.listFavorites();
      setFavorites(favs);
    } catch {
      setError('Favoriten konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRemove = useCallback(async (item: UserFoodRelation) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await favoritesApi.removeFavorite(item.foodRef);
      setFavorites((prev) => prev.filter((f) => f.id !== item.id));
    } catch {
      // silently ignore
    }
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Zurueck zu Schnellzugriff"
        >
          <Icon lib="feather" name="arrow-left" size="md" color={colors.textMuted} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Schnellzugriff</Text>
          {!loading && favorites.length > 0 ? (
            <Text style={styles.headerCount}>
              {favorites.length} {favorites.length === 1 ? 'Produkt' : 'Produkte'}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.spinner} />
      ) : error ? (
        <View style={styles.errorContainer}>
          <ErrorBanner error={error} onRetry={load} />
        </View>
      ) : favorites.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon lib="ion" name="heart-outline" size="md" color={colors.textDisabled} />
          <Text style={styles.emptyText}>Noch keine Favoriten</Text>
          <Text style={styles.emptyHint}>
            Tippe auf das Herz-Icon in den Suchergebnissen um ein Produkt zu speichern.
          </Text>
        </View>
      ) : (
        <BottomSheetFlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <FavoriteRow
              item={item}
              onSelect={() => onSelectRelation(item)}
              onRemove={() => void handleRemove(item)}
            />
          )}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.xs,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
  },
  headerCount: {
    ...typography.caption,
    color: colors.textMuted,
  },

  spinner: { marginTop: spacing.xl },
  errorContainer: { marginTop: spacing.sm },
  listContent: { paddingBottom: spacing.xl * 2 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },

  thumbnail: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
  },
  thumbnailFallback: {
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },

  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text,
  },
  rowShortName: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '500',
  },
  rowBrand: {
    ...typography.caption,
    color: colors.textMuted,
  },

  removeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyContainer: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  emptyText: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  emptyHint: {
    ...typography.body2,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});