// LibraryScreen — kanonischer Einstieg für "Favoriten" und "Eigene Lebensmittel".
// Erreichbar über Profil → Bibliothek (Route `Library`). Inhalte: FavoritesView, OwnFoodsView.

import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '../../app/theme';
import { Icon } from '../../shared/components/Icon';
import { Snackbar, useSnackbar } from '../../shared/components/Snackbar';
import type { ProfileStackParamList } from '../../app/navigation/RootNavigator';
import { FavoritesView } from './FavoritesView';
import { OwnFoodsView } from './OwnFoodsView';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Library'>;

type Tab = 'favorites' | 'ownFoods';

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'favorites', label: 'Favoriten' },
  { id: 'ownFoods', label: 'Eigene Lebensmittel' },
];

export default function LibraryScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('favorites');
  // Eigene Lebensmittel werden erst beim ersten Öffnen geladen und bleiben danach (inkl. Suche) erhalten.
  const [ownFoodsOpened, setOwnFoodsOpened] = useState(false);
  const { ref: snackbarRef, show: showSnackbar } = useSnackbar();

  function selectTab(tab: Tab) {
    if (tab === 'ownFoods') setOwnFoodsOpened(true);
    setActiveTab(tab);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Zurück"
        >
          <Icon lib="feather" name="chevron-left" size="lg" color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} accessibilityRole="header">Bibliothek</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabBar} accessibilityRole="tablist">
        {TABS.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, selected && styles.tabActive]}
              onPress={() => selectTab(tab.id)}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.pane, activeTab !== 'favorites' && styles.hidden]}>
        <FavoritesView showSnackbar={showSnackbar} />
      </View>
      {ownFoodsOpened ? (
        <View style={[styles.pane, activeTab !== 'ownFoods' && styles.hidden]}>
          <OwnFoodsView showSnackbar={showSnackbar} />
        </View>
      ) : null}

      <Snackbar ref={snackbarRef} />
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
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1,
    minHeight: spacing.xxl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.surface,
  },
  tabActive: { borderBottomColor: colors.primary },
  tabLabel: { ...typography.body2, color: colors.textMuted, textAlign: 'center' },
  tabLabelActive: { color: colors.primary, fontWeight: '600' },
  pane: { flex: 1 },
  hidden: { display: 'none' },
});
