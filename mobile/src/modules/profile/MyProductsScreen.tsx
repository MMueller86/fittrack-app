// MyProductsScreen — Liste aller selbst gespeicherten Lebensmittel (ReusableItems).
// Kein OpenFoodFacts — nur Produkte die der User über Scan, KI oder Manuell angelegt hat.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ReusableItem } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { reusableItemsApi } from '../../shared/api/reusableItemsApi';
import LabelScanReviewScreen from '../nutrition/LabelScanReviewScreen';
import type { ProfileStackParamList } from '../../app/navigation/RootNavigator';

type Props = NativeStackScreenProps<ProfileStackParamList, 'MyProducts'>;

const SOURCE_BADGE: Record<string, string> = {
  manual: '✏️ Manuell',
  'label-scan': '📷 Scan',
  ai: '✨ KI',
};

function kcalPer100g(item: ReusableItem): number | null {
  return item.nutritionPer100g?.calories ?? null;
}

function macroChip(value: number | undefined, label: string) {
  if (value == null) return null;
  return `${Math.round(value * 10) / 10}g ${label}`;
}

function ProductCard({
  item,
  onTap,
  onDelete,
}: {
  item: ReusableItem;
  onTap: () => void;
  onDelete: () => void;
}) {
  const kcal = kcalPer100g(item);
  const n = item.nutritionPer100g;
  const chips = [
    macroChip(n?.protein, 'P'),
    macroChip(n?.carbs, 'K'),
    macroChip(n?.fat, 'F'),
    macroChip(n?.fiber, 'Bal'),
  ].filter(Boolean);

  return (
    <TouchableOpacity style={styles.card} onPress={onTap} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
          {item.brand ? <Text style={styles.productBrand} numberOfLines={1}>{item.brand}</Text> : null}
        </View>
        <TouchableOpacity
          onPress={onDelete}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.deleteBtn}
        >
          <Text style={styles.deleteBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.badgeRow}>
          {kcal != null && (
            <View style={styles.kcalBadge}>
              <Text style={styles.kcalText}>{Math.round(kcal)} kcal</Text>
              <Text style={styles.kcalUnit}>/100g</Text>
            </View>
          )}
          {chips.map((c) => (
            <View key={c} style={styles.chip}>
              <Text style={styles.chipText}>{c}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.sourceBadge]}>
          <Text style={styles.sourceText}>{SOURCE_BADGE[item.sourceType] ?? item.sourceType}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function MyProductsScreen({ navigation }: Props) {
  const [items, setItems] = useState<ReusableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Edit modal state
  const [editItem, setEditItem] = useState<ReusableItem | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { items: loaded } = await reusableItemsApi.list();
      // Nur user-erstellte Produkte (kein OpenFoodFacts)
      const userItems = loaded
        .filter((i) => i.sourceType !== 'openFoodFacts')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setItems(userItems);
    } catch {
      setError('Laden fehlgeschlagen. Bitte erneut versuchen.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const filtered = search.trim()
    ? items.filter((i) =>
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        (i.brand ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : items;

  function handleDelete(item: ReusableItem) {
    // Erst Nutzung abfragen, dann Alert mit Info anzeigen
    reusableItemsApi.remove(item.id).then(({ diaryUsageCount }) => {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      if (diaryUsageCount > 0) {
        Alert.alert(
          'Produkt gelöscht',
          `Das Produkt wurde entfernt. ${diaryUsageCount} Diary-Eintrag${diaryUsageCount !== 1 ? 'e' : ''} bleiben mit den gespeicherten Nährwerten erhalten.`,
        );
      }
    }).catch(() => {
      Alert.alert('Fehler', 'Produkt konnte nicht gelöscht werden.');
    });
  }

  function confirmDelete(item: ReusableItem) {
    Alert.alert(
      `"${item.name}" löschen?`,
      'Das Produkt wird aus deiner Bibliothek entfernt. Bestehende Diary-Einträge bleiben mit den gespeicherten Nährwerten erhalten.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Löschen', style: 'destructive', onPress: () => handleDelete(item) },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meine Lebensmittel</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Suchen…"
          placeholderTextColor={colors.textMuted}
          clearButtonMode="while-editing"
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>Erneut versuchen</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          showsVerticalScrollIndicator={false}
        >
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyTitle}>
                {search.trim() ? 'Keine Treffer' : 'Noch keine Produkte'}
              </Text>
              <Text style={styles.emptyText}>
                {search.trim()
                  ? 'Versuche einen anderen Suchbegriff.'
                  : 'Füge Produkte über den Scan- oder Manuell-Tab beim Hinzufügen eines Eintrags hinzu.'}
              </Text>
            </View>
          ) : (
            filtered.map((item) => (
              <ProductCard
                key={item.id}
                item={item}
                onTap={() => setEditItem(item)}
                onDelete={() => confirmDelete(item)}
              />
            ))
          )}
          <View style={{ height: spacing.xl * 2 }} />
        </ScrollView>
      )}

      {/* Edit Modal */}
      {editItem && (
        <LabelScanReviewScreen
          visible={true}
          mealId=""
          mode="edit"
          existingItem={editItem}
          onClose={() => setEditItem(null)}
          onSaved={() => setEditItem(null)}
          onUpdated={() => {
            setEditItem(null);
            void load();
            // KI-Anreicherung läuft async (~2-3 Sek nach dem Save) — nochmal laden
            // damit beim nächsten Öffnen der enrichte Status sichtbar ist.
            setTimeout(() => void load(), 4000);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  backText: { ...typography.h2, color: colors.primary, lineHeight: 28 },
  headerTitle: { ...typography.h3, color: colors.text },
  searchContainer: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  searchInput: {
    ...typography.body1,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  errorText: { ...typography.body2, color: colors.negative, textAlign: 'center', marginBottom: spacing.md },
  retryBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  retryText: { ...typography.button, color: colors.primary },

  // Product card
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.xs },
  productName: { ...typography.body1, color: colors.text, fontWeight: '600' },
  productBrand: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  deleteBtn: { paddingLeft: spacing.sm },
  deleteBtnText: { ...typography.body1, color: colors.textMuted },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.xs },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, flex: 1 },
  kcalBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    gap: 2,
  },
  kcalText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  kcalUnit: { fontSize: 9, color: colors.primary },
  chip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  chipText: { ...typography.caption, color: colors.textSecondary },
  sourceBadge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  sourceText: { ...typography.caption, color: colors.textMuted },

  // Empty state
  empty: { alignItems: 'center', paddingTop: spacing.xl * 2 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  emptyText: { ...typography.body2, color: colors.textSecondary, textAlign: 'center', maxWidth: 280 },
});
