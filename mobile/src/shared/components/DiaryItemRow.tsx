import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '../../app/theme';

export interface DiaryItemRowProps {
  name: string;
  amountLabel: string;
  kcal: number;
  protein: number;
  aiBadgeLabel?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function DiaryItemRow({ name, amountLabel, kcal, protein, aiBadgeLabel, onPress, style }: DiaryItemRowProps) {
  const content = (
    <View style={{ flex: 1 }}>
      <View style={styles.itemRowTop}>
        <Text style={styles.itemName} numberOfLines={1}>{name}</Text>
        <Text style={styles.itemAmount}>{amountLabel}</Text>
      </View>
      <Text style={styles.itemMacros}>
        {Math.round(kcal)} kcal · {Math.round(protein)} g Eiweiß
      </Text>
      {aiBadgeLabel != null && (
        <View style={styles.aiItemRow}>
          <View style={styles.aiBadge}>
            <Text style={styles.aiBadgeText}>{aiBadgeLabel}</Text>
          </View>
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={[styles.itemRow, style]} onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.itemRow, style]}>
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
  itemRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  itemName: { ...typography.body2, color: colors.text, fontWeight: '600' as const, flex: 1 },
  itemAmount: { ...typography.caption, color: colors.textMuted, flexShrink: 0, marginLeft: spacing.xs, fontVariant: ['tabular-nums'] as const },
  itemMacros: { ...typography.caption, color: colors.textSecondary, marginBottom: 2, fontVariant: ['tabular-nums'] as const },
  aiItemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  aiBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  aiBadgeText: { ...typography.caption, color: colors.primary, fontWeight: '600' as const },
});
