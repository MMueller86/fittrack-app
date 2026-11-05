import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { colors, radius, spacing, typography } from '../../../app/theme';
import { Icon } from '../../../shared/components/Icon';

interface Props {
  hasPhoto: boolean;
  imageUri?: string;
  phase: 'photo_check.completed' | 'estimate.started' | null;
}

export function MealEstimateLoadingOverlay({ hasPhoto, imageUri, phase }: Props) {
  const estimateStarted = !hasPhoto || phase === 'estimate.started';
  const photoCheckCompleted = phase === 'photo_check.completed' || phase === 'estimate.started';
  const sweepProgress = useSharedValue(0);
  const progressStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sweepProgress.value * 128 }],
  }));

  useEffect(() => {
    if (!estimateStarted) {
      sweepProgress.value = 0;
      return;
    }
    sweepProgress.value = withRepeat(withTiming(1, { duration: 1800 }), -1, true);
    return () => {
      sweepProgress.value = 0;
    };
  }, [estimateStarted, sweepProgress]);

  return (
    <View
      style={styles.overlay}
      accessibilityViewIsModal
      accessibilityState={{ busy: true }}
    >
      <View style={styles.panel}>
        <View style={styles.eyebrow}>
          <Icon lib="mci" name="food-apple" size="sm" color={colors.primaryBright} />
          <Text style={styles.eyebrowText}>KI-KÜCHE · LIVE</Text>
        </View>

        <Text style={styles.title}>Dein Essen wird entschlüsselt</Text>
        <Text style={styles.description}>
          {hasPhoto
            ? phase === 'estimate.started'
              ? 'Foto und Beschreibung wurden abgeglichen. Wir schätzen Portion und Nährwerte.'
              : phase === 'photo_check.completed'
                ? 'Foto und Beschreibung wurden abgeglichen.'
                : 'Deine Anfrage wird verarbeitet.'
            : 'Wir ordnen deine Beschreibung ein und schätzen die Nährwerte.'}
        </Text>

        <View style={styles.visual}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.photo} resizeMode="cover" />
          ) : (
            <View style={styles.iconBackdrop}>
              <Icon lib="ion" name="restaurant-outline" size={48} color={colors.primaryBright} />
            </View>
          )}
          {hasPhoto && photoCheckCompleted ? (
            <View style={styles.photoTag}>
              <Icon lib="feather" name="check-circle" size="sm" color={colors.primaryBright} />
              <Text style={styles.photoTagText}>FOTO GEPRÜFT</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.steps}>
          {hasPhoto && phase === 'estimate.started' ? (
            <>
              <Step number="01" title="Foto geprüft" detail="Abgleich abgeschlossen" />
              <View style={styles.stepConnector} />
              <Step number="02" title="Mahlzeit schätzen" detail="Portion und Nährwerte ermitteln" />
            </>
          ) : hasPhoto && phase === 'photo_check.completed' ? (
            <Step number="01" title="Foto geprüft" detail="Abgleich abgeschlossen" />
          ) : hasPhoto ? null : (
            <Step number="01" title="Mahlzeit schätzen" detail="Portion und Nährwerte ermitteln" />
          )}
        </View>

        {estimateStarted ? (
          <View
            style={styles.progressTrack}
            accessibilityRole="progressbar"
            accessibilityLabel="KI-Schätzung läuft"
          >
            <Animated.View style={[styles.progressSweep, progressStyle]} />
          </View>
        ) : null}
        <Text style={styles.waitingText} accessibilityLiveRegion="polite">
          {hasPhoto && phase === null
            ? 'Wir halten dich auf dem Laufenden.'
            : hasPhoto && phase === 'photo_check.completed'
              ? 'Die Schätzung wird vorbereitet.'
              : 'Gute Schätzungen brauchen einen kleinen Moment.'}
        </Text>
      </View>
    </View>
  );
}

function Step({ number, title, detail }: { number: string; title: string; detail: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{number}</Text>
      </View>
      <View style={styles.stepCopy}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepDetail}>{detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 2,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xl,
    backgroundColor: colors.overlay,
  },
  panel: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    padding: spacing.md,
    gap: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  eyebrowText: {
    ...typography.overline,
    color: colors.primaryBright,
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
  description: {
    ...typography.body2,
    color: colors.textSecondary,
    lineHeight: 21,
  },
  visual: {
    height: 152,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  photo: {
    ...StyleSheet.absoluteFill,
    width: undefined,
    height: undefined,
  },
  iconBackdrop: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
  },
  photoTag: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
  },
  photoTagText: {
    ...typography.overline,
    color: colors.primaryBright,
  },
  steps: {
    gap: spacing.sm,
  },
  step: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepNumber: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
  },
  stepNumberText: {
    ...typography.caption,
    color: colors.primaryBright,
  },
  stepCopy: {
    flex: 1,
    gap: 2,
  },
  stepTitle: {
    ...typography.body2,
    color: colors.text,
    fontWeight: '600',
  },
  stepDetail: {
    ...typography.caption,
    color: colors.textMuted,
  },
  stepConnector: {
    height: spacing.sm,
    width: 1,
    marginLeft: 15,
    backgroundColor: colors.border,
  },
  progressTrack: {
    height: 4,
    overflow: 'hidden',
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
  },
  progressSweep: {
    width: '36%',
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.primaryBright,
  },
  waitingText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});