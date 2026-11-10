import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import type { AiMealEstimatePhotoUse } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../../app/theme';
import { Icon } from '../../../shared/components/Icon';

interface Props {
  hasPhoto: boolean;
  imageUri?: string;
  phase: 'photo_check.completed' | 'estimate.started' | null;
  photoUse: Exclude<AiMealEstimatePhotoUse, 'no_photo'> | null;
}

type PhotoStepStatus = 'loading' | 'pending' | 'accepted' | 'rejected' | 'uncertain' | 'unconfirmed';

interface PhotoStatus {
  badge: string;
  title: string;
  detail: string;
  description: string;
  icon: 'check-circle' | 'x-circle' | 'alert-circle';
  tone: string;
  stepStatus: PhotoStepStatus;
}

function getPhotoStatus(photoUse: Exclude<AiMealEstimatePhotoUse, 'no_photo'>): PhotoStatus {
  switch (photoUse) {
    case 'included':
      return {
        badge: 'FOTO PASST',
        title: 'Foto geprüft',
        detail: 'Passt zur Beschreibung',
        description: 'Foto und Beschreibung passen zusammen.',
        icon: 'check-circle',
        tone: colors.primaryBright,
        stepStatus: 'accepted',
      };
    case 'excluded_mismatch':
      return {
        badge: 'FOTO ABGELEHNT',
        title: 'Foto abgelehnt',
        detail: 'Passt nicht zur Beschreibung',
        description: 'Das Foto passt nicht zur Beschreibung und wird nicht genutzt.',
        icon: 'x-circle',
        tone: colors.negative,
        stepStatus: 'rejected',
      };
    case 'excluded_uncertain':
      return {
        badge: 'ABGLEICH UNKLAR',
        title: 'Foto nicht genutzt',
        detail: 'Abgleich nicht eindeutig',
        description: 'Der Abgleich ist nicht eindeutig. Das Foto wird nicht genutzt.',
        icon: 'alert-circle',
        tone: colors.warning,
        stepStatus: 'uncertain',
      };
  }
}

export function MealEstimateLoadingOverlay({ hasPhoto, imageUri, phase, photoUse }: Props) {
  const estimateStarted = !hasPhoto || phase === 'estimate.started';
  const photoStatus = photoUse ? getPhotoStatus(photoUse) : null;
  const photoStepTitle = photoStatus?.title
    ?? (phase === 'estimate.started' ? 'Fotoabgleich nicht bestätigt' : 'Prüfe Bild');
  const photoStepDetail = photoStatus?.detail
    ?? (phase === 'estimate.started'
      ? 'Schätzung ohne bestätigten Fotoabgleich'
      : 'Foto und Beschreibung abgleichen');
  const photoStepStatus = photoStatus?.stepStatus
    ?? (phase === 'estimate.started' ? 'unconfirmed' : 'loading');

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

        <Text style={styles.title}>Wir schätzen deine Mahlzeit</Text>
        <Text style={styles.description}>
          {hasPhoto
            ? photoStatus
              ? `${photoStatus.description}${estimateStarted ? ' Wir schätzen anhand deiner Beschreibung weiter.' : ''}`
              : phase === 'estimate.started'
                ? 'Der Fotoabgleich ist nicht bestätigt. Wir schätzen anhand deiner Beschreibung weiter.'
                : 'Wir prüfen das Foto und gleichen es mit deiner Beschreibung ab.'
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
          {hasPhoto && photoStatus ? (
            <View style={styles.photoTag}>
              <Icon lib="feather" name={photoStatus.icon} size="sm" color={photoStatus.tone} />
              <Text style={[styles.photoTagText, { color: photoStatus.tone }]}>{photoStatus.badge}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.steps}>
          {hasPhoto ? (
            <>
              <Step
                number="01"
                title={photoStepTitle}
                detail={photoStepDetail}
                status={photoStepStatus}
              />
              <View style={styles.stepConnector} />
              <Step
                number="02"
                title="Mahlzeit schätzen"
                detail="Portion und Nährwerte ermitteln"
                status={phase === 'estimate.started' ? 'loading' : 'pending'}
              />
            </>
          ) : (
            <Step
              number="01"
              title="Mahlzeit schätzen"
              detail="Portion und Nährwerte ermitteln"
              status="loading"
            />
          )}
        </View>

        <Text style={styles.waitingText} accessibilityLiveRegion="polite">
          {hasPhoto && phase === null
            ? 'Der Fotoabgleich läuft.'
            : hasPhoto && phase === 'photo_check.completed'
              ? 'Die Schätzung wird vorbereitet.'
              : 'Gute Schätzungen brauchen einen kleinen Moment.'}
        </Text>
      </View>
    </View>
  );
}

function Step({
  number,
  title,
  detail,
  status,
}: {
  number: string;
  title: string;
  detail: string;
  status?: PhotoStepStatus;
}) {
  const statusColor = status === 'accepted'
    ? colors.primaryBright
    : status === 'rejected'
      ? colors.negative
      : status === 'uncertain' || status === 'unconfirmed'
        ? colors.warning
        : null;
  const iconName = status === 'accepted'
    ? 'check'
    : status === 'rejected'
      ? 'x'
      : status === 'uncertain' || status === 'unconfirmed'
        ? 'alert-triangle'
        : null;

  return (
    <View style={styles.step}>
      <View style={[
        styles.stepNumber,
        statusColor ? { backgroundColor: statusColor } : null,
        status === 'pending' ? styles.stepNumberPending : null,
      ]}>
        {status === 'loading' ? (
          <ActivityIndicator size="small" color={colors.primaryBright} accessibilityLabel={`${title} läuft`} />
        ) : iconName ? (
          <Icon lib="feather" name={iconName} size="sm" color={colors.background} />
        ) : (
          <Text style={[styles.stepNumberText, status === 'pending' ? styles.stepNumberTextPending : null]}>
            {number}
          </Text>
        )}
      </View>
      <View style={styles.stepCopy}>
        <Text style={[styles.stepTitle, status === 'rejected' ? { color: colors.negative } : null]}>{title}</Text>
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
  stepNumberPending: {
    backgroundColor: colors.surfaceMuted,
  },
  stepNumberTextPending: {
    color: colors.textMuted,
  },
  waitingText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});