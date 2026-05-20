// AddItemModal — 3-mode item picker for the Nutrition Diary.
//
// Mode A: AI Input — describe meal in natural language, call /api/ai/meal-analyze
// Mode B: Search   — unified search via /api/food-search (user library + Open Food Facts)
// Mode C: Manual   — form input for all macro fields
//
// The modal is a full-screen React Native Modal (no extra dependencies).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import type { FoodSearchResult } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { formatApiError } from '../../shared/api/apiError';
import { isQuotaExceededError } from '../../shared/api/client';
import { ErrorBanner } from '../../shared/components/ErrorBanner';
import { diaryApi } from '../../shared/api/diaryApi';
import { calculateNutrition } from './nutritionUtils';
import { reusableItemsApi } from '../../shared/api/reusableItemsApi';
import { foodApi } from '../../shared/api/foodApi';

import { aiApi } from '../../shared/api/aiApi';
import type { MealParserPreviewResponse } from '../../shared/api/aiApi';
import MealParserReviewScreen from './MealParserReviewScreen';

type Mode = 'ai' | 'search' | 'manual';

interface Props {
  visible: boolean;
  mealId: string;
  mealName: string;
  onClose: () => void;
  onSaved: () => void;
}

const MODES: { id: Mode; label: string }[] = [
  { id: 'ai', label: '✨ AI' },
  { id: 'search', label: '🔍 Search' },
  { id: 'manual', label: '✏️ Manual' },
];

// --- Mode A: AI Input ---
interface AiModeProps {
  mealId: string;
  onSaved: () => void;
}

function AiMode({ mealId, onSaved }: AiModeProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<MealParserPreviewResponse | null>(null);

  async function handleAnalyze() {
    if (text.trim().length < 3) return;
    setLoading(true);
    setError(null);
    try {
      const result = await aiApi.previewMeal(text.trim());
      setPreview(result);
    } catch (e) {
      if (isQuotaExceededError(e)) {
        setError('Deine kostenlosen KI-Analysen für diesen Monat sind aufgebraucht. Das Kontingent wird am Monatsanfang zurückgesetzt.');
      } else {
        setError(formatApiError(e));
      }
    } finally {
      setLoading(false);
    }
  }

  function handleReviewSaved() {
    setPreview(null);
    setText('');
    onSaved();
  }

  return (
    <View style={[modeStyles.container, aiStyles.wrapper]}>
      <Text style={aiStyles.title}>✨ KI-Mahlzeitenerkennung</Text>
      <Text style={aiStyles.subtitle}>
        Beschreibe deine Mahlzeit in eigenen Worten, z.B. „200g Hähnchenbrust mit 150g Reis"
      </Text>
      <TextInput
        style={aiStyles.input}
        placeholder="Mahlzeit beschreiben…"
        placeholderTextColor={colors.textMuted}
        value={text}
        onChangeText={setText}
        multiline
        numberOfLines={3}
        returnKeyType="done"
      />
      {error && <ErrorBanner error={error} />}
      <TouchableOpacity
        style={[aiStyles.analyzeBtn, (loading || text.trim().length < 3) && aiStyles.analyzeBtnDisabled]}
        onPress={handleAnalyze}
        disabled={loading || text.trim().length < 3}
      >
        {loading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={aiStyles.analyzeBtnText}>Analysieren</Text>
        )}
      </TouchableOpacity>

      {preview && (
        <MealParserReviewScreen
          visible
          mealId={mealId}
          items={preview.items}
          warnings={preview.warnings}
          onClose={() => setPreview(null)}
          onSaved={handleReviewSaved}
        />
      )}
    </View>
  );
}

// --- QuantitySelector — step shown after selecting a food item ---
interface QuantitySelectorProps {
  item: FoodSearchResult;
  mealId: string;
  onSaved: () => void;
  onBack: () => void;
}

function PreviewValue({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <View style={qsStyles.previewItem}>
      <Text style={qsStyles.previewValue}>{value}</Text>
      <Text style={qsStyles.previewUnit}>{unit}</Text>
      <Text style={qsStyles.previewLabel}>{label}</Text>
    </View>
  );
}

function QuantitySelector({ item, mealId, onSaved, onBack }: QuantitySelectorProps) {
  const hasPortions = !!item.portion?.weightGrams;
  const hasPer100g = item.nutritionPer100g != null;

  type QMode = 'grams' | 'portion';
  const [qMode, setQMode] = useState<QMode>(hasPortions ? 'portion' : 'grams');
  const [qValue, setQValue] = useState(hasPortions ? '1' : '100');
  const [saving, setSaving] = useState(false);

  const parsedValue = Number(qValue);
  const isValid = Number.isFinite(parsedValue) && parsedValue > 0;

  const preview = useMemo(() => {
    if (!hasPer100g || !isValid || !item.nutritionPer100g) return null;
    try {
      return calculateNutrition(
        qMode,
        parsedValue,
        item.nutritionPer100g,
        item.portion?.weightGrams,
      );
    } catch {
      return null;
    }
  }, [qMode, parsedValue, item.nutritionPer100g, item.portion?.weightGrams, hasPer100g, isValid]);

  const handleAdd = async () => {
    if (!isValid || !preview) return;
    setSaving(true);
    try {
      await diaryApi.addItem(mealId, {
        productId: item.id,
        productName: item.name,
        inputMode: qMode,
        inputAmount: parsedValue,
        amountGrams: preview.amountGrams,
        calculatedNutrition: preview.calculatedNutrition,
      });
      onSaved();
    } catch (e) {
      Alert.alert('Fehler', formatApiError(e, 'Eintrag konnte nicht gespeichert werden.'));
    } finally {
      setSaving(false);
    }
  };

  const weightGrams = item.portion?.weightGrams;

  return (
    <ScrollView
      style={modeStyles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity onPress={onBack} style={qsStyles.backRow}>
        <Text style={qsStyles.backText}>← Zurück</Text>
      </TouchableOpacity>

      <Text style={qsStyles.itemName}>{item.name}</Text>
      {item.brand ? <Text style={qsStyles.brandText}>{item.brand}</Text> : null}

      {/* Segmented control — only when portion.weightGrams exists */}
      {hasPortions && (
        <View style={qsStyles.segmentedControl}>
          <TouchableOpacity
            style={[qsStyles.segment, qMode === 'grams' && qsStyles.segmentActive]}
            onPress={() => { setQMode('grams'); setQValue('100'); }}
          >
            <Text style={[qsStyles.segmentText, qMode === 'grams' && qsStyles.segmentTextActive]}>Gramm</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[qsStyles.segment, qMode === 'portion' && qsStyles.segmentActive]}
            onPress={() => { setQMode('portion'); setQValue('1'); }}
          >
            <Text style={[qsStyles.segmentText, qMode === 'portion' && qsStyles.segmentTextActive]}>Portion</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Amount input */}
      <View style={qsStyles.inputBlock}>
        <Text style={qsStyles.inputLabel}>
          {qMode === 'grams' ? 'Menge in g' : 'Anzahl Portionen'}
        </Text>
        <TextInput
          style={qsStyles.qInput}
          value={qValue}
          onChangeText={setQValue}
          keyboardType="decimal-pad"
          selectTextOnFocus
          autoFocus
        />
        {qMode === 'portion' && weightGrams != null && (
          <Text style={qsStyles.portionHint}>1 Portion = {weightGrams} g</Text>
        )}
      </View>

      {/* Live preview */}
      {preview && (
        <View style={qsStyles.preview}>
          <Text style={qsStyles.previewTitle}>
            Nährwerte ({Math.round(preview.amountGrams)} g)
          </Text>
          <View style={qsStyles.previewRow}>
            <PreviewValue label="Kalorien" value={preview.calculatedNutrition.calories} unit="kcal" />
            <PreviewValue label="Protein" value={preview.calculatedNutrition.protein} unit="g" />
            <PreviewValue label="Kohlenhydr." value={preview.calculatedNutrition.carbs} unit="g" />
            <PreviewValue label="Fett" value={preview.calculatedNutrition.fat} unit="g" />
            {preview.calculatedNutrition.fiber != null && (
              <PreviewValue label="Ballaststoffe" value={preview.calculatedNutrition.fiber} unit="g" />
            )}
          </View>
        </View>
      )}

      {!hasPer100g && (
        <Text style={qsStyles.hintText}>
          Keine Nährwertdaten verfügbar — manuelle Eingabe empfohlen.
        </Text>
      )}

      <TouchableOpacity
        style={[modeStyles.primaryBtn, (!isValid || saving || !hasPer100g) && modeStyles.btnDisabled]}
        onPress={handleAdd}
        disabled={!isValid || saving || !hasPer100g}
      >
        {saving ? (
          <ActivityIndicator size="small" color={colors.background} />
        ) : (
          <Text style={modeStyles.primaryBtnText}>Zur Mahlzeit hinzufügen</Text>
        )}
      </TouchableOpacity>
      <View style={{ height: spacing.lg }} />
    </ScrollView>
  );
}

// --- Mode B: Search ---
function SearchMode({ mealId, onSaved }: { mealId: string; onSaved: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FoodSearchResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    setLoading(true);
    setSearchError(null);
    try {
      const res = await foodApi.search(q);
      setResults(res.results);
    } catch (e) {
      setResults([]);
      setSearchError(formatApiError(e, 'Search failed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  // If user selected an item, show quantity selector
  if (selected) {
    return (
      <QuantitySelector
        item={selected}
        mealId={mealId}
        onSaved={onSaved}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <View style={modeStyles.container}>
      <TextInput
        style={modeStyles.input}
        placeholder="Search food (library + Open Food Facts)..."
        placeholderTextColor={colors.textMuted}
        value={query}
        onChangeText={setQuery}
        autoFocus
        returnKeyType="search"
      />
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
      ) : searchError ? (
        <ErrorBanner
          error={searchError}
          onRetry={() => doSearch(query)}
        />
      ) : results.length === 0 ? (
        <Text style={modeStyles.emptyText}>
          {query.trim() ? 'No results found.' : 'Start typing to search food...'}
        </Text>
      ) : (
        <ScrollView style={modeStyles.resultList} keyboardShouldPersistTaps="handled">
          {results.map((item) => (
            <TouchableOpacity
              key={`${item.source}-${item.id}`}
              style={[modeStyles.searchItem, !item.isComplete && srStyles.incompleteItem]}
              onPress={() => setSelected(item)}
            >
              <View style={{ flex: 1 }}>
                <View style={srStyles.nameRow}>
                  <Text style={modeStyles.searchItemName}>{item.name}</Text>
                  <Text style={srStyles.sourceBadge}>
                    {item.source === 'library' ? '📚' : '🌍'}
                  </Text>
                  {!item.isComplete && <Text style={srStyles.warningBadge}>⚠️</Text>}
                </View>
                {item.brand ? <Text style={srStyles.brandText}>{item.brand}</Text> : null}
                <Text style={modeStyles.searchItemMacros}>{item.displayLabel}</Text>
                {!item.isComplete && (
                  <Text style={srStyles.incompleteHint}>Incomplete data — tap to add manually</Text>
                )}
              </View>
              <Text style={modeStyles.addIcon}>›</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// --- Mode C: Manual ---
const EMPTY_FORM = { name: '', calories: '', protein: '', carbs: '', fat: '', fiber: '' };

function ManualMode({ mealId, onSaved }: { mealId: string; onSaved: () => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const set = (field: keyof typeof EMPTY_FORM) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const isValid =
    form.name.trim().length > 0 &&
    ['calories', 'protein', 'carbs', 'fat', 'fiber'].every((k) => {
      const v = Number((form as Record<string, string>)[k]);
      return Number.isFinite(v) && v >= 0;
    });

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    const macros = {
      name: form.name.trim(),
      calories: Number(form.calories),
      protein: Number(form.protein),
      carbs: Number(form.carbs),
      fat: Number(form.fat),
      fiber: Number(form.fiber),
    };
    try {
      await diaryApi.addItem(mealId, macros);
      // Save to reusable library (fire-and-forget — don't block the UI if it fails)
      reusableItemsApi.create(macros).catch(() => undefined);
      setForm(EMPTY_FORM);
      onSaved();
    } catch (e) {
      Alert.alert('Error', formatApiError(e, 'Could not save item'));
    } finally {
      setSaving(false);
    }
  };

  const numInput = (label: string, field: keyof typeof EMPTY_FORM, unit = 'g') => (
    <View style={modeStyles.fieldRow} key={field}>
      <Text style={modeStyles.fieldLabel}>
        {label} <Text style={modeStyles.fieldUnit}>({unit})</Text>
      </Text>
      <TextInput
        style={modeStyles.fieldInput}
        value={(form as Record<string, string>)[field]}
        onChangeText={set(field)}
        placeholder="0"
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
        returnKeyType="next"
      />
    </View>
  );

  return (
    <ScrollView style={modeStyles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={modeStyles.fieldRow}>
        <Text style={modeStyles.fieldLabel}>Name</Text>
        <TextInput
          style={[modeStyles.fieldInput, { flex: 1.6 }]}
          value={form.name}
          onChangeText={set('name')}
          placeholder="Food name"
          placeholderTextColor={colors.textMuted}
          returnKeyType="next"
        />
      </View>
      {numInput('Calories', 'calories', 'kcal')}
      {numInput('Protein', 'protein')}
      {numInput('Carbs', 'carbs')}
      {numInput('Fat', 'fat')}
      {numInput('Fiber', 'fiber')}
      <TouchableOpacity
        style={[modeStyles.primaryBtn, (!isValid || saving) && modeStyles.btnDisabled, { marginTop: spacing.md }]}
        onPress={handleSave}
        disabled={!isValid || saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color={colors.background} />
        ) : (
          <Text style={modeStyles.primaryBtnText}>Save Item</Text>
        )}
      </TouchableOpacity>
      <View style={{ height: spacing.lg }} />
    </ScrollView>
  );
}

// --- Modal shell ---
export default function AddItemModal({ visible, mealId, mealName, onClose, onSaved }: Props) {
  const [mode, setMode] = useState<Mode>('search');

  useEffect(() => {
    if (visible) setMode('search');
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={shellStyles.container}>
            {/* Header */}
            <View style={shellStyles.header}>
              <View>
                <Text style={shellStyles.title}>Add Item</Text>
                <Text style={shellStyles.subtitle}>to {mealName}</Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={shellStyles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Mode tabs */}
            <View style={shellStyles.tabs}>
              {MODES.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[shellStyles.tab, mode === m.id && shellStyles.tabActive]}
                  onPress={() => setMode(m.id)}
                >
                  <Text style={[shellStyles.tabText, mode === m.id && shellStyles.tabTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Mode content */}
            <View style={shellStyles.content}>
              {mode === 'ai' && <AiMode mealId={mealId} onSaved={onSaved} />}
              {mode === 'search' && <SearchMode mealId={mealId} onSaved={onSaved} />}
              {mode === 'manual' && <ManualMode mealId={mealId} onSaved={onSaved} />}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const shellStyles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.md,
    paddingTop: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { ...typography.h3, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  closeBtn: { ...typography.h3, color: colors.textSecondary },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: colors.background },
  content: { flex: 1, padding: spacing.md },
});

const modeStyles = StyleSheet.create({
  container: { flex: 1 },
  hint: { ...typography.body2, color: colors.text, marginBottom: spacing.xs },
  example: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm, fontStyle: 'italic' },
  textArea: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    padding: spacing.sm,
    ...typography.body2,
    minHeight: 80,
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    padding: spacing.sm,
    ...typography.body2,
    marginBottom: spacing.sm,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.45 },
  primaryBtnText: { ...typography.button, color: colors.background },
  resultBox: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  resultText: { ...typography.body2, color: colors.text },
  emptyText: { ...typography.body2, color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
  resultList: { flex: 1 },
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchItemName: { ...typography.body2, color: colors.text },
  searchItemMacros: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  addIcon: { ...typography.h2, color: colors.primary, paddingLeft: spacing.sm },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  fieldLabel: { ...typography.body2, color: colors.text, flex: 1 },
  fieldUnit: { color: colors.textMuted, fontSize: 11 },
  fieldInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    padding: spacing.sm,
    ...typography.body2,
    textAlign: 'right',
    minWidth: 90,
  },
});

// --- AI placeholder styles ---
const aiStyles = StyleSheet.create({
  wrapper: { gap: spacing.md, paddingTop: spacing.md },
  title: { ...typography.h3, color: colors.text },
  subtitle: { ...typography.body2, color: colors.textMuted },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.sm,
    color: colors.text,
    ...typography.body1,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  analyzeBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  analyzeBtnDisabled: { opacity: 0.4 },
  analyzeBtnText: { ...typography.body1, color: colors.white, fontWeight: '700' },
});

// --- QuantitySelector styles ---
const qsStyles = StyleSheet.create({
  backRow: { marginBottom: spacing.sm },
  backText: { ...typography.body2, color: colors.primary },
  itemName: { ...typography.h3, color: colors.text, marginBottom: 2 },
  brandText: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  // Segmented control
  segmentedControl: {
    flexDirection: 'row',
    marginVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  segmentTextActive: { color: colors.background },
  // Input block
  inputBlock: { marginVertical: spacing.sm },
  inputLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  qInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    color: colors.text,
    padding: spacing.sm,
    ...typography.h3,
    textAlign: 'center',
  },
  portionHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  hintText: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
  // Live preview
  preview: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginVertical: spacing.md,
  },
  previewTitle: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  previewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  previewItem: { alignItems: 'center', minWidth: 56 },
  previewValue: { ...typography.body1, color: colors.text, fontWeight: '700' },
  previewUnit: { ...typography.caption, color: colors.textMuted },
  previewLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
});

// --- Search result list styles ---
const srStyles = StyleSheet.create({
  incompleteItem: { opacity: 0.8, borderLeftWidth: 3, borderLeftColor: '#F59E0B', paddingLeft: spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  sourceBadge: { fontSize: 12 },
  warningBadge: { fontSize: 12 },
  brandText: { ...typography.caption, color: colors.textMuted, marginTop: 1 },
  incompleteHint: { ...typography.caption, color: '#F59E0B', marginTop: 2 },
});

