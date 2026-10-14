import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../app/theme';
import { Icon } from './Icon';
import { FoodEntryQuickActionButton } from './FoodEntryQuickActionButton';

export const FOOD_ENTRY_HEADER_HEIGHT = spacing.xl + spacing.xs;

interface Props {
  onSearch: () => void;
  onAi: () => void;
  onBarcode: () => void;
}

export function FoodEntrySearchRow({ onSearch, onAi, onBarcode }: Props) {
  return (
    <View style={styles.searchRow}>
      <TouchableOpacity
        style={styles.searchPill}
        onPress={onSearch}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Lebensmittel hinzufügen"
      >
        <Icon lib="feather" name="search" size="sm" color={colors.textMuted} />
        <Text style={styles.searchPillPlaceholder} numberOfLines={1} ellipsizeMode="tail">
          Lebensmittel hinzufügen
        </Text>
      </TouchableOpacity>
      <FoodEntryQuickActionButton action="ai" onPress={onAi} />
      <FoodEntryQuickActionButton action="barcode" onPress={onBarcode} />
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: spacing.md,
  },
  searchPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 52,
    paddingHorizontal: spacing.md,
  },
  searchPillPlaceholder: {
    ...typography.body2,
    color: colors.textMuted,
    flex: 1,
  },
});