// ProfileGroup / ProfileRow — profil-lokale Gruppen- und Zeilenmuster für den Profil-Hub
// und die Kontobereiche der Profilbearbeitung.

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ComponentProps } from 'react';
import type { Feather } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../../app/theme';
import { Icon } from '../../shared/components/Icon';

export const profileCardStyle = {
  backgroundColor: colors.surface,
  borderRadius: radius.xl,
  borderWidth: 1,
  borderColor: colors.border,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.15,
  shadowRadius: 6,
  elevation: 3,
} as const;

export function ProfileGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const rows = React.Children.toArray(children);
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle} accessibilityRole="header">{title}</Text>
      <View style={styles.groupCard}>
        {rows.map((row, index) => (
          <React.Fragment key={index}>
            {index > 0 ? <View style={styles.divider} /> : null}
            {row}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

interface ProfileRowProps {
  label: string;
  detail?: string;
  iconName?: ComponentProps<typeof Feather>['name'];
  onPress?: () => void;
  // Nicht verfügbarer Eintrag: keine Aktion, kein Chevron, für Screenreader als deaktiviert markiert.
  disabled?: boolean;
  accessibilityHint?: string;
}

export function ProfileRow({ label, detail, iconName, onPress, disabled, accessibilityHint }: ProfileRowProps) {
  const unavailable = disabled === true || !onPress;
  const iconColor = unavailable ? colors.textDisabled : colors.textSecondary;

  const content = (
    <>
      {iconName ? <Icon lib="feather" name={iconName} size="md" color={iconColor} /> : null}
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, unavailable && styles.rowLabelDisabled]}>{label}</Text>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      </View>
      {!unavailable ? <Icon lib="feather" name="chevron-right" size="md" color={colors.textMuted} /> : null}
    </>
  );

  if (unavailable) {
    return (
      <View
        style={styles.row}
        accessible
        accessibilityRole="button"
        accessibilityLabel={detail ? `${label}, ${detail}` : label}
        accessibilityState={{ disabled: true }}
      >
        {content}
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  group: { marginTop: spacing.md },
  groupTitle: {
    ...typography.overline,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  groupCard: {
    ...profileCardStyle,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  divider: { height: 1, backgroundColor: colors.border },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: spacing.xxl,
    paddingVertical: spacing.sm,
  },
  rowText: { flex: 1, flexShrink: 1 },
  rowLabel: { ...typography.body1, color: colors.text },
  rowLabelDisabled: { color: colors.textMuted },
  rowDetail: { ...typography.caption, color: colors.textMuted },
});
