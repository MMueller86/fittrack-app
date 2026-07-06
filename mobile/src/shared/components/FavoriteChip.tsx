// FavoriteChip — Shared Komponente für Favoriten-Schnellzugriffe.
// Orientiert sich am addMealChip-Pattern aus DiaryScreen (surface + border, horizontal).
// Zeigt: kleines Thumbnail links + shortName (AI) ?? displayName (Fallback) rechts.

import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Icon } from './Icon';
import { colors, radius, spacing, typography } from '../../app/theme';

export interface FavoriteChipProps {
  /** Produktname — immer vorhanden, dient als Fallback */
  displayName: string;
  /** AI-generierter Kurzname — wenn vorhanden, wird dieser angezeigt */
  shortName?: string | null;
  /** Produktbild-URL (24pt Thumbnail) */
  imageUrl?: string | null;
  /** Callback beim Antippen */
  onPress: () => void;
  /** Optionaler Accessibility-Label (default: displayName) */
  accessibilityLabel?: string;
}

export function FavoriteChip({
  displayName,
  shortName,
  imageUrl,
  onPress,
  accessibilityLabel,
}: FavoriteChipProps) {
  const [imgError, setImgError] = useState(false);
  const label = shortName || displayName;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <TouchableOpacity
      style={styles.chip}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? displayName}
    >
      {/* Thumbnail — wie Emoji-Icon in addMealChip */}
      {imageUrl && !imgError ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.thumbnail}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={styles.thumbnailFallback}>
          <Icon lib="feather" name="database" size="sm" color={colors.textMuted} />
        </View>
      )}

      {/* Name (shortName hat Vorrang, Fallback: displayName) */}
      <Text style={styles.chipName} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // addMealChip-Pattern aus DiaryScreen: surface + border, horizontal, radius.md
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  thumbnail: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
  },
  thumbnailFallback: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipName: {
    ...typography.body2,
    color: colors.text,
  },
});
