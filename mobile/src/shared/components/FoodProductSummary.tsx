// FoodProductSummary — rein präsentativer Produkt-Summary (Thumbnail, Name, Marke, Herkunft, Nährwerte).
// Geteilt von Search Hub (ResultRow) und Profil → Eigene Lebensmittel. Keine Navigation, keine Mutation;
// kontextspezifische Aktionen kommen über `trailing` und `footer` vom Aufrufer.

import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { NutritionBasis, NutritionValues, PortionInfo } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { Icon } from './Icon';
import {
  FOOD_THUMBNAIL_SIZE,
  buildNutritionLine,
  isRemoteImageUri,
  thumbnailLetter,
} from './foodProductSummaryUtils';

export interface FoodProductBadge {
  label: string;
  tone: 'accent' | 'neutral';
}

export interface FoodProductSummaryProps {
  name: string;
  brand?: string;
  imageUri?: string | null;
  badges?: readonly FoodProductBadge[];
  /** Nährwerte unvollständig — zeigt ein Warnsymbol neben Marke/Badges. */
  incomplete?: boolean;
  nutrition?: NutritionValues;
  nutritionBasis: NutritionBasis;
  portion?: PortionInfo | null;
  isAiEstimate?: boolean;
  /** Rechts neben dem Namen (z. B. Favoriten-Herz im Hub). */
  trailing?: React.ReactNode;
  /** Unterhalb der Nährwertzeile (z. B. Quick-Accept im Rezeptmodus). */
  footer?: React.ReactNode;
}

function Thumbnail({ uri, name }: { uri?: string | null; name: string }) {
  const [imgError, setImgError] = useState(false);

  if (isRemoteImageUri(uri) && !imgError) {
    return (
      <Image
        source={{ uri }}
        style={styles.thumbnail}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
        onError={() => setImgError(true)}
      />
    );
  }
  return (
    <View style={[styles.thumbnail, styles.thumbnailAvatar]}>
      <Text style={styles.thumbnailLetter}>{thumbnailLetter(name)}</Text>
    </View>
  );
}

export function FoodProductSummary({
  name,
  brand,
  imageUri,
  badges,
  incomplete,
  nutrition,
  nutritionBasis,
  portion,
  isAiEstimate,
  trailing,
  footer,
}: FoodProductSummaryProps) {
  const nutritionLine = buildNutritionLine({ nutrition, nutritionBasis, portion, isAiEstimate });
  const hasMetaLine = Boolean(brand) || (badges?.length ?? 0) > 0 || incomplete === true;

  return (
    <View style={styles.root}>
      <Thumbnail key={imageUri ?? 'none'} uri={imageUri} name={name} />

      <View style={styles.body}>
        <View style={styles.nameLine}>
          <Text style={styles.name} numberOfLines={2}>{name}</Text>
          {trailing}
        </View>

        {hasMetaLine ? (
          <View style={styles.metaLine}>
            {brand ? <Text style={styles.brand} numberOfLines={1}>{brand}</Text> : null}
            {badges?.map((badge) => (
              <View
                key={badge.label}
                style={badge.tone === 'accent' ? styles.badgeAccent : styles.badgeNeutral}
              >
                <Text style={badge.tone === 'accent' ? styles.badgeTextAccent : styles.badgeTextNeutral}>
                  {badge.label}
                </Text>
              </View>
            ))}
            {incomplete ? (
              <View accessible accessibilityLabel="Nährwerte unvollständig">
                <Icon lib="feather" name="alert-circle" size="sm" color={colors.neutral} />
              </View>
            ) : null}
          </View>
        ) : null}

        {nutritionLine ? <Text style={styles.nutritionLine}>{nutritionLine}</Text> : null}

        {footer}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  thumbnail: {
    width: FOOD_THUMBNAIL_SIZE,
    height: FOOD_THUMBNAIL_SIZE,
    borderRadius: radius.sm,
    flexShrink: 0,
  },
  thumbnailAvatar: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailLetter: {
    ...typography.h3,
    fontWeight: '700',
    color: colors.primary,
  },
  body: { flex: 1, gap: spacing.xs },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: {
    ...typography.body2,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  metaLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  brand: {
    ...typography.caption,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  badgeAccent: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    flexShrink: 0,
  },
  badgeTextAccent: {
    ...typography.overline,
    letterSpacing: 0,
    color: colors.primary,
  },
  badgeNeutral: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    flexShrink: 0,
  },
  badgeTextNeutral: {
    ...typography.overline,
    letterSpacing: 0,
    color: colors.textMuted,
  },
  nutritionLine: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
});
