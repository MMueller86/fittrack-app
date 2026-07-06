// AlleFavoritenModal — zeigt alle Favoriten des Nutzers als scrollbare Liste im Hub.
// Öffnet sich wenn "Alle →"-Chip im Wrap-Grid angetippt wird.
// Jedes Item: FavoriteChip-Stil + Produktname + Entfernen-Möglichkeit.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BottomSheetModal, BottomSheetFlatList } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import type { UserFoodRelation } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../../app/theme';
import { favoritesApi } from '../../../shared/api/favoritesApi';
import { FavoriteChip } from '../../../shared/components/FavoriteChip';
import { Icon } from '../../../shared/components/Icon';
import { ErrorBanner } from '../../../shared/components/ErrorBanner';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Wenn ein Favorit angetippt wird → ProduktDialog öffnen */
  onSelectRelation: (relation: UserFoodRelation) => void;
}

const SNAP_POINTS = ['60%', '90%'];

export function AlleFavoritenModal({ visible, onClose, onSelectRelation }: Props) {
  const sheetRef = React.useRef<BottomSheetModal>(null);
  const [favorites, setFavorites] = useState<UserFoodRelation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      sheetRef.current?.present();
      void loadFavorites();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible]);

  const loadFavorites = useCallback(async () => {
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

  const handleRemoveFavorite = useCallback(async (item: UserFoodRelation) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await favoritesApi.removeFavorite(item.foodRef);
      setFavorites((prev) => prev.filter((f) => f.id !== item.id));
    } catch {
      // silently ignore
    }
  }, []);

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
      enableDynamicSizing={false}
      index={0}
      onDismiss={onClose}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Meine Favoriten</Text>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Schließen"
        >
          <Icon lib="feather" name="x" size="md" color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.spinner} />
      ) : error ? (
        <View style={styles.errorContainer}>
          <ErrorBanner error={error} onRetry={() => void loadFavorites()} />
        </View>
      ) : (
        <BottomSheetFlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.listItem}
              onPress={() => {
                onSelectRelation(item);
                onClose();
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <FavoriteChip
                displayName={item.displayName}
                shortName={item.shortName}
                imageUrl={null}
                onPress={() => {
                  onSelectRelation(item);
                  onClose();
                }}
              />
              <View style={styles.listItemBody}>
                <Text style={styles.listItemName} numberOfLines={1}>
                  {item.shortName ?? item.displayName}
                </Text>
                {item.shortName && item.displayName !== item.shortName ? (
                  <Text style={styles.listItemFullName} numberOfLines={1}>
                    {item.displayName}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={() => void handleRemoveFavorite(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Aus Favoriten entfernen"
              >
                <Icon lib="ion" name="heart" size="md" color={colors.negative} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Noch keine Favoriten vorhanden.</Text>
          }
        />
      )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  handle: {
    backgroundColor: colors.border,
    width: 40,
    height: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
  },
  spinner: {
    marginTop: spacing.xl,
  },
  errorContainer: {
    padding: spacing.md,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listItemBody: {
    flex: 1,
  },
  listItemName: {
    ...typography.body2,
    fontWeight: '600' as const,
    color: colors.text,
  },
  listItemFullName: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  emptyText: {
    ...typography.body2,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
