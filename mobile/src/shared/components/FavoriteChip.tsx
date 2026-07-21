// FavoriteChip — Shared Komponente für Favoriten-Schnellzugriffe.
// Pill-shaped chip (radius.full), no borders.
// Food chips: surfaceMuted background. Recipe chips: primarySoft background.
// Thumbnail: 28×28 circular, falls back to icon container on error or missing URL.

import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import type { FoodRefType } from '@fittrack/shared';
import { Icon } from './Icon';
import { colors, radius, spacing, typography } from '../../app/theme';

export interface FavoriteChipProps {
  /** Produktname — immer vorhanden, dient als Fallback */
  displayName: string;
  /** AI-generierter Kurzname — wenn vorhanden, wird dieser angezeigt */
  shortName?: string | null;
  /** Produktbild-URL (28pt Thumbnail) */
  imageUrl?: string | null;
  /** Callback beim Antippen */
  onPress: () => void;
  /** Callback bei langem Drücken (≥400ms) */
  onLongPress?: () => void;
  /** Typ der Referenz — 'recipe' erhält primarySoft-Hintergrund */
  foodRefType?: FoodRefType;
  /** Optionaler Accessibility-Label (default: displayName) */
  accessibilityLabel?: string;
  /** Zuletzt verwendet — ISO-Datumsstring; wird als relativer Hinweis angezeigt ("heute", "gestern", "vor 3T") */
  lastUsedAt?: string | null;
}

function formatLastUsed(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return 'heute';
  if (diffDays === 1) return 'gestern';
  if (diffDays < 7) return `vor ${diffDays}T`;
  const weeks = Math.floor(diffDays / 7);
  if (weeks <= 4) return `vor ${weeks}W`;
  return null;
}

export function FavoriteChip({
  displayName,
  shortName,
  imageUrl,
  onPress,
  onLongPress,
  foodRefType,
  accessibilityLabel,
  lastUsedAt,
}: FavoriteChipProps) {
  const [imgError, setImgError] = useState(false);
  const label = shortName || displayName;
  const isRecipe = foodRefType === 'recipe';
  const lastUsedHint = formatLastUsed(lastUsedAt);

  const scale = useSharedValue(1);
  const reducedMotion = useReducedMotion();
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const handlePressIn = () => {
    if (!reducedMotion) scale.value = withTiming(0.95, { duration: 80 });
  };

  const handlePressOut = () => {
    if (!reducedMotion) scale.value = withTiming(1.0, { duration: 100 });
  };

  const handleLongPressInternal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress?.();
  };

  const hasImage = imageUrl != null && imageUrl.length > 0 && !imgError;

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={[styles.chip, isRecipe ? styles.recipeChip : styles.foodChip]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLongPress={onLongPress ? handleLongPressInternal : undefined}
        delayLongPress={400}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? displayName}
        accessibilityHint={isRecipe ? 'Rezept' : 'Lebensmittel'}
      >
        {hasImage ? (
          <View style={styles.thumbnailContainer}>
            <Image
              source={{ uri: imageUrl! }}
              style={styles.thumbnailImage}
              resizeMode="cover"
              onError={() => setImgError(true)}
            />
          </View>
        ) : (
          <View style={[
            styles.thumbnailContainer,
            { backgroundColor: isRecipe ? colors.primarySoft : colors.surfaceMuted },
          ]}>
            <Icon
              lib="feather"
              name={isRecipe ? 'book-open' : 'coffee'}
              size={14}
              color={isRecipe ? colors.primary : colors.textSecondary}
            />
          </View>
        )}

        {/* Name + optionaler Nutzungshinweis ("heute", "vor 2T" …) */}
        <View style={styles.labelContainer}>
          <Text style={styles.chipLabel} numberOfLines={1}>{label}</Text>
          {lastUsedHint !== null && (
            <Text style={styles.lastUsedLabel} numberOfLines={1}>{lastUsedHint}</Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,   // 8px — breathing room left/right
    paddingVertical: 8,              // explicit 8px → chip height = 28 + 16 = 44px
    gap: spacing.xs,
  },
  foodChip: {
    backgroundColor: colors.surfaceMuted,
  },
  recipeChip: {
    backgroundColor: colors.primarySoft,
  },
  labelContainer: {
    flexShrink: 1,
    justifyContent: 'center',
  },
  chipLabel: {
    ...typography.body2,
    color: colors.text,
    fontWeight: '600',
  },
  lastUsedLabel: {
    fontSize: 10,
    fontWeight: '400',
    color: colors.textMuted,
    letterSpacing: 0.2,
    marginTop: 1,
  },
  thumbnailContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',      // required for circular clip on Android
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailImage: {
    width: 28,
    height: 28,
    borderRadius: 14,   // explicit radius on Image for Android fallback
  },
});
