// RecipeListScreen — Recipe overview with "Zuletzt verwendet" + all recipes, FAB → create
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityRecipe, Recipe, UserFoodRelation } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { recipeApi } from '../../shared/api/recipeApi';
import { favoritesApi } from '../../shared/api/favoritesApi';
import { Icon } from '../../shared/components/Icon';
import { InfoOverlay } from '../../shared/components/InfoOverlay';
import { RecipeImageHeroImage } from './RecipeImageHeroImage';
import { RECIPE_HERO_ASPECT_RATIO } from './recipeImageSource';
import type { RecipeStackParamList } from '../../app/navigation/RootNavigator';

type Props = NativeStackScreenProps<RecipeStackParamList, 'RecipeList'>;

function formatKcal(n: number) {
  return `${Math.round(n)} kcal`;
}

type RecipeCardRecipe = Recipe | CommunityRecipe;

function RecipeCardThumbnail({
  recipeId,
  image,
  isOwnerRecipe,
}: {
  recipeId: string;
  image: RecipeCardRecipe['images'][number] | undefined;
  isOwnerRecipe: boolean;
}) {
  const [communityImage, setCommunityImage] = useState<{
    recipeId: string;
    imageId: string;
    uri: string;
  } | null>(null);

  useEffect(() => {
    if (isOwnerRecipe || !image) return undefined;

    const controller = new AbortController();
    let active = true;
    void recipeApi.getCommunityImage(recipeId, image.id, controller.signal)
      .then((uri) => {
        if (active) setCommunityImage({ recipeId, imageId: image.id, uri });
      })
      .catch(() => undefined);

    return () => {
      active = false;
      controller.abort();
    };
  }, [image?.id, isOwnerRecipe, recipeId]);

  const uri = isOwnerRecipe
    ? image?.url ?? null
    : communityImage?.recipeId === recipeId && communityImage.imageId === image?.id
      ? communityImage.uri
      : null;

  return uri && image ? (
    <RecipeImageHeroImage
      uri={uri}
      heroCrop={image.heroCrop}
      style={cardStyles.thumbnail}
      accessibilityLabel="Rezeptfoto"
    />
  ) : (
    <View style={cardStyles.thumbnailPlaceholder}>
      <Icon lib="ion" name="restaurant-outline" size="md" color={colors.textMuted} />
    </View>
  );
}

function RecipeCard({
  recipe,
  isFavorite,
  favoriteBusy,
  onPress,
  onFavoriteToggle,
}: {
  recipe: RecipeCardRecipe;
  isFavorite: boolean;
  favoriteBusy: boolean;
  onPress: () => void;
  onFavoriteToggle: (recipe: RecipeCardRecipe) => void;
}) {
  const thumbnailImage = recipe.images[0];
  const isOwnerRecipe = 'ownerUserId' in recipe;
  const statusLabel = isOwnerRecipe
    ? recipe.visibility === 'community' ? 'Veröffentlicht' : 'Privat'
    : null;
  const authorName = !isOwnerRecipe ? recipe.authorDisplayName.trim() || 'Anonymous' : null;

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.row}>
        <TouchableOpacity
          style={cardStyles.mainRow}
          onPress={onPress}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`Rezept öffnen: ${recipe.name}`}
        >
          <RecipeCardThumbnail
            recipeId={recipe.id}
            image={thumbnailImage}
            isOwnerRecipe={isOwnerRecipe}
          />
          <View style={cardStyles.info}>
            <Text style={cardStyles.name} numberOfLines={2}>
              {recipe.name}
            </Text>
            <Text style={cardStyles.meta}>
              {formatKcal(recipe.nutritionPerPortion.calories)} · {recipe.portions}{' '}
              {recipe.portions === 1 ? 'Portion' : 'Portionen'}
            </Text>
            {statusLabel ? <Text style={cardStyles.status}>{statusLabel}</Text> : null}
            {authorName ? <Text style={cardStyles.author}>Von {authorName}</Text> : null}
            {recipe.tags.length > 0 && (
              <Text style={cardStyles.tags} numberOfLines={1}>
                {recipe.tags.join(' · ')}
              </Text>
            )}
          </View>
          <Text style={cardStyles.chevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onFavoriteToggle(recipe)}
          disabled={favoriteBusy}
          style={cardStyles.heartButton}
          accessibilityRole="button"
          accessibilityLabel={isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
          accessibilityState={{ disabled: favoriteBusy, selected: isFavorite }}
        >
          <Icon
            lib="ion"
            name={isFavorite ? 'heart' : 'heart-outline'}
            size="md"
            color={isFavorite ? colors.negative : colors.textMuted}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const THUMB = 64;

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  mainRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  thumbnail: {
    width: THUMB,
    aspectRatio: RECIPE_HERO_ASPECT_RATIO,
    borderRadius: radius.sm,
    marginRight: spacing.md,
    flexShrink: 0,
  },
  thumbnailPlaceholder: {
    width: THUMB,
    aspectRatio: RECIPE_HERO_ASPECT_RATIO,
    borderRadius: radius.sm,
    marginRight: spacing.md,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  info: { flex: 1, minWidth: 0 },
  name: { ...typography.body1, color: colors.text, fontWeight: '600', flexShrink: 1 },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  status: { ...typography.caption, color: colors.primary, marginTop: 2 },
  author: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  tags: { ...typography.caption, color: colors.primary, marginTop: 2 },
  chevron: { ...typography.h2, color: colors.textMuted, marginLeft: spacing.xs },
  heartButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
    flexShrink: 0,
  },
});

export default function RecipeListScreen({ navigation }: Props) {
  const [section, setSection] = useState<'mine' | 'community'>('mine');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [communityRecipes, setCommunityRecipes] = useState<CommunityRecipe[]>([]);
  const [favorites, setFavorites] = useState<UserFoodRelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [continuationToken, setContinuationToken] = useState<string | undefined>();
  const [favoriteBusyId, setFavoriteBusyId] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<{ title: string; body: string } | null>(null);
  const requestRevisionRef = useRef(0);
  const requestControllerRef = useRef<AbortController | null>(null);
  const continuationTokenRef = useRef<string | undefined>(undefined);

  const load = useCallback(async (options: { append?: boolean; refresh?: boolean } = {}) => {
    const append = options.append ?? false;
    const refresh = options.refresh ?? false;
    const nextToken = continuationTokenRef.current;
    if (append && !nextToken) return;

    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    const requestRevision = ++requestRevisionRef.current;
    const isCurrentRequest = () => !controller.signal.aborted
      && requestRevisionRef.current === requestRevision;

    if (append) setLoadingMore(true);
    else if (refresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(false);

    try {
      const favoritesRequest = favoritesApi.listFavorites().catch(() => null);
      if (section === 'mine') {
        const [data, favoriteData] = await Promise.all([
          recipeApi.list(controller.signal),
          favoritesRequest,
        ]);
        if (!isCurrentRequest()) return;
        setRecipes(data.recipes);
        if (favoriteData) setFavorites(favoriteData);
        continuationTokenRef.current = undefined;
        setContinuationToken(undefined);
      } else {
        const page = await recipeApi.listCommunity({
          limit: 20,
          ...(append && nextToken ? { continuationToken: nextToken } : {}),
        }, controller.signal);
        const favoriteData = await favoritesRequest;
        if (!isCurrentRequest()) return;
        setCommunityRecipes((current) => {
          if (!append) return page.recipes;
          const existingIds = new Set(current.map((recipe) => recipe.id));
          return [...current, ...page.recipes.filter((recipe) => !existingIds.has(recipe.id))];
        });
        continuationTokenRef.current = page.continuationToken;
        setContinuationToken(page.continuationToken);
        if (favoriteData) setFavorites(favoriteData);
      }
    } catch {
      if (isCurrentRequest()) setLoadError(true);
    } finally {
      if (isCurrentRequest()) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
  }, [section]);

  const favoriteIds = new Set(favorites.map((f) => f.foodRef));

  const handleFavoriteToggle = useCallback(
    async (recipe: RecipeCardRecipe) => {
      if (favoriteBusyId !== null) return;
      const existingFavorite = favorites.find((favorite) => favorite.foodRef === recipe.id);
      setFavoriteBusyId(recipe.id);
      if (existingFavorite) {
        setFavorites((prev) => prev.filter((f) => f.foodRef !== recipe.id));
      }
      try {
        if (existingFavorite) {
          await favoritesApi.removeFavorite(recipe.id);
        } else {
          const favorite = await favoritesApi.addFavorite({
            foodRef: recipe.id,
            foodRefType: 'recipe',
            displayName: recipe.name,
          });
          setFavorites((current) => [
            ...current.filter((relation) => relation.foodRef !== recipe.id),
            favorite,
          ]);
        }
      } catch (error: unknown) {
        if (existingFavorite && getResponseStatus(error) !== 404) {
          setFavorites((current) => [...current, existingFavorite]);
          setErrorNotice({
            title: 'Favorit konnte nicht entfernt werden',
            body: 'Bitte prüfe deine Verbindung und versuche es erneut.',
          });
        } else if (!existingFavorite) {
          setErrorNotice({
            title: 'Favorit konnte nicht gespeichert werden',
            body: 'Das Rezept ist möglicherweise nicht mehr verfügbar. Bitte aktualisiere die Community-Liste.',
          });
          if (getResponseStatus(error) === 404) void load({ refresh: true });
        }
      } finally {
        setFavoriteBusyId(null);
      }
    },
    [favoriteBusyId, favorites, load],
  );

  const handleRemoveUnavailableFavorite = useCallback(async (favorite: UserFoodRelation) => {
    if (favoriteBusyId !== null) return;
    setFavoriteBusyId(favorite.foodRef);
    setFavorites((current) => current.filter((relation) => relation.foodRef !== favorite.foodRef));
    try {
      await favoritesApi.removeFavorite(favorite.foodRef);
    } catch (error: unknown) {
      if (getResponseStatus(error) !== 404) {
        setFavorites((current) => [...current, favorite]);
        setErrorNotice({
          title: 'Favorit konnte nicht entfernt werden',
          body: 'Bitte prüfe deine Verbindung und versuche es erneut.',
        });
      }
    } finally {
      setFavoriteBusyId(null);
    }
  }, [favoriteBusyId]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        requestControllerRef.current?.abort();
        requestRevisionRef.current += 1;
      };
    }, [load]),
  );

  const handleLoadMore = useCallback(() => {
    if (section !== 'community' || loading || loadingMore || !continuationToken) return;
    void load({ append: true });
  }, [continuationToken, load, loading, loadingMore, section]);

  const handleRetry = useCallback(() => {
    if (section === 'community' && communityRecipes.length > 0 && continuationToken) {
      void load({ append: true });
    } else {
      void load({ refresh: true });
    }
  }, [communityRecipes.length, continuationToken, load, section]);

  const recent = recipes.filter((r) => r.lastUsedAt != null).slice(0, 5);
  const visibleRecipes: RecipeCardRecipe[] = section === 'mine' ? recipes : communityRecipes;
  const unavailableFavorites = section === 'community'
    ? favorites.filter((favorite) => (
        favorite.foodRefType === 'recipe'
        && favorite.isFavorite
        && favorite.recipeAccess === 'unavailable'
      ))
    : [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.screenTitle}>Rezepte</Text>
      <View style={styles.segmentedControl}>
        <TouchableOpacity
          style={[styles.segment, section === 'mine' && styles.segmentSelected]}
          onPress={() => setSection('mine')}
          accessibilityRole="tab"
          accessibilityLabel="Deine Rezepte"
          accessibilityState={{ selected: section === 'mine' }}
        >
          <Text style={[styles.segmentText, section === 'mine' && styles.segmentTextSelected]}>
            Deine Rezepte
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, section === 'community' && styles.segmentSelected]}
          onPress={() => setSection('community')}
          accessibilityRole="tab"
          accessibilityLabel="Community-Rezepte"
          accessibilityState={{ selected: section === 'community' }}
        >
          <Text style={[styles.segmentText, section === 'community' && styles.segmentTextSelected]}>
            Community-Rezepte
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load({ refresh: true })} />}
      >
        {loadError && (
          <View style={styles.errorState}>
            <Text style={styles.errorText}>Rezepte konnten nicht geladen werden.</Text>
            <TouchableOpacity onPress={handleRetry} accessibilityRole="button">
              <Text style={styles.retryText}>Erneut versuchen</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading && visibleRecipes.length === 0 && !loadError ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : section === 'mine' ? (
          <>
            {recent.length > 0 && (
              <>
                <Text style={styles.sectionHeader}>Zuletzt verwendet</Text>
                {recent.map((recipe) => (
                  <RecipeCard
                    key={`recent-${recipe.id}`}
                    recipe={recipe}
                    isFavorite={favoriteIds.has(recipe.id)}
                    favoriteBusy={favoriteBusyId === recipe.id}
                    onPress={() => navigation.navigate('RecipeDetail', { id: recipe.id })}
                    onFavoriteToggle={handleFavoriteToggle}
                  />
                ))}
              </>
            )}
            {recipes.length > 0 && (
              <>
                <Text style={styles.sectionHeader}>Alle Rezepte</Text>
                {recipes.map((recipe) => (
                  <RecipeCard
                    key={`all-${recipe.id}`}
                    recipe={recipe}
                    isFavorite={favoriteIds.has(recipe.id)}
                    favoriteBusy={favoriteBusyId === recipe.id}
                    onPress={() => navigation.navigate('RecipeDetail', { id: recipe.id })}
                    onFavoriteToggle={handleFavoriteToggle}
                  />
                ))}
              </>
            )}
            {recipes.length === 0 && !loading && !loadError && (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Noch keine Rezepte</Text>
                <Text style={styles.emptySubtitle}>Tippe auf + um dein erstes Rezept zu erstellen.</Text>
              </View>
            )}
          </>
        ) : (
          <>
            {communityRecipes.length > 0 && (
              <>
                <Text style={styles.sectionHeader}>Community-Rezepte</Text>
                {communityRecipes.map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    isFavorite={favoriteIds.has(recipe.id)}
                    favoriteBusy={favoriteBusyId === recipe.id}
                    onPress={() => navigation.navigate('RecipeDetail', recipe.isOwnRecipe
                      ? { id: recipe.id }
                      : { id: recipe.id, source: 'community' })}
                    onFavoriteToggle={handleFavoriteToggle}
                  />
                ))}
              </>
            )}

            {unavailableFavorites.length > 0 && (
              <>
                <Text style={styles.sectionHeader}>Nicht mehr verfügbare Favoriten</Text>
                {unavailableFavorites.map((favorite) => (
                  <View key={favorite.foodRef} style={styles.unavailableFavorite}>
                    <View style={styles.unavailableFavoriteCopy}>
                      <Text style={styles.unavailableFavoriteName} numberOfLines={2}>
                        {favorite.displayName}
                      </Text>
                      <Text style={styles.unavailableFavoriteMeta}>Nicht mehr in der Community verfügbar</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.removeFavoriteButton}
                      onPress={() => void handleRemoveUnavailableFavorite(favorite)}
                      disabled={favoriteBusyId === favorite.foodRef}
                      accessibilityRole="button"
                      accessibilityLabel="Favorit entfernen"
                    >
                      <Icon lib="ion" name="heart" size="md" color={colors.negative} />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}

            {communityRecipes.length === 0
              && unavailableFavorites.length === 0
              && !loading
              && !loadError && (
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>Noch keine Community-Rezepte</Text>
                </View>
              )}

            {continuationToken && (
              <TouchableOpacity
                style={styles.loadMoreButton}
                onPress={handleLoadMore}
                disabled={loading || loadingMore}
                accessibilityRole="button"
                accessibilityLabel="Mehr Rezepte laden"
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.loadMoreText}>Mehr Rezepte laden</Text>
                )}
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      {section === 'mine' && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('RecipeWizard')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Rezept erstellen"
        >
          <Text style={styles.fabLabel}>+</Text>
        </TouchableOpacity>
      )}

      <InfoOverlay
        visible={errorNotice != null}
        title={errorNotice?.title ?? 'Fehler'}
        body={errorNotice?.body ?? ''}
        onClose={() => setErrorNotice(null)}
      />
    </SafeAreaView>
  );
}

function getResponseStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('response' in error)) return null;
  const response = error.response;
  if (typeof response !== 'object' || response === null || !('status' in response)) return null;
  return typeof response.status === 'number' ? response.status : null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl + spacing.xl },
  screenTitle: { ...typography.h1, color: colors.text, marginHorizontal: spacing.md, marginTop: spacing.md, marginBottom: spacing.md },
  segmentedControl: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
  },
  segmentSelected: { backgroundColor: colors.surfaceMuted },
  segmentText: { ...typography.body2, color: colors.textMuted, textAlign: 'center', flexShrink: 1 },
  segmentTextSelected: { color: colors.text, fontWeight: '600' },
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
  loadingState: { paddingVertical: spacing.xxl, alignItems: 'center' },
  errorState: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  errorText: { ...typography.body2, color: colors.textSecondary, textAlign: 'center' },
  retryText: { ...typography.button, color: colors.primary },
  unavailableFavorite: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    paddingLeft: spacing.md,
  },
  unavailableFavoriteCopy: { flex: 1, minWidth: 0, paddingVertical: spacing.sm },
  unavailableFavoriteName: { ...typography.body2, color: colors.text, fontWeight: '600' },
  unavailableFavoriteMeta: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  removeFavoriteButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  loadMoreText: { ...typography.button, color: colors.primary },
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
