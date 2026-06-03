// RecipeCreateScreen — Create or edit a recipe with ingredients, steps, tags, and image upload
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RecipeIngredient, RecipeStep } from '@fittrack/shared';
import { randomUUID } from 'expo-crypto';
import { colors, radius, spacing, typography } from '../../app/theme';
import { recipeApi } from '../../shared/api/recipeApi';
import type { RecipeStackParamList } from '../../app/navigation/RootNavigator';
import AddIngredientModal from './AddIngredientModal';

type Props = NativeStackScreenProps<RecipeStackParamList, 'RecipeCreate'>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEmptyStep(order: number): RecipeStep {
  return { order, description: '' };
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function RecipeCreateScreen({ route, navigation }: Props) {
  const editId = route.params?.editId ?? null;
  const isEdit = editId != null;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [portions, setPortions] = useState('4');
  const [tags, setTags] = useState('');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [steps, setSteps] = useState<RecipeStep[]>([buildEmptyStep(1)]);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
  const [pendingImageMime, setPendingImageMime] = useState<'image/jpeg' | 'image/png'>('image/jpeg');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [addIngredientVisible, setAddIngredientVisible] = useState(false);

  const load = useCallback(async () => {
    if (!editId) return;
    try {
      const data = await recipeApi.get(editId);
      setName(data.name);
      setDescription(data.description ?? '');
      setPortions(String(data.portions));
      setTags(data.tags.join(', '));
      setIngredients(data.ingredients);
      setSteps(data.steps.length > 0 ? data.steps : [buildEmptyStep(1)]);
    } catch {
      Alert.alert('Fehler', 'Rezept konnte nicht geladen werden.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [editId, navigation]);

  useEffect(() => { load(); }, [load]);

  // --- Image picker ---
  const handlePickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Berechtigung', 'Kamerazugriff erforderlich.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPendingImageUri(asset.uri);
      setPendingImageMime(asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg');
    }
  };

  // --- Ingredient management ---
  const handleAddIngredient = (ingredient: RecipeIngredient) => {
    setIngredients((prev) => [...prev, ingredient]);
  };

  const handleRemoveIngredient = (id: string) => {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
  };

  // --- Step management ---
  const handleAddStep = () => {
    setSteps((prev) => [...prev, buildEmptyStep(prev.length + 1)]);
  };

  const handleUpdateStep = (index: number, field: keyof RecipeStep, value: string | number | undefined) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    );
  };

  const handleRemoveStep = (index: number) => {
    setSteps((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, order: i + 1 })),
    );
  };

  // --- Save ---
  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name fehlt', 'Bitte gib dem Rezept einen Namen.');
      return;
    }
    const parsedPortions = parseFloat(portions);
    if (!Number.isFinite(parsedPortions) || parsedPortions <= 0) {
      Alert.alert('Portionen', 'Bitte gib eine gültige Anzahl Portionen ein.');
      return;
    }
    const validSteps = steps.filter((s) => s.description.trim().length > 0);
    const parsedTags = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      let recipe;
      if (isEdit && editId) {
        recipe = await recipeApi.update(editId, {
          name: name.trim(),
          description: description.trim() || undefined,
          portions: parsedPortions,
          ingredients,
          steps: validSteps,
          tags: parsedTags,
        });
      } else {
        recipe = await recipeApi.create({
          name: name.trim(),
          description: description.trim() || undefined,
          portions: parsedPortions,
          ingredients,
          steps: validSteps,
          tags: parsedTags,
        });
      }

      // Upload pending image if any
      if (pendingImageUri) {
        await recipeApi.uploadImage(recipe.id, pendingImageUri, pendingImageMime);
      }

      navigation.goBack();
    } catch {
      Alert.alert('Fehler', 'Rezept konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.cancel}>Abbrechen</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEdit ? 'Rezept bearbeiten' : 'Neues Rezept'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving
              ? <ActivityIndicator color={colors.primary} />
              : <Text style={styles.save}>Speichern</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Basic info */}
          <Text style={styles.sectionTitle}>Grunddaten</Text>
          <TextInput
            style={styles.input}
            placeholder="Name des Rezepts *"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Beschreibung (optional)"
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Portionen</Text>
              <TextInput
                style={styles.input}
                placeholder="4"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={portions}
                onChangeText={setPortions}
              />
            </View>
            <View style={{ flex: 2, marginLeft: spacing.sm }}>
              <Text style={styles.label}>Tags (kommagetrennt)</Text>
              <TextInput
                style={styles.input}
                placeholder="Vegetarisch, Brot, …"
                placeholderTextColor={colors.textMuted}
                value={tags}
                onChangeText={setTags}
              />
            </View>
          </View>

          {/* Image */}
          <Text style={styles.sectionTitle}>Foto</Text>
          {pendingImageUri ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: pendingImageUri }} style={styles.imagePreview} resizeMode="cover" />
              <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => setPendingImageUri(null)}>
                <Text style={styles.imageRemoveText}>Entfernen</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.imagePickerBtn} onPress={handlePickImage}>
              <Text style={styles.imagePickerText}>+ Foto hinzufügen</Text>
            </TouchableOpacity>
          )}

          {/* Ingredients */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Zutaten</Text>
            <TouchableOpacity onPress={() => setAddIngredientVisible(true)}>
              <Text style={styles.addLink}>+ Hinzufügen</Text>
            </TouchableOpacity>
          </View>
          {ingredients.length === 0 && (
            <Text style={styles.emptyHint}>Noch keine Zutaten hinzugefügt.</Text>
          )}
          {ingredients.map((ing) => (
            <View key={ing.id} style={styles.ingredientRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ingredientName}>{ing.displayName}</Text>
                <Text style={styles.ingredientMeta}>
                  {ing.inputAmount}{ing.unit} · {Math.round(ing.nutritionContribution.calories)} kcal
                  {ing.isAiEstimate ? ' · KI' : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleRemoveIngredient(ing.id)}>
                <Text style={styles.removeText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* Steps */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Zubereitung</Text>
            <TouchableOpacity onPress={handleAddStep}>
              <Text style={styles.addLink}>+ Schritt</Text>
            </TouchableOpacity>
          </View>
          {steps.map((step, i) => (
            <View key={i} style={styles.stepContainer}>
              <View style={styles.stepHeader}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{step.order}</Text>
                </View>
                {steps.length > 1 && (
                  <TouchableOpacity onPress={() => handleRemoveStep(i)}>
                    <Text style={styles.removeText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                style={styles.input}
                placeholder="Titel des Schritts (optional)"
                placeholderTextColor={colors.textMuted}
                value={step.title ?? ''}
                onChangeText={(v) => handleUpdateStep(i, 'title', v)}
              />
              <TextInput
                style={[styles.input, styles.multiline]}
                placeholder="Anleitung *"
                placeholderTextColor={colors.textMuted}
                value={step.description}
                onChangeText={(v) => handleUpdateStep(i, 'description', v)}
                multiline
                numberOfLines={3}
              />

            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>

      <AddIngredientModal
        visible={addIngredientVisible}
        onClose={() => setAddIngredientVisible(false)}
        onAdd={(ing) => { handleAddIngredient(ing); setAddIngredientVisible(false); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.h3, color: colors.text },
  cancel: { ...typography.body1, color: colors.textSecondary },
  save: { ...typography.button, color: colors.primary },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },
  sectionTitle: {
    ...typography.overline,
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: spacing.lg },
  addLink: { ...typography.button, color: colors.primary, marginBottom: 4 },
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  input: {
    ...typography.body1,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  imagePreviewContainer: { marginBottom: spacing.sm },
  imagePreview: { width: '100%', height: 180, borderRadius: radius.md },
  imageRemoveBtn: { marginTop: spacing.xs },
  imageRemoveText: { ...typography.body2, color: colors.negative },
  imagePickerBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  imagePickerText: { ...typography.body2, color: colors.textMuted },
  emptyHint: { ...typography.body2, color: colors.textMuted, marginBottom: spacing.sm },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  ingredientName: { ...typography.body2, color: colors.text, fontWeight: '600' },
  ingredientMeta: { ...typography.caption, color: colors.textMuted },
  removeText: { ...typography.body1, color: colors.negative, paddingHorizontal: spacing.sm },
  stepContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  stepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: { ...typography.caption, color: colors.primaryBright, fontWeight: '700' },
});
