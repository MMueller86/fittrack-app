// FoodEntryHub â€” central food entry component.
// Opened as a BottomSheetModal from anywhere in the app via useFoodEntryHubStore.
// Manages its own state machine via hubReducer.
// Closes automatically on tab navigation.

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Keyboard, Platform, StyleSheet, Text, TouchableOpacity, View, Animated as RNAnimated } from 'react-native';
import { BottomSheetModal, BottomSheetTextInput, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import type { FoodSearchResult, UserFoodRelation } from '@fittrack/shared';
import { Icon } from '../../../shared/components/Icon';

import type { ReusableItem } from '@fittrack/shared';
import { favoritesApi } from '../../../shared/api/favoritesApi';
import { foodApi } from '../../../shared/api/foodApi';
import { diaryApi } from '../../../shared/api/diaryApi';
import { colors, radius, spacing, typography } from '../../../app/theme';
import { useFoodEntryHubStore } from './useFoodEntryHubStore';
import { hubReducer, INITIAL_HUB_STATE } from './hubReducer';
import { IdleState } from './IdleState';
import { SearchState } from './SearchState';
import { QuantityView } from './QuantityView';
import { AllFavoritesInline } from './AllFavoritesInline';
import { ManuellerSubFlow } from './ManuellerSubFlow';
import { AISubFlow } from './AISubFlow';
import { BarcodeSubFlow } from './BarcodeSubFlow';
import { LabelSubFlow } from './LabelSubFlow';

// Einziger Snap Point -- Sheet bleibt bei 85%, Tastatur überlagert nur den unteren Inhalt
const SNAP_POINTS = ['85%'];

export function FoodEntryHub() {
  const { isOpen, context, onSuccess, close, autoFocusSearch, initialSubflow, autoCloseOnSave } = useFoodEntryHubStore();
  const [hubState, dispatch] = useReducer(hubReducer, INITIAL_HUB_STATE);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  // searchActive bleibt true solange der Nutzer im Suchmodus ist -- unabhängig vom Keyboard-Status
  const [searchActive, setSearchActive] = useState(false);
  const [addedItem, setAddedItem] = useState<{ productName: string; mealId: string; itemId: string } | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  // Inline Alle-Favoriten-Ansicht (kein zweites BottomSheetModal)
  const [allFavoritesMode, setAllFavoritesMode] = useState(false);
  const [recents, setRecents] = useState<UserFoodRelation[]>([]);
  // Gecachte Suchergebnisse â€” erhalten beim Ãœbergang in Quantity-Modus und zurÃ¼ck
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
  // Refs fÃ¼r Keyboard-Listener (verhindert stale closures)
  const searchFocusedRef = useRef(false);
  const searchQueryRef = useRef('');
  const insets = useSafeAreaInsets();

  // Snackbar: identisch zu DiaryScreen (Opacity-Fade, Core RN Animated)
  const snackbarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snackbarOpacity = useRef(new RNAnimated.Value(0)).current;
  const snackbarTimerProgress = useRef(new RNAnimated.Value(1)).current;

  // Keyboard-Sichtbarkeit tracken um paddingBottom dynamisch anzupassen
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

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
      setAllFavoritesMode(false);
      setCachedResults([]);
      favoritesApi.listRecent(20).then(setRecents).catch(() => setRecents([]));

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
      sheetRef.current?.dismiss();
    }
  }, [isOpen]);

  // Lazy Sheet-Präsentation: wenn im HomeScreen-Subflow ein Produkt gefunden wurde,
  // muss das Sheet jetzt geöffnet werden (QuantityView lebt darin).
  useEffect(() => {
    if (isOpen && hubState.mode === 'product' && !sheetIsOpenRef.current) {
      sheetIsOpenRef.current = true;
      sheetRef.current?.present();
    }
  }, [isOpen, hubState.mode]);

  // Keyboard-Listener: zuverlÃ¤ssige Tastatur-Dismiss-Erkennung (onBlur feuert in BottomSheet nicht immer)
  useEffect(() => {
    if (!isOpen) return;
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      if (blurIsSelectionRef.current) {
        // Tastatur durch Produktauswahl geschlossen â€” kein Reset
        blurIsSelectionRef.current = false;
        searchFocusedRef.current = false;
        setSearchFocused(false);
        return;
      }
      if (!searchFocusedRef.current) {
        // Tastatur war nicht durch unser Suchfeld fokussiert (z.B. Subflow oder Scroll-Edge-Case)
        // â†’ kein Reset, Suchzustand beibehalten
        return;
      }
      // Nutzer hat Tastatur manuell geschlossen â†’ zurÃ¼ck zu Idle
      searchFocusedRef.current = false;
      searchQueryRef.current = '';
      setSearchFocused(false);
      setSearchQuery('');
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
    // damit useEffect([isOpen]) kein doppeltes dismiss() ausfÃ¼hrt.
    sheetIsOpenRef.current = false;
    close();
  }, [close]);

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
    dispatch({ type: 'OPEN_SEARCH' });
  }, [autoFocusSearch]);

  const handleSearchBlur = useCallback(() => {
    // Tastatur-Dismiss wird primÃ¤r Ã¼ber keyboardDidHide-Listener behandelt.
    // onBlur hier nur als minimaler Fallback fÃ¼r Android.
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
   * Favorit / Recent auswÃ¤hlen: NÃ¤hrwerte werden per Food-Search nachgeladen,
   * da UserFoodRelation keine nutritionPer100g enthÃ¤lt.
   * Exakter Abgleich per foodRef â€” Fallback auf Minimal-Daten wenn nicht gefunden.
   */
  const handleSelectRelation = useCallback(async (relation: UserFoodRelation) => {
    blurIsSelectionRef.current = true;
    Keyboard.dismiss();
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
    // Fallback: Ã¶ffnet ProduktDialog ohne Makro-Vorschau
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
  }, []);

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
  }, [autoCloseOnSave, onSuccess, close]);

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

  /** Label Scan "Als Produkt speichern" â†’ direkt ProduktDialog Ã¶ffnen */
  const handleLabelProductFound = useCallback((product: FoodSearchResult) => {
    // Transitioning subflow â†’ product state: LabelSubFlow becomes invisible, ProduktDialog opens
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
        snapPoints={SNAP_POINTS}
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

            {/* Search Bar â€” Pill + AI-Icon + Barcode-Icon */}
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
              {/* AI-Einstieg â€” pill-fÃ¶rmiger Button passend zur Suchpill */}
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

          {/* Content-Bereich */}
          <View style={styles.contentArea}>
            {hubState.mode === 'product' ? (
              <QuantityView
                product={hubState.product}
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
            ) : allFavoritesMode ? (
              <AllFavoritesInline
                onBack={() => setAllFavoritesMode(false)}
                onSelectRelation={(relation) => {
                  setAllFavoritesMode(false);
                  void handleSelectRelation(relation);
                }}
              />
            ) : (
              <IdleState
                isOpen={isOpen}
                onSelectRelation={(relation) => void handleSelectRelation(relation)}
                onRequestFocus={handleRequestFocus}
                onOpenAllFavorites={() => setAllFavoritesMode(true)}
              />
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

      {/* Sub-Flow Overlays â€” nur mounten wenn aktiv.
           Hintergrund: react-native-vision-camera und react-native-image-crop-picker
           sind native Module, die beim Mount initialisiert werden. Wenn sie immer
           im Tree sitzen (visible=false), crashen sie beim App-Start auÃŸerhalb
           eines EAS-Builds. Konditionelles Mounten lÃ¶st das Problem. */}
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
  // Search Bar â€” Pill + auÃŸenliegende AI/Barcode-Icons
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
});
