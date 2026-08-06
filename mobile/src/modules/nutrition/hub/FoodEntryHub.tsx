// FoodEntryHub — central food entry component.
// Opened as a BottomSheetModal from anywhere in the app via useFoodEntryHubStore.
// Manages its own state machine via hubReducer.
// Closes automatically on tab navigation.

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Modal, Platform, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View, Animated as RNAnimated } from 'react-native';
import { BottomSheetModal, BottomSheetTextInput, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  FadeIn,
  useReducedMotion,
} from 'react-native-reanimated';
import type { FoodSearchResult, UserFoodRelation, MealType } from '@fittrack/shared';
import { Icon } from '../../../shared/components/Icon';

import type { ReusableItem } from '@fittrack/shared';
import { favoritesApi } from '../../../shared/api/favoritesApi';
import { foodApi } from '../../../shared/api/foodApi';
import { nutritionDiaryService as diaryApi } from '../../../services/nutritionDiaryService';
import { reusableItemsApi } from '../../../shared/api/reusableItemsApi';
import { recipeApi } from '../../../shared/api/recipeApi';
import { colors, radius, spacing, typography } from '../../../app/theme';
import { computeLastUsageText, computeMacroText, computeDirectAddLabel, relativeUsage, sortByMealTypeUsage } from './FoodEntryHub.utils';
export { computeLastUsageText, computeMacroText };
import { useFoodEntryHubStore } from './useFoodEntryHubStore';
import { hubReducer, INITIAL_HUB_STATE } from './hubReducer';
import type { QuickEntryPrefill } from './hubReducer';
import { FoodList } from './FoodList';
import { SearchState } from './SearchState';
import { QuantityView } from './QuantityView';
import { ManuellerSubFlow } from './ManuellerSubFlow';
import { AISubFlow } from './AISubFlow';
import { BarcodeSubFlow } from './BarcodeSubFlow';
import { LabelSubFlow } from './LabelSubFlow';
import { getSuggestedMealType } from './mealTimeRules';

// Einziger Snap Point -- Sheet bleibt bei 85%, Tastatur überlagert nur den unteren Inhalt
const DEFAULT_SNAP_POINTS = ['85%'];
const FULL_SNAP_POINTS = ['100%'];

// ---------------------------------------------------------------------------
// Filter types + options
// ---------------------------------------------------------------------------

type FilterKey = 'fuerDich' | 'zuleztVerwendet' | 'alle' | MealType;

const FILTER_OPTIONS: Array<{ key: FilterKey; label: string; modalLabel?: string }> = [
  { key: 'fuerDich',        label: 'Für dich' },
  { key: 'zuleztVerwendet', label: 'Zuletzt verwendet' },
  { key: 'breakfast',       label: '☀️ Frühstück',      modalLabel: 'Frühstück' },
  { key: 'lunch',           label: '🌤️ Mittagessen',    modalLabel: 'Mittagessen' },
  { key: 'dinner',          label: '🌙 Abendessen',     modalLabel: 'Abendessen' },
  { key: 'snack',           label: '🍎 Snack',          modalLabel: 'Snack' },
  { key: 'preworkout',      label: '⚡ Pre Workout',    modalLabel: 'Pre Workout' },
  { key: 'postworkout',     label: '💪 Post Workout',   modalLabel: 'Post Workout' },
  { key: 'alle',            label: 'Alle' },
];

const MEAL_LABEL: Record<string, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snack',
  preworkout: 'Pre-Workout',
  postworkout: 'Post-Workout',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function FoodEntryHub() {
  const { isOpen, context, onSuccess, close, autoFocusSearch, initialSubflow, autoCloseOnSave, topInset: hubTopInset } = useFoodEntryHubStore();
  const [hubState, dispatch] = useReducer(hubReducer, INITIAL_HUB_STATE);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  // searchActive bleibt true solange der Nutzer im Suchmodus ist -- unabhängig vom Keyboard-Status
  const [searchActive, setSearchActive] = useState(false);
  const [addedItem, setAddedItem] = useState<{ productName: string; mealId: string; itemId: string } | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  // Filter-State für den IdleMode
  const [activeFilter, setActiveFilter] = useState<FilterKey>('fuerDich');
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [directAddLoadingRefs, setDirectAddLoadingRefs] = useState<Set<string>>(new Set());
  // Favoriten für "Für dich" und Mahlzeit-Filter
  const [allFavorites, setAllFavorites] = useState<UserFoodRelation[]>([]);
  const [allFavoritesLoading, setAllFavoritesLoading] = useState(false);
  const [allFavoritesError, setAllFavoritesError] = useState<string | null>(null);
  // "Alle"-Liste (lazily loaded)
  const [allItems, setAllItems] = useState<UserFoodRelation[]>([]);
  const [allItemsLoaded, setAllItemsLoaded] = useState(false);
  // Session-stabile Relevanzsortierung + Kontext-Mahlzeit
  const sessionOrderRef = useRef<UserFoodRelation[] | null>(null);
  const [recents, setRecents] = useState<UserFoodRelation[]>([]);
  // Gecachte Suchergebnisse — erhalten beim Übergang in Quantity-Modus und zurück
  const [cachedResults, setCachedResults] = useState<FoodSearchResult[]>([]);
  const sheetRef = useRef<BottomSheetModal>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const searchInputRef = useRef<any>(null);
  // Guard: ignoriert Android-Auto-Focus während der Sheet-Öffnungsanimation.
  // Auf Android fokussiert das System den ersten TextInput automatisch beim Sheet-Open.
  // Ohne diesen Guard aktiviert sich searchActive sofort und überschreibt IdleState.
  const sheetSettledRef = useRef(false);
  // Trackt ob das Sheet gerade visuell offen ist (nicht den Store-State).
  const sheetIsOpenRef = useRef(false);
  // Verhindert Reset wenn Tastatur durch Produktauswahl geschlossen wird
  const blurIsSelectionRef = useRef(false);
  // Refs für Keyboard-Listener (verhindert stale closures)
  const searchFocusedRef = useRef(false);
  const searchQueryRef = useRef('');
  const insets = useSafeAreaInsets();

  // Snackbar: identisch zu DiaryScreen (Opacity-Fade, Core RN Animated)
  const snackbarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snackbarOpacity = useRef(new RNAnimated.Value(0)).current;
  const snackbarTimerProgress = useRef(new RNAnimated.Value(1)).current;

  const reducedMotion = useReducedMotion();

  // Keyboard-Sichtbarkeit tracken um paddingBottom dynamisch anzupassen
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // ---------------------------------------------------------------------------
  // Favorites loading
  // ---------------------------------------------------------------------------

  const loadFavorites = useCallback(async () => {
    setAllFavoritesLoading(true);
    setAllFavoritesError(null);
    try {
      const contextMealType = context.mealType ?? getSuggestedMealType();
      const response = await favoritesApi.listFavoritesRanked(contextMealType);
      setAllFavorites(response.items);
      sessionOrderRef.current = response.items;
    } catch (e: unknown) {
      setAllFavoritesError(e instanceof Error ? e.message : 'Laden fehlgeschlagen');
    } finally {
      setAllFavoritesLoading(false);
    }
  }, [context.mealType]);

  const loadAllItems = useCallback(async () => {
    if (allItemsLoaded) return;
    try {
      const [favorites, { items: reusableItems }, { recipes }] = await Promise.all([
        favoritesApi.listFavorites(),
        reusableItemsApi.list(),
        recipeApi.list(),
      ]);
      const favRefSet = new Set(favorites.map(f => f.foodRef));
      const extraItems: UserFoodRelation[] = [
        ...reusableItems
          .filter(item => !favRefSet.has(item.id))
          .map(item => ({
            id: `personal:${item.id}`,
            userId: '',
            foodRef: item.id,
            foodRefType: 'personal' as const,
            displayName: item.name,
            displayBrand: item.brand ?? undefined,
            imageUrl: item.imageUrl ?? null,
            isFavorite: false,
            usageCount: 0,
            lastUsedAt: null,
            createdAt: item.createdAt,
            nutritionPer100g: item.nutritionPer100g,
            portion: item.portion,
          })),
        ...recipes
          .filter(r => !favRefSet.has(r.id))
          .map(r => ({
            id: `recipe:${r.id}`,
            userId: '',
            foodRef: r.id,
            foodRefType: 'recipe' as const,
            displayName: r.name,
            imageUrl: r.images?.[0]?.url ?? null,
            isFavorite: false,
            usageCount: r.usageCount,
            lastUsedAt: r.lastUsedAt ?? null,
            createdAt: r.createdAt,
          })),
      ];
      const merged = [...favorites, ...extraItems].sort((a, b) =>
        (a.displayName ?? '').localeCompare(b.displayName ?? '', 'de'),
      );
      setAllItems(merged);
      setAllItemsLoaded(true);
    } catch {
      // Silent — show what we have
    }
  }, [allItemsLoaded]);

  useEffect(() => {
    if (activeFilter === 'alle') void loadAllItems();
  }, [activeFilter, loadAllItems]);

  // ---------------------------------------------------------------------------
  // Open / close sync with store
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (isOpen) {
      dispatch({ type: 'RESET' });
      setSearchQuery('');
      setSearchFocused(false);
      setSearchActive(false);
      setAddedItem(null);
      setActiveFilter('fuerDich');
      setCachedResults([]);
      favoritesApi.listRecent(20).then(setRecents).catch(() => setRecents([]));
      void loadFavorites();

      if (autoCloseOnSave && initialSubflow) {
        // HomeScreen-Subflow: Bottom Sheet NICHT öffnen — kein sheetIsOpenRef setzen
        dispatch({ type: 'OPEN_SUBFLOW', flow: initialSubflow });
        return;
      }

      sheetIsOpenRef.current = true;
      sheetSettledRef.current = false;
      sheetRef.current?.present();
      // Nach der Sheet-Animation (600ms) Focus-Events wieder erlauben
      setTimeout(() => { sheetSettledRef.current = true; }, 600);
      if (autoFocusSearch) {
        setTimeout(() => searchInputRef.current?.focus(), 480);
      }
      if (initialSubflow) {
        // Kleines Delay damit das Sheet erst animiert hat
        setTimeout(() => dispatch({ type: 'OPEN_SUBFLOW', flow: initialSubflow }), 350);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (sheetIsOpenRef.current) {
      sessionOrderRef.current = null;
      sheetRef.current?.dismiss();
    }
  }, [isOpen, loadFavorites]);

  // Lazy Sheet-Präsentation: wenn im HomeScreen-Subflow ein Produkt gefunden wurde,
  // muss das Sheet jetzt geöffnet werden (QuantityView lebt darin).
  useEffect(() => {
    if (isOpen && hubState.mode === 'product' && !sheetIsOpenRef.current) {
      sheetIsOpenRef.current = true;
      sheetRef.current?.present();
    }
  }, [isOpen, hubState.mode]);

  // Keyboard-Listener: zuverlässige Tastatur-Dismiss-Erkennung (onBlur feuert in BottomSheet nicht immer)
  useEffect(() => {
    if (!isOpen) return;
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      if (blurIsSelectionRef.current) {
        // Tastatur durch Produktauswahl geschlossen — kein Reset
        blurIsSelectionRef.current = false;
        searchFocusedRef.current = false;
        setSearchFocused(false);
        return;
      }
      if (!searchFocusedRef.current) {
        // Tastatur war nicht durch unser Suchfeld fokussiert (z.B. Subflow oder Scroll-Edge-Case)
        // → kein Reset, Suchzustand beibehalten
        return;
      }
      // Nutzer hat Tastatur manuell geschlossen → zurück zu Idle (PO-2: Filter reset)
      searchFocusedRef.current = false;
      searchQueryRef.current = '';
      setSearchFocused(false);
      setSearchQuery('');
      setSearchActive(false);
      setActiveFilter('fuerDich');
      dispatch({ type: 'RESET' });
    });
    return () => sub.remove();
  }, [isOpen]);
  // Snackbar: Opacity-Fade identisch zu DiaryScreen (Core RN Animated)
  const dismissSnackbar = useCallback(() => {
    if (snackbarTimerRef.current) clearTimeout(snackbarTimerRef.current);
    RNAnimated.timing(snackbarOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setAddedItem(null);
    });
  }, [snackbarOpacity]);

  useEffect(() => {
    if (addedItem) {
      // Fade in
      snackbarTimerProgress.setValue(1);
      RNAnimated.timing(snackbarOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      // Timer-Progressbar
      RNAnimated.timing(snackbarTimerProgress, { toValue: 0, duration: 5000, useNativeDriver: false }).start();
      // Auto-Dismiss mit Fade-out
      if (snackbarTimerRef.current) clearTimeout(snackbarTimerRef.current);
      snackbarTimerRef.current = setTimeout(dismissSnackbar, 5000);
    }
    return () => {
      if (snackbarTimerRef.current) clearTimeout(snackbarTimerRef.current);
    };
  }, [addedItem, snackbarOpacity, snackbarTimerProgress, dismissSnackbar]);

  const handleSheetDismiss = useCallback(() => {
    // Sheet hat sich selbst geschlossen (Swipe/onDismiss). Ref VOR close() setzen,
    // damit useEffect([isOpen]) kein doppeltes dismiss() ausführt.
    sheetIsOpenRef.current = false;
    onSuccess?.();
    close();
  }, [close, onSuccess]);

  // ---------------------------------------------------------------------------
  // Header subtitle
  // ---------------------------------------------------------------------------

  const subtitle = useMemo(() => {
    if (!context.mealId) return null;
    const labels: Record<string, string> = {
      breakfast: 'Frühstück',
      lunch: 'Mittagessen',
      dinner: 'Abendessen',
      snack: 'Snack',
      preworkout: 'Pre-Workout',
      postworkout: 'Post-Workout',
    };
    const label = labels[context.mealType] ?? context.mealType;
    return `Hinzufügen zu ${label}`;
  }, [context.mealId, context.mealType]);

  // ---------------------------------------------------------------------------
  // Search field handlers
  // ---------------------------------------------------------------------------

  const handleSearchFocus = useCallback(() => {
    // Android fokussiert TextInput automatisch beim Sheet-Open — ignorieren bis Sheet settled ist
    if (!sheetSettledRef.current && !autoFocusSearch) return;
    searchFocusedRef.current = true;
    setSearchFocused(true);
    setSearchActive(true);
    setActiveFilter('zuleztVerwendet');
    dispatch({ type: 'OPEN_SEARCH' });
  }, [autoFocusSearch]);

  const handleSearchBlur = useCallback(() => {
    // Tastatur-Dismiss wird primär über keyboardDidHide-Listener behandelt.
    // onBlur hier nur als minimaler Fallback für Android.
    searchFocusedRef.current = false;
    setSearchFocused(false);
  }, []);

  const handleSearchChange = useCallback((text: string) => {
    searchQueryRef.current = text;
    setSearchQuery(text);
    dispatch({ type: 'SET_QUERY', query: text });
  }, []);

  // ---------------------------------------------------------------------------
  // Product selection
  // ---------------------------------------------------------------------------

  const handleSelectProduct = useCallback((product: FoodSearchResult) => {
    blurIsSelectionRef.current = true;
    Keyboard.dismiss();
    dispatch({ type: 'SELECT_PRODUCT', product });
  }, []);

  /**

   * Quick Entry / Favorit auswählen:
   * Fast path wenn nutritionPer100g vorhanden — kein Netzwerk-Call.
   * Fallback auf foodApi.search() für Legacy-Einträge ohne denormalisierte Nährwerte.
   */
  const handleSelectRelation = useCallback(async (relation: UserFoodRelation) => {
    blurIsSelectionRef.current = true;
    Keyboard.dismiss();

    if (relation.nutritionPer100g) {
      // Fast path: construct FoodSearchResult from cached relation data
      const product: FoodSearchResult = {
        id: relation.foodRef,
        source: relation.foodRefType === 'catalog' ? 'openFoodFacts' : 'library',
        name: relation.displayName,
        brand: relation.displayBrand,
        displayLabel: '',
        nutritionBasis: 'per100g',
        nutritionPer100g: relation.nutritionPer100g,
        portion: relation.portion ?? undefined,
        isComplete: true,
        imageUrl: relation.imageUrl ?? undefined,
        isFavorite: relation.isFavorite,
      };
      const prefill: QuickEntryPrefill = {
        inputMode: relation.preferredInputMode,
        inputAmount: relation.preferredInputAmount,
      };
      dispatch({ type: 'SELECT_PRODUCT', product, prefill });
      return;
    }

    // Fallback: legacy record without denormalized nutrition
    try {
      const { results } = await foodApi.search(relation.displayName);
      const match = results.find((r) => r.id === relation.foodRef);
      if (match) {
        dispatch({ type: 'SELECT_PRODUCT', product: match });
        return;
      }
    } catch {
      // Fallback below
    }
    dispatch({
      type: 'SELECT_PRODUCT',
      product: {
        id: relation.foodRef,
        source: relation.foodRefType === 'catalog' ? 'openFoodFacts' : 'library',
        name: relation.displayName,
        brand: relation.displayBrand,
        displayLabel: '',
        nutritionBasis: 'per100g',
        isComplete: false,
      },
    });
  }, [dispatch]);

  // ---------------------------------------------------------------------------
  // QuantityView callbacks
  // ---------------------------------------------------------------------------

  const handleQuantityBack = useCallback(() => {
    dispatch({ type: 'CLOSE_PRODUCT' });
  }, []);

  const handleQuantityAdded = useCallback((productName: string, mealId: string, itemId: string) => {
    if (autoCloseOnSave) {
      // HomeScreen-Modus: Hub sofort schließen, kein Snackbar
      onSuccess?.();
      close();
      return;
    }
    dispatch({ type: 'RESET' });
    setSearchQuery('');
    searchQueryRef.current = '';
    setSearchFocused(false);
    searchFocusedRef.current = false;
    setAddedItem({ productName, mealId, itemId });
    onSuccess?.();
    // Recents sofort aktualisieren -- neues Item erscheint direkt in der Liste
    favoritesApi.listRecent(20).then(setRecents).catch(() => {});
    // Favoriten neu laden damit lastInputAmount sofort sichtbar wird
    sessionOrderRef.current = null;
    void loadFavorites();
  }, [autoCloseOnSave, onSuccess, close, loadFavorites]);

  // ---------------------------------------------------------------------------
  // Hub-Snackbar actions
  // ---------------------------------------------------------------------------

  // Undo: zuletzt hinzugefuegten Eintrag loeschen
  const handleUndo = useCallback(async () => {
    if (!addedItem?.itemId || !addedItem?.mealId) return;
    try {
      await diaryApi.deleteItem(addedItem.mealId, addedItem.itemId);
      onSuccess?.(); // DiaryScreen refresht
    } catch {
      // silently ignore
    } finally {
      dismissSnackbar();
    }
  }, [addedItem, onSuccess, dismissSnackbar]);

  // ---------------------------------------------------------------------------
  // Subflow handlers
  // ---------------------------------------------------------------------------

  const handleOpenSubflow = useCallback((flow: 'barcode' | 'ai' | 'label' | 'manual') => {
    Keyboard.dismiss();
    dispatch({ type: 'OPEN_SUBFLOW', flow });
  }, []);

  // UX-1: Auto-focus search from IdleState when both lists empty
  const handleRequestFocus = useCallback(() => {
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  // ---------------------------------------------------------------------------
  // Filter display items + secondary text + direct-add
  // ---------------------------------------------------------------------------

  const ordered = sessionOrderRef.current ?? allFavorites;

  const displayItems = useMemo((): UserFoodRelation[] => {
    switch (activeFilter) {
      case 'fuerDich':
        return ordered;
      case 'zuleztVerwendet':
        return recents;
      case 'alle':
        return allItems;
      default: {
        const mealType = activeFilter as MealType;
        return sortByMealTypeUsage(ordered, mealType);
      }
    }
  }, [activeFilter, ordered, recents, allItems]);

  const getSecondaryText = useCallback((item: UserFoodRelation): string | null => {
    switch (activeFilter) {
      case 'fuerDich':
        return computeLastUsageText(item);
      case 'zuleztVerwendet':
        return item.lastUsedAt ? relativeUsage(item.lastUsedAt) : null;
      case 'alle':
        return computeMacroText(item);
      default: {
        const mealType = activeFilter as MealType;
        const count = (item.usageDates ?? []).filter(e => e.mealType === mealType).length;
        const label = MEAL_LABEL[mealType] ?? mealType;
        return count > 0 ? `${count}\u00d7 zum ${label}` : null;
      }
    }
  }, [activeFilter]);

  const getDirectAddLabel = useCallback((item: UserFoodRelation): string | null => {
    return computeDirectAddLabel(item, activeFilter);
  }, [activeFilter]);

  const sessionMealHint = useMemo(() => {
    const meal = getSuggestedMealType();
    const labels: Record<string, string> = {
      breakfast:   'Passend zur Frühstückszeit',
      snack:       'Basierend auf deiner Nutzung',
      lunch:       'Passend zur Mittagszeit',
      dinner:      'Passend zur Abendessenszeit',
      preworkout:  'Passend zum Training',
      postworkout: 'Passend zum Training',
    };
    return labels[meal] ?? 'Basierend auf deiner Nutzung';
  }, []);

  const visibleMealFilters = useMemo((): FilterKey[] => {
    const mealKeys: FilterKey[] = ['breakfast', 'lunch', 'dinner', 'snack', 'preworkout', 'postworkout'];
    return mealKeys.filter(key =>
      allFavorites.some(item => (item.usageDates ?? []).some(e => e.mealType === (key as MealType)))
    );
  }, [allFavorites]);

  const handleDirectAdd = useCallback(async (item: UserFoodRelation) => {
    // Fehlende Nährwerte → kein Direkthinzufügen möglich
    if (!item.preferredInputAmount || !item.nutritionPer100g) {
      void handleSelectRelation(item);
      return;
    }
    // Temporäre IDs (Kaltstart-Race) → QuantityView als Fallback
    if (context.mealId?.startsWith('temp-')) {
      void handleSelectRelation(item);
      return;
    }
    setDirectAddLoadingRefs(prev => new Set(prev).add(item.foodRef));
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Kein mealId (z.B. HomeScreen): Mahlzeit per Tageszeit-Typ finden oder neu anlegen
      let mealId = context.mealId;
      if (!mealId) {
        const dayData = await diaryApi.getDay(context.date);
        const existing = dayData.meals.find((m) => m.type === context.mealType);
        if (existing) {
          mealId = existing.id;
        } else {
          const created = await diaryApi.createMeal(context.date, context.mealType);
          mealId = created.meal.id;
        }
      }
      const amountGrams = item.preferredInputMode === 'portion'
        ? item.preferredInputAmount * (item.portion?.weightGrams ?? 100)
        : item.preferredInputAmount;
      const result = await diaryApi.addItem(mealId, {
        productId: item.foodRef,
        productName: item.displayName,
        inputMode: item.preferredInputMode ?? 'grams',
        inputAmount: item.preferredInputAmount,
        amountGrams,
        // foodRefType → backend sourceType enum mapping
        sourceType: item.foodRefType === 'catalog' ? 'openFoodFacts' : item.foodRefType === 'personal' ? 'reusableItem' : item.foodRefType,
        imageUrl: item.imageUrl,
        calculatedNutrition: {
          calories: item.nutritionPer100g.calories * amountGrams / 100,
          protein: item.nutritionPer100g.protein * amountGrams / 100,
          carbs: item.nutritionPer100g.carbs * amountGrams / 100,
          fat: item.nutritionPer100g.fat * amountGrams / 100,
        },
      });
      const items = result.meal?.items ?? [];
      const itemId = items[items.length - 1]?.id ?? '';
      handleQuantityAdded(item.displayName, mealId, itemId);
    } catch {
      // API-Fehler → Fallback auf QuantityView
      void handleSelectRelation(item);
    } finally {
      setDirectAddLoadingRefs(prev => {
        const next = new Set(prev);
        next.delete(item.foodRef);
        return next;
      });
    }
  }, [context, handleSelectRelation, handleQuantityAdded]);

  const handleSubflowClose = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const handleSubflowSaved = useCallback((productName: string) => {
    if (autoCloseOnSave) {
      // HomeScreen-Modus: Subflow-State leeren, Hub schließen, HomeScreen aktualisieren
      dispatch({ type: 'RESET' });
      onSuccess?.();
      close();
      return;
    }
    dispatch({ type: 'RESET' });
    // Subflows: kein itemId verfuegbar -> Snackbar ohne Undo
    setAddedItem({ productName, mealId: '', itemId: '' });
    onSuccess?.();
  }, [autoCloseOnSave, onSuccess, close]);

  const handleBarcodeProductFound = useCallback((product: FoodSearchResult) => {
    dispatch({ type: 'SELECT_PRODUCT', product });
  }, []);

  /** Label Scan "Als Produkt speichern" → direkt ProduktDialog öffnen */
  const handleLabelProductFound = useCallback((product: FoodSearchResult) => {
    // Transitioning subflow → product state: LabelSubFlow becomes invisible, ProduktDialog opens
    dispatch({ type: 'SELECT_PRODUCT', product });
  }, []);

  const handleBarcodeProductCreated = useCallback((_item: ReusableItem) => {
    dispatch({ type: 'RESET' });
    setAddedItem({ productName: 'Neues Produkt', mealId: '', itemId: '' });
    onSuccess?.();
  }, [onSuccess]);

  // showSearch: true wenn Suchmodus aktiv (searchActive) ODER Query vorhanden
  // searchActive bleibt auch nach Tastatur-Close per Scroll true
  const showSearch = searchActive || searchQuery.trim().length > 0;

  const headerTitle = showSearch && searchQuery.trim().length > 0
    ? 'Suchergebnisse'
    : FILTER_OPTIONS.find(o => o.key === activeFilter)?.label ?? 'Für dich';

  // Backdrop-Komponente für Hintergrundabdunklung (~10%)
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        opacity={0.28}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={hubTopInset > 0 ? FULL_SNAP_POINTS : DEFAULT_SNAP_POINTS}
        topInset={hubTopInset}
        enableDynamicSizing={false}
        index={0}
        onDismiss={handleSheetDismiss}
        keyboardBehavior={'none' as 'interactive'}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handle}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
      >
        <View style={[styles.container, { paddingBottom: keyboardVisible ? 0 : insets.bottom + spacing.sm }]}>

            {/* Header */}
            {subtitle ? (
              <View style={styles.header}>
                <View style={styles.contextBadge}>
                  <Text style={styles.contextBadgeText} numberOfLines={1}>{subtitle}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.headerMinimal} />
            )}

            {/* Search Bar — Pill + AI-Icon + Barcode-Icon */}
            <View style={styles.searchRow}>
              <View style={styles.searchPill}>
                <View style={styles.searchIconLeft}>
                  <Icon lib="feather" name="search" size="sm" color={colors.textMuted} />
                </View>
                <BottomSheetTextInput
                  ref={searchInputRef}
                  style={styles.searchInput}
                  placeholder={
                    context.mealId
                      ? `Für ${
                          context.mealType === 'breakfast' ? 'Frühstück' :
                          context.mealType === 'lunch' ? 'Mittagessen' :
                          context.mealType === 'dinner' ? 'Abendessen' :
                          context.mealType === 'snack' ? 'Snack' :
                          context.mealType === 'preworkout' ? 'Pre-Workout' :
                          context.mealType === 'postworkout' ? 'Post-Workout' :
                          'Mahlzeit'
                        } suchen…`
                      : 'Lebensmittel suchen…'
                  }
                  placeholderTextColor={colors.textMuted}
                  value={searchQuery}
                  onChangeText={handleSearchChange}
                  onFocus={handleSearchFocus}
                  onBlur={handleSearchBlur}
                  returnKeyType="search"
                  keyboardType="default"
                  autoCorrect={false}
                  autoCapitalize="none"
                  spellCheck={false}
                  clearButtonMode={Platform.OS === 'ios' ? 'while-editing' : 'never'}
                  accessibilityLabel="Lebensmittel suchen"
                />
                {Platform.OS === 'android' && searchQuery.length > 0 ? (
                  <TouchableOpacity
                    style={styles.searchClearBtn}
                    onPress={() => handleSearchChange('')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon lib="feather" name="x-circle" size="sm" color={colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>
              {/* AI-Einstieg — pill-förmiger Button passend zur Suchpill */}
              <TouchableOpacity
                style={styles.searchAction}
                onPress={() => handleOpenSubflow('ai')}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel="KI-Analyse"
              >
                <Icon lib="mci" name="auto-fix" size="md" color={colors.primary} />
              </TouchableOpacity>
              {/* Barcode-Einstieg */}
              <TouchableOpacity
                style={styles.searchAction}
                onPress={() => handleOpenSubflow('barcode')}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel="Barcode scannen"
              >
                <Icon lib="mci" name="barcode-scan" size="md" color={colors.primary} />
              </TouchableOpacity>
            </View>

          {/* Single filter pill — compact selector above content */}
          {hubState.mode !== 'product' && (
            <>
              <TouchableOpacity
                style={styles.hubHeader}
                onPress={showSearch ? undefined : () => { Haptics.selectionAsync(); setFilterModalOpen(true); }}
                disabled={showSearch}
                accessibilityRole="button"
                accessibilityLabel={`Filter: ${headerTitle}`}
              >
                <View style={styles.hubHeaderRow}>
                  <Text style={styles.hubHeaderTitle}>
                    {headerTitle}
                  </Text>
                  {!showSearch && (
                    <View style={styles.hubHeaderChevron}>
                      <Icon lib="feather" name="chevron-down" size={16} color={colors.textMuted} />
                    </View>
                  )}
                </View>
                {activeFilter === 'fuerDich' && !showSearch && (
                  <Text style={styles.hubHeaderSubtitle}>{sessionMealHint}</Text>
                )}
              </TouchableOpacity>

              <Modal
                visible={filterModalOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setFilterModalOpen(false)}
              >
                <TouchableWithoutFeedback onPress={() => setFilterModalOpen(false)}>
                  <View style={styles.filterModalOverlay}>
                    <TouchableWithoutFeedback>
                      <View style={styles.filterModalSheet}>
                        <Text style={styles.filterModalTitle}>Ansicht wählen</Text>
                        {/* Group 1: personal filters */}
                        {(['fuerDich', 'zuleztVerwendet'] as FilterKey[]).map(key => {
                          const opt = FILTER_OPTIONS.find(o => o.key === key)!;
                          const isActive = activeFilter === key;
                          return (
                            <TouchableOpacity
                              key={key}
                              style={[styles.filterModalItem, isActive && styles.filterModalItemActive]}
                              onPress={() => { Haptics.selectionAsync(); setActiveFilter(key); setFilterModalOpen(false); }}
                            >
                              <Text style={[styles.filterModalItemText, isActive && styles.filterModalItemTextActive]}>
                                {opt.modalLabel ?? opt.label}
                              </Text>
                              {isActive && <Icon lib="feather" name="check" size={16} color={colors.primary} />}
                            </TouchableOpacity>
                          );
                        })}

                        {/* Divider */}
                        {visibleMealFilters.length > 0 && (
                          <View style={{ height: 1, backgroundColor: colors.border, opacity: 0.5, marginVertical: spacing.xs }} />
                        )}

                        {/* Group 2: meal types with usage */}
                        {visibleMealFilters.map(key => {
                          const opt = FILTER_OPTIONS.find(o => o.key === key)!;
                          const isActive = activeFilter === key;
                          return (
                            <TouchableOpacity
                              key={key}
                              style={[styles.filterModalItem, isActive && styles.filterModalItemActive]}
                              onPress={() => { Haptics.selectionAsync(); setActiveFilter(key); setFilterModalOpen(false); }}
                            >
                              <Text style={[styles.filterModalItemText, isActive && styles.filterModalItemTextActive]}>
                                {opt.modalLabel ?? opt.label}
                              </Text>
                              {isActive && <Icon lib="feather" name="check" size={16} color={colors.primary} />}
                            </TouchableOpacity>
                          );
                        })}

                        {/* 'alle' always at end */}
                        <View style={{ height: 1, backgroundColor: colors.border, opacity: 0.5, marginVertical: spacing.xs }} />
                        {(() => {
                          const opt = FILTER_OPTIONS.find(o => o.key === 'alle')!;
                          const isActive = activeFilter === 'alle';
                          return (
                            <TouchableOpacity
                              style={[styles.filterModalItem, isActive && styles.filterModalItemActive]}
                              onPress={() => { Haptics.selectionAsync(); setActiveFilter('alle'); setFilterModalOpen(false); }}
                            >
                              <Text style={[styles.filterModalItemText, isActive && styles.filterModalItemTextActive]}>
                                {opt.label}
                              </Text>
                              {isActive && <Icon lib="feather" name="check" size={16} color={colors.primary} />}
                            </TouchableOpacity>
                          );
                        })()}
                      </View>
                    </TouchableWithoutFeedback>
                  </View>
                </TouchableWithoutFeedback>
              </Modal>
            </>
          )}

          {/* Content-Bereich */}
          <View style={styles.contentArea}>
            {hubState.mode === 'product' ? (
              <QuantityView
                product={hubState.product}
                prefill={hubState.prefill}
                context={context}
                onBack={handleQuantityBack}
                onAdded={handleQuantityAdded}
              />
            ) : showSearch ? (
              <SearchState
                query={searchQuery}
                recents={recents}
                initialResults={cachedResults}
                onSelect={handleSelectProduct}
                onSelectRelation={(relation) => void handleSelectRelation(relation)}
                onOpenSubflow={handleOpenSubflow}
                onResultsChange={setCachedResults}
              />
            ) : (
              <Animated.View
                key={activeFilter}
                entering={reducedMotion ? undefined : FadeIn.duration(150)}
                style={{ flex: 1 }}
              >
                {activeFilter === 'alle' && !allItemsLoaded ? (
                  <View style={styles.loadingCenter}>
                    <ActivityIndicator size="large" color={colors.primary} />
                  </View>
                ) : (
                  <FoodList
                    items={displayItems}
                    loading={allFavoritesLoading}
                    error={allFavoritesError}
                    onSelect={(item) => void handleSelectRelation(item)}
                    onRetry={() => void loadFavorites()}
                    getSecondaryText={getSecondaryText}
                    showDirectAdd={activeFilter === 'fuerDich'}
                    onDirectAdd={(item) => void handleDirectAdd(item)}
                    getDirectAddLabel={getDirectAddLabel}
                    isDirectAddLoading={(item) => directAddLoadingRefs.has(item.foodRef)}
                    emptyTitle={
                      activeFilter === 'fuerDich' ? 'Dein Schnellzugriff' : undefined
                    }
                    emptyBody={
                      activeFilter === 'fuerDich'
                        ? 'Markiere Lebensmittel oder Rezepte mit \u2764\ufe0f als Quick Entry.'
                        : undefined
                    }
                  />
                )}
              </Animated.View>
            )}
          </View>

          {/* Hub-Snackbar: identisches Look & Feel wie DiaryScreen-Snackbar */}
          {addedItem ? (
            <RNAnimated.View style={[styles.hubSnackbar, { bottom: insets.bottom + spacing.sm, opacity: snackbarOpacity }, styles.hubSnackbarOverflow]}>
              <View style={styles.hubSnackbarContent}>
                <Text style={styles.hubSnackbarText} numberOfLines={1}>
                  „{addedItem.productName}“ hinzugefügt
                </Text>
                <View style={styles.hubSnackbarActions}>
                  {addedItem.itemId ? (
                    <TouchableOpacity
                      onPress={() => { void handleUndo(); }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                    >
                      <Text style={styles.hubSnackbarUndo}>Rückgängig</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
              {/* Timer-Progressbar */}
              <RNAnimated.View
                style={[styles.hubSnackbarTimerBar, { width: snackbarTimerProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
              />
            </RNAnimated.View>
          ) : null}
        </View>
      </BottomSheetModal>

      {/* Sub-Flow Overlays — nur mounten wenn aktiv.
           Hintergrund: react-native-vision-camera und react-native-image-crop-picker
           sind native Module, die beim Mount initialisiert werden. Wenn sie immer
           im Tree sitzen (visible=false), crashen sie beim App-Start außerhalb
           eines EAS-Builds. Konditionelles Mounten löst das Problem. */}
      {hubState.mode === 'subflow' && hubState.flow === 'manual' && (
        <ManuellerSubFlow
          visible
          context={context}
          onClose={handleSubflowClose}
          onSaved={handleSubflowSaved}
        />
      )}
      {hubState.mode === 'subflow' && hubState.flow === 'ai' && (
        <AISubFlow
          visible
          context={context}
          onClose={handleSubflowClose}
          onSaved={handleSubflowSaved}
        />
      )}
      {hubState.mode === 'subflow' && hubState.flow === 'label' && (
        <LabelSubFlow
          visible
          context={context}
          onClose={handleSubflowClose}
          onSaved={handleSubflowSaved}
          onProductFound={handleLabelProductFound}
        />
      )}
      {hubState.mode === 'subflow' && hubState.flow === 'barcode' && (
        <BarcodeSubFlow
          visible
          context={context}
          onClose={handleSubflowClose}
          onProductFound={handleBarcodeProductFound}
          onProductCreated={handleBarcodeProductCreated}
          onLabelProductFound={handleLabelProductFound}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.32,
    shadowRadius: 20,
    elevation: 16,
  },
  // Content-Bereich
  contentArea: {
    flex: 1,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  handle: {
    backgroundColor: colors.textSecondary,
    width: 48,
    height: 5,
    borderRadius: 3,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  // Header: nur Context-Badge wenn Mahlzeit bekannt
  header: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  headerMinimal: {
    height: spacing.xs,
  },
  contextBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  contextBadgeText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600' as const,
  },
  // Search Bar — Pill + außenliegende AI/Barcode-Icons
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  searchPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 52,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  searchAction: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  searchIconLeft: {
    width: 20,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    ...typography.body1,
    paddingVertical: 0,
  },
  searchClearBtn: {
    width: 20,
    alignItems: 'center',
  },

  // Hub-Snackbar -- identisches Look & Feel wie shared Snackbar (DiaryScreen)
  hubSnackbar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 12,
  },
  // overflow:hidden als eigener Style wegen RNAnimated-View
  hubSnackbarOverflow: {
    overflow: 'hidden' as const,
  },
  hubSnackbarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  hubSnackbarText: {
    ...typography.body2,
    color: colors.text,
    flex: 1,
  },
  hubSnackbarActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginLeft: spacing.md,
  },
  hubSnackbarUndo: {
    ...typography.button,
    color: colors.primary,
  },
  hubSnackbarTimerBar: {
    height: 3,
    backgroundColor: colors.primary,
    opacity: 0.6,
  },
  hubHeader: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  hubHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hubHeaderTitle: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
  },
  hubHeaderChevron: {
    paddingLeft: spacing.xs,
  },
  hubHeaderSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  hubHeaderDisabled: {
    opacity: 0.5,
  },
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  filterModalSheet: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  filterModalTitle: {
    ...typography.overline,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  filterModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  filterModalItemActive: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
  },
  filterModalItemText: {
    ...typography.body2,
    color: colors.text,
  },
  filterModalItemTextActive: {
    color: colors.primary,
    fontWeight: '600' as const,
  },
});
