// RelationRow — single list row for UserFoodRelation items (non-search views).
// Visual style matches ResultRow from SearchState.tsx.

import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { UserFoodRelation } from '@fittrack/shared';
import { Icon } from '../../../shared/components/Icon';
import { favoritesApi } from '../../../shared/api/favoritesApi';
import { colors, radius, spacing, typography } from '../../../app/theme';
import { thumbnailBorderWidth } from './RelationRow.utils';
export { thumbnailBorderWidth };

export interface RelationRowProps {
  relation: UserFoodRelation;
  onPress: () => void;
  isFirst: boolean;
  getSecondaryText?: (item: UserFoodRelation) => string | null;
  // "Wie immer?" direct-add
  showDirectAdd?: boolean;
  onDirectAdd?: () => void;
  directAddLabel?: string;
  directAddLoading?: boolean;
}

const THUMBNAIL_SIZE = 50;

// ---------------------------------------------------------------------------
// Thumbnail
// ---------------------------------------------------------------------------

function Thumbnail({ uri, isRecipe, borderWidth }: { uri?: string | null; isRecipe: boolean; borderWidth?: number }) {
  const [imgError, setImgError] = useState(false);
  const borderStyle = borderWidth ? { borderWidth, borderColor: colors.primary } : undefined;

  if (uri && !imgError) {
    return (
      <Image
        source={{ uri }}
        style={[styles.thumbnail, borderStyle]}
        resizeMode="cover"
        onError={() => setImgError(true)}
      />
    );
  }
  return (
    <View style={[styles.thumbnail, styles.thumbnailFallback, borderStyle]}>
      <Icon
        lib="feather"
        name={isRecipe ? 'book-open' : 'coffee'}
        size="md"
        color={colors.textMuted}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// RelationRow
// ---------------------------------------------------------------------------

export const RelationRow = React.memo(function RelationRow({
  relation,
  onPress,
  isFirst,
  getSecondaryText,
  showDirectAdd,
  onDirectAdd,
  directAddLabel,
  directAddLoading,
}: RelationRowProps) {
  const [isFavorite, setIsFavorite] = useState(relation.isFavorite);
  const isRecipe = relation.foodRefType === 'recipe';
  const secondaryText = getSecondaryText?.(relation) ?? null;
  const brandDisplay = relation.displayBrand
    ?? (relation.foodRefType === 'recipe' ? 'Eigenes Rezept' : undefined)
    ?? (relation.foodRefType === 'personal' ? 'Eigenes Lebensmittel' : undefined);
  const bw = thumbnailBorderWidth(relation.usageDates);

  const handleFavoriteToggle = useCallback(async () => {
    const next = !isFavorite;
    setIsFavorite(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (next) {
        await favoritesApi.addFavorite({
          foodRef: relation.foodRef,
          foodRefType: relation.foodRefType,
          displayName: relation.displayName,
          displayBrand: relation.displayBrand,
          imageUrl: relation.imageUrl,
          nutritionPer100g: relation.nutritionPer100g,
          portion: relation.portion,
        });
      } else {
        await favoritesApi.removeFavorite(relation.foodRef);
      }
    } catch {
      setIsFavorite(!next);
    }
  }, [isFavorite, relation]);

  return (
    <TouchableOpacity
      style={[styles.row, isFirst && styles.rowFirst]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={relation.displayName}
    >
      <Thumbnail uri={relation.imageUrl} isRecipe={isRecipe} borderWidth={bw} />

      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {relation.displayName}
        </Text>
        {brandDisplay ? (
          <Text style={styles.rowBrand} numberOfLines={1}>{brandDisplay}</Text>
        ) : null}
        {(secondaryText || (showDirectAdd && directAddLabel)) ? (
          <View style={styles.rowLine3}>
            {secondaryText ? (
              <Text style={[styles.rowSecondary, { flex: 1 }]} numberOfLines={1}>{secondaryText}</Text>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            {showDirectAdd && directAddLabel ? (
              <TouchableOpacity
                style={[styles.directAddPill, directAddLoading && styles.directAddPillLoading]}
                onPress={onDirectAdd}
                disabled={directAddLoading}
                accessibilityLabel={`Direkt hinzufügen: ${directAddLabel}`}
                accessibilityHint="Fügt sofort mit der bevorzugten Menge hinzu"
              >
                {directAddLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Icon lib="feather" name="plus" size={12} color={colors.primary} />
                    <Text style={styles.directAddText}>{directAddLabel}</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>

      <TouchableOpacity
        onPress={() => void handleFavoriteToggle()}
        style={isFavorite ? { opacity: 0.7 } : undefined}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel={isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
      >
        <Icon
          lib="ion"
          name={isFavorite ? 'heart' : 'heart-outline'}
          size={18}
          color={isFavorite ? colors.primary : colors.textMuted}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowFirst: {
    borderTopWidth: 0,
  },
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: radius.sm,
    flexShrink: 0,
  },
  thumbnailFallback: {
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 3,
  },
  rowName: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text,
  },
  rowBrand: {
    ...typography.caption,
    color: colors.textMuted,
  },
  rowSecondary: {
    ...typography.caption,
    color: colors.textMuted,
  },
  rowLine3: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  directAddPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  directAddText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.primary,
  },
  directAddPillLoading: {
    opacity: 0.5,
  },
});
