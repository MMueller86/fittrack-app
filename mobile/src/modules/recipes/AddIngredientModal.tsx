// AddIngredientModal — 4-tab ingredient picker for recipes (Suche / KI / Scan / Manuell)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { randomUUID } from 'expo-crypto';
import type {
  AiFoodEstimateNutrition,
  FoodSearchResult,
  NutritionLabelScanResult,
  RecipeIngredient,
} from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { foodApi } from '../../shared/api/foodApi';
import { aiApi } from '../../shared/api/aiApi';
import { FoodSearchResultList } from '../../shared/components/FoodSearchResultList';
import { QuantityInputRow } from '../../shared/components/QuantityInputRow';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (ingredient: RecipeIngredient) => void;
  /** When set the header reads "Zutat ersetzen". */
  replacingIngId?: string | null;
}

type Tab = 'search' | 'ai' | 'scan' | 'manual';
type AmountMode = 'grams' | 'portion';

// ---------------------------------------------------------------------------
// Builder helpers
// ---------------------------------------------------------------------------

function buildFromProduct(
  product: FoodSearchResult,
  mode: AmountMode,
  amount: number,
): RecipeIngredient {
  const portionWeightGrams = product.portion?.weightGrams;
  const portionLabel = product.portion?.label;
  const hasPortion = portionWeightGrams != null && portionWeightGrams > 0;
  const amountGrams =
    mode === 'portion' && hasPortion ? amount * portionWeightGrams! : amount;
  const raw = product.nutritionPer100g;
  const n = {
    calories: raw?.calories ?? 0,
    protein: raw?.protein ?? 0,
    carbs: raw?.carbs ?? 0,
    fat: raw?.fat ?? 0,
    fiber: raw?.fiber ?? 0,
  };
  const scale = amountGrams / 100;
  return {
    id: randomUUID(),
    displayName: product.name,
    inputMode: mode,
    inputAmount: amount,
    amountGrams,
    unit: mode === 'portion' ? (portionLabel ?? 'Portion') : 'g',
    linkedProductId: product.id,
    linkedReusableItemId: null,
    isAiEstimate: false,
    portionWeightGrams: hasPortion ? portionWeightGrams : undefined,
    portionLabel: hasPortion ? (portionLabel ?? 'Portion') : undefined,
    nutritionPer100g: n,
    nutritionContribution: {
      calories: Math.round(n.calories * scale * 10) / 10,
      protein: Math.round(n.protein * scale * 10) / 10,
      carbs: Math.round(n.carbs * scale * 10) / 10,
      fat: Math.round(n.fat * scale * 10) / 10,
      fiber: Math.round(n.fiber * scale * 10) / 10,
    },
  };
}

function buildFromAiEstimate(
  name: string,
  amountGrams: number,
  n: { calories: number; protein: number; carbs: number; fat: number; fiber: number },
): RecipeIngredient {
  const scale = amountGrams / 100;
  return {
    id: randomUUID(),
    displayName: name,
    inputMode: 'grams',
    inputAmount: amountGrams,
    amountGrams,
    unit: 'g',
    linkedProductId: null,
    linkedReusableItemId: null,
    isAiEstimate: true,
    nutritionPer100g: n,
    nutritionContribution: {
      calories: Math.round(n.calories * scale * 10) / 10,
      protein: Math.round(n.protein * scale * 10) / 10,
      carbs: Math.round(n.carbs * scale * 10) / 10,
      fat: Math.round(n.fat * scale * 10) / 10,
      fiber: Math.round(n.fiber * scale * 10) / 10,
    },
  };
}

function buildFromScan(
  name: string,
  amountGrams: number,
  scan: NutritionLabelScanResult,
): RecipeIngredient {
  const n = {
    calories: scan.nutrition.calories ?? 0,
    protein: scan.nutrition.protein ?? 0,
    carbs: scan.nutrition.carbs ?? 0,
    fat: scan.nutrition.fat ?? 0,
    fiber: scan.nutrition.fiber ?? 0,
  };
  const scale = amountGrams / 100;
  return {
    id: randomUUID(),
    displayName: name,
    inputMode: 'grams',
    inputAmount: amountGrams,
    amountGrams,
    unit: 'g',
    linkedProductId: null,
    linkedReusableItemId: null,
    isAiEstimate: false,
    nutritionPer100g: n,
    nutritionContribution: {
      calories: Math.round(n.calories * scale * 10) / 10,
      protein: Math.round(n.protein * scale * 10) / 10,
      carbs: Math.round(n.carbs * scale * 10) / 10,
      fat: Math.round(n.fat * scale * 10) / 10,
      fiber: Math.round(n.fiber * scale * 10) / 10,
    },
  };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AddIngredientModal({ visible, onClose, onAdd, replacingIngId }: Props) {
  const [tab, setTab] = useState<Tab>('search');

  // search tab
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<FoodSearchResult | null>(null);
  const [amountMode, setAmountMode] = useState<AmountMode>('grams');
  const [amountValue, setAmountValue] = useState('100');
  const [aiFooterEstimating, setAiFooterEstimating] = useState(false);

  // ai tab
  const [aiName, setAiName] = useState('');
  const [aiAmount, setAiAmount] = useState('100');
  const [estimating, setEstimating] = useState(false);

  // scan tab
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<NutritionLabelScanResult | null>(null);
  const [scanName, setScanName] = useState('');
  const [scanAmount, setScanAmount] = useState('100');

  // manual tab
  const [manualName, setManualName] = useState('');
  const [manualAmount, setManualAmount] = useState('100');
  const [manualKcal, setManualKcal] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualCarbs, setManualCarbs] = useState('');
  const [manualFat, setManualFat] = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const data = await foodApi.search(q.trim());
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  useEffect(() => {
    if (visible) { setTab('search'); resetAll(); }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetAll = () => {
    setQuery(''); setResults([]); setSearching(false);
    setSelectedProduct(null); setAmountMode('grams'); setAmountValue('100');
    setAiFooterEstimating(false);
    setAiName(''); setAiAmount('100'); setEstimating(false);
    setScanning(false); setScanResult(null); setScanName(''); setScanAmount('100');
    setManualName(''); setManualAmount('100');
    setManualKcal(''); setManualProtein(''); setManualCarbs(''); setManualFat('');
  };

  const handleClose = () => { resetAll(); onClose(); };

  const confirmAndClose = (ingredient: RecipeIngredient) => {
    onAdd(ingredient);
    handleClose();
  };

  // search tab handlers
  const handleSelectProduct = (product: FoodSearchResult) => {
    setSelectedProduct(product);
    const hasPortion = product.portion?.weightGrams != null && product.portion.weightGrams > 0;
    setAmountMode(hasPortion ? 'portion' : 'grams');
    setAmountValue(hasPortion ? '1' : '100');
  };

  const handleAddProduct = () => {
    if (!selectedProduct) return;
    const num = parseFloat(amountValue.replace(',', '.'));
    if (!Number.isFinite(num) || num <= 0) {
      Alert.alert('Ungültige Menge', 'Bitte gib eine gültige Zahl ein.');
      return;
    }
    confirmAndClose(buildFromProduct(selectedProduct, amountMode, num));
  };

  const handleAiFromSearch = async () => {
    if (!query.trim()) return;
    setAiFooterEstimating(true);
    try {
      const estimate = await aiApi.estimateFood({ name: query.trim() });
      const e = estimate.estimatedNutritionPer100g;
      const n = { calories: e.calories, protein: e.protein, carbs: e.carbs, fat: e.fat, fiber: e.fiber ?? 0 };
      confirmAndClose(buildFromAiEstimate(estimate.displayName, 100, n));
    } catch {
      Alert.alert('Fehler', 'KI-Schätzung fehlgeschlagen.');
    } finally {
      setAiFooterEstimating(false);
    }
  };

  // ai tab handler
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
      const n = { calories: e.calories, protein: e.protein, carbs: e.carbs, fat: e.fat, fiber: e.fiber ?? 0 };
      confirmAndClose(buildFromAiEstimate(aiName.trim(), grams, n));
    } catch {
      Alert.alert('Fehler', 'KI-Schätzung fehlgeschlagen.');
    } finally {
      setEstimating(false);
    }
  };

  // scan tab handlers
  const handlePickAndScan = async (source: 'camera' | 'gallery') => {
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Berechtigung', 'Zugriff verweigert.'); return; }

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

  // manual tab handler
  const handleAddManual = () => {
    if (!manualName.trim()) { Alert.alert('Name fehlt', 'Bitte gib einen Namen ein.'); return; }
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

  const isReplacing = !!replacingIngId;
  const headerTitle = isReplacing ? 'Zutat ersetzen' : 'Zutat hinzufügen';
  const addBtnLabel = isReplacing ? 'Zutat ersetzen' : 'Zutat hinzufügen';

  const TABS: { id: Tab; label: string }[] = [
    { id: 'search', label: 'Suche' },
    { id: 'ai', label: 'KI' },
    { id: 'scan', label: 'Scan' },
    { id: 'manual', label: 'Manuell' },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.cancel}>Abbrechen</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <View style={{ width: 80 }} />
        </View>

        <View style={styles.tabs}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.tab, tab === t.id && styles.tabActive]}
              onPress={() => setTab(t.id)}
            >
              <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* ============ SEARCH TAB ============ */}
          {tab === 'search' && !selectedProduct && (
            <>
              <TextInput
                style={styles.searchInput}
                placeholder="Lebensmittel suchen…"
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={setQuery}
                autoFocus
                returnKeyType="search"
              />
              <FoodSearchResultList
                results={results}
                loading={searching}
                query={query}
                onSelect={handleSelectProduct}
                showSourceBadges
                footer={
                  <View style={styles.noResultsBox}>
                    <Text style={styles.noResultsText}>
                      {`Kein Ergebnis für „${query}"`}
                    </Text>
                    <TouchableOpacity
                      style={[styles.addBtn, aiFooterEstimating && styles.addBtnDisabled]}
                      onPress={handleAiFromSearch}
                      disabled={aiFooterEstimating}
                    >
                      {aiFooterEstimating
                        ? <ActivityIndicator color={colors.white} />
                        : <Text style={styles.addBtnText}>✨ Mit KI schätzen</Text>}
                    </TouchableOpacity>
                  </View>
                }
              />
            </>
          )}

          {tab === 'search' && selectedProduct && (
            <>
              <TouchableOpacity onPress={() => setSelectedProduct(null)} style={styles.backBtn}>
                <Text style={styles.backBtnText}>‹ Zurück zur Suche</Text>
              </TouchableOpacity>
              <Text style={styles.selectedName}>{selectedProduct.name}</Text>
              {selectedProduct.brand
                ? <Text style={styles.selectedBrand}>{selectedProduct.brand}</Text>
                : null}
              <Text style={styles.label}>Menge</Text>
              <QuantityInputRow
                nutritionPer100g={{
                  calories: selectedProduct.nutritionPer100g?.calories ?? 0,
                  protein: selectedProduct.nutritionPer100g?.protein ?? 0,
                  carbs: selectedProduct.nutritionPer100g?.carbs ?? 0,
                  fat: selectedProduct.nutritionPer100g?.fat ?? 0,
                  fiber: selectedProduct.nutritionPer100g?.fiber ?? 0,
                }}
                portionWeightGrams={selectedProduct.portion?.weightGrams}
                portionLabel={selectedProduct.portion?.label}
                mode={amountMode}
                value={amountValue}
                onChange={(m, v) => { setAmountMode(m); setAmountValue(v); }}
              />
              <TouchableOpacity style={styles.addBtn} onPress={handleAddProduct}>
                <Text style={styles.addBtnText}>{addBtnLabel}</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ============ AI TAB ============ */}
          {tab === 'ai' && (
            <>
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
                {estimating
                  ? <ActivityIndicator color={colors.white} />
                  : <Text style={styles.addBtnText}>✨ KI-Schätzung abrufen</Text>}
              </TouchableOpacity>
            </>
          )}

          {/* ============ SCAN TAB ============ */}
          {tab === 'scan' && !scanResult && (
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
                  <TouchableOpacity style={styles.scanBtn} onPress={() => handlePickAndScan('camera')}>
                    <Text style={styles.scanBtnText}>📷 Kamera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.scanBtn} onPress={() => handlePickAndScan('gallery')}>
                    <Text style={styles.scanBtnText}>🖼 Galerie</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {tab === 'scan' && scanResult && (
            <>
              <TouchableOpacity onPress={() => { setScanResult(null); setScanName(''); }} style={styles.backBtn}>
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

          {/* ============ MANUAL TAB ============ */}
          {tab === 'manual' && (
            <>
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
                  <TextInput style={styles.macroInput} keyboardType="decimal-pad" value={manualKcal} onChangeText={setManualKcal} placeholder="0" placeholderTextColor={colors.textMuted} />
                </View>
                <View style={styles.macroField}>
                  <Text style={styles.macroLabel}>Protein (g)</Text>
                  <TextInput style={styles.macroInput} keyboardType="decimal-pad" value={manualProtein} onChangeText={setManualProtein} placeholder="0" placeholderTextColor={colors.textMuted} />
                </View>
                <View style={styles.macroField}>
                  <Text style={styles.macroLabel}>Kohlenhydr. (g)</Text>
                  <TextInput style={styles.macroInput} keyboardType="decimal-pad" value={manualCarbs} onChangeText={setManualCarbs} placeholder="0" placeholderTextColor={colors.textMuted} />
                </View>
                <View style={styles.macroField}>
                  <Text style={styles.macroLabel}>Fett (g)</Text>
                  <TextInput style={styles.macroInput} keyboardType="decimal-pad" value={manualFat} onChangeText={setManualFat} placeholder="0" placeholderTextColor={colors.textMuted} />
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
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.h3, color: colors.text },
  cancel: { ...typography.body1, color: colors.textSecondary, width: 80 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { ...typography.button, color: colors.textMuted },
  tabTextActive: { color: colors.primary },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },
  searchInput: {
    ...typography.body1,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  noResultsBox: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.md },
  noResultsText: { ...typography.body2, color: colors.textMuted },
  backBtn: { marginBottom: spacing.md },
  backBtnText: { ...typography.body2, color: colors.primary },
  selectedName: { ...typography.h3, color: colors.text, marginBottom: 2 },
  selectedBrand: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
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
  scanHint: { ...typography.body2, color: colors.textMuted, marginBottom: spacing.md },
  scanLoading: { alignItems: 'center', paddingVertical: spacing.xl },
  scanLoadingText: { ...typography.body1, color: colors.textMuted, marginTop: spacing.sm },
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
  scanNutritionTitle: { ...typography.overline, color: colors.textMuted, marginBottom: spacing.xs },
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
