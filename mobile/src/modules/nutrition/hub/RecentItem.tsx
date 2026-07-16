// RecentItem -- visuell identisch mit SearchState.ResultRow.
// Zeile 1: Produktname
// Zeile 2: Marke (optional)
// Zeile 3: letzte Menge + relative Zeit (ersetzt Makro-Zeile)

import React, { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { UserFoodRelation } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../../app/theme';

const THUMBNAIL_SIZE = 44;

// ---------------------------------------------------------------------------
// Thumbnail mit Buchstaben-Avatar (identisch zu SearchState)
// ---------------------------------------------------------------------------

function Thumbnail({ uri, name }: { uri?: string | null; name: string }) {
  const [imgError, setImgError] = useState(false);
  const letter = name.trim().charAt(0).toUpperCase() || '?';

  if (uri && !imgError) {
    return (
      <Image
        source={{ uri }}
        style={styles.thumbnail}
        resizeMode="cover"
        onError={() => setImgError(true)}
      />
    );
  }
  return (
    <View style={[styles.thumbnail, styles.thumbnailAvatar]}>
      <Text style={styles.thumbnailLetter}>{letter}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------

function relativeTime(isoDate: string | null): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'heute';
  if (diffDays === 1) return 'gestern';
  if (diffDays < 7) {
    return ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'][d.getDay()] ?? '';
  }
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

// ---------------------------------------------------------------------------
// RecentItem
// ---------------------------------------------------------------------------

interface Props {
  item: UserFoodRelation;
  onPress: (item: UserFoodRelation) => void;
  isFirst?: boolean;
}

export function RecentItem({ item, onPress, isFirst }: Props) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(item);
  }, [item, onPress]);

  const timeStr = relativeTime(item.lastUsedAt ?? null);
  const amountStr = item.lastInputAmount
    ? item.lastInputMode === 'portion'
      ? `${item.lastInputAmount} Port.`
      : `${Math.round(item.lastInputAmount)} g`
    : '';
  const metaLine = [amountStr, timeStr].filter(Boolean).join(' \u00b7 ');

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        isFirst && styles.rowFirst,
        pressed && styles.rowPressed,
      ]}
      onPress={handlePress}
      android_ripple={{ color: colors.surfaceMuted, borderless: false }}
      accessibilityRole="button"
      accessibilityLabel={item.displayName}
    >
      <Thumbnail uri={item.imageUrl ?? null} name={item.displayName} />

      <View style={styles.body}>
        {/* Zeile 1: Produktname */}
        <Text style={styles.name} numberOfLines={1}>{item.displayName}</Text>

        {/* Zeile 2: Marke */}
        {item.displayBrand ? (
          <Text style={styles.brand} numberOfLines={1}>{item.displayBrand}</Text>
        ) : null}

        {/* Zeile 3: letzte Menge + Zeit (in Makro-Zeilen-Optik) */}
        {metaLine ? (
          <Text style={styles.meta} numberOfLines={1}>{metaLine}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles -- identisch mit SearchState.ResultRow
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowFirst: {
    borderTopWidth: 0,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },

  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: radius.sm,
    flexShrink: 0,
  },
  thumbnailAvatar: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailLetter: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },

  body: { flex: 1, gap: 3 },

  name: {
    ...typography.body2,
    fontWeight: '700',
    color: colors.text,
  },
  brand: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  meta: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
});