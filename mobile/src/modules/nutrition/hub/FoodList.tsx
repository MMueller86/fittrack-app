// FoodList — generic list of UserFoodRelation items using BottomSheetFlatList.
// Used by FoodEntryHub for non-search views (Für dich, Zuletzt, Alle, meal-type filters).

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import type { UserFoodRelation } from '@fittrack/shared';
import { colors, spacing, typography } from '../../../app/theme';
import { ErrorBanner } from '../../../shared/components/ErrorBanner';
import { RelationRow } from './RelationRow';

interface FoodListProps {
  items: UserFoodRelation[];
  loading: boolean;
  error: string | null;
  onSelect: (item: UserFoodRelation) => void;
  onRetry: () => void;
  getSecondaryText?: (item: UserFoodRelation) => string | null;
  showDirectAdd?: boolean;
  onDirectAdd?: (item: UserFoodRelation) => void;
  getDirectAddLabel?: (item: UserFoodRelation) => string | null;
  isDirectAddLoading?: (item: UserFoodRelation) => boolean;
  emptyTitle?: string;
  emptyBody?: string;
}

export function FoodList({
  items,
  loading,
  error,
  onSelect,
  onRetry,
  getSecondaryText,
  showDirectAdd,
  onDirectAdd,
  getDirectAddLabel,
  isDirectAddLoading,
  emptyTitle,
  emptyBody,
}: FoodListProps) {
  if (error) {
    return <ErrorBanner error={error} onRetry={onRetry} />;
  }

  if (loading && items.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        {emptyTitle ? <Text style={styles.emptyTitle}>{emptyTitle}</Text> : null}
        {emptyBody ? <Text style={styles.emptyBody}>{emptyBody}</Text> : null}
      </View>
    );
  }

  return (
    <BottomSheetFlatList
      data={items}
      keyExtractor={item => item.id}
      renderItem={({ item, index }) => {
        const label = getDirectAddLabel?.(item) ?? null;
        return (
          <RelationRow
            relation={item}
            onPress={() => onSelect(item)}
            isFirst={index === 0}
            getSecondaryText={getSecondaryText}
            showDirectAdd={showDirectAdd && label !== null}
            onDirectAdd={showDirectAdd && label ? () => onDirectAdd?.(item) : undefined}
            directAddLabel={label ?? undefined}
            directAddLoading={isDirectAddLoading?.(item) ?? false}
          />
        );
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
    />
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  emptyContainer: {
    padding: spacing.lg,
    gap: 8,
    alignItems: 'center',
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
  },
  emptyBody: {
    ...typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: spacing.lg,
  },
});
