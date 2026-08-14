// RecipeDetailScreen — read-only recipe preview with logging and management actions
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  RECIPE_PORTION_MAX,
  RECIPE_PORTION_MIN,
  scaleRecipeIngredients,
} from '@fittrack/shared';
import type { Recipe } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { aiApi } from '../../shared/api/aiApi';
import { recipeApi } from '../../shared/api/recipeApi';
import { favoritesApi } from '../../shared/api/favoritesApi';
import { ConfirmSheet } from '../../shared/components/ConfirmSheet';
import { Icon } from '../../shared/components/Icon';
import { InfoOverlay } from '../../shared/components/InfoOverlay';
import { NutritionTile } from '../../shared/components/NutritionTile';
import { computeRecipeQuickEntryData } from './recipeUtils';
import { buildRecipePreviewViewModel } from './recipePreviewViewModel';
import { RecipeIngredientGroup } from './RecipeIngredientGroup';
import {
  createRecipeScalePreviewController,
  type RecipeScalePreviewController,
  type RecipeScalePreviewErrorNotice,
  type RecipeTextPreviewState,
} from './recipeScalePreviewState';
import { consumeRecipeDetailNavigationIntent } from './recipeWizardNavigation';
import type { RecipeStackParamList } from '../../app/navigation/RootNavigator';
import LogRecipeModal from './LogRecipeModal';

type Props = NativeStackScreenProps<RecipeStackParamList, 'RecipeDetail'>;

const RECIPE_SCALE_LOADING_MESSAGE =
  'Die KI passt die Texte an die neuen Rezeptmengen an. Die KI kann Fehler machen.';

function clampTargetPortions(value: number): number {
  return Math.min(RECIPE_PORTION_MAX, Math.max(RECIPE_PORTION_MIN, value));
}

export default function RecipeDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [logVisible, setLogVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [seasoningsExpanded, setSeasoningsExpanded] = useState(false);
  const [errorNotice, setErrorNotice] = useState<RecipeScalePreviewErrorNotice | null>(null);
  const [scaleInfoVisible, setScaleInfoVisible] = useState(false);
  const [targetPortions, setTargetPortions] = useState(RECIPE_PORTION_MIN);
  const [textPreview, setTextPreview] = useState<RecipeTextPreviewState>({
    status: 'original',
    description: null,
    steps: [],
  });
  const recipeRef = useRef<Recipe | null>(null);
  const logIntentConsumedRef = useRef(false);
  const targetPortionsRef = useRef(RECIPE_PORTION_MIN);
  const recipeIdRef = useRef(id);
  recipeIdRef.current = id;
  const setTargetPortionsValue = useCallback((value: number) => {
    targetPortionsRef.current = value;
    setTargetPortions(value);
  }, []);

  const scalePreviewControllerRef = useRef<RecipeScalePreviewController | null>(null);
  if (scalePreviewControllerRef.current === null) {
    scalePreviewControllerRef.current = createRecipeScalePreviewController({
      getScreenRecipeId: () => recipeIdRef.current,
      getCurrentRecipe: () => recipeRef.current,
      getTargetPortions: () => targetPortionsRef.current,
      setTargetPortions: setTargetPortionsValue,
      setTextPreview,
      setErrorNotice,
      previewRecipeScale: aiApi.previewRecipeScale,
    });
  }
  const scalePreviewController = scalePreviewControllerRef.current;

  const load = useCallback(async () => {
    const currentRecipe = recipeRef.current;
    scalePreviewController.resetForReload(currentRecipe);
    setLoading(true);
    try {
      const data = await recipeApi.get(id);
      recipeRef.current = data;
      setRecipe(data);
      scalePreviewController.restoreOriginalPreview(data);
      setImgIndex(0);
      setLoadError(false);
    } catch (err: unknown) {
      console.error('[RecipeDetail] Load failed for id', id, err);
      if (recipeRef.current == null) {
        setLoadError(true);
      } else {
        setErrorNotice({
          title: 'Rezept konnte nicht aktualisiert werden',
          body: 'Die zuletzt geladenen Daten bleiben sichtbar. Bitte versuche es später erneut.',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [id, scalePreviewController]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const requestScalePreview = useCallback(
    (nextTargetPortions: number, currentRecipe: Recipe) => {
      scalePreviewController.requestScalePreview(nextTargetPortions, currentRecipe);
    },
    [scalePreviewController],
  );

  const handleTargetPortionsChange = useCallback(
    (delta: number) => {
      const currentRecipe = recipeRef.current;
      if (!currentRecipe) return;

      const nextTargetPortions = clampTargetPortions(targetPortionsRef.current + delta);
      if (nextTargetPortions === targetPortionsRef.current) return;

      targetPortionsRef.current = nextTargetPortions;
      setTargetPortions(nextTargetPortions);
      requestScalePreview(nextTargetPortions, currentRecipe);
    },
    [requestScalePreview],
  );

  useEffect(() => () => scalePreviewController.dispose(), [scalePreviewController]);

  useEffect(() => {
    if (recipe == null) return;
    if (!consumeRecipeDetailNavigationIntent(route.params.intent, logIntentConsumedRef)) return;
    navigation.setParams({ intent: undefined });
    setLogVisible(true);
  }, [navigation, recipe, route.params.intent]);

  useEffect(() => {
    let cancelled = false;
    favoritesApi
      .listFavorites()
      .then((favs) => {
        if (!cancelled) setIsFavorite(favs.some((f) => f.foodRef === id));
      })
      .catch(() => {
        // The heart remains unfavorited when favorites are unavailable.
      });
    return () => {
      cancelled = true;
    };
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
      setIsFavorite(!next);
    }
  }, [recipe, isFavorite]);

  const handleDeleteConfirmed = async () => {
    setDeleting(true);
    try {
      await recipeApi.delete(id);
      navigation.goBack();
    } catch (err: unknown) {
      console.error('[RecipeDetail] Delete failed for id', id, err);
      setErrorNotice({
        title: 'Rezept konnte nicht gelöscht werden',
        body: 'Bitte versuche es später erneut.',
      });
    } finally {
      setDeleting(false);
    }
  };

  const topBar = (
    <View style={styles.topBar}>
      <TouchableOpacity
        style={styles.topBarAction}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Zurück"
      >
        <Icon lib="ion" name="chevron-back" size="lg" color={colors.text} />
      </TouchableOpacity>
      <Text style={styles.topBarTitle}>Rezept</Text>
      {recipe ? (
        <TouchableOpacity
          style={styles.topBarAction}
          onPress={() => void handleToggleFavorite()}
          accessibilityRole="button"
          accessibilityLabel={isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
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
  );

  if (loading && !recipe && !loadError) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {topBar}
        <View style={styles.stateContent}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!recipe) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {topBar}
        <View style={styles.stateContent}>
          <Text style={styles.stateTitle}>Rezept konnte nicht geladen werden</Text>
          <Text style={styles.stateText}>Bitte prüfe deine Verbindung und versuche es erneut.</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              setLoadError(false);
              void load();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Erneut versuchen</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const displayedIngredients =
    targetPortions === recipe.portions
      ? recipe.ingredients
      : scaleRecipeIngredients(recipe.ingredients, recipe.portions, targetPortions);
  const previewViewModel = buildRecipePreviewViewModel(displayedIngredients);
  const visibleIngredientGroups = previewViewModel.groups.filter((group) => group.ingredients.length > 0);
  const foodGroups = visibleIngredientGroups.filter((group) => group.category !== 'seasoning');
  const seasoningGroup = visibleIngredientGroups.find((group) => group.category === 'seasoning');
  const isTextPreviewLoading = textPreview.status === 'loading';
  const visibleSteps = isTextPreviewLoading
    ? []
    : textPreview.steps.filter((step) => step.description.trim().length > 0);
  const imageUrls = recipe.images
    .map((image) => image.url)
    .filter((url): url is string => typeof url === 'string' && url.length > 0);
  const currentImageUrl = imageUrls[imgIndex] ?? imageUrls[0];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {topBar}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scroll}>
        <Text style={styles.title} accessibilityRole="header">{recipe.name}</Text>

        {recipe.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {recipe.tags.map((tag) => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {recipe.description && <Text style={styles.description}>{recipe.description}</Text>}

        <View style={styles.portionsSection}>
          <View style={styles.portionSummaryRow}>
            <View style={styles.portionSummary}>
              <Text style={styles.portionLabel}>Portionen</Text>
              <Text style={styles.portionValue}>{recipe.portions}</Text>
              <Text style={styles.portionMeta}>gespeichert</Text>
            </View>
            <View style={[styles.portionSummary, styles.targetPortionSummary]}>
              <View style={[styles.portionLabelRow, styles.targetPortionLabelRow]}>
                <Text style={styles.portionLabel}>Nachkochen für</Text>
                <TouchableOpacity
                  style={styles.infoButton}
                  onPress={() => setScaleInfoVisible(true)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Erklärung zum Skalieren öffnen"
                >
                  <Icon lib="ion" name="information-circle-outline" size="md" color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={[
                    styles.stepperButton,
                    targetPortions <= RECIPE_PORTION_MIN && styles.stepperButtonDisabled,
                  ]}
                  onPress={() => handleTargetPortionsChange(-1)}
                  disabled={targetPortions <= RECIPE_PORTION_MIN}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Portionszahl verringern"
                >
                  <Text
                    style={[
                      styles.stepperButtonText,
                      targetPortions <= RECIPE_PORTION_MIN && styles.stepperButtonTextDisabled,
                    ]}
                  >
                    −
                  </Text>
                </TouchableOpacity>
                <Text style={styles.targetPortionValue}>{targetPortions}</Text>
                <TouchableOpacity
                  style={[
                    styles.stepperButton,
                    targetPortions >= RECIPE_PORTION_MAX && styles.stepperButtonDisabled,
                  ]}
                  onPress={() => handleTargetPortionsChange(1)}
                  disabled={targetPortions >= RECIPE_PORTION_MAX}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Portionszahl erhöhen"
                >
                  <Text
                    style={[
                      styles.stepperButtonText,
                      targetPortions >= RECIPE_PORTION_MAX && styles.stepperButtonTextDisabled,
                    ]}
                  >
                    +
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.portionMeta, styles.targetPortionMeta]}>temporär</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonPrimary]}
            onPress={() => setLogVisible(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Text style={styles.actionButtonPrimaryText}>Portion eintragen</Text>
          </TouchableOpacity>
        </View>

        {targetPortions !== recipe.portions && !isTextPreviewLoading && (
          <Text style={styles.scaleWarning}>Die KI kann Fehler machen.</Text>
        )}

        <Text style={styles.sectionLabel}>Nährwerte pro Portion</Text>
        <View style={styles.macroRow}>
          <NutritionTile label="Kalorien" value={recipe.nutritionPerPortion.calories} unit="kcal" />
          <NutritionTile label="Protein" value={recipe.nutritionPerPortion.protein} unit="g" />
          <NutritionTile label="Kohlenhydr." value={recipe.nutritionPerPortion.carbs} unit="g" />
          <NutritionTile label="Fett" value={recipe.nutritionPerPortion.fat} unit="g" />
        </View>

        {imageUrls.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Fotos ({imageUrls.length})</Text>
            <View style={styles.imageContainer}>
              <Image source={{ uri: currentImageUrl }} style={styles.image} resizeMode="cover" />
              {imageUrls.length > 1 && (
                <View style={styles.imageDots}>
                  {imageUrls.map((_, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => setImgIndex(index)}
                      accessibilityRole="button"
                      accessibilityLabel={`Foto ${index + 1} von ${imageUrls.length} anzeigen`}
                    >
                      <View style={[styles.dot, index === imgIndex && styles.dotActive]} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </>
        )}

        {visibleIngredientGroups.length > 0 && (
          <>
            <Text style={styles.contentSectionLabel}>Zutaten</Text>
            {foodGroups.map((group) => (
              <RecipeIngredientGroup key={group.category} group={group} />
            ))}
            {seasoningGroup && (
              <RecipeIngredientGroup
                group={seasoningGroup}
                collapsible
                expanded={seasoningsExpanded}
                onToggle={() => setSeasoningsExpanded((expanded) => !expanded)}
              />
            )}
          </>
        )}

        {isTextPreviewLoading ? (
          <Animated.View
            key="recipe-scale-loading"
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(150)}
            layout={LinearTransition.duration(300)}
          >
            <Text style={styles.contentSectionLabel}>Zubereitung</Text>
            <View style={styles.scaleLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
              <View style={styles.scaleLoadingCopy}>
                <Text style={styles.scaleLoadingTitle}>Zubereitung wird angepasst</Text>
                <Text style={styles.scaleLoadingText}>{RECIPE_SCALE_LOADING_MESSAGE}</Text>
              </View>
            </View>
          </Animated.View>
        ) : visibleSteps.length > 0 ? (
          <Animated.View
            key={`recipe-steps-${textPreview.status}`}
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(150)}
            layout={LinearTransition.duration(300)}
          >
            <Text style={styles.contentSectionLabel}>Zubereitung</Text>
            {visibleSteps.map((step, index) => (
              <View key={step.order} style={styles.stepRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{index + 1}</Text>
                </View>
                <View style={styles.stepContent}>
                  {step.title?.trim() && <Text style={styles.stepTitle}>{step.title}</Text>}
                  <Text style={styles.stepDescription}>{step.description}</Text>
                </View>
              </View>
            ))}
          </Animated.View>
        ) : null}

      </ScrollView>

      <View style={styles.stickyFooter}>
        <TouchableOpacity
          style={styles.stickyAction}
          onPress={() => navigation.navigate('RecipeWizard', { editId: id })}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          <Icon lib="ion" name="create-outline" size="md" color={colors.textSecondary} />
          <Text style={styles.stickyActionText}>Bearbeiten</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.stickyAction}
          onPress={() => setDeleteConfirmVisible(true)}
          disabled={deleting}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          <Icon lib="ion" name="trash-outline" size="md" color={colors.negative} />
          <Text style={styles.stickyDeleteText}>Löschen</Text>
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
      />

      <ConfirmSheet
        visible={deleteConfirmVisible}
        title="Rezept löschen?"
        subtitle="Das Rezept und seine gespeicherten Daten werden dauerhaft gelöscht."
        actions={[{ label: 'Löschen', destructive: true, onPress: () => void handleDeleteConfirmed() }]}
        onClose={() => setDeleteConfirmVisible(false)}
      />

      <InfoOverlay
        visible={scaleInfoVisible}
        title="Für wie viele kochst du?"
        body="Zutatenmengen und Zubereitung werden automatisch an die gewählte Portionszahl angepasst. Dein Originalrezept bleibt unverändert."
        onClose={() => setScaleInfoVisible(false)}
      />

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
  scroll: { padding: spacing.md, paddingBottom: spacing.md },
  stateContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  stateTitle: { ...typography.h3, color: colors.text, textAlign: 'center' },
  stateText: {
    ...typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  tagChip: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tagText: { ...typography.caption, color: colors.primaryBright, fontWeight: '600' },
  description: {
    ...typography.body2,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  portionsSection: {
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'stretch',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scaleLoading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  scaleLoadingCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  scaleLoadingTitle: {
    ...typography.body1,
    color: colors.text,
    fontWeight: '600',
  },
  scaleLoadingText: {
    ...typography.body2,
    color: colors.textSecondary,
    flex: 1,
  },
  portionSummaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  portionSummary: {
    flex: 1,
    minWidth: 0,
  },
  targetPortionSummary: {
    alignItems: 'flex-end',
  },
  portionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  targetPortionLabelRow: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  portionLabel: {
    ...typography.overline,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  portionMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  targetPortionMeta: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
  },
  infoButton: {
    width: spacing.lg,
    height: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepperButton: {
    width: spacing.xl,
    height: spacing.xl,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonDisabled: {
    backgroundColor: colors.surface,
  },
  stepperButtonText: {
    ...typography.h2,
    color: colors.primaryBright,
  },
  stepperButtonTextDisabled: {
    color: colors.textDisabled,
  },
  targetPortionValue: {
    ...typography.h2,
    color: colors.primaryBright,
    minWidth: spacing.xl,
    textAlign: 'center',
  },
  portionValue: {
    ...typography.h1,
    color: colors.primaryBright,
    fontWeight: '800',
  },
  scaleWarning: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    ...typography.overline,
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  imageContainer: {
    position: 'relative',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  image: { width: '100%', height: 240 },
  imageDots: {
    position: 'absolute',
    bottom: spacing.sm,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: spacing.xs,
    height: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.textMuted,
    opacity: 0.65,
  },
  dotActive: { backgroundColor: colors.white, opacity: 1 },
  contentSectionLabel: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stepBadge: {
    width: spacing.lg,
    height: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepBadgeText: { ...typography.body2, color: colors.primaryBright, fontWeight: '700' },
  stepContent: { flex: 1, marginLeft: spacing.md },
  stepTitle: { ...typography.body1, color: colors.text, fontWeight: '600', marginBottom: spacing.xs },
  stepDescription: { ...typography.body2, color: colors.textSecondary, lineHeight: 22 },
  actionButton: {
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  actionButtonPrimary: { backgroundColor: colors.primary },
  actionButtonPrimaryText: { ...typography.button, color: colors.white },
  stickyFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  stickyAction: {
    flex: 1,
    minHeight: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  stickyActionText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  stickyDeleteText: { ...typography.caption, color: colors.negative, fontWeight: '600' },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  primaryButtonText: { ...typography.button, color: colors.white },
});
