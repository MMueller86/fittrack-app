// RecipeCreateScreen — Create or edit a recipe with ingredients, steps, tags, and image upload
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RecipeIngredient, RecipeStep } from '@fittrack/shared';
import { randomUUID } from 'expo-crypto';
import { colors, radius, spacing, typography } from '../../app/theme';
import { recipeApi } from '../../shared/api/recipeApi';
import type { RecipeStackParamList } from '../../app/navigation/RootNavigator';
import { useFoodEntryHubStore } from '../nutrition/hub/useFoodEntryHubStore';
import { buildFromProduct } from './ingredientBuilders';
import { formatRecipeIngredientAmount } from './recipePreviewViewModel';
import { QuantityInputRow } from '../../shared/components/QuantityInputRow';

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
  const [amountEdits, setAmountEdits] = useState<Record<string, { mode: 'grams' | 'portion'; value: string }>>({});
  const openHub = useFoodEntryHubStore((s) => s.open);

  const load = useCallback(async () => {
    if (!editId) return;
    try {
      const data = await recipeApi.get(editId);
      setName(data.name);
      setDescription(data.description ?? '');
      setPortions(String(data.portions));
      setTags(data.tags.join(', '));
      setIngredients(data.ingredients);
      const edits: Record<string, { mode: 'grams' | 'portion'; value: string }> = {};
      for (const ing of data.ingredients) {
        edits[ing.id] = { mode: ing.inputMode, value: String(ing.inputAmount) };
      }
      setAmountEdits(edits);
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
    setAmountEdits((prev) => ({ ...prev, [ingredient.id]: { mode: ingredient.inputMode, value: String(ingredient.inputAmount) } }));
    setIngredients((prev) => [...prev, ingredient]);
  };

  const handleRemoveIngredient = (id: string) => {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
    setAmountEdits((prev) => { const next = { ...prev }; delete next[id]; return next; });
  };

  const handleUpdateIngredientAmount = (ingId: string, mode: 'grams' | 'portion', rawValue: string) => {
    setAmountEdits((prev) => ({ ...prev, [ingId]: { mode, value: rawValue } }));
    const num = parseFloat(rawValue.replace(',', '.'));
    if (!Number.isFinite(num) || num <= 0) return;
    setIngredients((prev) =>
      prev.map((ing) => {
        if (ing.id !== ingId) return ing;
        const portionWeightGrams = ing.portionWeightGrams;
        const amountGrams = mode === 'portion' && portionWeightGrams ? num * portionWeightGrams : num;
        const scale = amountGrams / 100;
        const n = ing.nutritionPer100g;
        return {
          ...ing,
          inputMode: mode,
          inputAmount: num,
          amountGrams,
          unit: mode === 'portion' ? (ing.portionLabel ?? 'Portion') : 'g',
          nutritionContribution: {
            calories: Math.round(n.calories * scale * 10) / 10,
            protein: Math.round(n.protein * scale * 10) / 10,
            carbs: Math.round(n.carbs * scale * 10) / 10,
            fat: Math.round(n.fat * scale * 10) / 10,
            fiber: Math.round(n.fiber * scale * 10) / 10,
          },
        };
      }),
    );
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
            <TouchableOpacity onPress={() => openHub({ onSelectIngredient: (product, mode, amount) => handleAddIngredient(buildFromProduct(product, mode, amount)) })}>
              <Text style={styles.addLink}>+ Hinzufügen</Text>
            </TouchableOpacity>
          </View>
          {ingredients.length === 0 && (
            <Text style={styles.emptyHint}>Noch keine Zutaten hinzugefügt.</Text>
          )}
          {ingredients.map((ing) => {
            const edit = amountEdits[ing.id] ?? { mode: ing.inputMode, value: String(ing.inputAmount) };
            const amountLabel = formatRecipeIngredientAmount(ing);
            return (
              <View key={ing.id} style={styles.ingredientCard}>
                <View style={styles.ingredientCardHeader}>
                  <View style={styles.ingredientNameBlock}>
                    <Text style={styles.ingredientName} numberOfLines={1}>{ing.displayName}</Text>
                    {ing.category === 'seasoning' && (
                      <View style={styles.seasoningMeta}>
                        <Text style={styles.seasoningLabel}>Gewürz</Text>
                        {amountLabel != null && (
                          <Text style={styles.seasoningAmount}>{amountLabel}</Text>
                        )}
                      </View>
                    )}
                  </View>
                  <View style={styles.ingredientCardActions}>
                    <TouchableOpacity onPress={() => {
                      const idToReplace = ing.id;
                      openHub({
                        onSelectIngredient: (product, mode, amount) => {
                          const replacement = buildFromProduct(product, mode, amount);
                          setAmountEdits((prev) => {
                            const next = { ...prev };
                            delete next[idToReplace];
                            return { ...next, [replacement.id]: { mode: replacement.inputMode, value: String(replacement.inputAmount) } };
                          });
                          setIngredients((prev) => prev.map((i) => i.id === idToReplace ? replacement : i));
                        },
                      });
                    }}>
                      <Text style={styles.replaceText}>Ersetzen</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleRemoveIngredient(ing.id)}>
                      <Text style={styles.removeText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {ing.category === 'seasoning' ? null : (
                  <QuantityInputRow
                    nutritionPer100g={ing.nutritionPer100g}
                    portionWeightGrams={ing.portionWeightGrams}
                    portionLabel={ing.portionLabel}
                    mode={edit.mode}
                    value={edit.value}
                    onChange={(m, v) => handleUpdateIngredientAmount(ing.id, m, v)}
                  />
                )}
              </View>
            );
          })}

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
  ingredientCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  ingredientCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  ingredientCardActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ingredientNameBlock: { flex: 1, minWidth: 0, paddingRight: spacing.sm },
  ingredientName: { ...typography.body2, color: colors.text, fontWeight: '600' },
  seasoningMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  seasoningLabel: { ...typography.caption, color: colors.textMuted },
  seasoningAmount: { ...typography.caption, color: colors.primaryBright },
  replaceText: { ...typography.caption, color: colors.primary },
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
