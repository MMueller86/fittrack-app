// RecipeDetailScreen — shows recipe with image carousel, ingredients, steps + actions
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Recipe } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { recipeApi } from '../../shared/api/recipeApi';
import { favoritesApi } from '../../shared/api/favoritesApi';
import { Icon } from '../../shared/components/Icon';
import { computeRecipeQuickEntryData } from './recipeUtils';
import type { RecipeStackParamList } from '../../app/navigation/RootNavigator';
import LogRecipeModal from './LogRecipeModal';

type Props = NativeStackScreenProps<RecipeStackParamList, 'RecipeDetail'>;

function MacroChip({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <View style={chipStyles.chip}>
      <Text style={chipStyles.value}>
        {Math.round(value)}
        {unit}
      </Text>
      <Text style={chipStyles.label}>{label}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginHorizontal: 3,
  },
  value: { ...typography.h3, color: colors.primaryBright },
  label: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
});

export default function RecipeDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [logVisible, setLogVisible] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await recipeApi.get(id);
      setRecipe(data);
    } catch (err: unknown) {
      console.error('[RecipeDetail] Load failed for id', id, err);
      let detail = '';
      if (err != null && typeof err === 'object' && 'response' in err) {
        const resp = (err as { response?: { status?: number; data?: unknown } }).response;
        detail = ` (HTTP ${resp?.status ?? '?'})`;
        console.error('[RecipeDetail] HTTP response:', resp?.status, resp?.data);
      } else if (err instanceof Error) {
        detail = `\n${err.message}`;
      }
      Alert.alert('Fehler', `Rezept konnte nicht geladen werden.${detail}`);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [id, navigation]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    favoritesApi
      .listFavorites()
      .then((favs) => setIsFavorite(favs.some((f) => f.foodRef === id)))
      .catch(() => {
        /* ignore — heart defaults to unfavorited */
      });
  }, [id]);

  const handleToggleFavorite = useCallback(async () => {
    if (!recipe) return;
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      if (next) {
        const { nutritionPer100g, portion } = computeRecipeQuickEntryData(recipe);
        await favoritesApi.addFavorite({
          foodRef: recipe.id,
          foodRefType: 'recipe',
          displayName: recipe.name,
          imageUrl: recipe.images[0]?.url ?? null,
          nutritionPer100g,
          portion,
        });
      } else {
        await favoritesApi.removeFavorite(recipe.id);
      }
    } catch {
      setIsFavorite(!next); // revert on error
    }
  }, [recipe, isFavorite]);

  useEffect(() => {
    if (!recipe) return;
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => void handleToggleFavorite()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ marginRight: spacing.md }}
          accessibilityLabel={isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
        >
          <Icon
            lib="ion"
            name={isFavorite ? 'heart' : 'heart-outline'}
            size="lg"
            color={isFavorite ? colors.negative : colors.textMuted}
          />
        </TouchableOpacity>
      ),
    });
  }, [recipe, isFavorite, navigation, handleToggleFavorite]);

  const handleDelete = () => {
    Alert.alert('Rezept löschen', 'Möchtest du dieses Rezept wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          try {
            await recipeApi.delete(id);
            navigation.goBack();
          } catch (err: unknown) {
            console.error('[RecipeDetail] Delete failed for id', id, err);
            let detail = '';
            if (err != null && typeof err === 'object' && 'response' in err) {
              const resp = (err as { response?: { status?: number; data?: unknown } }).response;
              detail = ` (HTTP ${resp?.status ?? '?'})`;
              console.error('[RecipeDetail] Delete HTTP response:', resp?.status, resp?.data);
            }
            Alert.alert('Fehler', `Rezept konnte nicht gelöscht werden.${detail}`);
          }
        },
      },
    ]);
  };

  if (loading || !recipe) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  const { nutritionPerPortion } = recipe;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Image carousel */}
        {recipe.images.length > 0 && (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: recipe.images[imgIndex].url }}
              style={styles.image}
              resizeMode="cover"
            />
            {recipe.images.length > 1 && (
              <View style={styles.imageDots}>
                {recipe.images.map((_, i) => (
                  <TouchableOpacity key={i} onPress={() => setImgIndex(i)}>
                    <View style={[styles.dot, i === imgIndex && styles.dotActive]} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{recipe.name}</Text>
            {recipe.description && (
              <Text style={styles.description}>{recipe.description}</Text>
            )}
            <Text style={styles.portionsLabel}>
              {recipe.portions} {recipe.portions === 1 ? 'Portion' : 'Portionen'}
            </Text>
          </View>
        </View>

        {/* Nutrition per portion */}
        <Text style={styles.sectionTitle}>Nährwerte pro Portion</Text>
        <View style={styles.macrosRow}>
          <MacroChip label="kcal" value={nutritionPerPortion.calories} unit="" />
          <MacroChip label="Eiweiß" value={nutritionPerPortion.protein} unit="g" />
          <MacroChip label="Kohlenhydr." value={nutritionPerPortion.carbs} unit="g" />
          <MacroChip label="Fett" value={nutritionPerPortion.fat} unit="g" />
        </View>

        {/* Ingredients */}
        {recipe.ingredients.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Zutaten</Text>
            {recipe.ingredients.map((ing) => (
              <View key={ing.id} style={styles.ingredientRow}>
                <Text style={styles.ingredientName}>{ing.displayName}</Text>
                <Text style={styles.ingredientAmount}>
                  {ing.inputAmount}{ing.unit}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Steps */}
        {recipe.steps.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Zubereitung</Text>
            {recipe.steps.map((step) => (
              <View key={step.order} style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{step.order}</Text>
                </View>
                <View style={styles.stepContent}>
                  {step.title && <Text style={styles.stepTitle}>{step.title}</Text>}
                  <Text style={styles.stepDesc}>{step.description}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => setLogVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.btnPrimaryText}>Portion eintragen</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => navigation.navigate('RecipeCreate', { editId: id })}
            activeOpacity={0.8}
          >
            <Text style={styles.btnSecondaryText}>Bearbeiten</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnDestructive]} onPress={handleDelete} activeOpacity={0.8}>
            <Text style={styles.btnDestructiveText}>Löschen</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <LogRecipeModal
        visible={logVisible}
        recipe={recipe}
        onClose={() => setLogVisible(false)}
        onLogged={() => {
          setLogVisible(false);
          load();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: spacing.xxl },
  imageContainer: { position: 'relative' },
  image: { width: '100%', height: 240 },
  imageDots: {
    position: 'absolute',
    bottom: spacing.sm,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: { backgroundColor: colors.white },
  header: { padding: spacing.md },
  headerText: { flex: 1 },
  title: { ...typography.h1, color: colors.text },
  description: { ...typography.body2, color: colors.textSecondary, marginTop: spacing.xs },
  portionsLabel: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  sectionTitle: {
    ...typography.overline,
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  macrosRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  ingredientName: { ...typography.body2, color: colors.text },
  ingredientAmount: { ...typography.body2, color: colors.textSecondary },
  stepRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { ...typography.caption, color: colors.primaryBright, fontWeight: '700' },
  stepContent: { flex: 1 },
  stepTitle: { ...typography.body1, color: colors.text, fontWeight: '600' },
  stepDesc: { ...typography.body2, color: colors.textSecondary, marginTop: 2 },
  actions: { padding: spacing.md, gap: spacing.sm, marginTop: spacing.lg },
  btn: { borderRadius: radius.md, paddingVertical: spacing.sm + 4, alignItems: 'center' },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { ...typography.button, color: colors.white },
  btnSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  btnSecondaryText: { ...typography.button, color: colors.text },
  btnDestructive: { backgroundColor: 'transparent' },
  btnDestructiveText: { ...typography.button, color: colors.negative },
});
