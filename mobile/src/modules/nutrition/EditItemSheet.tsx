// EditItemSheet — redesigned bottom sheet for editing a diary item.
// Features: adaptive stepper, live macro preview, More Actions (⋯), inline delete.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Meal, MealItem } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { diaryApi } from '../../shared/api/diaryApi';
import { ConfirmSheet } from '../../shared/components/ConfirmSheet';
import { useSourceProduct } from './useSourceProduct';

function getStep(amount: number, isPortion: boolean): number {
  if (isPortion) return 0.5;
  if (amount < 50) return 5;
  if (amount < 500) return 10;
  return 50;
}

function formatAmount(val: number, isPortion: boolean): string {
  if (isPortion) return val % 1 === 0 ? String(val) : val.toFixed(1);
  return String(Math.round(val));
}

function derivePer100g(item: MealItem) {
  if (item.unit !== 'g' || !item.quantity || item.quantity <= 0) return null;
  const q = item.quantity;
  return {
    calories: (item.macros.calories / q) * 100,
    protein: (item.macros.protein / q) * 100,
    carbs: (item.macros.carbs / q) * 100,
    fat: (item.macros.fat / q) * 100,
    fiber: ((item.macros.fiber ?? 0) / q) * 100,
  };
}

function MacroPreviewRow({ label, value, unit, barPct }: {
  label: string; value: number; unit: string; barPct?: number;
}) {
  return (
    <View style={pStyles.row}>
      <Text style={pStyles.label}>{label}</Text>
      <View style={pStyles.right}>
        <Text style={pStyles.value}>{Math.round(value * 10) / 10} <Text style={pStyles.unit}>{unit}</Text></Text>
        {barPct !== undefined && (
          <View style={pStyles.track}>
            <View style={[pStyles.fill, { width: `${Math.min(barPct, 1) * 100}%` }]} />
          </View>
        )}
      </View>
    </View>
  );
}

const pStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  label: { ...typography.caption, color: colors.textSecondary, width: 110 },
  right: { flex: 1, alignItems: 'flex-end' },
  value: { ...typography.caption, color: colors.text, fontWeight: '600' as const },
  unit: { fontWeight: '400' as const, color: colors.textMuted },
  track: { height: 3, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden', width: '100%', marginTop: 2 },
  fill: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 2 },
});

interface Props {
  visible: boolean;
  mealId: string;
  mealName: string;
  dateLabel: string;
  item: MealItem;
  proteinTarget?: number;
  onSaved: (updatedMeal: Meal) => void;
  onDeleted: (mealId: string, itemId: string, itemName: string) => void;
  onClose: () => void;
  onMoveRequest?: (item: MealItem) => void;
  onCopyRequest?: (item: MealItem) => void;
}

export default function EditItemSheet({
  visible, mealId, mealName, dateLabel, item, proteinTarget,
  onSaved, onDeleted, onClose, onMoveRequest, onCopyRequest,
}: Props) {
  const insets = useSafeAreaInsets();
  const isPortion = item.unit === 'portion';

  const [inputMode, setInputMode] = useState<'grams' | 'portion'>(isPortion ? 'portion' : 'grams');
  const [amount, setAmount] = useState(item.quantity);
  const [amountText, setAmountText] = useState(formatAmount(item.quantity, isPortion));
  const [isTyping, setIsTyping] = useState(false);
  const [saving, setSaving] = useState(false);
  const [moreActionsVisible, setMoreActionsVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

  const { product: sourceProduct } = useSourceProduct(item.sourceId);
  const canTogglePortion = isPortion || !!sourceProduct?.portion?.weightGrams;
  const portionWeightGrams = sourceProduct?.portion?.weightGrams;

  useEffect(() => {
    const mode = item.unit === 'portion' ? 'portion' : 'grams';
    setInputMode(mode);
    setAmount(item.quantity);
    setAmountText(formatAmount(item.quantity, mode === 'portion'));
    setIsTyping(false);
  }, [item.id, item.quantity, item.unit]);

  const per100g = useMemo(() => derivePer100g(item), [item]);

  const preview = useMemo(() => {
    if (!amount || amount <= 0) return null;
    if (inputMode === 'grams' && per100g) {
      const s = amount / 100;
      return { calories: per100g.calories * s, protein: per100g.protein * s, carbs: per100g.carbs * s, fat: per100g.fat * s, fiber: per100g.fiber * s };
    }
    if (inputMode === 'portion') {
      const s = item.quantity > 0 ? amount / item.quantity : 1;
      return { calories: item.macros.calories * s, protein: item.macros.protein * s, carbs: item.macros.carbs * s, fat: item.macros.fat * s, fiber: (item.macros.fiber ?? 0) * s };
    }
    return null;
  }, [amount, inputMode, per100g, item]);

  const adjustAmount = (delta: number) => {
    setAmount((prev) => {
      const next = Math.max(0.5, +(prev + delta).toFixed(1));
      setAmountText(formatAmount(next, inputMode === 'portion'));
      return next;
    });
  };

  const handleToggleMode = (mode: 'grams' | 'portion') => {
    if (mode === inputMode) return;
    setInputMode(mode);
    if (mode === 'portion') {
      if (isPortion) { setAmount(item.quantity); setAmountText(formatAmount(item.quantity, true)); }
      else if (portionWeightGrams && amount > 0) { const p = Math.max(0.5, Math.round((amount / portionWeightGrams) * 2) / 2); setAmount(p); setAmountText(formatAmount(p, true)); }
      else { setAmount(1); setAmountText('1'); }
    } else {
      if (portionWeightGrams) { const g = Math.round(amount * portionWeightGrams); setAmount(g); setAmountText(String(g)); }
      else { setAmount(item.quantity); setAmountText(String(Math.round(item.quantity))); }
    }
  };

  const handleSave = async () => {
    const parsed = parseFloat(amountText.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    Keyboard.dismiss();
    setSaving(true);
    try {
      const result = await diaryApi.updateItem(mealId, item.id, {
        inputMode,
        ...(inputMode === 'portion' ? { portionCount: parsed } : { amountGrams: parsed }),
      });
      onSaved(result.meal);
    } catch { /* caller handles errors */ }
    finally { setSaving(false); }
  };

  const isValid = (() => { const p = parseFloat(amountText.replace(',', '.')); return Number.isFinite(p) && p > 0; })();
  const amountLabel = inputMode === 'grams' ? 'g' : 'Port.';

  const moreActions = [
    ...(onMoveRequest ? [{ label: 'Verschieben…', onPress: () => { setMoreActionsVisible(false); onClose(); onMoveRequest(item); } }] : []),
    ...(onCopyRequest ? [{ label: 'Auf anderen Tag kopieren…', onPress: () => { setMoreActionsVisible(false); onClose(); onCopyRequest(item); } }] : []),
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'position' : 'height'} style={styles.avoidingView}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View style={styles.handle} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Header */}
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.contextLabel}>in {mealName} · {dateLabel}</Text>
              </View>
              {moreActions.length > 0 && (
                <TouchableOpacity style={styles.moreBtn} onPress={() => setMoreActionsVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.moreBtnText}>···</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Mode toggle */}
            {canTogglePortion && (
              <View style={styles.segmentedControl}>
                {(['grams', 'portion'] as const).map((m) => (
                  <TouchableOpacity key={m} style={[styles.segment, inputMode === m && styles.segmentActive]} onPress={() => handleToggleMode(m)}>
                    <Text style={[styles.segmentText, inputMode === m && styles.segmentTextActive]}>{m === 'grams' ? 'Gramm' : 'Portionen'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Portion hint */}
            {inputMode === 'portion' && portionWeightGrams && (
              <Text style={styles.portionHint}>
                1 Portion = {portionWeightGrams} g{sourceProduct?.portion?.label ? ` (${sourceProduct.portion.label})` : ''}
              </Text>
            )}

            {/* Stepper */}
            <View style={styles.stepperRow}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => adjustAmount(-getStep(amount, inputMode === 'portion'))} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={styles.stepBtnText}>−</Text>
              </TouchableOpacity>
              {isTyping ? (
                <TextInput style={styles.amountInput} value={amountText} onChangeText={(t) => { setAmountText(t); const p = parseFloat(t.replace(',', '.')); if (Number.isFinite(p) && p > 0) setAmount(p); }} onBlur={() => { setIsTyping(false); const p = parseFloat(amountText.replace(',', '.')); if (!Number.isFinite(p) || p <= 0) setAmountText(formatAmount(amount, inputMode === 'portion')); }} keyboardType="decimal-pad" selectTextOnFocus autoFocus />
              ) : (
                <TouchableOpacity onPress={() => setIsTyping(true)} style={styles.amountDisplay}>
                  <Text style={styles.amountValue}>{amountText}</Text>
                  <Text style={styles.amountUnit}>{amountLabel}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.stepBtn} onPress={() => adjustAmount(getStep(amount, inputMode === 'portion'))} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={styles.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.stepHint}>Schritt: ±{getStep(amount, inputMode === 'portion')}{inputMode === 'portion' ? ' Port.' : ' g'}</Text>

            {/* Preview */}
            {preview && (
              <View style={styles.preview}>
                <Text style={styles.previewTitle}>
                  Nährwerte für {inputMode === 'grams' ? `${Math.round(amount)} g` : `${formatAmount(amount, true)} Portion${amount !== 1 ? 'en' : ''}`}
                </Text>
                <MacroPreviewRow label="Kalorien" value={preview.calories} unit="kcal" />
                <MacroPreviewRow label="Eiweiß" value={preview.protein} unit="g" barPct={proteinTarget ? preview.protein / proteinTarget : undefined} />
                <MacroPreviewRow label="Kohlenhydrate" value={preview.carbs} unit="g" />
                <MacroPreviewRow label="Fett" value={preview.fat} unit="g" />
                {preview.fiber > 0.1 && <MacroPreviewRow label="Ballaststoffe" value={preview.fiber} unit="g" />}
              </View>
            )}
          </ScrollView>

          {/* Action bar */}
          <View style={styles.actionBar}>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => setDeleteConfirmVisible(true)}>
              <Text style={styles.deleteBtnText}>Löschen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, (!isValid || saving) && styles.saveBtnDisabled]} onPress={handleSave} disabled={!isValid || saving}>
              {saving ? <ActivityIndicator size="small" color={colors.background} /> : <Text style={styles.saveBtnText}>Speichern</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <ConfirmSheet visible={deleteConfirmVisible} title={`„${item.name}" löschen?`} actions={[{ label: 'Eintrag löschen', destructive: true, onPress: () => { setDeleteConfirmVisible(false); onClose(); onDeleted(mealId, item.id, item.name); } }]} onClose={() => setDeleteConfirmVisible(false)} />
      {moreActions.length > 0 && <ConfirmSheet visible={moreActionsVisible} title={item.name} actions={moreActions} onClose={() => setMoreActionsVisible(false)} />}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  avoidingView: { justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: spacing.md, paddingTop: spacing.sm, maxHeight: '90%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md },
  scrollContent: { paddingBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  itemName: { ...typography.h3, color: colors.text },
  contextLabel: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  moreBtn: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', marginLeft: spacing.sm },
  moreBtnText: { fontSize: 18, color: colors.textSecondary, letterSpacing: 2, lineHeight: 22 },
  segmentedControl: { flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 3, marginBottom: spacing.sm },
  segment: { flex: 1, paddingVertical: spacing.xs + 2, alignItems: 'center', borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { ...typography.body2, color: colors.textSecondary },
  segmentTextActive: { color: colors.text, fontWeight: '600' as const },
  portionHint: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.sm },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, marginVertical: spacing.md },
  stepBtn: { width: 52, height: 52, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  stepBtnText: { fontSize: 28, color: colors.text, fontWeight: '300' as const, lineHeight: 32 },
  amountDisplay: { alignItems: 'center', minWidth: 100 },
  amountValue: { ...typography.display, color: colors.text },
  amountUnit: { ...typography.caption, color: colors.textMuted, marginTop: -4 },
  amountInput: { ...typography.display, color: colors.text, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, textAlign: 'center', minWidth: 120 },
  stepHint: { ...typography.caption, color: colors.textDisabled, textAlign: 'center', marginBottom: spacing.md },
  preview: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  previewTitle: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm, textTransform: 'uppercase' as const, letterSpacing: 0.8 },
  actionBar: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  deleteBtn: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.negative },
  deleteBtnText: { ...typography.button, color: colors.negative },
  saveBtn: { flex: 2, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { ...typography.button, color: colors.white },
});
