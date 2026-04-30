// WeightDetailScreen — first real product slice.
// Lets the user log a new weight entry and view past entries (newest first).
//
// Auth: backend currently uses a fixed dev-user. When real JWT auth lands
// (M2), the apiClient will start sending the Bearer token automatically;
// this screen needs no changes.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { addWeight, deleteWeight, listWeights } from '../../services/weightsService';
import type { WeightEntry } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';

export default function WeightDetailScreen() {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await listWeights();
      setEntries(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load entries';
      setError(message);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const onSave = useCallback(async () => {
    const normalized = input.replace(',', '.').trim();
    const value = Number(normalized);
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert('Invalid weight', 'Please enter a positive number (e.g. 78.5).');
      return;
    }
    Keyboard.dismiss();
    setSaving(true);
    try {
      const created = await addWeight({ value, unit: 'kg' });
      setEntries((prev) => [created, ...prev]);
      setInput('');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save entry';
      Alert.alert('Save failed', message);
    } finally {
      setSaving(false);
    }
  }, [input]);

  const onDelete = useCallback((entry: WeightEntry) => {
    Alert.alert(
      'Delete entry?',
      `${entry.date} — ${entry.value.toFixed(1)} ${entry.unit}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Optimistic removal; restore on failure.
            const previous = entries;
            setEntries((prev) => prev.filter((e) => e.id !== entry.id));
            try {
              await deleteWeight(entry.id);
            } catch (e) {
              setEntries(previous);
              const message = e instanceof Error ? e.message : 'Failed to delete entry';
              Alert.alert('Delete failed', message);
            }
          },
        },
      ],
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Weight Tracking</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="78.5"
          placeholderTextColor={colors.textDisabled}
          keyboardType="decimal-pad"
          editable={!saving}
        />
        <Text style={styles.unit}>kg</Text>
        <TouchableOpacity
          style={[styles.button, (saving || !input) && styles.buttonDisabled]}
          onPress={onSave}
          disabled={saving || !input}
        >
          <Text style={styles.buttonLabel}>{saving ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={entries.length === 0 ? styles.emptyContainer : styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No entries yet. Log your first weight above.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.entryRow}>
              <Text style={styles.entryDate}>{item.date}</Text>
              <View style={styles.entryRight}>
                <Text style={styles.entryValue}>
                  {item.value.toFixed(1)} {item.unit}
                </Text>
                <TouchableOpacity
                  onPress={() => onDelete(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete entry from ${item.date}`}
                >
                  <Text style={styles.deleteLabel}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  input: {
    flex: 1,
    ...typography.body1,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  unit: {
    ...typography.body2,
    color: colors.textSecondary,
    marginRight: spacing.md,
  },
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  buttonDisabled: {
    backgroundColor: colors.textDisabled,
  },
  buttonLabel: {
    ...typography.button,
    color: colors.white,
  },
  error: {
    ...typography.body2,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  loader: {
    marginTop: spacing.lg,
  },
  listContent: {
    paddingBottom: spacing.lg,
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  entryDate: {
    ...typography.body1,
    color: colors.text,
  },
  entryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  entryValue: {
    ...typography.body1,
    color: colors.primary,
    fontWeight: '600',
  },
  deleteLabel: {
    ...typography.body2,
    color: colors.error,
    fontWeight: '600',
  },
  separator: {
    height: spacing.sm,
  },
});
