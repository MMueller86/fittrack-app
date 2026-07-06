// FavoriteChip — Shared Komponente für Favoriten-Schnellzugriffe.
// Verwendet überall wo Favoriten als kompakte Chips erscheinen:
// - Food Entry Hub (IdleState)
// - Künftig: Profil → Bibliothek → Favoriten
//
// Zeigt: shortName (AI-generiert) ?? displayName (Fallback) + optionales Produktbild.
// Design: primarySoft-Badge-Pattern (= aiBadge aus DiaryScreen).

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
  /** Produktbild-URL (32pt Thumbnail) */
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
      {/* Thumbnail */}
      {imageUrl && !imgError ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.thumbnail}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={styles.thumbnailFallback}>
          <Icon lib="feather" name="database" size="sm" color={colors.primary} />
        </View>
      )}

      {/* Name (shortName hat Vorrang, Fallback: displayName) */}
      <Text style={styles.chipName} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    width: 72,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: spacing.xs + 2,
    gap: 4,
    alignItems: 'flex-start',
  },
  thumbnail: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
  },
  thumbnailFallback: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(103, 178, 62, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipName: {
    ...typography.caption,
    fontWeight: '600' as const,
    color: colors.primary,
    lineHeight: 14,
  },
});
