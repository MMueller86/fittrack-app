// LibraryScreen — Bibliothek: Favoriten & Meine Lebensmittel.
// Erreichbar über Profil-Tab → "Bibliothek".

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ReusableItem, UserFoodRelation } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { favoritesApi } from '../../shared/api/favoritesApi';
import { reusableItemsApi } from '../../shared/api/reusableItemsApi';
import type { ProfileStackParamList } from '../../app/navigation/RootNavigator';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Library'>;

type Tab = 'favorites' | 'myProducts';

// ---------------------------------------------------------------------------
// FavoriteCard
// ---------------------------------------------------------------------------

function FavoriteCard({
  item,
  onRemove,
}: {
  item: UserFoodRelation;
  onRemove: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        <Text style={styles.cardName} numberOfLines={2}>
          {item.displayName}
        </Text>
        {item.displayBrand ? (
          <Text style={styles.cardBrand} numberOfLines={1}>
            {item.displayBrand}
          </Text>
        ) : null}
        <Text style={styles.cardMeta}>
          {item.foodRefType === 'catalog' ? '🌐 Katalog' : '📁 Eigenes Produkt'}
          {item.usageCount > 0 ? `  ·  ${item.usageCount}× verwendet` : ''}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={onRemove}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel={`${item.displayName} aus Favoriten entfernen`}
      >
        <Text style={styles.removeButtonText}>♡</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// MyProductCard
// ---------------------------------------------------------------------------

function MyProductCard({
  item,
}: {
  item: ReusableItem;
}) {
  const kcal = item.nutritionPer100g?.calories;
  return (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        <Text style={styles.cardName} numberOfLines={2}>
          {item.name}
        </Text>
        {item.brand ? (
          <Text style={styles.cardBrand} numberOfLines={1}>
            {item.brand}
          </Text>
        ) : null}
        <Text style={styles.cardMeta}>
          {kcal != null ? `${Math.round(kcal)} kcal/100g  ·  ` : ''}
          {item.sourceType === 'manual' ? '✏️ Manuell' : item.sourceType === 'label-scan' ? '📷 Scan' : '✨ KI'}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function LibraryScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('favorites');

  // Favorites state
  const [favorites, setFavorites] = useState<UserFoodRelation[]>([]);
  const [favLoading, setFavLoading] = useState(true);
  const [favError, setFavError] = useState<string | null>(null);

  // My products state
  const [products, setProducts] = useState<ReusableItem[]>([]);
  const [prodLoading, setProdLoading] = useState(false);
  const [prodLoaded, setProdLoaded] = useState(false);
  const [prodError, setProdError] = useState<string | null>(null);

  // Load favorites on mount
  useEffect(() => {
    loadFavorites();
  }, []);

  // Lazy-load my products when tab selected
  useEffect(() => {
    if (activeTab === 'myProducts' && !prodLoaded) {
      loadProducts();
    }
  }, [activeTab]);

  const loadFavorites = useCallback(async () => {
    try {
      setFavLoading(true);
      setFavError(null);
      const data = await favoritesApi.listFavorites();
      setFavorites(data);
    } catch {
      setFavError('Favoriten konnten nicht geladen werden.');
    } finally {
      setFavLoading(false);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      setProdLoading(true);
      setProdError(null);
      const { items } = await reusableItemsApi.list();
      setProducts(items);
      setProdLoaded(true);
    } catch {
      setProdError('Produkte konnten nicht geladen werden.');
    } finally {
      setProdLoading(false);
    }
  }, []);

  const handleRemoveFavorite = useCallback(
    (item: UserFoodRelation) => {
      Alert.alert(
        'Aus Favoriten entfernen',
        `„${item.displayName}" aus den Favoriten entfernen?`,
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Entfernen',
            style: 'destructive',
            onPress: async () => {
              try {
                await favoritesApi.removeFavorite(item.foodRef);
                setFavorites((prev) => prev.filter((f) => f.id !== item.id));
              } catch {
                Alert.alert('Fehler', 'Favorit konnte nicht entfernt werden.');
              }
            },
          },
        ],
      );
    },
    [],
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bibliothek</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'favorites' && styles.tabActive]}
          onPress={() => setActiveTab('favorites')}
        >
          <Text style={[styles.tabLabel, activeTab === 'favorites' && styles.tabLabelActive]}>
            ♥ Favoriten
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'myProducts' && styles.tabActive]}
          onPress={() => setActiveTab('myProducts')}
        >
          <Text style={[styles.tabLabel, activeTab === 'myProducts' && styles.tabLabelActive]}>
            📁 Meine Lebensmittel
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'favorites' ? (
        favLoading ? (
          <ActivityIndicator style={styles.centered} color={colors.primary} />
        ) : favError ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{favError}</Text>
            <TouchableOpacity onPress={loadFavorites} style={styles.retryButton}>
              <Text style={styles.retryText}>Erneut versuchen</Text>
            </TouchableOpacity>
          </View>
        ) : favorites.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>Noch keine Favoriten.</Text>
            <Text style={styles.emptyHint}>
              Tippe beim Suchen auf das Herz-Symbol, um ein Lebensmittel als Favorit zu speichern.
            </Text>
          </View>
        ) : (
          <FlatList
            data={favorites}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <FavoriteCard item={item} onRemove={() => handleRemoveFavorite(item)} />
            )}
            contentContainerStyle={styles.listContent}
          />
        )
      ) : prodLoading ? (
        <ActivityIndicator style={styles.centered} color={colors.primary} />
      ) : prodError ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{prodError}</Text>
          <TouchableOpacity onPress={loadProducts} style={styles.retryButton}>
            <Text style={styles.retryText}>Erneut versuchen</Text>
          </TouchableOpacity>
        </View>
      ) : products.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Noch keine eigenen Produkte.</Text>
          <Text style={styles.emptyHint}>
            Scanne ein Etikett oder lege ein Produkt manuell an, um es hier zu sehen.
          </Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MyProductCard item={item} />}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
  },
  backButtonText: {
    fontSize: 28,
    color: colors.text,
    lineHeight: 34,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    ...typography.h3,
    color: colors.text,
  },
  headerRight: {
    width: 40,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabLabel: {
    ...typography.body2,
    color: colors.textMuted,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardContent: {
    flex: 1,
    gap: 2,
  },
  cardName: {
    ...typography.body1,
    color: colors.text,
    fontWeight: '600',
  },
  cardBrand: {
    ...typography.caption,
    color: colors.textMuted,
  },
  cardMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  removeButton: {
    paddingLeft: spacing.sm,
  },
  removeButtonText: {
    fontSize: 22,
    color: colors.primary,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  errorText: {
    ...typography.body1,
    color: colors.negative,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  retryText: {
    ...typography.body1,
    color: '#fff',
  },
  emptyText: {
    ...typography.body1,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptyHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
