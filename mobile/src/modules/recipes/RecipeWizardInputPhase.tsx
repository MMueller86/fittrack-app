import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../app/theme';

interface Props {
  inputText: string;
  hasMeaningfulRecipeText: boolean;
  onChangeText: (value: string) => void;
  onAnalyze: () => void;
}

export function RecipeWizardInputPhase({
  inputText,
  hasMeaningfulRecipeText,
  onChangeText,
  onAnalyze,
}: Props) {
  return (
    <>
      <View style={styles.content}>
        <Text style={styles.intro}>
          Zutaten, Mengen und Zubereitung als Stichpunkte reichen. Die KI erstellt daraus ein strukturiertes Rezept.
        </Text>
        <TextInput
          style={styles.textArea}
          placeholder={
            'z. B.\n\nSpaghetti Bolognese (4 Portionen)\n\n500 g Hackfleisch\n2 Dosen gehackte Tomaten\n1 Zwiebel\n2 Knoblauchzehen\n2 EL Tomatenmark\n1 EL Olivenöl\nSalz, Pfeffer, Oregano\n\nZwiebel und Knoblauch anbraten. Hackfleisch dazugeben und krümelig braten. Tomatenmark kurz mitrösten. Gehackte Tomaten hinzufügen und ca. 30 Minuten köcheln lassen. Mit Salz, Pfeffer und Oregano abschmecken.'
          }
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primaryBright}
          value={inputText}
          onChangeText={onChangeText}
          multiline
          scrollEnabled
          textAlignVertical="top"
        />
      </View>
      <View style={styles.stickyFooter}>
        <TouchableOpacity
          style={[styles.primaryButton, !hasMeaningfulRecipeText && styles.primaryButtonDisabled]}
          onPress={onAnalyze}
          disabled={!hasMeaningfulRecipeText}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>✦ Rezept analysieren</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: spacing.md,
  },
  intro: {
    ...typography.body2,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  textArea: {
    ...typography.body1,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    flex: 1,
    textAlignVertical: 'top',
  },
  stickyFooter: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: colors.border,
  },
  primaryButtonText: {
    ...typography.button,
    color: colors.white,
  },
});