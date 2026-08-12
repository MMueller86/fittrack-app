import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, radius, spacing, typography } from '../../app/theme';
import { CHECKMARK_OUTLINE_ICON, Icon } from './Icon';

export interface DiaryItemRowProps {
  name: string;
  amountLabel?: string;
  kcal?: number;
  protein?: number;
  secondaryLabel?: string;
  statusLabel?: string;
  statusPending?: boolean;
  statusTone?: 'neutral' | 'attention' | 'success';
  aiBadgeLabel?: string;
  onPress?: () => void;
  onConfirm?: () => void;
  confirmAccessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'recipeIngredient';
}

export function DiaryItemRow({
  name,
  amountLabel,
  kcal,
  protein,
  secondaryLabel,
  statusLabel,
  statusPending,
  statusTone,
  aiBadgeLabel,
  onPress,
  onConfirm,
  confirmAccessibilityLabel,
  style,
  variant = 'default',
}: DiaryItemRowProps) {
  const statusReveal = useSharedValue(statusTone === 'success' ? 0 : 1);
  const statusRevealStyle = useAnimatedStyle(() => ({
    opacity: statusReveal.value,
    transform: [{ scale: 0.8 + statusReveal.value * 0.2 }],
  }));
  const isRecipeIngredient = variant === 'recipeIngredient';
  const showLeadingSuccess = isRecipeIngredient && statusTone === 'success';

  useEffect(() => {
    if (statusTone === 'success') {
      statusReveal.value = 0;
      statusReveal.value = withTiming(1, { duration: 220 });
    } else {
      statusReveal.value = 1;
    }
  }, [statusTone]);

  const content = (
    <View style={{ flex: 1 }}>
      <View style={[styles.itemRowTop, variant === 'recipeIngredient' && styles.itemRowTopRecipe]}>
        {showLeadingSuccess && (
          <Animated.View style={[styles.leadingStatusIcon, statusRevealStyle]}>
            <Icon lib="ion" name={CHECKMARK_OUTLINE_ICON} size="sm" color={colors.primary} />
          </Animated.View>
        )}
        <Text
          style={[styles.itemName, variant === 'recipeIngredient' && styles.itemNameRecipe]}
          numberOfLines={isRecipeIngredient ? 2 : 1}
        >
          {name}
        </Text>
        {!isRecipeIngredient && amountLabel != null && amountLabel.length > 0 && (
          <Text style={styles.itemAmount}>
            {amountLabel}
          </Text>
        )}
      </View>
      {secondaryLabel != null && (isRecipeIngredient ? (
        <View style={styles.itemSecondaryRecipeRow}>
          <Icon lib="ion" name="arrow-forward" size="sm" color={colors.textMuted} />
          <Text style={[styles.itemSecondary, styles.itemSecondaryRecipe]} numberOfLines={2}>
            {secondaryLabel}
          </Text>
        </View>
      ) : (
        <Text style={styles.itemSecondary} numberOfLines={1}>
          {secondaryLabel}
        </Text>
      ))}
      {statusLabel != null && (
        <View
          style={[
            styles.itemStatusRow,
            variant === 'recipeIngredient' && styles.itemStatusRowRecipe,
            statusTone === 'success' && styles.itemStatusRowSuccess,
            statusTone === 'attention' && styles.itemStatusRowAttention,
          ]}
        >
          {statusPending ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : statusTone === 'success' || statusTone === 'attention' ? (
            <Animated.View style={[styles.itemStatusIcon, statusTone === 'success' && statusRevealStyle]}>
              <Icon
                lib="ion"
                name={statusTone === 'success' ? CHECKMARK_OUTLINE_ICON : 'arrow-forward-circle-outline'}
                size="sm"
                color={statusTone === 'success' ? colors.primary : colors.primaryBright}
              />
            </Animated.View>
          ) : null}
          <Text
            style={[
              styles.itemStatus,
              statusTone === 'success' && styles.itemStatusSuccess,
              statusTone === 'attention' && styles.itemStatusAttention,
            ]}
            numberOfLines={2}
          >
            {statusLabel}
          </Text>
        </View>
      )}
      {kcal != null && protein != null && (
        <Text style={[styles.itemMacros, variant === 'recipeIngredient' && styles.itemMacrosRecipe]}>
          {Math.round(kcal)} kcal · {Math.round(protein)} g Eiweiß
        </Text>
      )}
      {aiBadgeLabel != null && (
        <View style={[styles.aiItemRow, variant === 'recipeIngredient' && styles.aiItemRowRecipe]}>
          <View style={styles.aiBadge}>
            <Text style={styles.aiBadgeText}>{aiBadgeLabel}</Text>
          </View>
        </View>
      )}
    </View>
  );

  const rowStyles = [
    styles.itemRow,
    variant === 'recipeIngredient' && styles.itemRowRecipe,
    statusTone === 'success' && variant === 'recipeIngredient' && styles.itemRowRecipeSuccess,
    statusTone === 'attention' && variant === 'recipeIngredient' && styles.itemRowRecipeAttention,
    statusTone === 'neutral' && variant === 'recipeIngredient' && styles.itemRowRecipeNeutral,
    style,
  ];

  if (isRecipeIngredient) {
    return (
      <View style={rowStyles}>
        {onPress ? (
          <TouchableOpacity
            style={styles.itemRowPressable}
            onPress={onPress}
            activeOpacity={0.7}
          >
            {content}
          </TouchableOpacity>
        ) : content}
        {((amountLabel != null && amountLabel.length > 0) || onConfirm) && (
          <View style={styles.recipeAmountRail}>
            {amountLabel != null && amountLabel.length > 0 && (
              <Text style={styles.itemAmountRecipe}>{amountLabel}</Text>
            )}
            {onConfirm && (
              <TouchableOpacity
                style={[styles.confirmAction, styles.confirmActionRecipe]}
                onPress={onConfirm}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={confirmAccessibilityLabel ?? 'Zuordnung bestätigen'}
              >
                <Icon lib="ion" name={CHECKMARK_OUTLINE_ICON} size="md" color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  }

  if (onConfirm) {
    return (
      <View
        style={rowStyles}
      >
        {onPress ? (
          <TouchableOpacity
            style={styles.itemRowPressable}
            onPress={onPress}
            activeOpacity={0.7}
          >
            {content}
          </TouchableOpacity>
        ) : content}
        <TouchableOpacity
          style={styles.confirmAction}
          onPress={onConfirm}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={confirmAccessibilityLabel ?? 'Zuordnung bestätigen'}
        >
          <Icon lib="ion" name={CHECKMARK_OUTLINE_ICON} size="md" color={colors.primary} />
        </TouchableOpacity>
      </View>
    );
  }

  if (onPress) {
    return (
      <TouchableOpacity
        style={rowStyles}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={rowStyles}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm + 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  itemRowRecipe: {
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemRowRecipeSuccess: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },
  itemRowRecipeAttention: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },
  itemRowRecipeNeutral: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },
  itemRowPressable: { flex: 1 },
  confirmAction: {
    width: spacing.xl,
    height: spacing.xl,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginLeft: spacing.sm,
    marginTop: spacing.xs,
  },
  itemRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  itemRowTopRecipe: { alignItems: 'center', marginBottom: spacing.xs },
  itemName: { ...typography.body2, color: colors.text, fontWeight: '600' as const, flex: 1 },
  itemNameRecipe: { ...typography.body1, color: colors.text, fontWeight: '600' as const },
  itemAmount: { ...typography.caption, color: colors.textMuted, flexShrink: 0, marginLeft: spacing.xs, fontVariant: ['tabular-nums'] as const },
  itemAmountRecipe: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600' as const,
    width: '100%',
    textAlign: 'center' as const,
    fontVariant: ['tabular-nums'] as const,
  },
  leadingStatusIcon: {
    width: spacing.lg,
    alignItems: 'center' as const,
    marginRight: spacing.xs,
  },
  recipeAmountRail: {
    minWidth: spacing.xxl + spacing.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing.xs,
    marginLeft: spacing.sm,
  },
  confirmActionRecipe: {
    marginLeft: 0,
    marginTop: 0,
  },
  itemSecondary: { ...typography.caption, color: colors.textSecondary, paddingLeft: spacing.sm, marginBottom: 2, flexShrink: 1 },
  itemSecondaryRecipeRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: spacing.xs,
    paddingLeft: spacing.lg + spacing.xs,
    marginBottom: spacing.xs,
  },
  itemSecondaryRecipe: {
    color: colors.textMuted,
    paddingLeft: 0,
    marginBottom: 0,
    flex: 1,
  },
  itemStatusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingLeft: spacing.sm, marginBottom: 2 },
  itemStatusRowRecipe: { paddingLeft: 0, marginBottom: spacing.xs },
  itemStatusRowSuccess: { marginTop: spacing.xs },
  itemStatusRowAttention: { marginTop: spacing.xs },
  itemStatusIcon: { width: spacing.md, alignItems: 'center' as const },
  itemStatus: { ...typography.caption, color: colors.textMuted, flexShrink: 1 },
  itemStatusSuccess: { color: colors.primary, fontWeight: '600' as const },
  itemStatusAttention: { color: colors.primaryBright, fontWeight: '600' as const },
  itemMacros: { ...typography.caption, color: colors.textSecondary, marginBottom: 2, fontVariant: ['tabular-nums'] as const },
  itemMacrosRecipe: { color: colors.textMuted, marginBottom: spacing.xs },
  aiItemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  aiItemRowRecipe: { marginTop: spacing.sm },
  aiBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  aiBadgeText: { ...typography.caption, color: colors.primary, fontWeight: '600' as const },
});
