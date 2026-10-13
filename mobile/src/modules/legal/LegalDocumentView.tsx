// LegalDocumentView — scrollbare In-App-Ansicht für Impressum und Datenschutzerklärung.
// Zustandslos gegenüber Navigation: Profil-Stack-Routen, LoginScreen und ProfileWizardScreen
// binden sie über `onBack` ein (kein externer Link, keine Authentifizierung nötig).

import React, { useEffect, useMemo } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../../app/theme';
import { Icon } from '../../shared/components/Icon';
import { parseLegalMarkdown, type LegalInline } from './legalMarkdown';
import { LEGAL_DOCUMENTS, type LegalDocumentId } from './legalTexts';

interface LegalDocumentViewProps {
  documentId: LegalDocumentId;
  onBack: () => void;
  // Nur setzen, wenn die Ansicht nicht in einem Navigator liegt (Login, Wizard).
  interceptHardwareBack?: boolean;
}

function InlineText({ content }: { content: LegalInline[] }) {
  return (
    <>
      {content.map((segment, index) =>
        segment.bold ? (
          <Text key={index} style={styles.bold}>{segment.text}</Text>
        ) : (
          <Text key={index}>{segment.text}</Text>
        ),
      )}
    </>
  );
}

export function LegalDocumentView({ documentId, onBack, interceptHardwareBack }: LegalDocumentViewProps) {
  const document = LEGAL_DOCUMENTS[documentId];
  const blocks = useMemo(() => parseLegalMarkdown(document.markdown), [document.markdown]);

  useEffect(() => {
    if (!interceptHardwareBack) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [interceptHardwareBack, onBack]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Zurück"
        >
          <Icon lib="feather" name="chevron-left" size="lg" color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} accessibilityRole="header">{document.title}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {blocks.map((block, index) => {
          if (block.type === 'heading') {
            // Die H1 steht bereits als Titel im Header.
            if (block.level === 1) return null;
            return (
              <Text key={index} style={styles.sectionTitle} accessibilityRole="header">{block.text}</Text>
            );
          }
          if (block.type === 'bullet') {
            return (
              <View key={index} style={[styles.bulletRow, block.level === 1 && styles.bulletRowNested]}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}><InlineText content={block.content} /></Text>
              </View>
            );
          }
          return (
            <Text key={index} style={styles.paragraph}><InlineText content={block.content} /></Text>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: spacing.xxl,
    height: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    ...typography.h3,
    color: colors.text,
  },
  headerSpacer: { width: spacing.xxl },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.md,
  },
  paragraph: {
    ...typography.body2,
    color: colors.textSecondary,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bulletRowNested: { paddingLeft: spacing.md },
  bulletDot: {
    width: spacing.xs,
    height: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.textMuted,
    marginTop: spacing.sm,
  },
  bulletText: {
    ...typography.body2,
    color: colors.textSecondary,
    flex: 1,
    flexShrink: 1,
  },
  bold: { fontWeight: '700', color: colors.text },
});
