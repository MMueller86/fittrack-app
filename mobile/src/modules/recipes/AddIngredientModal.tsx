// AddIngredientModal — BottomSheetModal ingredient picker for recipes.
// SheetMode state machine: 'search' | 'amount' | 'ai' | 'label' | 'manual'.
// SearchState handles product search; RecipeIngredientAmountView handles amount input.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import * as ImagePicker from 'expo-image-picker';
import type {
  AiFoodEstimateNutrition,
  FoodSearchResult,
  NutritionLabelScanResult,
  RecipeIngredient,
} from '@fittrack/shared';
import { buildFromAiEstimate, buildFromScan } from './ingredientBuilders';
import { colors, radius, spacing, typography } from '../../app/theme';
import { aiApi } from '../../shared/api/aiApi';
import { Icon } from '../../shared/components/Icon';
import { SearchState } from '../nutrition/hub/SearchState';
import { RecipeIngredientAmountView } from './RecipeIngredientAmountView';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (ingredient: RecipeIngredient) => void;
  /** When set the header reads "Zutat ersetzen". */
  replacingIngId?: string | null;
  /** Pre-populate the search field when the sheet opens (AC-4). */
  initialQuery?: string;
}

type SheetMode = 'search' | 'amount' | 'ai' | 'label' | 'manual';

const SNAP_POINTS = ['85%', '90%'];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AddIngredientModal({
  visible,
  onClose,
  onAdd,
  replacingIngId,
  initialQuery,
}: Props) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => SNAP_POINTS, []);

  const [sheetMode, setSheetMode] = useState<SheetMode>('search');
  const [query, setQuery] = useState(initialQuery ?? '');
  const [selectedProduct, setSelectedProduct] = useState<FoodSearchResult | null>(null);

  // ai subflow
  const [aiName, setAiName] = useState('');
  const [aiAmount, setAiAmount] = useState('100');
  const [estimating, setEstimating] = useState(false);

  // label scan subflow
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<NutritionLabelScanResult | null>(null);
  const [scanName, setScanName] = useState('');
  const [scanAmount, setScanAmount] = useState('100');

  // manual subflow
  const [manualName, setManualName] = useState('');
  const [manualAmount, setManualAmount] = useState('100');
  const [manualKcal, setManualKcal] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualCarbs, setManualCarbs] = useState('');
  const [manualFat, setManualFat] = useState('');

  // Present / dismiss sheet when visible prop changes
  useEffect(() => {
    if (visible) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible]);

  // Reset all state when sheet opens; seed query from initialQuery (AC-4)
  useEffect(() => {
    if (!visible) return;
    setSheetMode('search');
    setSelectedProduct(null);
    setQuery(initialQuery ?? '');
    setAiName('');
    setAiAmount('100');
    setEstimating(false);
    setScanning(false);
    setScanResult(null);
    setScanName('');
    setScanAmount('100');
    setManualName('');
    setManualAmount('100');
    setManualKcal('');
    setManualProtein('');
    setManualCarbs('');
    setManualFat('');
  }, [visible, initialQuery]);

  // Android hardware back: amount handled by RecipeIngredientAmountView;
  // subflow modes → back to search; search → close sheet.
  useEffect(() => {
    if (!visible || Platform.OS !== 'android' || sheetMode === 'amount') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sheetMode === 'search') {
        sheetRef.current?.dismiss();
      } else {
        setSheetMode('search');
      }
      return true;
    });
    return () => sub.remove();
  }, [visible, sheetMode]);

  const handleSheetDismiss = useCallback(() => {
    setSheetMode('search');
    setSelectedProduct(null);
    onClose();
  }, [onClose]);

  const confirmAndClose = useCallback(
    (ingredient: RecipeIngredient) => {
      onAdd(ingredient);
      sheetRef.current?.dismiss();
    },
    [onAdd],
  );

  const handleSelectProduct = useCallback((product: FoodSearchResult) => {
    setSelectedProduct(product);
    setSheetMode('amount');
  }, []);

  const handleOpenSubflow = useCallback(
    (flow: 'barcode' | 'ai' | 'label' | 'manual') => {
      if (flow === 'ai') setSheetMode('ai');
      else if (flow === 'label') setSheetMode('label');
      else if (flow === 'manual') setSheetMode('manual');
      // barcode: not supported in recipe picker
    },
    [],
  );

  const handleBack = useCallback(() => setSheetMode('search'), []);

  // ---------------------------------------------------------------------------
  // AI subflow
  // ---------------------------------------------------------------------------

  const handleAiEstimate = async () => {
    if (!aiName.trim()) return;
    const grams = parseFloat(aiAmount.replace(',', '.'));
    if (!Number.isFinite(grams) || grams <= 0) {
      Alert.alert('Ungültige Menge', 'Bitte gib eine gültige Grammzahl ein.');
      return;
    }
    setEstimating(true);
    try {
      const estimate = await aiApi.estimateFood({ name: aiName.trim() });
      const e: AiFoodEstimateNutrition = estimate.estimatedNutritionPer100g;
      const n = {
        calories: e.calories,
        protein: e.protein,
        carbs: e.carbs,
        fat: e.fat,
        fiber: e.fiber ?? 0,
      };
      confirmAndClose(buildFromAiEstimate(aiName.trim(), grams, n));
    } catch {
      Alert.alert('Fehler', 'KI-Schätzung fehlgeschlagen.');
    } finally {
      setEstimating(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Label scan subflow
  // ---------------------------------------------------------------------------

  const handlePickAndScan = async (source: 'camera' | 'gallery') => {
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Berechtigung', 'Zugriff verweigert.');
      return;
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.9 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.9 });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const mimeType: 'image/jpeg' | 'image/png' =
      asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';

    setScanning(true);
    try {
      const scan = await aiApi.scanLabel(asset.uri, mimeType);
      setScanResult(scan);
      setScanName(scan.productName ?? '');
      setScanAmount('100');
    } catch {
      Alert.alert('Fehler', 'Label-Scan fehlgeschlagen.');
    } finally {
      setScanning(false);
    }
  };

  const handleAddScan = () => {
    if (!scanResult) return;
    const grams = parseFloat(scanAmount.replace(',', '.'));
    if (!Number.isFinite(grams) || grams <= 0) {
      Alert.alert('Ungültige Menge', 'Bitte gib eine gültige Grammzahl ein.');
      return;
    }
    confirmAndClose(buildFromScan(scanName.trim() || 'Gescanntes Produkt', grams, scanResult));
  };

  // ---------------------------------------------------------------------------
  // Manual subflow
  // ---------------------------------------------------------------------------

  const handleAddManual = () => {
    if (!manualName.trim()) {
      Alert.alert('Name fehlt', 'Bitte gib einen Namen ein.');
      return;
    }
    const grams = parseFloat(manualAmount.replace(',', '.'));
    if (!Number.isFinite(grams) || grams <= 0) {
      Alert.alert('Ungültige Menge', 'Bitte gib eine gültige Grammzahl ein.');
      return;
    }
    const n = {
      calories: parseFloat(manualKcal) || 0,
      protein: parseFloat(manualProtein) || 0,
      carbs: parseFloat(manualCarbs) || 0,
      fat: parseFloat(manualFat) || 0,
      fiber: 0,
    };
    confirmAndClose(buildFromAiEstimate(manualName.trim(), grams, n));
  };

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const isReplacing = !!replacingIngId;
  const addBtnLabel = isReplacing ? 'Zutat ersetzen' : 'Zutat hinzufügen';

  const headerTitle =
    sheetMode === 'amount' && selectedProduct
      ? selectedProduct.name
      : isReplacing
        ? 'Zutat ersetzen'
        : 'Zutat hinzufügen';

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        opacity={0.10}
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
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      index={0}
      onDismiss={handleSheetDismiss}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
    >
      <View style={styles.container}>
        {/* ── Header ── */}
        <View style={styles.header}>
          {sheetMode !== 'search' ? (
            <TouchableOpacity onPress={handleBack} hitSlop={8} style={styles.headerBack}>
              <Icon lib="feather" name="arrow-left" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSpacer} />
          )}
          <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle}</Text>
          <TouchableOpacity onPress={() => sheetRef.current?.dismiss()} style={styles.headerClose}>
            <Text style={styles.cancel}>Schließen</Text>
          </TouchableOpacity>
        </View>

        {/* ── Search input bar (search mode only) ── */}
        {sheetMode === 'search' && (
          <View style={styles.searchRow}>
            <View style={styles.searchPill}>
              <Icon lib="feather" name="search" size="sm" color={colors.textMuted} />
              <BottomSheetTextInput
                style={styles.searchInput}
                placeholder="Zutat suchen…"
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
                clearButtonMode={Platform.OS === 'ios' ? 'while-editing' : 'never'}
                accessibilityLabel="Zutat suchen"
              />
              {Platform.OS === 'android' && query.length > 0 ? (
                <TouchableOpacity
                  onPress={() => setQuery('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon lib="feather" name="x-circle" size="sm" color={colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )}

        {/* ── Search mode: SearchState ── */}
        {sheetMode === 'search' && (
          <SearchState
            query={query}
            recents={[]}
            onSelect={handleSelectProduct}
            onSelectRelation={() => {}}
            onOpenSubflow={handleOpenSubflow}
          />
        )}

        {/* ── Amount mode: RecipeIngredientAmountView (includes its own back handler) ── */}
        {sheetMode === 'amount' && selectedProduct != null && (
          <RecipeIngredientAmountView
            product={selectedProduct}
            replacingIngId={replacingIngId}
            onAdd={confirmAndClose}
            onBack={() => setSheetMode('search')}
          />
        )}

        {/* ── AI subflow ── */}
        {sheetMode === 'ai' && (
          <BottomSheetScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.label}>Zutat beschreiben</Text>
            <TextInput
              style={styles.input}
              placeholder="z. B. Vollmilch 3,5 %"
              placeholderTextColor={colors.textMuted}
              value={aiName}
              onChangeText={setAiName}
            />
            <Text style={styles.label}>Menge (g)</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="100"
              placeholderTextColor={colors.textMuted}
              value={aiAmount}
              onChangeText={setAiAmount}
            />
            <TouchableOpacity
              style={[styles.addBtn, (estimating || !aiName.trim()) && styles.addBtnDisabled]}
              onPress={handleAiEstimate}
              disabled={estimating || !aiName.trim()}
            >
              {estimating ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.addBtnText}>✨ KI-Schätzung abrufen</Text>
              )}
            </TouchableOpacity>
          </BottomSheetScrollView>
        )}

        {/* ── Label scan subflow ── */}
        {sheetMode === 'label' && (
          <BottomSheetScrollView contentContainerStyle={styles.scroll}>
            {!scanResult ? (
              <>
                <Text style={styles.scanHint}>
                  Fotografiere das Nährwert-Label auf der Verpackung.
                </Text>
                {scanning ? (
                  <View style={styles.scanLoading}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.scanLoadingText}>Label wird analysiert…</Text>
                  </View>
                ) : (
                  <View style={styles.scanBtns}>
                    <TouchableOpacity
                      style={styles.scanBtn}
                      onPress={() => handlePickAndScan('camera')}
                    >
                      <Text style={styles.scanBtnText}>📷 Kamera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.scanBtn}
                      onPress={() => handlePickAndScan('gallery')}
                    >
                      <Text style={styles.scanBtnText}>🖼 Galerie</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            ) : (
              <>
                <TouchableOpacity
                  onPress={() => { setScanResult(null); setScanName(''); }}
                  style={styles.backBtn}
                >
                  <Text style={styles.backBtnText}>‹ Erneut scannen</Text>
                </TouchableOpacity>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={scanName}
                  onChangeText={setScanName}
                  placeholder="Produktname"
                  placeholderTextColor={colors.textMuted}
                />
                <View style={styles.scanNutritionBox}>
                  <Text style={styles.scanNutritionTitle}>Erkannte Nährwerte (pro 100 g)</Text>
                  <Text style={styles.scanNutritionRow}>
                    {`${scanResult.nutrition.calories ?? '?'} kcal · ${scanResult.nutrition.protein ?? '?'} g P · ${scanResult.nutrition.carbs ?? '?'} g KH · ${scanResult.nutrition.fat ?? '?'} g F`}
                  </Text>
                </View>
                <Text style={styles.label}>Menge (g)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="decimal-pad"
                  value={scanAmount}
                  onChangeText={setScanAmount}
                  placeholder="100"
                  placeholderTextColor={colors.textMuted}
                />
                <TouchableOpacity style={styles.addBtn} onPress={handleAddScan}>
                  <Text style={styles.addBtnText}>{addBtnLabel}</Text>
                </TouchableOpacity>
              </>
            )}
          </BottomSheetScrollView>
        )}

        {/* ── Manual subflow ── */}
        {sheetMode === 'manual' && (
          <BottomSheetScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="z. B. Butter"
              placeholderTextColor={colors.textMuted}
              value={manualName}
              onChangeText={setManualName}
            />
            <Text style={styles.label}>Nährwerte pro 100 g</Text>
            <View style={styles.macroRow}>
              <View style={styles.macroField}>
                <Text style={styles.macroLabel}>kcal</Text>
                <TextInput
                  style={styles.macroInput}
                  keyboardType="decimal-pad"
                  value={manualKcal}
                  onChangeText={setManualKcal}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={styles.macroField}>
                <Text style={styles.macroLabel}>Protein (g)</Text>
                <TextInput
                  style={styles.macroInput}
                  keyboardType="decimal-pad"
                  value={manualProtein}
                  onChangeText={setManualProtein}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={styles.macroField}>
                <Text style={styles.macroLabel}>Kohlenhydr. (g)</Text>
                <TextInput
                  style={styles.macroInput}
                  keyboardType="decimal-pad"
                  value={manualCarbs}
                  onChangeText={setManualCarbs}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={styles.macroField}>
                <Text style={styles.macroLabel}>Fett (g)</Text>
                <TextInput
                  style={styles.macroInput}
                  keyboardType="decimal-pad"
                  value={manualFat}
                  onChangeText={setManualFat}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>
            <Text style={styles.label}>Menge (g)</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={manualAmount}
              onChangeText={setManualAmount}
              placeholder="100"
              placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity
              style={[styles.addBtn, !manualName.trim() && styles.addBtnDisabled]}
              onPress={handleAddManual}
              disabled={!manualName.trim()}
            >
              <Text style={styles.addBtnText}>{addBtnLabel}</Text>
            </TouchableOpacity>
          </BottomSheetScrollView>
        )}
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  background: { backgroundColor: colors.background },
  handle: { backgroundColor: colors.border },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBack: { padding: spacing.xs },
  headerSpacer: { width: 42 },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  headerClose: { alignItems: 'flex-end', minWidth: 42 },
  cancel: { ...typography.body1, color: colors.textSecondary },
  searchRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  searchInput: {
    ...typography.body1,
    color: colors.text,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },
  label: {
    ...typography.overline,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    ...typography.body1,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  addBtnDisabled: { backgroundColor: colors.border },
  addBtnText: { ...typography.button, color: colors.white },
  backBtn: { marginBottom: spacing.md },
  backBtnText: { ...typography.body2, color: colors.primary },
  scanHint: { ...typography.body2, color: colors.textMuted, marginBottom: spacing.md },
  scanLoading: { alignItems: 'center', paddingVertical: spacing.xl },
  scanLoadingText: {
    ...typography.body1,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  scanBtns: { flexDirection: 'row', gap: spacing.md },
  scanBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  scanBtnText: { ...typography.body1, color: colors.white, fontWeight: '600' },
  scanNutritionBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  scanNutritionTitle: {
    ...typography.overline,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  scanNutritionRow: { ...typography.body2, color: colors.text },
  macroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  macroField: { flex: 1, minWidth: '40%' },
  macroLabel: { ...typography.caption, color: colors.textMuted, marginBottom: 4 },
  macroInput: {
    ...typography.body1,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
});

