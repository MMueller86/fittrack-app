import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CommunityRecipe } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { favoritesApi } from '../../shared/api/favoritesApi';
import { recipeApi } from '../../shared/api/recipeApi';
import { Icon } from '../../shared/components/Icon';
import { InfoOverlay } from '../../shared/components/InfoOverlay';
import { NutritionTile } from '../../shared/components/NutritionTile';
import { buildRecipePreviewViewModel } from './recipePreviewViewModel';
import { RecipeIngredientGroup } from './RecipeIngredientGroup';
import { RecipeImageHeroImage } from './RecipeImageHeroImage';
import { RECIPE_HERO_ASPECT_RATIO } from './recipeImageSource';
import LogRecipeModal from './LogRecipeModal';
import type { RecipeStackParamList } from '../../app/navigation/RootNavigator';

type Props = NativeStackScreenProps<RecipeStackParamList, 'RecipeDetail'>;

interface ErrorNotice {
  title: string;
  body: string;
}

function getResponseStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('response' in error)) return null;
  const response = error.response;
  if (typeof response !== 'object' || response === null || !('status' in response)) return null;
  return typeof response.status === 'number' ? response.status : null;
}

export default function CommunityRecipeDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const [recipe, setRecipe] = useState<CommunityRecipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [logVisible, setLogVisible] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [errorNotice, setErrorNotice] = useState<ErrorNotice | null>(null);
  const requestRevisionRef = useRef(0);

  const load = useCallback(async (signal?: AbortSignal) => {
    const requestRevision = ++requestRevisionRef.current;
    const isCurrentRequest = () => !signal?.aborted && requestRevisionRef.current === requestRevision;
    setLoading(true);
    setLoadError(false);
    setUnavailable(false);
    setRecipe(null);
    setImageIndex(0);
    setImageUri(null);
    setImageError(false);

    try {
      const data = await recipeApi.getCommunity(id, signal);
      if (!isCurrentRequest()) return;
      setRecipe(data);
      setLoading(false);
      void favoritesApi.listFavorites()
        .then((relations) => {
          if (isCurrentRequest()) {
            setIsFavorite(relations.some((relation) => relation.foodRef === id));
          }
        })
        .catch(() => undefined);
    } catch (error: unknown) {
      if (!isCurrentRequest()) return;
      const notFound = getResponseStatus(error) === 404;
      setRecipe(null);
      setUnavailable(notFound);
      setLoadError(!notFound);
    } finally {
      if (isCurrentRequest()) setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      void load(controller.signal);
      return () => {
        controller.abort();
        requestRevisionRef.current += 1;
      };
    }, [load]),
  );

  const currentImage = recipe?.images[imageIndex] ?? recipe?.images[0] ?? null;

  useEffect(() => {
    if (!currentImage) {
      setImageUri(null);
      setImageError(false);
      return undefined;
    }

    const controller = new AbortController();
    let active = true;
    setImageUri(null);
    setImageError(false);

    void recipeApi.getCommunityImage(id, currentImage.id, controller.signal)
      .then((uri) => {
        if (active) setImageUri(uri);
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted) return;
        if (getResponseStatus(error) === 404) {
          void load();
          return;
        }
        setImageError(true);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [currentImage?.id, id, load]);

  const handleToggleFavorite = useCallback(async () => {
    if (!recipe || favoriteBusy) return;
    const nextFavorite = !isFavorite;
    setIsFavorite(nextFavorite);
    setFavoriteBusy(true);

    try {
      if (nextFavorite) {
        await favoritesApi.addFavorite({
          foodRef: recipe.id,
          foodRefType: 'recipe',
          displayName: recipe.name,
        });
      } else {
        await favoritesApi.removeFavorite(recipe.id);
      }
    } catch (error: unknown) {
      setIsFavorite(!nextFavorite);
      if (nextFavorite && getResponseStatus(error) === 404) {
        void load();
      } else {
        setErrorNotice({
          title: 'Favorit konnte nicht aktualisiert werden',
          body: 'Bitte prüfe deine Verbindung und versuche es erneut.',
        });
      }
    } finally {
      setFavoriteBusy(false);
    }
  }, [favoriteBusy, isFavorite, load, recipe]);

  const visibleIngredientGroups = recipe
    ? buildRecipePreviewViewModel(recipe.ingredients).groups
      .filter((group) => group.ingredients.length > 0)
    : [];
  const authorName = recipe?.authorDisplayName.trim() || 'Anonymous';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.topBarAction}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Zurück"
        >
          <Icon lib="ion" name="chevron-back" size="lg" color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Community-Rezept</Text>
        {recipe ? (
          <TouchableOpacity
            style={styles.topBarAction}
            onPress={() => void handleToggleFavorite()}
            disabled={favoriteBusy}
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
            accessibilityState={{ disabled: favoriteBusy, selected: isFavorite }}
          >
            <Icon
              lib="ion"
              name={isFavorite ? 'heart' : 'heart-outline'}
              size="lg"
              color={isFavorite ? colors.negative : colors.textMuted}
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.topBarAction} />
        )}
      </View>

      {loading && !recipe ? (
        <View style={styles.stateContent}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : unavailable ? (
        <View style={styles.stateContent}>
          <Text style={styles.stateTitle}>Rezept nicht verfügbar</Text>
          <Text style={styles.stateText}>Dieses Rezept ist nicht mehr in der Community verfügbar.</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryButtonText}>Zurück</Text>
          </TouchableOpacity>
        </View>
      ) : loadError ? (
        <View style={styles.stateContent}>
          <Text style={styles.stateTitle}>Rezept konnte nicht geladen werden</Text>
          <Text style={styles.stateText}>Bitte prüfe deine Verbindung und versuche es erneut.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => void load()}>
            <Text style={styles.primaryButtonText}>Erneut versuchen</Text>
          </TouchableOpacity>
        </View>
      ) : recipe ? (
        <>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scroll}>
            <Text style={styles.title} accessibilityRole="header">{recipe.name}</Text>

            <View style={styles.authorRow}>
              <Icon lib="ion" name="person-outline" size="sm" color={colors.textMuted} />
              <Text style={styles.authorName}>{authorName}</Text>
            </View>

            {recipe.tags.length > 0 && (
              <View style={styles.tagsRow}>
                {recipe.tags.map((tag) => (
                  <View key={tag} style={styles.tagChip}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}

            {recipe.description ? <Text style={styles.description}>{recipe.description}</Text> : null}

            <View style={styles.portionsSummary}>
              <Text style={styles.sectionLabel}>Portionen</Text>
              <Text style={styles.portionsValue}>{recipe.portions}</Text>
            </View>

            <Text style={styles.sectionLabel}>Nährwerte pro Portion</Text>
            <View style={styles.nutritionRow}>
              <NutritionTile label="Kalorien" value={recipe.nutritionPerPortion.calories} unit="kcal" />
              <NutritionTile label="Protein" value={recipe.nutritionPerPortion.protein} unit="g" />
              <NutritionTile label="Kohlenhydr." value={recipe.nutritionPerPortion.carbs} unit="g" />
              <NutritionTile label="Fett" value={recipe.nutritionPerPortion.fat} unit="g" />
            </View>
            <Text style={styles.nutritionDisclaimer}>Nährwerte wurden von FitTrack nicht verifiziert.</Text>

            {(recipe.ingredientNotices.containsAiEstimates
              || recipe.ingredientNotices.containsManualIngredients) && (
              <View style={styles.ingredientNotices}>
                {recipe.ingredientNotices.containsAiEstimates && (
                  <View style={styles.noticeBadge}>
                    <Text style={styles.noticeText}>Enthält KI-Schätzungen</Text>
                  </View>
                )}
                {recipe.ingredientNotices.containsManualIngredients && (
                  <View style={styles.noticeBadge}>
                    <Text style={styles.noticeText}>Enthält manuell erfasste Zutaten</Text>
                  </View>
                )}
              </View>
            )}

            {currentImage && (
              <>
                <Text style={styles.sectionLabel}>Fotos ({recipe.images.length})</Text>
                <View style={styles.imageFrame}>
                  {imageUri ? (
                    <RecipeImageHeroImage
                      uri={imageUri}
                      heroCrop={currentImage.heroCrop}
                      style={styles.image}
                      accessibilityLabel={`Community-Rezeptfoto ${imageIndex + 1}`}
                    />
                  ) : imageError ? (
                    <View style={styles.imagePlaceholder}>
                      <Text style={styles.imagePlaceholderText}>Foto konnte nicht geladen werden.</Text>
                    </View>
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <ActivityIndicator color={colors.primary} />
                    </View>
                  )}
                </View>
                {recipe.images.length > 1 && (
                  <View style={styles.imageDots}>
                    {recipe.images.map((image, index) => (
                      <TouchableOpacity
                        key={image.id}
                        onPress={() => setImageIndex(index)}
                        accessibilityRole="button"
                        accessibilityLabel={`Foto ${index + 1} von ${recipe.images.length} anzeigen`}
                        accessibilityState={{ selected: index === imageIndex }}
                      >
                        <View style={[styles.dot, index === imageIndex && styles.dotActive]} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            {visibleIngredientGroups.length > 0 && (
              <>
                <Text style={styles.contentSectionLabel}>Zutaten</Text>
                {visibleIngredientGroups.map((group) => (
                  <RecipeIngredientGroup key={group.category} group={group} />
                ))}
              </>
            )}

            {recipe.steps.length > 0 && (
              <View>
                <Text style={styles.contentSectionLabel}>Zubereitung</Text>
                {recipe.steps.map((step, index) => (
                  <View key={`${step.order}-${index}`} style={styles.stepRow}>
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepBadgeText}>{index + 1}</Text>
                    </View>
                    <View style={styles.stepContent}>
                      {step.title?.trim() ? <Text style={styles.stepTitle}>{step.title}</Text> : null}
                      <Text style={styles.stepDescription}>{step.description}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setLogVisible(true)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Portion eintragen"
            >
              <Text style={styles.primaryButtonText}>Portion eintragen</Text>
            </TouchableOpacity>
          </View>

          <LogRecipeModal
            visible={logVisible}
            recipe={recipe}
            onClose={() => setLogVisible(false)}
            onLogged={() => {
              setLogVisible(false);
              void load();
            }}
            onUnavailable={() => {
              setLogVisible(false);
              void load();
            }}
          />
        </>
      ) : null}

      <InfoOverlay
        visible={errorNotice != null}
        title={errorNotice?.title ?? 'Fehler'}
        body={errorNotice?.body ?? ''}
        onClose={() => setErrorNotice(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topBarAction: {
    width: spacing.xxl,
    height: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: { ...typography.h3, color: colors.text, flex: 1, textAlign: 'center' },
  scrollView: { flex: 1 },
  scroll: { padding: spacing.md, paddingBottom: spacing.lg },
  stateContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  stateTitle: { ...typography.h3, color: colors.text, textAlign: 'center', marginBottom: spacing.sm },
  stateText: { ...typography.body2, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.sm },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  authorName: { ...typography.body2, color: colors.textSecondary },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  tagChip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tagText: { ...typography.caption, color: colors.textSecondary },
  description: { ...typography.body1, color: colors.textSecondary, marginBottom: spacing.md },
  portionsSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  portionsValue: { ...typography.h3, color: colors.text },
  sectionLabel: {
    ...typography.overline,
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  nutritionRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  nutritionDisclaimer: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  ingredientNotices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  noticeBadge: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  noticeText: { ...typography.caption, color: colors.textSecondary },
  imageFrame: {
    width: '100%',
    aspectRatio: RECIPE_HERO_ASPECT_RATIO,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  image: { ...StyleSheet.absoluteFillObject },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  imagePlaceholderText: { ...typography.body2, color: colors.textMuted, textAlign: 'center' },
  imageDots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm },
  dot: { width: spacing.sm, height: spacing.sm, borderRadius: radius.full, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary },
  contentSectionLabel: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.sm },
  stepBadge: {
    width: spacing.xl,
    height: spacing.xl,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepBadgeText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  stepContent: { flex: 1, minWidth: 0 },
  stepTitle: { ...typography.body2, color: colors.text, fontWeight: '600', marginBottom: spacing.xs },
  stepDescription: { ...typography.body2, color: colors.textSecondary, lineHeight: 21 },
  footer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border },
  primaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
  },
  primaryButtonText: { ...typography.button, color: colors.background, textAlign: 'center' },
  secondaryButton: {
    minHeight: 48,
    minWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: { ...typography.button, color: colors.text },
});