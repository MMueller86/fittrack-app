// OwnFoodsView — "Eigene Lebensmittel": selbst angelegte ReusableItems (kein Open Food Facts).
// Suche, Bearbeiten, Löschen (mit Bestätigung) und Aktualisieren. Zeilenaufbau über FoodProductSummary,
// Verwaltungsaktionen (Bearbeiten/Löschen) bleiben hier und getrennt von den Search-Hub-Aktionen.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { ReusableItem } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { reusableItemsApi } from '../../shared/api/reusableItemsApi';
import { ConfirmSheet } from '../../shared/components/ConfirmSheet';
import { FoodProductSummary } from '../../shared/components/FoodProductSummary';
import { Icon } from '../../shared/components/Icon';
import type { SnackbarConfig } from '../../shared/components/Snackbar';
import LabelScanReviewScreen from '../nutrition/LabelScanReviewScreen';
import { LibraryFoodCard } from './LibraryFoodCard';
import { LibraryStateView } from './LibraryStateView';
import { useLibraryList } from './useLibraryList';
import {
  deleteFeedbackMessage,
  filterOwnFoodItems,
  ownFoodBadges,
  selectOwnFoodItems,
} from './ownFoodItems';

// Design-System: Suchfeld ist eine 52-pt-Pill.
const SEARCH_FIELD_HEIGHT = 52;
// Die KI-Anreicherung läuft nach dem Speichern asynchron (~2-3 s) — danach nochmals laden.
const ENRICHMENT_RELOAD_MS = 4000;

function OwnFoodRow({
  item,
  onEdit,
  onDelete,
}: {
  item: ReusableItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <LibraryFoodCard
      onPress={onEdit}
      accessibilityHint="Öffnet das Bearbeiten"
      actionLabel={`${item.name} löschen`}
      onAction={onDelete}
      actionIcon={<Icon lib="feather" name="trash-2" size="md" color={colors.textMuted} />}
    >
      <FoodProductSummary
        name={item.name}
        brand={item.brand}
        imageUri={item.imageUrl}
        badges={ownFoodBadges(item)}
        incomplete={!item.isComplete}
        nutrition={item.nutritionPer100g}
        nutritionBasis={item.nutritionBasis}
        portion={item.portion}
        isAiEstimate={item.sourceType === 'ai'}
      />
    </LibraryFoodCard>
  );
}

function SearchField({ value, onChangeText }: { value: string; onChangeText: (text: string) => void }) {
  return (
    <View style={styles.searchPill}>
      <Icon lib="feather" name="search" size="sm" color={colors.textMuted} />
      <TextInput
        style={styles.searchInput}
        value={value}
        onChangeText={onChangeText}
        placeholder="Eigene Lebensmittel suchen…"
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        accessibilityLabel="Eigene Lebensmittel suchen"
      />
      {value.length > 0 ? (
        <TouchableOpacity
          onPress={() => onChangeText('')}
          style={styles.searchClear}
          accessibilityRole="button"
          accessibilityLabel="Suche löschen"
        >
          <Icon lib="feather" name="x-circle" size="sm" color={colors.textMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function OwnFoodsView({ showSnackbar }: { showSnackbar: (config: SnackbarConfig) => void }) {
  const { items, setItems, status, refreshing, load, retry, refresh } = useLibraryList(
    async () => selectOwnFoodItems((await reusableItemsApi.list()).items),
    () => showSnackbar({ message: 'Eigene Lebensmittel konnten nicht aktualisiert werden.' }),
  );
  const [search, setSearch] = useState('');
  const [editItem, setEditItem] = useState<ReusableItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ReusableItem | null>(null);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(
    () => () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    },
    [],
  );

  const filtered = useMemo(() => filterOwnFoodItems(items, search), [items, search]);

  async function deleteItem(item: ReusableItem) {
    try {
      const { diaryUsageCount } = await reusableItemsApi.remove(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      showSnackbar({ message: deleteFeedbackMessage(item.name, diaryUsageCount), durationMs: 6000 });
    } catch {
      showSnackbar({ message: 'Lebensmittel konnte nicht gelöscht werden.' });
    }
  }

  function handleUpdated() {
    setEditItem(null);
    void load();
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = setTimeout(() => void load(), ENRICHMENT_RELOAD_MS);
  }

  function renderBody() {
    if (status === 'loading') return <LibraryStateView kind="loading" />;
    if (status === 'error') {
      return (
        <LibraryStateView
          kind="error"
          title="Eigene Lebensmittel konnten nicht geladen werden"
          body="Bitte prüfe deine Verbindung und versuche es erneut."
          onRetry={retry}
        />
      );
    }
    if (items.length === 0) {
      return (
        <LibraryStateView
          kind="empty"
          title="Noch keine eigenen Lebensmittel"
          body="Lege beim Hinzufügen eines Eintrags ein Lebensmittel per Label-Scan, KI-Schätzung oder manuell an — dann erscheint es hier."
          refreshing={refreshing}
          onRefresh={refresh}
        />
      );
    }
    return (
      <>
        <SearchField value={search} onChangeText={setSearch} />
        {filtered.length === 0 ? (
          <LibraryStateView
            kind="empty"
            iconName="search"
            title="Keine Treffer"
            body="Versuche einen anderen Suchbegriff."
            refreshing={refreshing}
            onRefresh={refresh}
          />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <OwnFoodRow item={item} onEdit={() => setEditItem(item)} onDelete={() => setPendingDelete(item)} />
            )}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
          />
        )}
      </>
    );
  }

  return (
    <View style={styles.container}>
      {renderBody()}

      <ConfirmSheet
        visible={pendingDelete != null}
        title={pendingDelete ? `\u201E${pendingDelete.name}\u201C löschen?` : 'Löschen?'}
        subtitle="Das Lebensmittel wird aus deiner Bibliothek entfernt. Bestehende Tagebuch-Einträge behalten ihre gespeicherten Nährwerte."
        actions={[
          {
            label: 'Löschen',
            destructive: true,
            onPress: () => {
              if (pendingDelete) void deleteItem(pendingDelete);
            },
          },
        ]}
        onClose={() => setPendingDelete(null)}
      />

      {editItem ? (
        <LabelScanReviewScreen
          visible
          mealId=""
          mode="edit"
          existingItem={editItem}
          onClose={() => setEditItem(null)}
          onSaved={() => setEditItem(null)}
          onUpdated={handleUpdated}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: SEARCH_FIELD_HEIGHT,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
  },
  searchInput: {
    flex: 1,
    ...typography.body1,
    color: colors.text,
    paddingVertical: 0,
  },
  searchClear: {
    minWidth: spacing.xl,
    minHeight: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: { padding: spacing.md, paddingBottom: spacing.xxl },
});
