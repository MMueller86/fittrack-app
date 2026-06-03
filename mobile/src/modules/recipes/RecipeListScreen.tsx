// RecipeListScreen — Recipe overview with "Zuletzt verwendet" + all recipes, FAB → create
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Recipe } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { recipeApi } from '../../shared/api/recipeApi';
import type { RecipeStackParamList } from '../../app/navigation/RootNavigator';

type Props = NativeStackScreenProps<RecipeStackParamList, 'RecipeList'>;

function formatKcal(n: number) {
  return `${Math.round(n)} kcal`;
}

function RecipeCard({
  recipe,
  onPress,
}: {
  recipe: Recipe;
  onPress: () => void;
}) {
  const thumbnailUrl = recipe.images.length > 0 ? (recipe.images[0]!.url ?? null) : null;

  return (
    <TouchableOpacity style={cardStyles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={cardStyles.row}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={cardStyles.thumbnail} resizeMode="cover" />
        ) : (
          <View style={cardStyles.thumbnailPlaceholder}>
            <Text style={cardStyles.thumbnailPlaceholderIcon}>🍽</Text>
          </View>
        )}
        <View style={cardStyles.info}>
          <Text style={cardStyles.name} numberOfLines={1}>
            {recipe.name}
          </Text>
          <Text style={cardStyles.meta}>
            {formatKcal(recipe.nutritionPerPortion.calories)} · {recipe.portions}{' '}
            {recipe.portions === 1 ? 'Portion' : 'Portionen'}
          </Text>
          {recipe.tags.length > 0 && (
            <Text style={cardStyles.tags} numberOfLines={1}>
              {recipe.tags.join(' · ')}
            </Text>
          )}
        </View>
        <Text style={cardStyles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const THUMB = 64;

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  thumbnail: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.sm,
    marginRight: spacing.md,
    flexShrink: 0,
  },
  thumbnailPlaceholder: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.sm,
    marginRight: spacing.md,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  thumbnailPlaceholderIcon: { fontSize: 24 },
  info: { flex: 1 },
  name: { ...typography.body1, color: colors.text, fontWeight: '600' },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  tags: { ...typography.caption, color: colors.primary, marginTop: 2 },
  chevron: { ...typography.h2, color: colors.textMuted, marginLeft: spacing.sm },
});

export default function RecipeListScreen({ navigation }: Props) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await recipeApi.list();
      setRecipes(data.recipes);
    } catch {
      Alert.alert('Fehler', 'Rezepte konnten nicht geladen werden.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [load, navigation]);

  const recent = recipes.filter((r) => r.lastUsedAt != null).slice(0, 5);
  const all = recipes;

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <Text style={styles.screenTitle}>Meine Rezepte</Text>

        {recent.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>Zuletzt verwendet</Text>
            {recent.map((r) => (
              <RecipeCard
                key={r.id}
                recipe={r}
                onPress={() => navigation.navigate('RecipeDetail', { id: r.id })}
              />
            ))}
          </>
        )}

        {all.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>Alle Rezepte</Text>
            {all.map((r) => (
              <RecipeCard
                key={r.id}
                recipe={r}
                onPress={() => navigation.navigate('RecipeDetail', { id: r.id })}
              />
            ))}
          </>
        )}

        {recipes.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Noch keine Rezepte</Text>
            <Text style={styles.emptySubtitle}>Tippe auf + um dein erstes Rezept zu erstellen.</Text>
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('RecipeWizard')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabLabel}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl + spacing.xl },
  screenTitle: { ...typography.h1, color: colors.text, marginBottom: spacing.lg },
  sectionHeader: {
    ...typography.overline,
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    letterSpacing: 1.2,
  },
  empty: { alignItems: 'center', marginTop: spacing.xxl },
  emptyTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  emptySubtitle: { ...typography.body2, color: colors.textMuted, textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  fabLabel: { fontSize: 30, color: colors.white, lineHeight: 32, fontWeight: '600' },
});
