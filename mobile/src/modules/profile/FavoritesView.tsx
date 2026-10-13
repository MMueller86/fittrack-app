// FavoritesView — Relation-Liste der Favoriten (UserFoodRelation), Entfernen mit Bestätigung.
// Zeilenaufbau über FoodProductSummary (wie Search Hub); einzige Aktion ist das Entfernen.

import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { UserFoodRelation } from '@fittrack/shared';
import { colors, spacing } from '../../app/theme';
import { favoritesApi } from '../../shared/api/favoritesApi';
import { ConfirmSheet } from '../../shared/components/ConfirmSheet';
import { FoodProductSummary } from '../../shared/components/FoodProductSummary';
import { Icon } from '../../shared/components/Icon';
import type { SnackbarConfig } from '../../shared/components/Snackbar';
import { favoriteSummaryProps } from './favoriteFoodSummary';
import { LibraryFoodCard } from './LibraryFoodCard';
import { LibraryStateView } from './LibraryStateView';
import { useLibraryList } from './useLibraryList';

function FavoriteRow({ item, onRemove }: { item: UserFoodRelation; onRemove: () => void }) {
  const summary = favoriteSummaryProps(item);

  return (
    <LibraryFoodCard
      actionLabel={`${summary.name} aus Favoriten entfernen`}
      onAction={onRemove}
      actionIcon={<Icon lib="ion" name="heart" size="md" color={colors.negative} />}
    >
      <FoodProductSummary {...summary} />
    </LibraryFoodCard>
  );
}

export function FavoritesView({ showSnackbar }: { showSnackbar: (config: SnackbarConfig) => void }) {
  const { items, setItems, status, refreshing, load, retry, refresh } = useLibraryList(
    () => favoritesApi.listFavorites(),
    () => showSnackbar({ message: 'Favoriten konnten nicht aktualisiert werden.' }),
  );
  const [pendingRemove, setPendingRemove] = useState<UserFoodRelation | null>(null);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function removeFavorite(item: UserFoodRelation) {
    try {
      await favoritesApi.removeFavorite(item.foodRef);
      setItems((prev) => prev.filter((f) => f.id !== item.id));
    } catch {
      showSnackbar({ message: 'Favorit konnte nicht entfernt werden.' });
    }
  }

  if (status === 'loading') return <LibraryStateView kind="loading" />;
  if (status === 'error') {
    return (
      <LibraryStateView
        kind="error"
        title="Favoriten konnten nicht geladen werden"
        body="Bitte prüfe deine Verbindung und versuche es erneut."
        onRetry={retry}
      />
    );
  }
  if (items.length === 0) {
    return (
      <LibraryStateView
        kind="empty"
        iconName="heart"
        title="Noch keine Favoriten"
        body="Tippe beim Suchen auf das Herz-Symbol, um ein Lebensmittel als Favorit zu speichern."
        refreshing={refreshing}
        onRefresh={refresh}
      />
    );
  }

  return (
    <>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <FavoriteRow item={item} onRemove={() => setPendingRemove(item)} />}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      />
      <ConfirmSheet
        visible={pendingRemove != null}
        title="Aus Favoriten entfernen?"
        subtitle={pendingRemove ? `\u201E${favoriteSummaryProps(pendingRemove).name}\u201C wird aus deinen Favoriten entfernt.` : undefined}
        actions={[
          {
            label: 'Entfernen',
            destructive: true,
            onPress: () => {
              if (pendingRemove) void removeFavorite(pendingRemove);
            },
          },
        ]}
        onClose={() => setPendingRemove(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  listContent: { padding: spacing.md, paddingBottom: spacing.xxl },
});
