// NewMeasurementCard — Premium input card for logging a new weight entry.
//
// Replaces the old "Log entry" form with a purposeful, dashboard-style UI
// that feels like the primary action of the screen, not a form field.

import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { WeightUnit } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';

export interface NewMeasurementCardProps {
  unit: WeightUnit;
  onUnitChange: (u: WeightUnit) => void;
  input: string;
  onInputChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
}

const UNITS: WeightUnit[] = ['kg', 'lbs'];

export function NewMeasurementCard({
  unit,
  onUnitChange,
  input,
  onInputChange,
  onSave,
  saving,
}: NewMeasurementCardProps) {
  const canSave = input.trim().length > 0 && !saving;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Neue Messung</Text>
      <Text style={styles.subtitle}>Wie viel wiegst du heute?</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={onInputChange}
          placeholder="78.5"
          placeholderTextColor={colors.textDisabled}
          keyboardType="decimal-pad"
          editable={!saving}
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={canSave ? onSave : undefined}
          accessibilityLabel="Gewicht eingeben"
        />
        <View style={styles.unitSegment}>
          {UNITS.map((u) => {
            const active = u === unit;
            return (
              <TouchableOpacity
                key={u}
                onPress={() => onUnitChange(u)}
                style={[styles.unitOption, active && styles.unitOptionActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.unitLabel, active && styles.unitLabelActive]}>
                  {u}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
        onPress={onSave}
        disabled={!canSave}
        accessibilityRole="button"
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <Text style={styles.saveLabel}>Messung speichern</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body2,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  input: {
    flex: 1,
    ...typography.h2,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  unitSegment: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: 3,
  },
  unitOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  unitOptionActive: {
    backgroundColor: colors.primary,
  },
  unitLabel: {
    ...typography.button,
    color: colors.textSecondary,
  },
  unitLabelActive: {
    color: colors.white,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  saveButtonDisabled: {
    backgroundColor: colors.surfaceMuted,
  },
  saveLabel: {
    ...typography.button,
    color: colors.white,
    fontSize: 16,
  },
});
