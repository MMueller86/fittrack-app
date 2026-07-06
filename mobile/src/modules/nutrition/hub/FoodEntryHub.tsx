// FoodEntryHub — central food entry component.
// Opened as a BottomSheetModal from anywhere in the app via useFoodEntryHubStore.
// Manages its own state machine via hubReducer.
// Closes automatically on tab navigation.

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Keyboard, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BottomSheetModal, BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import type { FoodSearchResult } from '@fittrack/shared';
import { Icon } from '../../../shared/components/Icon';

import type { ReusableItem } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../../app/theme';
import { useFoodEntryHubStore } from './useFoodEntryHubStore';
import { hubReducer, INITIAL_HUB_STATE } from './hubReducer';
import { IdleState } from './IdleState';
import { SearchState } from './SearchState';
import { ProduktDialog } from './ProduktDialog';
import { ManuellerSubFlow } from './ManuellerSubFlow';
import { AISubFlow } from './AISubFlow';
import { BarcodeSubFlow } from './BarcodeSubFlow';
import { LabelSubFlow } from './LabelSubFlow';

// Snap points: 75% default, 90% when search is focused
const SNAP_POINTS = ['75%', '90%'];

export function FoodEntryHub() {
  const { isOpen, context, onSuccess, close, autoFocusSearch } = useFoodEntryHubStore();
  const [hubState, dispatch] = useReducer(hubReducer, INITIAL_HUB_STATE);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [addedProduct, setAddedProduct] = useState<string | null>(null);
  const sheetRef = useRef<BottomSheetModal>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const searchInputRef = useRef<any>(null);
  // Trackt ob das Sheet gerade visuell offen ist (nicht den Store-State).
  const sheetIsOpenRef = useRef(false);
  const insets = useSafeAreaInsets();

  // P-8: Animations
  const contentOpacity = useSharedValue(0);
  const snackbarTranslateY = useSharedValue(80);
  const contentAnimStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));
  const snackbarAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: snackbarTranslateY.value }],
  }));

  // ---------------------------------------------------------------------------
  // Open / close sync with store
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (isOpen) {
      sheetIsOpenRef.current = true;
      dispatch({ type: 'RESET' });
      setSearchQuery('');
      setSearchFocused(false);
      setAddedProduct(null);
      contentOpacity.value = 0;
      sheetRef.current?.present();
      // Fade-in content after sheet settles
      setTimeout(() => {
        contentOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.ease) });
        // Auto-focus search if opened from HomeScreen search bar
        if (autoFocusSearch) {
          setTimeout(() => searchInputRef.current?.focus(), 300);
        }
      }, 180);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (sheetIsOpenRef.current) {
      contentOpacity.value = 0;
      sheetRef.current?.dismiss();
    }
  }, [isOpen, contentOpacity]);

  // P-8: Snackbar spring-in animation
  useEffect(() => {
    if (addedProduct) {
      snackbarTranslateY.value = 80;
      snackbarTranslateY.value = withSpring(0, { damping: 15, stiffness: 200 });
    }
  }, [addedProduct, snackbarTranslateY]);

  // ---------------------------------------------------------------------------
  // Sheet dismiss callback (user drags down)
  // ---------------------------------------------------------------------------

  const handleSheetDismiss = useCallback(() => {
    // Sheet hat sich selbst geschlossen (Swipe/onDismiss). Ref VOR close() setzen,
    // damit useEffect([isOpen]) kein doppeltes dismiss() ausführt.
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
    setSearchFocused(true);
    dispatch({ type: 'OPEN_SEARCH' });
    sheetRef.current?.snapToIndex(1);
  }, []);

  const handleSearchBlur = useCallback(() => {
    setSearchFocused(false);
    if (!searchQuery) sheetRef.current?.snapToIndex(0);
  }, [searchQuery]);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    dispatch({ type: 'SET_QUERY', query: text });
  }, []);

  // ---------------------------------------------------------------------------
  // Product selection
  // ---------------------------------------------------------------------------

  const handleSelectProduct = useCallback((product: FoodSearchResult) => {
    Keyboard.dismiss();
    dispatch({ type: 'SELECT_PRODUCT', product });
  }, []);

  // ---------------------------------------------------------------------------
  // ProduktDialog callbacks
  // ---------------------------------------------------------------------------

  const handleProduktDismiss = useCallback(() => {
    dispatch({ type: 'CLOSE_PRODUCT' });
  }, []);

  const handleProduktAdded = useCallback((productName: string) => {
    dispatch({ type: 'CLOSE_PRODUCT' });
    setAddedProduct(productName);
    onSuccess?.();
    setSearchQuery('');
    setSearchFocused(false);
  }, [onSuccess]);

  // ---------------------------------------------------------------------------
  // Hub-Snackbar actions
  // ---------------------------------------------------------------------------

  const handleWeiteres = useCallback(() => {
    setAddedProduct(null);
    dispatch({ type: 'RESET' });
    setSearchQuery('');
    setSearchFocused(false);
    sheetRef.current?.snapToIndex(0);
  }, []);

  const handleFertig = useCallback(() => {
    setAddedProduct(null);
    close();
  }, [close]);

  // ---------------------------------------------------------------------------
  // Subflow handlers
  // ---------------------------------------------------------------------------

  const handleOpenSubflow = useCallback((flow: 'barcode' | 'ai' | 'label' | 'manual') => {
    Keyboard.dismiss();
    dispatch({ type: 'OPEN_SUBFLOW', flow });
  }, []);

  // UX-1: Auto-focus search from IdleState when both lists empty
  const handleRequestFocus = useCallback(() => {
    sheetRef.current?.snapToIndex(1);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  const handleSubflowClose = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const handleSubflowSaved = useCallback((productName: string) => {
    dispatch({ type: 'RESET' });
    setAddedProduct(productName);
    onSuccess?.();
  }, [onSuccess]);

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
    setAddedProduct('Neues Produkt');
    onSuccess?.();
  }, [onSuccess]);

  const showSearch = searchFocused || searchQuery.trim().length > 0;

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
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handle}
        enablePanDownToClose
      >
        <BottomSheetView style={[styles.container, { paddingBottom: insets.bottom + spacing.md }]}>
          <Animated.View style={[styles.animatedContent, contentAnimStyle]}>

            {/* Header — kompakt: Kontext-Badge links, Close-Icon rechts */}
            <View style={styles.header}>
              {subtitle ? (
                <View style={styles.contextBadge}>
                  <Text style={styles.contextBadgeText} numberOfLines={1}>{subtitle}</Text>
                </View>
              ) : (
                <View style={styles.headerSpacer} />
              )}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={close}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel="Hub schließen"
                accessibilityRole="button"
              >
                <Icon lib="feather" name="x" size="md" color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Suchfeld — Pill-Form mit Icon + Android Clear Button */}
            <View style={styles.searchRow}>
              <View style={styles.searchContainer}>
                <View style={styles.searchIconLeft}>
                  <Icon lib="feather" name="search" size="sm" color={colors.textMuted} />
                </View>
                <BottomSheetTextInput
                  ref={searchInputRef}
                  style={styles.searchInput}
                  placeholder={subtitle ? `Für ${context.mealType === 'breakfast' ? 'Frühstück' : context.mealType === 'lunch' ? 'Mittagessen' : context.mealType === 'dinner' ? 'Abendessen' : 'Mahlzeit'} suchen…` : 'Lebensmittel suchen…'}
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
            </View>

          {/* Content: Idle oder Search */}
          {showSearch ? (
            <SearchState
              query={searchQuery}
              onSelect={handleSelectProduct}
              onOpenSubflow={handleOpenSubflow}
            />
          ) : (
            <IdleState
              isOpen={isOpen}
              searchFocused={searchFocused}
              onSelectRelation={(relation) => {
                handleSelectProduct({
                  id: relation.foodRef,
                  source: relation.foodRefType === 'catalog' ? 'openFoodFacts' : 'library',
                  name: relation.displayName,
                  brand: relation.displayBrand,
                  displayLabel: '',
                  nutritionBasis: 'per100g',
                  isComplete: true,
                });
              }}
              onOpenSubflow={handleOpenSubflow}
              onRequestFocus={handleRequestFocus}
            />
          )}

          {/* Hub-Snackbar */}
          {addedProduct ? (
            <View style={styles.hubSnackbar}>
              <Text style={styles.hubSnackbarText} numberOfLines={1}>
                „{addedProduct}“ hinzugefügt
              </Text>
              <View style={styles.hubSnackbarActions}>
                <TouchableOpacity
                  style={styles.hubSnackbarBtn}
                  onPress={handleWeiteres}
                  accessibilityRole="button"
                >
                  <Text style={styles.hubSnackbarBtnText}>Weiteres</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.hubSnackbarBtn, styles.hubSnackbarBtnPrimary]}
                  onPress={handleFertig}
                  accessibilityRole="button"
                >
                  <Text style={[styles.hubSnackbarBtnText, styles.hubSnackbarBtnTextPrimary]}>
                    Fertig
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
          </Animated.View>
        </BottomSheetView>
      </BottomSheetModal>

      {/* ProduktDialog — gestapeltes BottomSheetModal */}
      <ProduktDialog
        product={hubState.mode === 'product' ? hubState.product : null}
        context={context}
        onDismiss={handleProduktDismiss}
        onAdded={handleProduktAdded}
      />

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
  },
  animatedContent: {
    flex: 1,
  },
  handle: {
    backgroundColor: colors.border,
    width: 40,
    height: 4,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  // Kompakter Header: Kontext-Badge links, Close rechts
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    minHeight: 36,
  },
  headerSpacer: {
    flex: 1,
  },
  contextBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    flex: 1,
    alignSelf: 'center',
    marginRight: spacing.sm,
  },
  contextBadgeText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600' as const,
  },
  closeButton: {
    padding: spacing.xs,
  },
  // Pill-Suchfeld
  searchRow: {
    marginBottom: spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 44,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
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

  // Hub-Snackbar — absolut positioniert am unteren Rand des Sheets,
  // überlagert den Scrollbereich (verhindert dass sie hinter flex:1 Content verschwindet)
  hubSnackbar: {
    position: 'absolute',
    bottom: 0,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  hubSnackbarText: {
    ...typography.body2,
    color: colors.text,
  },
  hubSnackbarActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  hubSnackbarBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  hubSnackbarBtnPrimary: {
    backgroundColor: colors.primary,
  },
  hubSnackbarBtnText: {
    ...typography.caption,
    fontWeight: '600' as const,
    color: colors.textSecondary,
  },
  hubSnackbarBtnTextPrimary: {
    color: colors.background,
  },
});
