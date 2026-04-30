// HomeScreen — branded landing surface.
// Shows the app logo, a welcome line, and a Weight summary card that
// links to WeightDetailScreen. Other modules (Nutrition, Recipes,
// Profile) live in their own bottom-tabs and are out of scope here.

import React, { useCallback, useState } from 'react';
import {
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { HomeStackParamList } from '../../app/navigation/RootNavigator';
import { colors, spacing, typography } from '../../app/theme';
import { Logo } from '../../shared/components/Logo';
import { WeightSummaryCard } from '../../shared/components/WeightSummaryCard';
import { listWeights } from '../../services/weightsService';
import type { WeightEntry } from '@fittrack/shared';

type Props = NativeStackScreenProps<HomeStackParamList, 'HomeMain'>;

export default function HomeScreen({ navigation }: Props) {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listWeights();
      setEntries(data);
    } catch {
      // Silent on home: WeightDetailScreen surfaces real errors.
      setEntries([]);
    }
  }, []);

  // Re-fetch every time the screen regains focus (after add/delete on detail).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        await load();
        if (!cancelled) setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // listWeights returns newest-first; index 0 = latest, 1 = previous.
  const latest = entries[0];
  const previous = entries[1];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.brand}>
          <Logo size={140} />
          <Text style={styles.welcome}>Welcome back</Text>
          <Text style={styles.tagline}>Ernährung. Training. Fortschritt.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Today</Text>
          <WeightSummaryCard
            latest={latest}
            previous={previous}
            loading={loading}
            onPress={() => navigation.navigate('WeightDetail')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  brand: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  welcome: {
    ...typography.h1,
    color: colors.text,
    marginTop: spacing.sm,
  },
  tagline: {
    ...typography.caption,
    color: colors.primaryBright,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  section: {
    marginTop: spacing.sm,
  },
  sectionLabel: {
    ...typography.overline,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
});
