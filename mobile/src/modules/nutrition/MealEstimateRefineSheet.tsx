import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated as NativeAnimated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AiMealEstimateRefine, AiMealEstimateRefineHint } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { ErrorBanner } from '../../shared/components/ErrorBanner';
import { Icon } from '../../shared/components/Icon';
import { useKeyboardOverlap } from '../../shared/keyboard/useKeyboardOverlap';

type RefineOptions = Omit<AiMealEstimateRefine, 'previous'>;

interface Props {
  visible: boolean;
  loading: boolean;
  quotaExceeded: boolean;
  error: string | null;
  attemptsUsed: number;
  onClose: () => void;
  onSubmit: (refine: RefineOptions) => Promise<boolean>;
}

const MAX_ATTEMPTS = 3;
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F]/g;

export function sanitizeRefineNote(value: string): string {
  return value.replace(CONTROL_CHARACTERS, '').slice(0, 200);
}

export default function MealEstimateRefineSheet({
  visible,
  loading,
  quotaExceeded,
  error,
  attemptsUsed,
  onClose,
  onSubmit,
}: Props) {
  const insets = useSafeAreaInsets();
  const { ref: keyboardRef, overlap: keyboardInset } = useKeyboardOverlap();
  const [selectedHint, setSelectedHint] = useState<AiMealEstimateRefineHint | null>(null);
  const [note, setNote] = useState('');
  const translateY = useSharedValue(600);
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const trimmedNote = note.trim();
  const noteIsValid = trimmedNote.length === 0 || trimmedNote.length >= 3;
  const hasInput = selectedHint !== null || trimmedNote.length >= 3;
  const limitReached = attemptsUsed >= MAX_ATTEMPTS;
  const canSubmit = visible && hasInput && noteIsValid && !loading && !quotaExceeded && !limitReached;

  useEffect(() => {
    translateY.value = visible ? withTiming(0, { duration: 220 }) : 600;
  }, [translateY, visible]);

  function close() {
    if (loading) return;
    setSelectedHint(null);
    setNote('');
    onClose();
  }

  async function submit() {
    if (!canSubmit) return;
    const refine: RefineOptions = {
      ...(selectedHint === null ? {} : { hints: [selectedHint] }),
      ...(trimmedNote.length < 3 ? {} : { note: trimmedNote }),
    };
    if (await onSubmit(refine)) close();
  }

  if (!visible) return null;

  return (
    <View ref={keyboardRef} style={styles.overlay}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        disabled={loading}
        onPress={close}
        accessibilityLabel="Neu schätzen schließen"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.avoidingView, { paddingBottom: keyboardInset }]}
      >
        <Animated.View style={[styles.sheet, { paddingBottom: keyboardInset > 0 ? spacing.md : Math.max(insets.bottom, spacing.md) }, sheetStyle]}>
          <View style={styles.handleArea}>
            <View style={styles.handle} />
          </View>
          <View style={styles.header}>
            <Text style={styles.title}>Neu schätzen</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={close}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Schließen"
            >
              <Icon lib="feather" name="x" size="md" color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Text style={styles.label}>Portionsgröße</Text>
            <View style={styles.chips}>
              {([
                { value: 'larger', label: 'Portion größer' },
                { value: 'smaller', label: 'Portion kleiner' },
              ] as const).map(({ value, label }) => {
                const selected = selectedHint === value;
                return (
                  <TouchableOpacity
                    key={value}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setSelectedHint(selected ? null : value)}
                    disabled={loading}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityState={{ selected, disabled: loading }}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.noteHeader}>
              <Text style={styles.label}>Was sollen wir korrigieren? (optional)</Text>
              <Text style={styles.counter}>{trimmedNote.length}/200</Text>
            </View>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={(value) => setNote(sanitizeRefineNote(value))}
              placeholder="z. B. Das waren zwei Scheiben Brot ohne Butter"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={200}
              editable={!loading}
              accessibilityLabel="Korrektur"
            />
            {error ? <ErrorBanner error={error} /> : null}
            {limitReached ? <Text style={styles.notice}>Maximal 3 Neu-Schätzungen pro Ergebnis.</Text> : null}
            <TouchableOpacity
              style={[styles.submitButton, !canSubmit && styles.disabledButton]}
              onPress={() => void submit()}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityLabel="Neu schätzen bestätigen"
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.submitButtonText}>Neu schätzen</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end', zIndex: 10 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  avoidingView: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomWidth: 0,
    paddingHorizontal: spacing.md,
  },
  handleArea: { alignItems: 'center', paddingTop: spacing.sm, paddingBottom: spacing.xs },
  handle: { width: 40, height: 4, borderRadius: radius.sm, backgroundColor: colors.border },
  header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.h3, color: colors.text },
  closeButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  content: { gap: spacing.md, paddingBottom: spacing.md },
  label: { ...typography.body2, color: colors.textSecondary },
  chips: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },
  chipSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { ...typography.button, color: colors.textSecondary, textAlign: 'center' },
  chipTextSelected: { color: colors.primaryBright },
  noteHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  counter: { ...typography.caption, color: colors.textMuted },
  noteInput: {
    minHeight: 88,
    maxHeight: 160,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    color: colors.text,
    ...typography.body2,
    textAlignVertical: 'top',
  },
  notice: { ...typography.caption, color: colors.textMuted },
  submitButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  submitButtonText: { ...typography.button, color: colors.background },
  disabledButton: { opacity: 0.5 },
});