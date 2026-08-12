import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { colors, radius, spacing, typography } from '../../app/theme';
import { CHECKMARK_OUTLINE_ICON, Icon } from '../../shared/components/Icon';
import { DiaryItemRow } from '../../shared/components/DiaryItemRow';
import { SwipeableRow } from '../../shared/components/SwipeableRow';
import type { AmountEdit, WizardIngredient } from './recipeWizardTypes';

interface Props {
  ingredients: WizardIngredient[];
  seasoningIngredients: WizardIngredient[];
  mainIngredients: WizardIngredient[];
  orderedMainIngredients: WizardIngredient[];
  amountEdits: Record<string, AmountEdit>;
  confirmedMainIngredientCount: number;
  allMainIngredientsConfirmed: boolean;
  reviewProgressPercent: number;
  seasoningsExpanded: boolean;
  onToggleSeasonings: () => void;
  onReviewHelp: () => void;
  onRemoveIngredient: (ingredientId: string) => void;
  onConfirmIngredient: (ingredientId: string) => void;
  onOpenIngredient: (ingredient: WizardIngredient) => void;
  onAddIngredient: () => void;
}

interface SeasoningTagProps {
  ingredient: WizardIngredient;
  onRemove: (ingredientId: string) => void;
}

function SeasoningTag({ ingredient, onRemove }: SeasoningTagProps) {
  const kitchenText = ingredient.resolvedIngredient?.amountLabel?.trim() ?? '';

  return (
    <View style={styles.seasoningTag}>
      <View style={styles.seasoningTagCopy}>
        {kitchenText.length > 0 && (
          <Text style={styles.seasoningAmount} numberOfLines={2}>
            {kitchenText}
          </Text>
        )}
        <Text style={styles.seasoningName} numberOfLines={2}>
          {ingredient.parserItem.displayName}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.seasoningTagRemoveButton}
        onPress={() => onRemove(ingredient.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={`${ingredient.parserItem.displayName} entfernen`}
      >
        <Icon lib="ion" name="close" size="sm" color={colors.negative} />
      </TouchableOpacity>
    </View>
  );
}

export function RecipeWizardIngredientsPhase({
  ingredients,
  seasoningIngredients,
  mainIngredients,
  orderedMainIngredients,
  amountEdits,
  confirmedMainIngredientCount,
  allMainIngredientsConfirmed,
  reviewProgressPercent,
  seasoningsExpanded,
  onToggleSeasonings,
  onReviewHelp,
  onRemoveIngredient,
  onConfirmIngredient,
  onOpenIngredient,
  onAddIngredient,
}: Props) {
  const renderMainIngredientRow = (ingredient: WizardIngredient) => {
    if (ingredient.status === 'confirmed' || ingredient.status === 'auto-matched') {
      const resolvedIngredient = ingredient.resolvedIngredient!;
      const edit = amountEdits[ingredient.id];
      const originalName = ingredient.parserItem.displayName.trim();
      const assignedName = resolvedIngredient.displayName.trim();
      const amountLabel = edit?.mode === 'portion'
        ? `${edit.value} Portion${parseFloat(edit.value) !== 1 ? 'en' : ''}`
        : `${Math.round(parseFloat(edit?.value ?? '0'))} g`;

      return (
        <DiaryItemRow
          key={ingredient.id}
          name={ingredient.parserItem.displayName}
          amountLabel={amountLabel}
          secondaryLabel={
            originalName.toLocaleLowerCase() !== assignedName.toLocaleLowerCase()
              ? resolvedIngredient.displayName
              : undefined
          }
          statusTone={ingredient.userConfirmed ? 'success' : 'attention'}
          kcal={resolvedIngredient.nutritionContribution.calories}
          protein={resolvedIngredient.nutritionContribution.protein}
          aiBadgeLabel={resolvedIngredient.isAiEstimate ? '✦ KI-Schätzung' : undefined}
          onConfirm={!ingredient.userConfirmed ? () => onConfirmIngredient(ingredient.id) : undefined}
          confirmAccessibilityLabel={`Zuordnung für ${ingredient.parserItem.displayName} bestätigen`}
          variant="recipeIngredient"
          onPress={() => onOpenIngredient(ingredient)}
        />
      );
    }

    return (
      <DiaryItemRow
        key={ingredient.id}
        name={ingredient.parserItem.displayName}
        amountLabel={ingredient.parserItem.kitchenAmountText ?? ''}
        statusLabel="Tippe, um ein Lebensmittel zuzuordnen"
        statusTone="neutral"
        variant="recipeIngredient"
        onPress={() => onOpenIngredient(ingredient)}
      />
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.overview}>
          <View style={styles.summaryLine}>
            <View style={styles.summaryIcon}>
              <Icon lib="ion" name="list-outline" size="sm" color={colors.textMuted} />
            </View>
            <View style={styles.summaryTextWrap}>
              <Text style={styles.intro}>
                <Text style={styles.summaryNumber}>{ingredients.length}</Text>{' '}
                {ingredients.length === 1 ? 'Zutat' : 'Zutaten'} erkannt
              </Text>
            </View>
          </View>
        </View>

        {seasoningIngredients.length > 0 && (
          <View style={styles.seasoningSection}>
            <TouchableOpacity
              style={styles.seasoningHeader}
              onPress={onToggleSeasonings}
              activeOpacity={0.7}
            >
              <View style={styles.seasoningHeaderCopy}>
                <View style={styles.seasoningTitleRow}>
                  <Icon lib="ion" name={CHECKMARK_OUTLINE_ICON} size="sm" color={colors.primary} />
                  <Text style={styles.seasoningHeaderTitle}>Gewürze automatisch übernommen</Text>
                  <View style={styles.groupCount}>
                    <Text style={styles.groupCountText}>{seasoningIngredients.length}</Text>
                  </View>
                </View>
              </View>
              <Icon
                lib="ion"
                name={seasoningsExpanded ? 'chevron-up' : 'chevron-down'}
                size="sm"
                color={colors.textMuted}
              />
            </TouchableOpacity>
            {seasoningsExpanded && (
              <View style={styles.seasoningTags}>
                {seasoningIngredients.map((ingredient) => (
                  <SeasoningTag
                    key={ingredient.id}
                    ingredient={ingredient}
                    onRemove={onRemoveIngredient}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {ingredients.length === 0 && (
          <Text style={styles.emptyHint}>
            Keine Zutaten erkannt. Füge sie manuell hinzu.
          </Text>
        )}

        {mainIngredients.length > 0 && (
          <View style={styles.mainIngredientsSection}>
            <View style={styles.mainIngredientsHeader}>
              <View style={styles.mainIngredientsTitleRow}>
                <Text style={styles.mainIngredientsTitle}>Hauptzutaten</Text>
                <TouchableOpacity
                  style={styles.reviewProgressHelpButton}
                  onPress={allMainIngredientsConfirmed ? undefined : onReviewHelp}
                  disabled={allMainIngredientsConfirmed}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Fortschritt: ${confirmedMainIngredientCount} von ${mainIngredients.length} Hauptzutaten bestätigt`}
                  accessibilityState={{ disabled: allMainIngredientsConfirmed }}
                >
                  <Text
                    style={[
                      styles.reviewProgressLabel,
                      allMainIngredientsConfirmed && styles.reviewProgressLabelComplete,
                    ]}
                  >
                    {confirmedMainIngredientCount}/{mainIngredients.length} bestätigt
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.reviewProgressRow}>
                <View style={styles.reviewProgressTrack}>
                  <View style={[styles.reviewProgressFill, { width: `${reviewProgressPercent}%` }]} />
                </View>
              </View>
            </View>
            <ScrollView
              style={styles.mainIngredientsList}
              contentContainerStyle={styles.mainIngredientsListContent}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {orderedMainIngredients.map((ingredient) => (
                <Animated.View
                  key={ingredient.id}
                  layout={LinearTransition.duration(300)}
                >
                  <SwipeableRow onDelete={() => onRemoveIngredient(ingredient.id)}>
                    {renderMainIngredientRow(ingredient)}
                  </SwipeableRow>
                </Animated.View>
              ))}
            </ScrollView>
          </View>
        )}

        <TouchableOpacity style={styles.addButton} onPress={onAddIngredient}>
          <Icon lib="ion" name="add" size="sm" color={colors.textSecondary} />
          <Text style={styles.addButtonText}>Zutat hinzufügen</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  content: {
    flex: 1,
    paddingTop: spacing.md,
  },
  overview: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  intro: {
    ...typography.body1,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  summaryLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryIcon: {
    width: spacing.lg,
    alignItems: 'center',
  },
  summaryTextWrap: {
    flex: 1,
  },
  summaryNumber: {
    color: colors.text,
    fontWeight: '700',
  },
  seasoningSection: {
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  seasoningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    marginBottom: spacing.sm,
  },
  seasoningHeaderCopy: {
    flex: 1,
    marginRight: spacing.sm,
  },
  seasoningTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  seasoningHeaderTitle: {
    ...typography.body2,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
  },
  groupCount: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  groupCountText: {
    ...typography.caption,
    color: colors.primaryBright,
    fontWeight: '700',
  },
  seasoningTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
  },
  seasoningTag: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: spacing.xxl + spacing.md,
    maxWidth: '100%',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    borderRadius: radius.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  seasoningTagCopy: {
    flexShrink: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingRight: spacing.lg,
  },
  seasoningName: {
    ...typography.body2,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  seasoningAmount: {
    ...typography.caption,
    color: colors.primaryBright,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  seasoningTagRemoveButton: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    minWidth: spacing.xl,
    minHeight: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
  },
  emptyHint: {
    ...typography.body2,
    color: colors.textMuted,
    marginBottom: spacing.md,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  mainIngredientsSection: {
    flex: 1,
    minHeight: 0,
    marginBottom: 0,
  },
  mainIngredientsHeader: {
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
    paddingBottom: spacing.sm,
  },
  mainIngredientsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  mainIngredientsTitle: {
    ...typography.body1,
    color: colors.text,
    fontWeight: '700',
    flex: 1,
  },
  reviewProgressHelpButton: {
    alignItems: 'flex-end',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  reviewProgressLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    flexShrink: 0,
  },
  reviewProgressLabelComplete: {
    color: colors.primary,
    fontWeight: '700',
  },
  reviewProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  reviewProgressTrack: {
    flex: 1,
    height: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  reviewProgressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.full,
  },
  mainIngredientsList: {
    flex: 1,
    minHeight: 0,
  },
  mainIngredientsListContent: {
    paddingBottom: spacing.sm,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginTop: 0,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  addButtonText: {
    ...typography.body2,
    color: colors.textMuted,
  },
});