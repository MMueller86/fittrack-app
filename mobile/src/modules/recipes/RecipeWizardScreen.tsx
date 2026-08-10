// RecipeWizardScreen — AI-powered recipe creation wizard
// Flow: input → analyzing → ingredients (resolve) → steps (review) → preview (save)
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
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
import { randomUUID } from 'expo-crypto';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { FoodSearchResult, RecipeIngredient } from '@fittrack/shared';
import { calculateRecipeNutrition, calculateNutrition } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { aiApi, type AiRecipeStep, type MealParserPreviewItem } from '../../shared/api/aiApi';
import { recipeApi } from '../../shared/api/recipeApi';
import { buildFromProduct, buildIngFromCandidate, buildIngFromAiEstimate, buildIngFromSeasoning } from './ingredientBuilders';
import { useFoodEntryHubStore } from '../nutrition/hub/useFoodEntryHubStore';
import { Snackbar, useSnackbar } from '../../shared/components/Snackbar';
import { Icon } from '../../shared/components/Icon';
import { DiaryItemRow } from '../../shared/components/DiaryItemRow';
import type { RecipeStackParamList } from '../../app/navigation/RootNavigator';

type Props = NativeStackScreenProps<RecipeStackParamList, 'RecipeWizard'>;

type WizardPhase = 'input' | 'analyzing' | 'ingredients' | 'steps' | 'preview';
type IngStatus = 'auto-matched' | 'needs-selection' | 'needs-ai' | 'ai-estimating' | 'confirmed' | 'seasoning';

interface WizardIngredient {
  id: string;
  parserItem: MealParserPreviewItem;
  status: IngStatus;
  resolvedIngredient?: RecipeIngredient;
}

interface WizardStepItem {
  id: string;
  title: string;
  description: string;
}

function initWizardIngredient(item: MealParserPreviewItem): WizardIngredient {
  const id = randomUUID();
  if (item.status === 'matched' && item.selectedProductId) {
    const candidate = item.candidates.find((c) => c.id === item.selectedProductId);
    if (candidate) {
      return {
        id,
        parserItem: item,
        status: 'auto-matched',
        resolvedIngredient: buildIngFromCandidate(id, item, candidate),
      };
    }
  }
  if (item.status === 'seasoning') {
    return { id, parserItem: item, status: 'seasoning', resolvedIngredient: buildIngFromSeasoning(id, item) };
  }
  if (item.status === 'needsSelection') {
    return { id, parserItem: item, status: 'needs-selection' };
  }
  return { id, parserItem: item, status: 'needs-ai' };
}

// ---------------------------------------------------------------------------
// SeasoningRow — compact row for auto-recognised seasoning ingredients
// ---------------------------------------------------------------------------

interface SeasoningRowProps {
  ing: WizardIngredient;
  onRemove: (id: string) => void;
}

function SeasoningRow({ ing, onRemove }: SeasoningRowProps) {
  const kitchenText = ing.parserItem.kitchenAmountText ?? '';
  return (
    <View style={styles.seasoningRow}>
      <Text style={styles.seasoningName} numberOfLines={1}>
        {ing.parserItem.displayName}
      </Text>
      {kitchenText.length > 0 && (
        <Text style={styles.seasoningAmount}>{kitchenText}</Text>
      )}
      <TouchableOpacity
        style={styles.seasoningRemoveBtn}
        onPress={() => onRemove(ing.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Icon lib="ion" name="close" size="sm" color={colors.negative} />
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const PHASE_PREV: Record<WizardPhase, WizardPhase> = {
  input: 'input',
  analyzing: 'input',
  ingredients: 'input',
  steps: 'ingredients',
  preview: 'steps',
};

const PHASE_TITLES: Record<WizardPhase, string> = {
  input: 'Rezept beschreiben',
  analyzing: 'KI analysiert…',
  ingredients: 'Zutaten bestätigen',
  steps: 'Zubereitungsschritte',
  preview: 'Rezeptvorschau',
};

export default function RecipeWizardScreen({ navigation }: Props) {
  const [phase, setPhase] = useState<WizardPhase>('input');
  const [inputText, setInputText] = useState('');

  // Recipe metadata (filled from AI analysis)
  const [recipeName, setRecipeName] = useState('');
  const [recipeDescription, setRecipeDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [portions, setPortions] = useState(4);

  // Ingredients
  const [ingredients, setIngredients] = useState<WizardIngredient[]>([]);
  // Steps
  const [steps, setSteps] = useState<WizardStepItem[]>([]);

  // Image
  const [pendingImages, setPendingImages] = useState<Array<{ uri: string; mime: 'image/jpeg' | 'image/png' }>>([]);

  // Save
  const [saving, setSaving] = useState(false);
  const { ref: snackbarRef, show: showSnackbar } = useSnackbar();
  const openHub = useFoodEntryHubStore((s) => s.open);

  const [seasoningsExpanded, setSeasoningsExpanded] = useState(false);

  // Amount editor state per resolved ingredient: { mode, value }
  type AmountMode = 'grams' | 'portion';
  const [amountEdits, setAmountEdits] = useState<Record<string, { mode: AmountMode; value: string }>>({});

  // ---------------------------------------------------------------------------
  // Back handling
  // ---------------------------------------------------------------------------

  const handleBack = useCallback(() => {
    if (phase === 'input') {
      navigation.goBack();
      return true;
    }
    if (phase === 'analyzing') return true; // block back while analyzing

    Alert.alert(
      'Zurück?',
      phase === 'ingredients'
        ? 'Die KI-Analyse geht verloren. Fortfahren?'
        : 'Nicht gespeicherter Fortschritt geht verloren.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Zurück', style: 'destructive', onPress: () => setPhase(PHASE_PREV[phase]) },
      ],
    );
    return true;
  }, [phase, navigation]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => sub.remove();
  }, [handleBack]);

  // ---------------------------------------------------------------------------
  // Analysis
  // ---------------------------------------------------------------------------

  const runAnalysis = useCallback(async () => {
    setPhase('analyzing');
    try {
      const result = await aiApi.analyzeRecipe(inputText.trim());
      setRecipeName(result.suggestedName);
      setRecipeDescription(result.description);
      setPortions(Math.max(1, result.suggestedPortions));
      setTags(result.tags);
      const wizardIngredients = result.ingredients.map(initWizardIngredient);
      setIngredients(wizardIngredients);
      // Initialize amount editors for all auto-matched ingredients
      const initialEdits: Record<string, { mode: 'grams' | 'portion'; value: string }> = {};
      for (const wi of wizardIngredients) {
        if (wi.resolvedIngredient) {
          initialEdits[wi.id] = {
            mode: wi.resolvedIngredient.inputMode,
            value: String(wi.resolvedIngredient.inputAmount),
          };
        }
      }
      setAmountEdits(initialEdits);
      setSteps(
        result.steps.map((s: AiRecipeStep) => ({
          id: randomUUID(),
          title: s.title ?? '',
          description: s.description,
        })),
      );
      setPhase('ingredients');

      // Auto-batch AI estimate for all unmatched ingredients
      const needsAi = wizardIngredients.filter((wi) => wi.status === 'needs-ai');
      if (needsAi.length > 0) {
        setIngredients((prev) =>
          prev.map((wi) => wi.status === 'needs-ai' ? { ...wi, status: 'ai-estimating' } : wi),
        );
        try {
          const batchResults = await aiApi.estimateFoodBatch(
            needsAi.map((wi) => ({ name: wi.parserItem.displayName })),
          );
          setIngredients((prev) => {
            const updated = [...prev];
            needsAi.forEach((wi, idx) => {
              const estimate = batchResults[idx];
              const i = updated.findIndex((u) => u.id === wi.id);
              if (i === -1 || !estimate) return;
              if (estimate.confidence === 0) {
                updated[i] = { ...updated[i]!, status: 'needs-ai' };
                return;
              }
              const resolved = buildIngFromAiEstimate(wi.id, wi.parserItem, estimate);
              updated[i] = { ...updated[i]!, status: 'confirmed', resolvedIngredient: resolved };
              setAmountEdits((e) => ({ ...e, [wi.id]: { mode: resolved.inputMode, value: String(resolved.inputAmount) } }));
            });
            return updated;
          });
        } catch (err) {
          console.error('[RecipeWizard] batch AI estimate failed:', err);
          setIngredients((prev) =>
            prev.map((wi) => wi.status === 'ai-estimating' ? { ...wi, status: 'needs-ai' } : wi),
          );
        }
      }
    } catch (err: unknown) {
      console.error('[RecipeWizard] analyzeRecipe failed:', err);
      let detail = '';
      if (err != null && typeof err === 'object' && 'response' in err) {
        const resp = (err as { response?: { status?: number; data?: { error?: string } } }).response;
        detail = ` (HTTP ${resp?.status ?? '?'})`;
        console.error('[RecipeWizard] Analysis HTTP response:', resp?.status, resp?.data);
      } else if (err instanceof Error) {
        detail = `\n${err.message}`;
      }
      Alert.alert('Fehler', `Rezept konnte nicht analysiert werden.${detail}`);
      setPhase('input');
    }
  }, [inputText]);

  // ---------------------------------------------------------------------------
  // Ingredient actions
  // ---------------------------------------------------------------------------

  const handleSelectViaHub = (ingId: string, product: FoodSearchResult, mode: 'grams' | 'portion', amount: number) => {
    const ingredient = buildFromProduct(product, mode, amount);
    setIngredients(prev => prev.map(i => i.id !== ingId ? i : {
      ...i,
      status: 'confirmed',
      resolvedIngredient: { ...ingredient, id: ingId },
    }));
    setAmountEdits(e => ({ ...e, [ingId]: { mode, value: String(amount) } }));
  };

  const handleAiEstimate = async (ingId: string) => {
    const ing = ingredients.find((i) => i.id === ingId);
    if (!ing) return;
    setIngredients((prev) =>
      prev.map((i) => (i.id === ingId ? { ...i, status: 'ai-estimating' } : i)),
    );
    try {
      const estimate = await aiApi.estimateFood({ name: ing.parserItem.displayName });
      const resolved = buildIngFromAiEstimate(ingId, ing.parserItem, estimate);
      setAmountEdits((e) => ({ ...e, [ingId]: { mode: resolved.inputMode, value: String(resolved.inputAmount) } }));
      setIngredients((prev) =>
        prev.map((i) => {
          if (i.id !== ingId) return i;
          return { ...i, status: 'confirmed', resolvedIngredient: resolved };
        }),
      );
    } catch (err: unknown) {
      console.error('[RecipeWizard] AI estimate failed for', ing.parserItem.displayName, err);
      let message = `KI-Schätzung für „${ing.parserItem.displayName}" fehlgeschlagen.`;
      if (err != null && typeof err === 'object' && 'response' in err) {
        const resp = (err as { response?: { status?: number; data?: { error?: string; feature?: string } } }).response;
        const status = resp?.status;
        console.error('[RecipeWizard] AI estimate HTTP response:', status, resp?.data);
        if (status === 429) {
          message = 'KI-Kontingent erschöpft. Bitte warte bis zum nächsten Monat oder upgrade deinen Account.';
        } else {
          message += ` (HTTP ${status ?? '?'})`;
        }
      } else if (err instanceof Error) {
        console.error('[RecipeWizard] AI estimate error:', err.message);
        message += `\n${err.message}`;
      }
      Alert.alert('Fehler', message);
      setIngredients((prev) =>
        prev.map((i) => (i.id === ingId ? { ...i, status: 'needs-ai' } : i)),
      );
    }
  };

  const handleRemoveIngredient = (ingId: string) => {
    const ing = ingredients.find(i => i.id === ingId);
    if (!ing) return;
    const originalIndex = ingredients.findIndex(i => i.id === ingId);
    const capturedAmountEdit = amountEdits[ingId];

    setIngredients(prev => prev.filter(i => i.id !== ingId));
    setAmountEdits(prev => {
      const next = { ...prev };
      delete next[ingId];
      return next;
    });

    showSnackbar({
      message: `„${ing.parserItem.displayName}“ entfernt`,
      undoLabel: 'Rückgängig',
      onUndo: () => {
        setIngredients(prev => {
          const next = [...prev];
          next.splice(originalIndex, 0, ing);
          return next;
        });
        if (capturedAmountEdit !== undefined) {
          setAmountEdits(prev => ({ ...prev, [ingId]: capturedAmountEdit }));
        }
      },
      durationMs: 3500,
    });
  };

  const handleUpdateIngredientAmount = (ingId: string, mode: 'grams' | 'portion', rawValue: string) => {
    setAmountEdits((prev) => ({ ...prev, [ingId]: { mode, value: rawValue } }));
    const num = parseFloat(rawValue.replace(',', '.'));
    if (!Number.isFinite(num) || num <= 0) return;
    setIngredients((prev) =>
      prev.map((ing) => {
        if (ing.id !== ingId || !ing.resolvedIngredient) return ing;
        const ri = ing.resolvedIngredient;
        const portionWeightGrams = ri.portionWeightGrams;
        const amountGrams = mode === 'portion' && portionWeightGrams
          ? num * portionWeightGrams
          : num;
        const scale = amountGrams / 100;
        const n = ri.nutritionPer100g;
        return {
          ...ing,
          resolvedIngredient: {
            ...ri,
            inputMode: mode,
            inputAmount: num,
            amountGrams,
            unit: mode === 'portion' ? (ri.portionLabel ?? 'Portion') : 'g',
            nutritionContribution: {
              calories: Math.round(n.calories * scale * 10) / 10,
              protein: Math.round(n.protein * scale * 10) / 10,
              carbs: Math.round(n.carbs * scale * 10) / 10,
              fat: Math.round(n.fat * scale * 10) / 10,
              fiber: Math.round(n.fiber * scale * 10) / 10,
            },
          },
        };
      }),
    );
  };

  const handleAddManualViaHub = (product: FoodSearchResult, mode: 'grams' | 'portion', amount: number) => {
    const ingredient = buildFromProduct(product, mode, amount);
    const wi: WizardIngredient = {
      id: ingredient.id,
      parserItem: {
        rawText: ingredient.displayName,
        displayName: ingredient.displayName,
        status: 'matched',
        selectedProductId: ingredient.linkedProductId,
        selectedProductName: ingredient.displayName,
        candidates: [],
        inputMode: ingredient.inputMode,
        inputAmount: ingredient.inputAmount,
        amountGrams: ingredient.amountGrams,
        needsReview: false,
        warnings: [],
      },
      status: 'confirmed',
      resolvedIngredient: ingredient,
    };
    setAmountEdits(e => ({ ...e, [ingredient.id]: { mode, value: String(amount) } }));
    setIngredients(prev => [...prev, wi]);
  };

  const handleReplaceViaHub = (ingId: string, product: FoodSearchResult, mode: 'grams' | 'portion', amount: number) => {
    const ingredient = buildFromProduct(product, mode, amount);
    setIngredients(prev => prev.map(i => i.id !== ingId ? i : {
      ...i,
      status: 'confirmed',
      resolvedIngredient: { ...ingredient, id: ingId },
    }));
    setAmountEdits(e => ({ ...e, [ingId]: { mode, value: String(amount) } }));
  };

  // ---------------------------------------------------------------------------
  // Step actions
  // ---------------------------------------------------------------------------

  const handleAddStep = () =>
    setSteps((prev) => [
      ...prev,
      { id: randomUUID(), title: '', description: '' },
    ]);

  const handleUpdateStep = (id: string, field: keyof WizardStepItem, value: string) =>
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));

  const handleRemoveStep = (id: string) =>
    setSteps((prev) => prev.filter((s) => s.id !== id));

  // ---------------------------------------------------------------------------
  // Image picker
  // ---------------------------------------------------------------------------

  const handlePickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Berechtigung', 'Zugriff auf Fotos erforderlich.');
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
      const mime = asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
      setPendingImages((prev) => [...prev, { uri: asset.uri, mime }]);
    }
  };

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const handleSave = async () => {
    if (!recipeName.trim()) {
      Alert.alert('Name fehlt', 'Bitte gib dem Rezept einen Namen.');
      return;
    }
    const confirmedIngredients = ingredients
      .filter((i) => i.status === 'confirmed' || i.status === 'auto-matched' || i.status === 'seasoning')
      .map((i) => i.resolvedIngredient!)
      .filter(Boolean);

    const finalSteps = steps
      .filter((s) => s.description.trim().length > 0)
      .map((s, idx) => ({
        order: idx + 1,
        title: s.title.trim() || undefined,
        description: s.description.trim(),
      }));

    setSaving(true);
    let savedRecipeId: string | null = null;
    try {
      const recipe = await recipeApi.create({
        name: recipeName.trim(),
        description: recipeDescription.trim() || undefined,
        portions,
        ingredients: confirmedIngredients,
        steps: finalSteps,
        tags,
      });
      savedRecipeId = recipe.id;
    } catch (err: unknown) {
      console.error('[RecipeWizard] Save failed:', err);
      let detail = '';
      if (err != null && typeof err === 'object' && 'response' in err) {
        const resp = (err as { response?: { status?: number; data?: { error?: string } } }).response;
        detail = `\n(${resp?.status ?? '?'})${resp?.data?.error ? ' ' + resp.data.error : ''}`;
        console.error('[RecipeWizard] HTTP', resp?.status, resp?.data);
      } else if (err instanceof Error) {
        detail = `\n${err.message}`;
      }
      Alert.alert('Fehler', `Rezept konnte nicht gespeichert werden.${detail}`);
      setSaving(false);
      return;
    }

    // Upload images sequentially — non-blocking: navigate even if some fail
    const failedUploads: number[] = [];
    for (let i = 0; i < pendingImages.length; i++) {
      const img = pendingImages[i]!;
      try {
        await recipeApi.uploadImage(savedRecipeId, img.uri, img.mime);
      } catch (err) {
        console.error(`[RecipeWizard] Image upload ${i + 1} failed:`, err);
        failedUploads.push(i + 1);
      }
    }

    setSaving(false);
    navigation.replace('RecipeDetail', { id: savedRecipeId });

    if (failedUploads.length > 0) {
      Alert.alert(
        'Fotos nicht hochgeladen',
        `Foto ${failedUploads.join(', ')} konnte nicht hochgeladen werden. Prüfe die Speicher-Konfiguration (STORAGE_CONNECTION_STRING).`,
      );
    }
  };

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const seasoningIngredients = ingredients.filter(i => i.status === 'seasoning');
  const mainIngredients = ingredients.filter(i => i.status !== 'seasoning');

  const confirmedIngredients = ingredients
    .filter((i) => i.status === 'confirmed' || i.status === 'auto-matched' || i.status === 'seasoning')
    .map((i) => i.resolvedIngredient!)
    .filter(Boolean);

  const allIngredientsResolved =
    ingredients.length > 0 &&
    ingredients.every((i) => i.status === 'confirmed' || i.status === 'auto-matched' || i.status === 'seasoning');

  const liveNutrition =
    confirmedIngredients.length > 0 && portions > 0
      ? calculateRecipeNutrition(confirmedIngredients, portions)
      : null;

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container}>
      {phase === 'analyzing' ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.analyzingTitle}>KI analysiert dein Rezept…</Text>
          <Text style={styles.analyzingSubtext}>Das kann einige Sekunden dauern.</Text>
        </View>
      ) : <>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.headerBack}>‹ Zurück</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {PHASE_TITLES[phase]}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >

          {/* ================================================================
              PHASE: input
          ================================================================ */}
          {phase === 'input' && (
            <View>
              <Text style={styles.intro}>
                Beschreibe dein Rezept in eigenen Worten — Zutaten, Mengen, Zubereitungsschritte.
                Tippfehler und Stichpunkte sind kein Problem, die KI strukturiert alles für dich.
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={'Z. B.:\nSpaghetti Bolognese für 4 Personen\n500g Hackfleisch, 2 Dosen Tomaten, 1 Zwiebel, Knoblauch\nZwiebeln und Knoblauch anbraten, Hack dazugeben, Tomaten rein, 30 min köcheln…'}
                placeholderTextColor={colors.textMuted}
                value={inputText}
                onChangeText={setInputText}
                multiline
                numberOfLines={10}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  inputText.trim().length < 10 && styles.primaryBtnDisabled,
                ]}
                onPress={runAnalysis}
                disabled={inputText.trim().length < 10}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryBtnText}>✦ Rezept analysieren</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ================================================================
              PHASE: ingredients
          ================================================================ */}
          {phase === 'ingredients' && (
            <View>
              <Text style={styles.ingredientsIntro}>
                Prüfe die erkannten Hauptzutaten und ordne sie bei Bedarf zu. Gewürze werden automatisch übernommen.
              </Text>
              {(() => {
                const pendingCount = ingredients.filter(
                  i => i.status === 'needs-selection' || i.status === 'needs-ai'
                ).length;
                const estimatingCount = ingredients.filter(i => i.status === 'ai-estimating').length;
                const confirmedCount = ingredients.filter(
                  i => i.status === 'confirmed' || i.status === 'auto-matched' || i.status === 'seasoning'
                ).length;
                const total = ingredients.length;
                if (total === 0) return null;
                if (pendingCount > 0) {
                  return (
                    <View style={styles.statusPill}>
                      <Text style={styles.statusPillText}>{pendingCount} ausstehend · {confirmedCount}/{total}</Text>
                    </View>
                  );
                }
                if (estimatingCount > 0) {
                  return (
                    <View style={styles.statusPill}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.statusPillText}>KI schätzt…</Text>
                    </View>
                  );
                }
                return (
                  <View style={styles.statusPill}>
                    <Text style={[styles.statusPillText, { color: colors.primary }]}>Alle {total} Zutaten bereit ✓</Text>
                  </View>
                );
              })()}

              {ingredients.length === 0 && (
                <Text style={styles.emptyHint}>
                  Keine Zutaten erkannt. Füge sie manuell hinzu.
                </Text>
              )}

              {/* Automatisch erkannt — collapsible seasoning section */}
              {seasoningIngredients.length > 0 && (
                <>
                  <TouchableOpacity
                    style={styles.seasoningHeader}
                    onPress={() => setSeasoningsExpanded(v => !v)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.seasoningHeaderTitle}>
                      Automatisch erkannt ({seasoningIngredients.length})
                    </Text>
                    <Icon
                      lib="ion"
                      name={seasoningsExpanded ? 'chevron-up' : 'chevron-down'}
                      size="sm"
                      color={colors.textMuted}
                    />
                  </TouchableOpacity>
                  {seasoningsExpanded && seasoningIngredients.map(ing => (
                    <SeasoningRow key={ing.id} ing={ing} onRemove={handleRemoveIngredient} />
                  ))}
                </>
              )}

              {mainIngredients.map((ing) => {
                if (ing.status === 'confirmed' || ing.status === 'auto-matched') {
                  const ri = ing.resolvedIngredient!;
                  const edit = amountEdits[ing.id];
                  const amountLabel =
                    edit?.mode === 'portion'
                      ? `${edit.value} Portion${parseFloat(edit.value ?? '1') !== 1 ? 'en' : ''}`
                      : `${Math.round(parseFloat(edit?.value ?? '0'))} g`;
                  return (
                    <DiaryItemRow
                      key={ing.id}
                      name={ri.displayName}
                      amountLabel={amountLabel}
                      kcal={ri.nutritionContribution.calories}
                      protein={ri.nutritionContribution.protein}
                      aiBadgeLabel={ri.isAiEstimate ? '✦ KI-Schätzung' : undefined}
                      onPress={() => openHub({
                        initialQuery: ing.parserItem.displayName,
                        prefillAmount: ing.parserItem.inputAmount != null && ing.parserItem.inputMode !== 'unknown'
                          ? { mode: ing.parserItem.inputMode as 'grams' | 'portion', amount: ing.parserItem.inputAmount }
                          : null,
                        onSelectIngredient: (product, mode, amount) => handleSelectViaHub(ing.id, product, mode, amount),
                      })}
                    />
                  );
                }

                if (ing.status === 'ai-estimating') {
                  return (
                    <View key={ing.id} style={styles.ingredientHintRow}>
                      <Text style={styles.ingredientHintName}>{ing.parserItem.displayName}</Text>
                      <ActivityIndicator size="small" />
                    </View>
                  );
                }

                return (
                  <TouchableOpacity
                    key={ing.id}
                    style={styles.ingredientHintRow}
                    onPress={() => openHub({
                      initialQuery: ing.parserItem.displayName,
                      prefillAmount: ing.parserItem.inputAmount != null && ing.parserItem.inputMode !== 'unknown'
                        ? { mode: ing.parserItem.inputMode as 'grams' | 'portion', amount: ing.parserItem.inputAmount }
                        : null,
                      onSelectIngredient: (product, mode, amount) => handleSelectViaHub(ing.id, product, mode, amount),
                    })}
                  >
                    <Text style={styles.ingredientHintName}>{ing.parserItem.displayName}</Text>
                    <Text style={styles.ingredientHintAction}>Tippen zum Zuordnen</Text>

                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => openHub({
                  onSelectIngredient: (product, mode, amount) => {
                    handleAddManualViaHub(product, mode, amount);
                  },
                })}
              >
                <Text style={styles.addBtnText}>+ Zutat hinzufügen</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ================================================================
              PHASE: steps
          ================================================================ */}
          {phase === 'steps' && (
            <View>
              <Text style={styles.intro}>
                Überprüfe und bearbeite die Zubereitungsschritte. Leere Schritte werden beim Speichern ignoriert.
              </Text>

              {steps.length === 0 && (
                <Text style={styles.emptyHint}>
                  Noch keine Schritte vorhanden. Füge sie manuell hinzu.
                </Text>
              )}

              {steps.map((step, idx) => (
                <View key={step.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepBadgeText}>{idx + 1}</Text>
                    </View>
                    <TextInput
                      style={styles.stepTitleInput}
                      placeholder="Schritt-Titel (optional)"
                      placeholderTextColor={colors.textMuted}
                      value={step.title}
                      onChangeText={(v) => handleUpdateStep(step.id, 'title', v)}
                    />
                    <TouchableOpacity onPress={() => handleRemoveStep(step.id)}>
                      <Text style={styles.removeText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={[styles.input, styles.multilineSmall]}
                    placeholder="Anleitung *"
                    placeholderTextColor={colors.textMuted}
                    value={step.description}
                    onChangeText={(v) => handleUpdateStep(step.id, 'description', v)}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              ))}

              <TouchableOpacity style={styles.addBtn} onPress={handleAddStep}>
                <Text style={styles.addBtnText}>+ Schritt hinzufügen</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => setPhase('preview')}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryBtnText}>Weiter zur Vorschau →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ================================================================
              PHASE: preview
          ================================================================ */}
          {phase === 'preview' && (
            <View>
              {/* Editable name */}
              <TextInput
                style={styles.previewNameInput}
                value={recipeName}
                onChangeText={setRecipeName}
                placeholder="Rezeptname"
                placeholderTextColor={colors.textMuted}
              />

              {/* Tags */}
              {tags.length > 0 && (
                <View style={styles.tagsRow}>
                  {tags.map((tag) => (
                    <View key={tag} style={styles.tagChip}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Description */}
              {recipeDescription.length > 0 && (
                <Text style={styles.previewDescription}>{recipeDescription}</Text>
              )}

              {/* Portions stepper */}
              <View style={styles.portionsRow}>
                <Text style={styles.portionsLabel}>Portionen</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setPortions((p) => Math.max(1, p - 1))}
                  >
                    <Text style={styles.stepperBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{portions}</Text>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setPortions((p) => p + 1)}
                  >
                    <Text style={styles.stepperBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Macro chips */}
              {liveNutrition && (
                <View style={styles.macroRow}>
                  {[
                    {
                      label: 'Kalorien',
                      value: `${Math.round(liveNutrition.nutritionPerPortion.calories)}`,
                      unit: 'kcal',
                    },
                    {
                      label: 'Protein',
                      value: `${Math.round(liveNutrition.nutritionPerPortion.protein)}`,
                      unit: 'g',
                    },
                    {
                      label: 'Kohlenhydr.',
                      value: `${Math.round(liveNutrition.nutritionPerPortion.carbs)}`,
                      unit: 'g',
                    },
                    {
                      label: 'Fett',
                      value: `${Math.round(liveNutrition.nutritionPerPortion.fat)}`,
                      unit: 'g',
                    },
                  ].map((m) => (
                    <View key={m.label} style={styles.macroChip}>
                      <Text style={styles.macroValue}>
                        {m.value}
                        <Text style={styles.macroUnit}> {m.unit}</Text>
                      </Text>
                      <Text style={styles.macroLabel}>{m.label}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Photo */}
              <Text style={styles.sectionLabel}>Fotos ({pendingImages.length})</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
                {pendingImages.map((img, idx) => (
                  <View key={idx} style={styles.imageThumbnailContainer}>
                    <Image source={{ uri: img.uri }} style={styles.imageThumbnail} resizeMode="cover" />
                    <TouchableOpacity
                      style={styles.imageThumbnailRemove}
                      onPress={() => setPendingImages((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Text style={styles.imageThumbnailRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.imagePickerThumb} onPress={handlePickImage}>
                  <Text style={styles.imagePickerText}>+ Foto</Text>
                </TouchableOpacity>
              </ScrollView>

              {/* Ingredients */}
              <Text style={styles.sectionLabel}>
                Zutaten ({confirmedIngredients.length})
              </Text>
              {confirmedIngredients.map((ing) => (
                <View key={ing.id} style={styles.previewIngRow}>
                  <View style={styles.previewIngDot} />
                  <Text style={styles.previewIngText}>
                    {ing.displayName}
                    {'  —  '}
                    {ing.inputAmount}
                    {ing.unit}
                    {ing.isAiEstimate ? '  · KI' : ''}
                  </Text>
                </View>
              ))}

              {/* Steps */}
              {steps.filter((s) => s.description.trim().length > 0).length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>Zubereitung</Text>
                  {steps
                    .filter((s) => s.description.trim().length > 0)
                    .map((s, idx) => (
                      <View key={s.id} style={styles.previewStep}>
                        <View style={styles.previewStepBadge}>
                          <Text style={styles.previewStepBadgeText}>{idx + 1}</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: spacing.md }}>
                          {s.title.trim().length > 0 && (
                            <Text style={styles.previewStepTitle}>{s.title}</Text>
                          )}
                          <Text style={styles.previewStepDesc}>{s.description}</Text>
                        </View>
                      </View>
                    ))}
                </>
              )}

              {/* Save button */}
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  styles.saveBtn,
                  (saving || !recipeName.trim()) && styles.primaryBtnDisabled,
                ]}
                onPress={handleSave}
                disabled={saving || !recipeName.trim()}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>Rezept speichern</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
        {phase === 'ingredients' && (
          <View style={styles.stickyFooter}>
            <TouchableOpacity
              style={[styles.primaryBtn, !allIngredientsResolved && styles.primaryBtnDisabled]}
              onPress={() => setPhase('steps')}
              disabled={!allIngredientsResolved}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>Zur Zubereitung →</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
      </>}

      <Snackbar ref={snackbarRef} />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBack: { ...typography.body1, color: colors.primary, minWidth: 60 },
  headerTitle: { ...typography.h3, color: colors.text, flex: 1, textAlign: 'center' },

  // Scroll
  scroll: { padding: spacing.md, paddingBottom: spacing.md },

  // Analyzing
  analyzingTitle: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  analyzingSubtext: {
    ...typography.body2,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },

  // Intro text
  intro: {
    ...typography.body2,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 22,
  },

  // Input
  input: {
    ...typography.body1,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  textArea: {
    minHeight: 200,
    textAlignVertical: 'top',
  },
  multilineSmall: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Primary button
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  primaryBtnDisabled: { backgroundColor: colors.border },
  primaryBtnText: { ...typography.button, color: colors.white },

  // Save button extra margin
  saveBtn: { marginTop: spacing.xl },

  // Sticky footer (ingredients phase CTA)
  stickyFooter: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },

  // Ingredients phase
  ingredientsIntro: {
    ...typography.body2,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  statusPill: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginBottom: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusPillText: { ...typography.caption, color: colors.primaryBright, fontWeight: '600' },

  // Empty hint
  emptyHint: {
    ...typography.body2,
    color: colors.textMuted,
    marginBottom: spacing.md,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },

  // Ingredient / Step card
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardResolved: { borderColor: colors.primary },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardTitleRow: { flexDirection: 'row' as const, alignItems: 'center' as const },
  cardTitle: { ...typography.body1, color: colors.text, fontWeight: '600' },
  cardMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  ingOverline: { ...typography.overline, color: colors.textMuted, marginBottom: 2 },
  ingDisplayName: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  seasoningHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  seasoningHeaderTitle: {
    ...typography.body2,
    color: colors.textSecondary,
    fontWeight: '600' as const,
  },
  seasoningBadge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    marginLeft: spacing.xs,
  },
  seasoningBadgeText: { ...typography.overline, color: colors.textMuted },
  seasoningRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  seasoningName: {
    flex: 1,
    ...typography.body2,
    color: colors.text,
  },
  seasoningAmount: {
    ...typography.body2,
    color: colors.textMuted,
  },
  seasoningReplaceBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 32,
  },
  seasoningReplaceBtnText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600' as const,
  },
  seasoningRemoveBtn: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    minHeight: 32,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  seasoningRemoveBtnText: {
    ...typography.caption,
    color: colors.negative,
    fontWeight: '600' as const,
  },
  amountInputReadOnly: { opacity: 0.5 },
  checkmark: { ...typography.h3, color: colors.primary, marginLeft: spacing.sm },
  removeText: {
    ...typography.body1,
    color: colors.negative,
    paddingHorizontal: spacing.sm,
  },

  // Resolved row
  resolvedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  resolvedOverline: { ...typography.overline, color: colors.textMuted, marginTop: spacing.xs, marginBottom: 2 },
  resolvedProductName: { ...typography.body2, color: colors.text },
  aiBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    alignSelf: 'flex-start' as const,
    marginTop: 2,
  },
  aiBadgeText: { ...typography.caption, color: colors.primary },
  changeLink: { ...typography.caption, color: colors.negative },

  // Amount editor
  segmentedControl: {
    flexDirection: 'row' as const,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
    overflow: 'hidden' as const,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.xs,
    alignItems: 'center' as const,
  },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' as const },
  segmentTextActive: { color: colors.white },
  amountRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  amountInput: {
    ...typography.body1,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    minWidth: 70,
    textAlign: 'center' as const,
  },
  amountUnit: { ...typography.body2, color: colors.textSecondary },
  amountKcal: { ...typography.caption, color: colors.textMuted, marginLeft: 'auto' as const },
  portionHint: { ...typography.caption, color: colors.textMuted, marginTop: 2 },

  // Status description
  statusDesc: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  statusDescRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  aiExplainText: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },

  // AI button
  aiBtn: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  aiBtnText: { ...typography.caption, color: colors.primaryBright, fontWeight: '600' },

  // Estimating row
  estimatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  estimatingText: { ...typography.caption, color: colors.textMuted, marginLeft: spacing.sm },

  // Add button
  addBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  addBtnText: { ...typography.body2, color: colors.textSecondary },

  // Step badge (in step editor)
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  stepBadgeText: { ...typography.caption, color: colors.primaryBright, fontWeight: '700' },
  stepTitleInput: {
    ...typography.body2,
    color: colors.text,
    flex: 1,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginRight: spacing.sm,
  },

  // Preview — name
  previewNameInput: {
    ...typography.h1,
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
    marginBottom: spacing.md,
  },

  // Preview — tags
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  tagChip: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  tagText: { ...typography.caption, color: colors.primaryBright, fontWeight: '600' },

  // Preview — description
  previewDescription: {
    ...typography.body2,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },

  // Preview — portions stepper
  portionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  portionsLabel: { ...typography.body1, color: colors.text },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: { ...typography.h3, color: colors.text, lineHeight: 30 },
  stepperValue: { ...typography.h3, color: colors.text, minWidth: 24, textAlign: 'center' },

  // Preview — macro chips
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: spacing.md,
    gap: spacing.xs,
  },
  macroChip: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  macroValue: { ...typography.body1, color: colors.text, fontWeight: '700' },
  macroUnit: { ...typography.caption, color: colors.textMuted, fontWeight: '400' },
  macroLabel: { ...typography.caption, color: colors.textMuted, marginTop: 2 },

  // Preview — section label
  sectionLabel: {
    ...typography.overline,
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    letterSpacing: 1.1,
  },

  // Preview — image thumbnails
  imageThumbnailContainer: {
    position: 'relative',
    marginRight: spacing.sm,
  },
  imageThumbnail: {
    width: 100,
    height: 100,
    borderRadius: radius.md,
  },
  imageThumbnailRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageThumbnailRemoveText: {
    color: colors.white,
    fontSize: 11,
    lineHeight: 14,
  },
  imagePickerThumb: {
    width: 100,
    height: 100,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePickerText: { ...typography.caption, color: colors.textMuted },

  // Preview — ingredient list
  previewIngRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  previewIngDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginRight: spacing.sm,
  },
  previewIngText: { ...typography.body2, color: colors.text },

  // Preview — step list
  previewStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  previewStepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  previewStepBadgeText: { ...typography.body2, color: colors.primaryBright, fontWeight: '700' },
  previewStepTitle: {
    ...typography.body1,
    color: colors.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  previewStepDesc: { ...typography.body2, color: colors.textSecondary, lineHeight: 22 },

  // Action buttons for ingredient cards
  actionRow: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  replaceBtn: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center' as const,
  },
  replaceBtnText: {
    ...typography.body2,
    color: colors.primary,
    fontWeight: '600' as const,
  },
  removeBtn: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.negative,
    justifyContent: 'center' as const,
  },
  removeBtnText: {
    ...typography.body2,
    color: colors.negative,
    fontWeight: '600' as const,
  },

  // Compact hint rows for unresolved ingredients
  ingredientHintRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: spacing.sm + 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ingredientHintName: { ...typography.body2, color: colors.text, fontWeight: '600' as const, flex: 1 },
  ingredientHintAction: { ...typography.caption, color: colors.primary, flexShrink: 0, marginLeft: spacing.xs },
});
