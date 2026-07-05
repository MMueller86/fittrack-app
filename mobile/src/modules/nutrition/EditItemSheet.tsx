// EditItemSheet — redesigned bottom sheet for editing a diary item.
// Features: adaptive stepper, live macro preview, More Actions (⋯), inline delete.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
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
    // Fallback für Gramm-Modus bei portionsbasiertem Eintrag (per100g nicht verfügbar)
    if (inputMode === 'grams' && portionWeightGrams && portionWeightGrams > 0 && item.quantity > 0) {
      const totalGrams = item.quantity * portionWeightGrams;
      const s = amount / totalGrams;
      return { calories: item.macros.calories * s, protein: item.macros.protein * s, carbs: item.macros.carbs * s, fat: item.macros.fat * s, fiber: (item.macros.fiber ?? 0) * s };
    }
    if (inputMode === 'portion') {
      const s = item.quantity > 0 ? amount / item.quantity : 1;
      return { calories: item.macros.calories * s, protein: item.macros.protein * s, carbs: item.macros.carbs * s, fat: item.macros.fat * s, fiber: (item.macros.fiber ?? 0) * s };
    }
    return null;
  }, [amount, inputMode, per100g, portionWeightGrams, item]);

  const adjustAmount = (delta: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAmount((prev) => {
      const next = Math.max(0.5, +(prev + delta).toFixed(1));
      setAmountText(formatAmount(next, inputMode === 'portion'));
      return next;
    });
  };

  const handleToggleMode = (mode: 'grams' | 'portion') => {
    if (mode === inputMode) return;
    void Haptics.selectionAsync();
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
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved(result.meal);
    } catch { /* caller handles errors */ }
    finally { setSaving(false); }
  };

  const isValid = (() => { const p = parseFloat(amountText.replace(',', '.')); return Number.isFinite(p) && p > 0; })();
  const amountLabel = inputMode === 'grams' ? 'g' : 'Port.';

  // Animated swipe-to-close + open animation
  const dragY = useSharedValue(0);
  const slideY = useSharedValue(600);
  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value + slideY.value }],
  }));

  // Animate in when sheet opens; reset drag when reopened
  useEffect(() => {
    if (visible) {
      dragY.value = 0;
      slideY.value = 600;
      slideY.value = withSpring(0, { damping: 22, stiffness: 160 });
    }
  }, [visible]);

  const handleSwipeDismiss = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dragY.value = 0;
    onClose();
  };

  const panGesture = Gesture.Pan()
    .onUpdate((e) => { dragY.value = Math.max(0, e.translationY); })
    .onEnd((e) => {
      if (e.translationY > 80) {
        dragY.value = withTiming(800, { duration: 340 }, () => runOnJS(handleSwipeDismiss)());
      } else {
        dragY.value = withSpring(0, { damping: 18, stiffness: 140 });
      }
    });

  const moreActions = [
    { label: 'Löschen', destructive: true, onPress: () => { setMoreActionsVisible(false); setDeleteConfirmVisible(true); } },
    ...(onMoveRequest ? [{ label: 'Verschieben…', onPress: () => { setMoreActionsVisible(false); onClose(); onMoveRequest(item); } }] : []),
    ...(onCopyRequest ? [{ label: 'Auf anderen Tag kopieren…', onPress: () => { setMoreActionsVisible(false); onClose(); onCopyRequest(item); } }] : []),
  ];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.gestureRoot}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'position' : 'height'} style={styles.avoidingView}>
          <Animated.View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }, sheetAnimStyle]}>
            {/* Handle zone — drag down to dismiss */}
            <GestureDetector gesture={panGesture}>
              <View style={styles.handleArea}>
                <View style={styles.handle} />
              </View>
            </GestureDetector>

            {/* Fixed header — always visible, never scrolls away */}
            <View style={styles.headerRow}>
              <Text style={[styles.itemName, { flex: 1 }]} numberOfLines={1}>{item.name}</Text>
              <TouchableOpacity style={styles.headerActionBtn} onPress={() => setMoreActionsVisible(true)} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
                <Text style={styles.headerActionText}>···</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerActionBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
                <Text style={styles.headerActionText}>✕</Text>
              </TouchableOpacity>
            </View>
            {portionWeightGrams && (
              <Text style={styles.portionSubtitle}>
                1 Portion = {portionWeightGrams} g{sourceProduct?.portion?.label ? ` (${sourceProduct.portion.label})` : ''}
              </Text>
            )}

            <View>
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

              {/* Makro-Bar */}
              {preview && (
                <View style={styles.macroBar}>
                  <View style={styles.macroHeroSlot}>
                    <Text style={styles.macroHeroVal}>{Math.round(preview.calories)}</Text>
                    <Text style={styles.macroLabel}>kcal</Text>
                  </View>
                  <View style={styles.macroDivider} />
                  <View style={styles.macroSlot}>
                    <Text style={styles.macroVal}>{Math.round(preview.protein * 10) / 10}g</Text>
                    <Text style={styles.macroLabel}>Eiweiß</Text>
                  </View>
                  <View style={styles.macroDivider} />
                  <View style={styles.macroSlot}>
                    <Text style={styles.macroVal}>{Math.round(preview.carbs * 10) / 10}g</Text>
                    <Text style={styles.macroLabel}>KH</Text>
                  </View>
                  <View style={styles.macroDivider} />
                  <View style={styles.macroSlot}>
                    <Text style={styles.macroVal}>{Math.round(preview.fat * 10) / 10}g</Text>
                    <Text style={styles.macroLabel}>Fett</Text>
                  </View>
                  {preview.fiber > 0.1 && (
                    <>
                      <View style={styles.macroDivider} />
                      <View style={styles.macroSlot}>
                        <Text style={styles.macroVal}>{Math.round(preview.fiber * 10) / 10}g</Text>
                        <Text style={styles.macroLabel}>Bst.</Text>
                      </View>
                    </>
                  )}
                </View>
              )}
            </View>

            {/* Action bar */}
            <View style={styles.actionBar}>
              <TouchableOpacity style={[styles.saveBtn, (!isValid || saving) && styles.saveBtnDisabled]} onPress={handleSave} disabled={!isValid || saving}>
                {saving ? <ActivityIndicator size="small" color={colors.background} /> : <Text style={styles.saveBtnText}>Speichern</Text>}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>

      <ConfirmSheet visible={deleteConfirmVisible} title={`„${item.name}" löschen?`} actions={[{ label: 'Eintrag löschen', destructive: true, onPress: () => { setDeleteConfirmVisible(false); onClose(); onDeleted(mealId, item.id, item.name); } }]} onClose={() => setDeleteConfirmVisible(false)} />
      <ConfirmSheet visible={moreActionsVisible} title={item.name} actions={moreActions} onClose={() => setMoreActionsVisible(false)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  gestureRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  avoidingView: { justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderWidth: 1, borderColor: colors.border, borderBottomWidth: 0, paddingHorizontal: spacing.md, paddingTop: 0 },
  handleArea: { alignItems: 'center', paddingTop: 5, paddingBottom: 4, marginBottom: 0 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
  // Header zone
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 1, paddingHorizontal: 0 },
  itemName: { ...typography.h3, color: colors.text },
  headerActionBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  headerActionText: { fontSize: 16, color: colors.textMuted },
  portionSubtitle: { ...typography.caption, color: colors.textMuted, marginBottom: 8 },
  // Toggle
  segmentedControl: { flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 3, marginBottom: 4 },
  segment: { flex: 1, paddingVertical: spacing.xs + 1, alignItems: 'center', borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { ...typography.body2, color: colors.textSecondary },
  segmentTextActive: { color: colors.white, fontWeight: '600' as const },
  // Stepper
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, marginTop: 0, marginBottom: 4 },
  stepBtn: { width: 44, height: 44, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  stepBtnText: { fontSize: 22, color: colors.text, fontWeight: '400' as const, lineHeight: 26 },
  amountDisplay: { alignItems: 'center', minWidth: 90 },
  amountValue: { fontSize: 36, fontWeight: '700' as const, color: colors.text, letterSpacing: -0.5, fontVariant: ['tabular-nums'] as const },
  amountUnit: { ...typography.caption, color: colors.textMuted, marginTop: -2 },
  amountInput: { fontSize: 36, fontWeight: '700' as const, color: colors.text, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, textAlign: 'center', minWidth: 110 },
  // Makro-Bar
  macroBar: { flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: radius.md, overflow: 'hidden', marginBottom: 4 },
  macroHeroSlot: { flex: 1.3, alignItems: 'center', paddingVertical: 8 },
  macroSlot: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  macroHeroVal: { fontSize: 20, fontWeight: '700' as const, color: colors.primary, fontVariant: ['tabular-nums'] as const },
  macroVal: { fontSize: 14, fontWeight: '600' as const, color: colors.text, fontVariant: ['tabular-nums'] as const },
  macroLabel: { ...typography.caption, color: colors.textMuted, marginTop: 1 },
  macroDivider: { width: 1, backgroundColor: colors.border, marginVertical: 8 },
  // Action bar
  actionBar: { flexDirection: 'row', paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.border },
  saveBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { ...typography.button, color: colors.white },
});
