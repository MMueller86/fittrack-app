// Illustrationen der vier Landing-Slides. Alle Werte sind Beispielwerte im Designraster 340 x 410.

import React from 'react';
import { Image, type ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, radius, spacing, typography } from '../../../app/theme';
import { Icon } from '../../../shared/components/Icon';
import { GlassCard, Glow, Layer, landingCardStyles as shared } from './landingPrimitives';

const GNOCCHI_PHOTO = require('../../../../assets/landing/gnocchi-spinat.jpg');
const ROLLS_CARD_PHOTO = require('../../../../assets/landing/quark-broetchen-karte.jpg');
const ROLLS_CUTOUT = require('../../../../assets/landing/quark-broetchen-freisteller.png');
const CARD_DAY = require('../../../../assets/landing/karte-tag-im-blick.jpg');
const CARD_WEIGHT = require('../../../../assets/landing/karte-gewichtstrend.jpg');
const CARD_INSIGHT = require('../../../../assets/landing/karte-daily-insight.jpg');
const CARD_WEEK = require('../../../../assets/landing/karte-wochenrueckblick.jpg');

const GLOW_SIZE = 400;
const GLOW_FRAME = { left: -30, top: 5, width: GLOW_SIZE, height: GLOW_SIZE } as const;

function MacroBar({ fraction, color }: { fraction: number; color: string }) {
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${fraction * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

function CurvedArrow() {
  return (
    <Svg width={60} height={84}>
      <Path d="M8 4 C 0 34, 12 62, 46 70" stroke={colors.primaryBright} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <Path d="M35 61 L47 70 L33 77" stroke={colors.primaryBright} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

interface PhotoCardProps {
  source: ImageSourcePropType;
  /** Breite / Höhe der Bilddatei. */
  ratio: number;
  tilt: '-3deg' | '3deg';
}

function PhotoCard({ source, ratio, tilt }: PhotoCardProps) {
  return (
    <View style={[styles.photoCard, { aspectRatio: ratio, transform: [{ rotate: tilt }] }]}>
      <Image source={source} style={styles.photo} resizeMode="cover" />
    </View>
  );
}

export function CaptureStage() {
  return (
    <>
      <Layer depth={0.04} style={GLOW_FRAME}>
        <Glow color={colors.warning} size={GLOW_SIZE} opacity={0.22} />
      </Layer>
      <Layer depth={0.1} style={{ left: 8, top: 4, width: 310 }}>
        <GlassCard style={styles.tiltLeft}>
          <View style={styles.labelRow}>
            <Icon lib="ion" name="sparkles" size={18} color={colors.primaryBright} />
            <Text style={styles.label}>Du schreibst</Text>
          </View>
          <View style={styles.inputBox}>
            <Text style={styles.inputText} numberOfLines={1}>2 Quarkbrötchen mit Frischkäse</Text>
            <Icon lib="ion" name="send" size={20} color={colors.primaryBright} />
          </View>
        </GlassCard>
      </Layer>
      <Layer depth={0.2} style={{ left: 22, top: 104 }}>
        <CurvedArrow />
      </Layer>
      <Layer depth={0.32} style={{ left: 60, top: 92, width: 220, height: 176 }}>
        <Image source={ROLLS_CUTOUT} style={styles.cutout} resizeMode="contain" />
      </Layer>
      <Layer depth={0.45} style={{ left: 250, top: 120 }}>
        <Icon lib="mci" name="leaf" size={26} color={colors.primary} />
      </Layer>
      <Layer depth={0.18} style={{ left: 15, top: 250, width: 310 }}>
        <GlassCard style={styles.tiltRight}>
          <View style={styles.labelRow}>
            <Icon lib="ion" name="sparkles" size={18} color={colors.primaryBright} />
            <Text style={styles.label}>FitTrack schätzt</Text>
          </View>
          <Text style={styles.kcal}>
            ≈ 420<Text style={styles.kcalUnit}> kcal</Text>
          </Text>
          <View style={styles.barsRow}>
            <MacroBar fraction={0.55} color={colors.macro.protein} />
            <MacroBar fraction={0.4} color={colors.macro.carbohydrates} />
            <MacroBar fraction={0.7} color={colors.macro.fat} />
          </View>
          <Text style={[shared.hint, styles.alignEnd]}>Beispielwerte</Text>
        </GlassCard>
      </Layer>
    </>
  );
}

export function RecipesStage() {
  return (
    <>
      <Layer depth={0.04} style={GLOW_FRAME}>
        <Glow color={colors.warning} size={GLOW_SIZE} opacity={0.2} />
      </Layer>
      <Layer depth={0.08} style={{ left: 0, top: 50, width: 160 }}>
        <GlassCard style={[styles.recipeCard, styles.tiltBackLeft]}>
          <View style={styles.recipeImageSmall}>
            <Image source={ROLLS_CARD_PHOTO} style={styles.photo} resizeMode="cover" />
            <View style={styles.badgeSmall}>
              <Icon lib="ion" name="bookmark-outline" size={18} color={colors.text} />
            </View>
          </View>
          <Text style={styles.recipeTitleSmall} numberOfLines={2}>Quarkbrötchen mit Frischkäse</Text>
        </GlassCard>
      </Layer>
      <Layer depth={0.22} style={{ left: 88, top: 0, width: 240 }}>
        <GlassCard style={[styles.recipeCard, styles.tiltRight]}>
          <View style={styles.recipeImage}>
            <Image source={GNOCCHI_PHOTO} style={styles.photo} resizeMode="cover" />
            <View style={styles.badge}>
              <Icon lib="ion" name="heart" size={20} color={colors.primaryBright} />
            </View>
          </View>
          <View style={styles.recipeBody}>
            <Text style={shared.title}>Gnocchi mit Spinat</Text>
            <View style={styles.chipRow}>
              <View style={styles.chip}>
                <Icon lib="mci" name="timer-outline" size={14} color={colors.primaryBright} />
                <Text style={styles.chipText}>Schnell</Text>
              </View>
              <View style={styles.chip}>
                <Icon lib="mci" name="leaf" size={14} color={colors.primaryBright} />
                <Text style={styles.chipText}>Vegetarisch</Text>
              </View>
            </View>
          </View>
        </GlassCard>
      </Layer>
      <Layer depth={0.2} style={{ left: 18, top: 252 }}>
        <CurvedArrow />
      </Layer>
      <Layer depth={0.3} style={{ left: 36, top: 336, width: 290 }}>
        <View style={[styles.pill, styles.tiltLeftSmall]}>
          <View style={styles.pillCheck}>
            <Icon lib="mci" name="check" size={18} color={colors.background} />
          </View>
          <Text style={styles.pillText}>1 Portion im Tagebuch</Text>
        </View>
      </Layer>
    </>
  );
}

export function ProgressStage() {
  return (
    <>
      <Layer depth={0.04} style={GLOW_FRAME}>
        <Glow color={colors.primary} size={GLOW_SIZE} opacity={0.22} />
      </Layer>
      <Layer depth={0.1} style={{ left: 0, top: 0, width: 256 }}>
        <PhotoCard source={CARD_DAY} ratio={1024 / 1080} tilt="-3deg" />
      </Layer>
      <Layer depth={0.28} style={{ left: 62, top: 232, width: 278 }}>
        <PhotoCard source={CARD_WEIGHT} ratio={1112 / 660} tilt="3deg" />
      </Layer>
    </>
  );
}

export function InsightsStage() {
  return (
    <>
      <Layer depth={0.04} style={GLOW_FRAME}>
        <Glow color={colors.primary} size={GLOW_SIZE} opacity={0.22} />
      </Layer>
      <Layer depth={0.12} style={{ left: 4, top: 4, width: 310 }}>
        <PhotoCard source={CARD_INSIGHT} ratio={1240 / 640} tilt="-3deg" />
      </Layer>
      <Layer depth={0.3} style={{ left: 28, top: 168, width: 310 }}>
        <PhotoCard source={CARD_WEEK} ratio={1240 / 960} tilt="3deg" />
      </Layer>
    </>
  );
}

const styles = StyleSheet.create({
  tiltLeft: { transform: [{ rotate: '-3deg' }] },
  tiltRight: { transform: [{ rotate: '3deg' }] },
  tiltLeftSmall: { transform: [{ rotate: '-2deg' }] },
  tiltBackLeft: { transform: [{ rotate: '-7deg' }] },
  alignEnd: { alignSelf: 'flex-end' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  label: { ...typography.body2, color: colors.textSecondary },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm + spacing.xs,
    paddingHorizontal: spacing.md,
  },
  inputText: { ...typography.body2, color: colors.text, flex: 1 },
  cutout: { width: '100%', height: '100%' },
  photo: { width: '100%', height: '100%' },
  photoCard: {
    width: '100%',
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surfaceElevated,
    shadowColor: colors.background,
    shadowOpacity: 0.6,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  kcal: { fontSize: 40, fontWeight: '800', letterSpacing: -1, color: colors.text, marginBottom: spacing.sm },
  kcalUnit: { ...typography.h2, color: colors.textSecondary },
  barsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  barTrack: { flex: 1, height: 6, borderRadius: radius.full, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.full },

  recipeCard: { padding: 0, overflow: 'hidden' },
  recipeImageSmall: {
    height: 100,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeImage: {
    height: 150,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    top: spacing.sm + spacing.xs,
    right: spacing.sm + spacing.xs,
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderColor: colors.primaryDark,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSmall: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeTitleSmall: { ...typography.body2, color: colors.text, fontWeight: '700', padding: spacing.sm + spacing.xs },
  recipeBody: { padding: spacing.md, gap: spacing.sm },
  chipRow: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.full,
    borderColor: colors.primaryDark,
    borderWidth: 1,
    backgroundColor: colors.primarySoft,
  },
  chipText: { ...typography.caption, color: colors.primaryBright },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
  },
  pillCheck: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { ...typography.h3, color: colors.text, fontWeight: '700' },
});
