import React, { useEffect, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../../app/theme';
import { MealChip } from '../../shared/components/MealChip';
import type { RecipeInstagramNutritionHighlight } from '../../shared/api/recipeInstagramRenderContract';

export const MAX_RECIPE_INSTAGRAM_TAGS = 4;

export interface RecipeInstagramOptions {
  selectedTags: string[];
  nutritionHighlight: RecipeInstagramNutritionHighlight;
}

export interface RecipeInstagramOptionsSheetProps {
  visible: boolean;
  tags: readonly string[];
  initialSelectedTags?: readonly string[];
  initialNutritionHighlight?: RecipeInstagramNutritionHighlight;
  onClose: () => void;
  onConfirm: (options: RecipeInstagramOptions) => void;
}

function uniqueTagsInServerOrder(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const uniqueTags: string[] = [];

  for (const tag of tags) {
    if (seen.has(tag)) continue;
    seen.add(tag);
    uniqueTags.push(tag);
  }

  return uniqueTags;
}

export function normalizeRecipeInstagramTags(
  tags: readonly string[],
  selectedTags: readonly string[],
): string[] {
  const selected = new Set(selectedTags);
  return uniqueTagsInServerOrder(tags)
    .filter((tag) => selected.has(tag))
    .slice(0, MAX_RECIPE_INSTAGRAM_TAGS);
}

export function getInitialRecipeInstagramTags(tags: readonly string[]): string[] {
  return uniqueTagsInServerOrder(tags).slice(0, MAX_RECIPE_INSTAGRAM_TAGS);
}

export function toggleRecipeInstagramTag(
  tags: readonly string[],
  selectedTags: readonly string[],
  tag: string,
): string[] {
  const normalizedSelectedTags = normalizeRecipeInstagramTags(tags, selectedTags);
  const selected = new Set(normalizedSelectedTags);

  if (selected.has(tag)) {
    selected.delete(tag);
  } else if (selected.size < MAX_RECIPE_INSTAGRAM_TAGS && tags.includes(tag)) {
    selected.add(tag);
  }

  return normalizeRecipeInstagramTags(tags, [...selected]);
}

export function RecipeInstagramOptionsSheet({
  visible,
  tags,
  initialSelectedTags,
  initialNutritionHighlight = null,
  onClose,
  onConfirm,
}: RecipeInstagramOptionsSheetProps) {
  const insets = useSafeAreaInsets();
  const [selectedTags, setSelectedTags] = useState<string[]>(() => (
    initialSelectedTags === undefined
      ? getInitialRecipeInstagramTags(tags)
      : normalizeRecipeInstagramTags(tags, initialSelectedTags)
  ));
  const [nutritionHighlight, setNutritionHighlight] = useState<RecipeInstagramNutritionHighlight>(
    initialNutritionHighlight,
  );

  useEffect(() => {
    if (!visible) return;

    setSelectedTags(
      initialSelectedTags === undefined
        ? getInitialRecipeInstagramTags(tags)
        : normalizeRecipeInstagramTags(tags, initialSelectedTags),
    );
    setNutritionHighlight(initialNutritionHighlight);
  }, [visible]);

  const highProteinEnabled = nutritionHighlight === 'high-protein';

  const handleConfirm = () => {
    onConfirm({
      selectedTags: [...selectedTags],
      nutritionHighlight,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Optionsfenster schließen"
      />

      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>Instagram-Optionen</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Abbrechen"
          >
            <Text style={styles.closeButtonText}>Abbrechen</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionLabel}>Tags</Text>
          {tags.length === 0 ? (
            <Text style={styles.helperText}>Für dieses Rezept sind keine Tags hinterlegt.</Text>
          ) : (
            <>
              <Text style={styles.helperText}>Welche Tags sollen auf dem Bild erscheinen?</Text>
              <View style={styles.tagList}>
                {tags.map((tag, index) => {
                  const isSelected = selectedTags.includes(tag);
                  const isDisabled = !isSelected && selectedTags.length >= MAX_RECIPE_INSTAGRAM_TAGS;

                  return (
                    <MealChip
                      key={`${tag}-${index}`}
                      label={tag}
                      filled={isSelected}
                      compact
                      disabled={isDisabled}
                      onPress={() => setSelectedTags((current) => toggleRecipeInstagramTag(tags, current, tag))}
                      accessibilityRole="checkbox"
                      accessibilityLabel={`Tag ${tag}`}
                      accessibilityState={{ checked: isSelected, disabled: isDisabled }}
                    />
                  );
                })}
              </View>
              <Text style={styles.selectionCount}>{selectedTags.length} von {MAX_RECIPE_INSTAGRAM_TAGS} ausgewählt</Text>
            </>
          )}

          <View style={styles.divider} />
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleLabel}>High-Protein-Symbol anzeigen</Text>
              <Text style={styles.toggleValue}>{highProteinEnabled ? 'High-Protein' : 'Kein Highlight'}</Text>
            </View>
            <Switch
              value={highProteinEnabled}
              onValueChange={(enabled) => setNutritionHighlight(enabled ? 'high-protein' : null)}
              trackColor={{ false: colors.surfaceMuted, true: colors.primaryDark }}
              thumbColor={highProteinEnabled ? colors.primaryBright : colors.textMuted}
              ios_backgroundColor={colors.surfaceMuted}
              accessibilityRole="switch"
              accessibilityLabel="High-Protein-Symbol anzeigen"
              accessibilityState={{ checked: highProteinEnabled }}
            />
          </View>
        </ScrollView>

        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleConfirm}
          activeOpacity={0.8}
          accessibilityRole="button"
            accessibilityLabel="Vorschau anzeigen"
        >
            <Text style={styles.confirmButtonText}>Vorschau anzeigen</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    opacity: 0.75,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '82%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  handle: {
    width: spacing.xl,
    height: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
  },
  closeButton: {
    minHeight: spacing.xl,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  closeButtonText: {
    ...typography.button,
    color: colors.textSecondary,
  },
  scroll: {
    flexShrink: 1,
  },
  content: {
    paddingBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.overline,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  helperText: {
    ...typography.body2,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  selectionCount: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  toggleCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  toggleLabel: {
    ...typography.body1,
    color: colors.text,
    fontWeight: '600',
  },
  toggleValue: {
    ...typography.body2,
    color: colors.textSecondary,
  },
  confirmButton: {
    minHeight: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  confirmButtonText: {
    ...typography.button,
    color: colors.background,
  },
});