// AddIngredientModal — Suche nach Produkten oder KI-Schätzung für Rezeptzutaten
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { randomUUID } from 'expo-crypto';
import type { AiFoodEstimateNutrition, FoodSearchResult, RecipeIngredient } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { foodApi } from '../../shared/api/foodApi';
import { aiApi } from '../../shared/api/aiApi';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (ingredient: RecipeIngredient) => void;
}

type Tab = 'search' | 'ai';

function buildIngredientFromProduct(
  product: FoodSearchResult,
  amountGrams: number,
): RecipeIngredient {
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
    inputMode: 'grams',
    inputAmount: amountGrams,
    amountGrams,
    unit: 'g',
    linkedProductId: product.id,
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

function buildIngredientFromEstimate(
  name: string,
  amountGrams: number,
  nutritionPer100g: { calories: number; protein: number; carbs: number; fat: number; fiber: number },
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
    nutritionPer100g,
    nutritionContribution: {
      calories: Math.round(nutritionPer100g.calories * scale * 10) / 10,
      protein: Math.round(nutritionPer100g.protein * scale * 10) / 10,
      carbs: Math.round(nutritionPer100g.carbs * scale * 10) / 10,
      fat: Math.round(nutritionPer100g.fat * scale * 10) / 10,
      fiber: Math.round(nutritionPer100g.fiber * scale * 10) / 10,
    },
  };
}

export default function AddIngredientModal({ visible, onClose, onAdd }: Props) {
  const [tab, setTab] = useState<Tab>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<FoodSearchResult | null>(null);
  const [amountInput, setAmountInput] = useState('100');

  // AI tab
  const [aiName, setAiName] = useState('');
  const [aiAmount, setAiAmount] = useState('100');
  const [estimating, setEstimating] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const data = await foodApi.search(query.trim());
      setResults(data.results ?? []);
    } catch {
      Alert.alert('Fehler', 'Suche fehlgeschlagen.');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectProduct = (product: FoodSearchResult) => {
    setSelectedProduct(product);
  };

  const handleAddProduct = () => {
    if (!selectedProduct) return;
    const grams = parseFloat(amountInput);
    if (!Number.isFinite(grams) || grams <= 0) {
      Alert.alert('Ungültige Menge', 'Bitte gib eine gültige Grammzahl ein.');
      return;
    }
    onAdd(buildIngredientFromProduct(selectedProduct, grams));
    resetAndClose();
  };

  const handleAiEstimate = async () => {
    if (!aiName.trim()) return;
    const grams = parseFloat(aiAmount);
    if (!Number.isFinite(grams) || grams <= 0) {
      Alert.alert('Ungültige Menge', 'Bitte gib eine gültige Grammzahl ein.');
      return;
    }
    setEstimating(true);
    try {
      const estimate = await aiApi.estimateFood({ name: aiName.trim() });
      const raw: AiFoodEstimateNutrition = estimate.estimatedNutritionPer100g;
      const n = {
        calories: raw.calories,
        protein: raw.protein,
        carbs: raw.carbs,
        fat: raw.fat,
        fiber: raw.fiber ?? 0,
      };
      onAdd(buildIngredientFromEstimate(aiName.trim(), grams, n));
      resetAndClose();
    } catch {
      Alert.alert('Fehler', 'KI-Schätzung fehlgeschlagen.');
    } finally {
      setEstimating(false);
    }
  };

  const resetAndClose = () => {
    setQuery('');
    setResults([]);
    setSelectedProduct(null);
    setAmountInput('100');
    setAiName('');
    setAiAmount('100');
    setTab('search');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetAndClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={resetAndClose}>
            <Text style={styles.cancel}>Abbrechen</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Zutat hinzufügen</Text>
          <View style={{ width: 80 }} />
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, tab === 'search' && styles.tabActive]} onPress={() => setTab('search')}>
            <Text style={[styles.tabText, tab === 'search' && styles.tabTextActive]}>Produktsuche</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === 'ai' && styles.tabActive]} onPress={() => setTab('ai')}>
            <Text style={[styles.tabText, tab === 'ai' && styles.tabTextActive]}>KI-Schätzung</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {tab === 'search' && (
            <>
              {!selectedProduct ? (
                <>
                  <View style={styles.searchRow}>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Lebensmittel suchen…"
                      placeholderTextColor={colors.textMuted}
                      value={query}
                      onChangeText={setQuery}
                      onSubmitEditing={handleSearch}
                      returnKeyType="search"
                    />
                    <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={searching}>
                      {searching
                        ? <ActivityIndicator color={colors.white} />
                        : <Text style={styles.searchBtnText}>Suchen</Text>}
                    </TouchableOpacity>
                  </View>
                  {results.map((r) => (
                    <TouchableOpacity key={r.id} style={styles.resultRow} onPress={() => handleSelectProduct(r)}>
                      <View>
                        <Text style={styles.resultName}>{r.name}</Text>
                        {r.brand && <Text style={styles.resultBrand}>{r.brand}</Text>}
                        <Text style={styles.resultMeta}>{r.displayLabel}</Text>
                      </View>
                      <Text style={styles.chevron}>›</Text>
                    </TouchableOpacity>
                  ))}
                </>
              ) : (
                <>
                  <TouchableOpacity onPress={() => setSelectedProduct(null)} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>‹ Zurück zur Suche</Text>
                  </TouchableOpacity>
                  <Text style={styles.selectedName}>{selectedProduct.name}</Text>
                  <Text style={styles.label}>Menge (g)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    value={amountInput}
                    onChangeText={setAmountInput}
                    placeholder="100"
                    placeholderTextColor={colors.textMuted}
                  />
                  <TouchableOpacity style={styles.addBtn} onPress={handleAddProduct}>
                    <Text style={styles.addBtnText}>Zutat hinzufügen</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}

          {tab === 'ai' && (
            <>
              <Text style={styles.label}>Zutat beschreiben</Text>
              <TextInput
                style={styles.input}
                placeholder="z. B. Vollmilch 3,5%"
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
                  : <Text style={styles.addBtnText}>KI-Schätzung abrufen</Text>}
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
  searchRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  searchInput: {
    flex: 1,
    ...typography.body1,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  searchBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  searchBtnText: { ...typography.button, color: colors.white },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  resultName: { ...typography.body1, color: colors.text },
  resultBrand: { ...typography.caption, color: colors.textMuted },
  resultMeta: { ...typography.caption, color: colors.textSecondary },
  chevron: { ...typography.h2, color: colors.textMuted },
  backBtn: { marginBottom: spacing.md },
  backBtnText: { ...typography.body2, color: colors.primary },
  selectedName: { ...typography.h3, color: colors.text, marginBottom: spacing.md },
  label: { ...typography.overline, color: colors.textMuted, marginBottom: spacing.xs, marginTop: spacing.md },
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
});
