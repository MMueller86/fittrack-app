import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { colors, radius, spacing, typography } from '../../app/theme';
import { Icon } from '../../shared/components/Icon';
import type { RecipePreviewIngredientGroup } from './recipePreviewViewModel';

interface Props {
  group: RecipePreviewIngredientGroup;
  collapsible?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}

export function RecipeIngredientGroup({
  group,
  collapsible = false,
  expanded = true,
  onToggle,
}: Props) {
  const headerContent = (
    <View style={styles.groupHeaderContent}>
      <Text style={styles.groupLabel}>
        {group.title} ({group.ingredients.length})
      </Text>
      {collapsible && (
        <Icon
          lib="ion"
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size="md"
          color={colors.textMuted}
        />
      )}
    </View>
  );

  return (
    <View>
      {collapsible ? (
        <TouchableOpacity
          style={styles.groupHeader}
          onPress={onToggle}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${group.title} ${expanded ? 'ausblenden' : 'anzeigen'}`}
          accessibilityState={{ expanded }}
        >
          {headerContent}
        </TouchableOpacity>
      ) : (
        <View style={styles.groupHeader}>{headerContent}</View>
      )}

      {expanded && (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)}>
          {group.ingredients.map(({ ingredient, amountLabel }) => (
            <View key={ingredient.id} style={styles.ingredientRow}>
              <View style={styles.ingredientCopy}>
                <View style={styles.ingredientNameRow}>
                  <Text style={styles.ingredientName}>{ingredient.displayName}</Text>
                  {ingredient.isAiEstimate && (
                    <View style={styles.aiBadge}>
                      <Text style={styles.aiBadgeText}>KI</Text>
                    </View>
                  )}
                </View>
              </View>
              {amountLabel != null && (
                <Text style={styles.ingredientAmount}>{amountLabel}</Text>
              )}
            </View>
          ))}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  groupHeader: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  groupHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupLabel: {
    ...typography.body1,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ingredientCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.sm,
  },
  ingredientNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ingredientName: {
    ...typography.body2,
    color: colors.text,
    fontWeight: '600',
    flexShrink: 1,
  },
  ingredientAmount: {
    ...typography.caption,
    color: colors.textSecondary,
    flexShrink: 0,
    textAlign: 'right',
  },
  aiBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs / 2,
  },
  aiBadgeText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
});