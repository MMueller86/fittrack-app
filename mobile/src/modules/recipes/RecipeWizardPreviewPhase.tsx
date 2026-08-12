import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { RecipeNutrition } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import type { RecipePreviewViewModel } from './recipePreviewViewModel';
import type { PendingWizardImage, WizardStepItem } from './recipeWizardTypes';
import { RecipeIngredientGroup } from './RecipeIngredientGroup';

interface Props {
  recipeName: string;
  recipeDescription: string;
  tags: string[];
  portions: number;
  pendingImages: PendingWizardImage[];
  steps: WizardStepItem[];
  liveNutrition: { nutritionPerPortion: RecipeNutrition } | null;
  previewViewModel: RecipePreviewViewModel;
  saving: boolean;
  onRecipeNameChange: (value: string) => void;
  onPortionsChange: (value: number) => void;
  onPickImage: () => void;
  onRemoveImage: (index: number) => void;
  onSave: () => void;
}

export function RecipeWizardPreviewPhase({
  recipeName,
  recipeDescription,
  tags,
  portions,
  pendingImages,
  steps,
  liveNutrition,
  previewViewModel,
  saving,
  onRecipeNameChange,
  onPortionsChange,
  onPickImage,
  onRemoveImage,
  onSave,
}: Props) {
  const [seasoningsExpanded, setSeasoningsExpanded] = useState(false);
  const visibleSteps = steps.filter((step) => step.description.trim().length > 0);
  const visibleIngredientGroups = previewViewModel.groups.filter((group) => group.ingredients.length > 0);
  const foodGroups = visibleIngredientGroups.filter((group) => group.category !== 'seasoning');
  const seasoningGroup = visibleIngredientGroups.find((group) => group.category === 'seasoning');

  return (
    <View>
      <TextInput
        style={styles.nameInput}
        value={recipeName}
        onChangeText={onRecipeNameChange}
        placeholder="Rezeptname"
        placeholderTextColor={colors.textMuted}
        multiline
        numberOfLines={2}
        scrollEnabled={false}
        textAlignVertical="top"
      />

      {tags.length > 0 && (
        <View style={styles.tagsRow}>
          {tags.map((tag) => (
            <View key={tag} style={styles.tagChip}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {recipeDescription.length > 0 && (
        <Text style={styles.description}>{recipeDescription}</Text>
      )}

      <View style={styles.portionsRow}>
        <Text style={styles.portionsLabel}>Portionen</Text>
        <View style={styles.stepper}>
          <TouchableOpacity
            style={styles.stepperButton}
            onPress={() => onPortionsChange(Math.max(1, portions - 1))}
            accessibilityRole="button"
            accessibilityLabel="Portionen verringern"
          >
            <Text style={styles.stepperButtonText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.stepperValue}>{portions}</Text>
          <TouchableOpacity
            style={styles.stepperButton}
            onPress={() => onPortionsChange(portions + 1)}
            accessibilityRole="button"
            accessibilityLabel="Portionen erhöhen"
          >
            <Text style={styles.stepperButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {liveNutrition && (
        <>
          <Text style={styles.sectionLabel}>Nährwerte pro Portion</Text>
          <View style={styles.macroRow}>
          {[
            {
              label: 'Kalorien',
              value: `${Math.round(liveNutrition.nutritionPerPortion.calories)}`,
              unit: 'kcal',
            },
            {
              label: 'Protein',
              value: `${Math.round(liveNutrition.nutritionPerPortion.protein)}`,
              unit: 'g',
            },
            {
              label: 'Kohlenhydr.',
              value: `${Math.round(liveNutrition.nutritionPerPortion.carbs)}`,
              unit: 'g',
            },
            {
              label: 'Fett',
              value: `${Math.round(liveNutrition.nutritionPerPortion.fat)}`,
              unit: 'g',
            },
          ].map((macro) => (
            <View key={macro.label} style={styles.macroChip}>
              <Text style={styles.macroValue}>
                {macro.value}
                <Text style={styles.macroUnit}> {macro.unit}</Text>
              </Text>
              <Text style={styles.macroLabel}>{macro.label}</Text>
            </View>
          ))}
          </View>
        </>
      )}

      <Text style={styles.sectionLabel}>Fotos ({pendingImages.length})</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageStrip}>
        {pendingImages.map((image, index) => (
          <View key={image.uri} style={styles.imageThumbnailContainer}>
            <Image source={{ uri: image.uri }} style={styles.imageThumbnail} resizeMode="cover" />
            <TouchableOpacity
              style={styles.imageThumbnailRemove}
              onPress={() => onRemoveImage(index)}
              accessibilityRole="button"
              accessibilityLabel={`Foto ${index + 1} entfernen`}
            >
              <Text style={styles.imageThumbnailRemoveText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.imagePickerThumb} onPress={onPickImage}>
          <Text style={styles.imagePickerText}>+ Foto</Text>
        </TouchableOpacity>
      </ScrollView>

      {visibleIngredientGroups.length > 0 && (
        <>
          <Text style={styles.contentSectionLabel}>Zutaten</Text>
          {foodGroups.map((group) => (
            <RecipeIngredientGroup key={group.category} group={group} />
          ))}
          {seasoningGroup && (
            <RecipeIngredientGroup
              group={seasoningGroup}
              collapsible
              expanded={seasoningsExpanded}
              onToggle={() => setSeasoningsExpanded((expanded) => !expanded)}
            />
          )}
        </>
      )}

      {visibleSteps.length > 0 && (
        <>
          <Text style={styles.contentSectionLabel}>Zubereitung</Text>
          {visibleSteps.map((step, index) => (
            <View key={step.id} style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{index + 1}</Text>
              </View>
              <View style={styles.stepContent}>
                {step.title.trim().length > 0 && (
                  <Text style={styles.stepTitle}>{step.title}</Text>
                )}
                <Text style={styles.stepDescription}>{step.description}</Text>
              </View>
            </View>
          ))}
        </>
      )}

      <TouchableOpacity
        style={[styles.primaryButton, (saving || !recipeName.trim()) && styles.primaryButtonDisabled]}
        onPress={onSave}
        disabled={saving || !recipeName.trim()}
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.primaryButtonText}>Rezept speichern</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  nameInput: {
    ...typography.h2,
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: spacing.xxl,
    paddingTop: 0,
    paddingBottom: spacing.sm,
    marginBottom: spacing.md,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  tagChip: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tagText: {
    ...typography.caption,
    color: colors.primaryBright,
    fontWeight: '600',
  },
  description: {
    ...typography.body2,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  portionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  portionsLabel: {
    ...typography.body1,
    color: colors.text,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepperButton: {
    width: spacing.xl,
    height: spacing.xl,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: {
    ...typography.h3,
    color: colors.text,
    lineHeight: 30,
  },
  stepperValue: {
    ...typography.h3,
    color: colors.text,
    minWidth: spacing.lg,
    textAlign: 'center',
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  macroChip: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  macroValue: {
    ...typography.body1,
    color: colors.text,
    fontWeight: '700',
  },
  macroUnit: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '400',
  },
  macroLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  sectionLabel: {
    ...typography.overline,
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  contentSectionLabel: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  imageStrip: {
    marginBottom: spacing.sm,
  },
  imageThumbnailContainer: {
    position: 'relative',
    marginRight: spacing.sm,
  },
  imageThumbnail: {
    width: 100,
    height: 100,
    borderRadius: radius.md,
  },
  imageThumbnailRemove: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: radius.full,
    width: spacing.md,
    height: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageThumbnailRemoveText: {
    ...typography.caption,
    color: colors.white,
    lineHeight: 14,
  },
  imagePickerThumb: {
    width: 100,
    height: 100,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePickerText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stepBadge: {
    width: spacing.lg,
    height: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepBadgeText: {
    ...typography.body2,
    color: colors.primaryBright,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  stepTitle: {
    ...typography.body1,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  stepDescription: {
    ...typography.body2,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  primaryButtonDisabled: {
    backgroundColor: colors.border,
  },
  primaryButtonText: {
    ...typography.button,
    color: colors.white,
  },
});