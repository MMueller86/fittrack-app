// AddItemModal — 3-mode item picker for the Nutrition Diary.
//
// Mode A: AI Input — describe meal in natural language, call /api/ai/meal-analyze
// Mode B: Search   — autocomplete from reusable items (/api/reusable-items?query=)
// Mode C: Manual   — form input for all macro fields
//
// The modal is a full-screen React Native Modal (no extra dependencies).

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import type { ReusableItem } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { diaryApi } from '../../shared/api/diaryApi';
import { reusableItemsApi } from '../../shared/api/reusableItemsApi';
import { aiApi } from '../../shared/api/aiApi';

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
function AiMode({ mealId, onSaved }: { mealId: string; onSaved: () => void }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    Keyboard.dismiss();
    setLoading(true);
    setResult(null);
    try {
      const res = await aiApi.analyzeMeal(text.trim());
      setResult(res.message);
    } catch {
      setResult('Could not reach the AI service. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={modeStyles.container}>
      <Text style={modeStyles.hint}>Describe your meal in plain language</Text>
      <Text style={modeStyles.example}>e.g. "2 slices whole grain toast with butter and cheese"</Text>
      <TextInput
        style={modeStyles.textArea}
        placeholder="Describe your meal..."
        placeholderTextColor={colors.textMuted}
        value={text}
        onChangeText={setText}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />
      <TouchableOpacity
        style={[modeStyles.primaryBtn, (!text.trim() || loading) && modeStyles.btnDisabled]}
        onPress={handleAnalyze}
        disabled={!text.trim() || loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.background} />
        ) : (
          <Text style={modeStyles.primaryBtnText}>Analyze with AI</Text>
        )}
      </TouchableOpacity>
      {result !== null && (
        <View style={modeStyles.resultBox}>
          <Text style={modeStyles.resultText}>{result}</Text>
        </View>
      )}
    </View>
  );
}

// --- Mode B: Search ---
function SearchMode({ mealId, onSaved }: { mealId: string; onSaved: () => void }) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<ReusableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await reusableItemsApi.search(q);
      setItems(res.items);
    } catch {
      setItems([]);
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

  const handleSelect = async (item: ReusableItem) => {
    setSaving(item.id);
    try {
      await diaryApi.addItem(mealId, {
        name: item.name,
        calories: item.calories,
        proteinG: item.proteinG,
        carbsG: item.carbsG,
        fatG: item.fatG,
        fiberG: item.fiberG,
      });
      onSaved();
    } catch {
      Alert.alert('Error', 'Could not add item');
    } finally {
      setSaving(null);
    }
  };

  return (
    <View style={modeStyles.container}>
      <TextInput
        style={modeStyles.input}
        placeholder="Search food..."
        placeholderTextColor={colors.textMuted}
        value={query}
        onChangeText={setQuery}
        autoFocus
        returnKeyType="search"
      />
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
      ) : items.length === 0 ? (
        <Text style={modeStyles.emptyText}>
          {query.trim() ? 'No results found.' : 'Start typing to search your food library.'}
        </Text>
      ) : (
        <ScrollView style={modeStyles.resultList} keyboardShouldPersistTaps="handled">
          {items.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={modeStyles.searchItem}
              onPress={() => handleSelect(item)}
              disabled={saving === item.id}
            >
              <View style={{ flex: 1 }}>
                <Text style={modeStyles.searchItemName}>{item.name}</Text>
                <Text style={modeStyles.searchItemMacros}>
                  {Math.round(item.calories)} kcal · {Math.round(item.proteinG)}g P ·{' '}
                  {Math.round(item.carbsG)}g C · {Math.round(item.fatG)}g F
                </Text>
              </View>
              {saving === item.id ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={modeStyles.addIcon}>+</Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// --- Mode C: Manual ---
const EMPTY_FORM = { name: '', calories: '', proteinG: '', carbsG: '', fatG: '', fiberG: '' };

function ManualMode({ mealId, onSaved }: { mealId: string; onSaved: () => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const set = (field: keyof typeof EMPTY_FORM) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const isValid =
    form.name.trim().length > 0 &&
    ['calories', 'proteinG', 'carbsG', 'fatG', 'fiberG'].every((k) => {
      const v = Number((form as Record<string, string>)[k]);
      return Number.isFinite(v) && v >= 0;
    });

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    const macros = {
      name: form.name.trim(),
      calories: Number(form.calories),
      proteinG: Number(form.proteinG),
      carbsG: Number(form.carbsG),
      fatG: Number(form.fatG),
      fiberG: Number(form.fiberG),
    };
    try {
      await diaryApi.addItem(mealId, macros);
      // Save to reusable library (fire-and-forget — don't block the UI if it fails)
      reusableItemsApi.create(macros).catch(() => undefined);
      setForm(EMPTY_FORM);
      onSaved();
    } catch {
      Alert.alert('Error', 'Could not save item');
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
      {numInput('Protein', 'proteinG')}
      {numInput('Carbs', 'carbsG')}
      {numInput('Fat', 'fatG')}
      {numInput('Fiber', 'fiberG')}
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
