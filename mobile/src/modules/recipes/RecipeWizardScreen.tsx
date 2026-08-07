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
import { aiApi, type AiFoodEstimatePreview, type AiRecipeStep, type MealParserPreviewItem } from '../../shared/api/aiApi';
import { recipeApi } from '../../shared/api/recipeApi';
import AddIngredientModal from './AddIngredientModal';
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

// ---------------------------------------------------------------------------
// Build helpers
// ---------------------------------------------------------------------------

function buildIngFromCandidate(
  id: string,
  item: MealParserPreviewItem,
  candidate: FoodSearchResult,
): RecipeIngredient {
  const portionWeightGrams = candidate.portion?.weightGrams;
  const portionLabel = candidate.portion?.label;
  const hasPortions = portionWeightGrams != null && portionWeightGrams > 0;

  // If the AI parser already determined a portion-based input and the product
  // has portion data, preserve that. Otherwise default to grams.
  const inputMode: 'grams' | 'portion' =
    item.inputMode === 'portion' && hasPortions ? 'portion' : 'grams';

  const inputAmount = item.inputAmount ?? (hasPortions && inputMode === 'portion' ? 1 : 100);
  const amountGrams = inputMode === 'portion'
    ? inputAmount * portionWeightGrams!
    : (item.amountGrams ?? inputAmount);

  const raw = candidate.nutritionPer100g;
  const n = {
    calories: raw?.calories ?? 0,
    protein: raw?.protein ?? 0,
    carbs: raw?.carbs ?? 0,
    fat: raw?.fat ?? 0,
    fiber: raw?.fiber ?? 0,
  };
  const scale = amountGrams / 100;
  return {
    id,
    displayName: candidate.name,
    inputMode,
    inputAmount,
    amountGrams,
    unit: inputMode === 'portion' ? (portionLabel ?? 'Portion') : 'g',
    linkedProductId: candidate.id,
    linkedReusableItemId: null,
    isAiEstimate: false,
    portionWeightGrams: hasPortions ? portionWeightGrams : undefined,
    portionLabel: hasPortions ? (portionLabel ?? 'Portion') : undefined,
    nutritionPer100g: n,
    nutritionContribution: {
      calories: Math.round(n.calories * scale * 10) / 10,
      protein: Math.round(n.protein * scale * 10) / 10,
      carbs: Math.round(n.carbs * scale * 10) / 10,
      fat: Math.round(n.fat * scale * 10) / 10,
      fiber: Math.round(n.fiber * scale * 10) / 10,
    },
  };
}

function buildIngFromSeasoning(id: string, item: MealParserPreviewItem): RecipeIngredient {
  const amountGrams = item.amountGrams ?? 0;
  const zero = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  return {
    id,
    displayName: item.displayName,
    inputMode: 'grams',
    inputAmount: amountGrams,
    amountGrams,
    unit: 'g',
    linkedProductId: null,
    linkedReusableItemId: null,
    isAiEstimate: false,
    category: 'seasoning',
    nutritionPer100g: zero,
    nutritionContribution: zero,
  };
}

function buildIngFromAiEstimate(
  id: string,
  item: MealParserPreviewItem,
  estimate: AiFoodEstimatePreview,
): RecipeIngredient {
  const amountGrams = item.amountGrams ?? item.inputAmount ?? 100;
  const e = estimate.estimatedNutritionPer100g;
  const n = {
    calories: e.calories,
    protein: e.protein,
    carbs: e.carbs,
    fat: e.fat,
    fiber: e.fiber ?? 0,
  };
  const scale = amountGrams / 100;
  return {
    id,
    displayName: estimate.displayName,
    inputMode: item.inputMode === 'grams' ? 'grams' : 'portion',
    inputAmount: item.inputAmount ?? amountGrams,
    amountGrams,
    unit: item.inputMode === 'grams' ? 'g' : 'Stück',
    linkedProductId: null,
    linkedReusableItemId: null,
    isAiEstimate: true,
    nutritionPer100g: n,
    nutritionContribution: {
      calories: Math.round(n.calories * scale * 10) / 10,
      protein: Math.round(n.protein * scale * 10) / 10,
      carbs: Math.round(n.carbs * scale * 10) / 10,
      fat: Math.round(n.fat * scale * 10) / 10,
      fiber: Math.round(n.fiber * scale * 10) / 10,
    },
  };
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
  const [expandedIngId, setExpandedIngId] = useState<string | null>(null);
  const [addIngredientVisible, setAddIngredientVisible] = useState(false);
  const [replacingIngId, setReplacingIngId] = useState<string | null>(null);

  // Steps
  const [steps, setSteps] = useState<WizardStepItem[]>([]);

  // Image
  const [pendingImages, setPendingImages] = useState<Array<{ uri: string; mime: 'image/jpeg' | 'image/png' }>>([]);

  // Save
  const [saving, setSaving] = useState(false);

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

  const handleSelectCandidate = (ingId: string, candidate: FoodSearchResult) => {
    setIngredients((prev) =>
      prev.map((ing) => {
        if (ing.id !== ingId) return ing;
        const resolved = buildIngFromCandidate(ing.id, ing.parserItem, candidate);
        return { ...ing, status: 'confirmed', resolvedIngredient: resolved };
      }),
    );
    // Initialize amount editor with defaults from the resolved ingredient
    setIngredients((prev) => {
      const ing = prev.find((i) => i.id === ingId);
      if (ing?.resolvedIngredient) {
        const ri = ing.resolvedIngredient;
        setAmountEdits((e) => ({
          ...e,
          [ingId]: { mode: ri.inputMode, value: String(ri.inputAmount) },
        }));
      }
      return prev;
    });
    setExpandedIngId(null);
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
    setIngredients((prev) => prev.filter((i) => i.id !== ingId));
    setAmountEdits((prev) => { const next = { ...prev }; delete next[ingId]; return next; });
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

  const handleAddManualIngredient = (ingredient: RecipeIngredient) => {
    const replacingIsSeasoning = replacingIngId
      ? ingredients.find((i) => i.id === replacingIngId)?.status === 'seasoning'
      : false;
    const finalIngredient = replacingIsSeasoning
      ? { ...ingredient, category: 'food' as const }
      : ingredient;
    const wi: WizardIngredient = {
      id: finalIngredient.id,
      parserItem: {
        rawText: finalIngredient.displayName,
        displayName: finalIngredient.displayName,
        status: 'matched',
        selectedProductId: finalIngredient.linkedProductId,
        selectedProductName: finalIngredient.displayName,
        candidates: [],
        inputMode: finalIngredient.inputMode,
        inputAmount: finalIngredient.inputAmount,
        amountGrams: finalIngredient.amountGrams,
        needsReview: false,
        warnings: [],
      },
      status: 'confirmed',
      resolvedIngredient: finalIngredient,
    };
    const newEdit = { mode: finalIngredient.inputMode, value: String(finalIngredient.inputAmount) };
    setAmountEdits((e) => ({ ...e, [finalIngredient.id]: newEdit }));
    if (replacingIngId) {
      setIngredients((prev) => prev.map((i) => i.id === replacingIngId ? wi : i));
      setReplacingIngId(null);
    } else {
      setIngredients((prev) => [...prev, wi]);
    }
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

  const confirmedIngredients = ingredients
    .filter((i) => i.status === 'confirmed' || i.status === 'auto-matched' || i.status === 'seasoning')
    .map((i) => i.resolvedIngredient!)
    .filter(Boolean);

  const allIngredientsResolved =
    ingredients.length === 0 ||
    ingredients.every((i) => i.status === 'confirmed' || i.status === 'auto-matched' || i.status === 'seasoning');

  const liveNutrition =
    confirmedIngredients.length > 0 && portions > 0
      ? calculateRecipeNutrition(confirmedIngredients, portions)
      : null;

  // ---------------------------------------------------------------------------
  // Analyzing screen
  // ---------------------------------------------------------------------------

  if (phase === 'analyzing') {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.analyzingTitle}>KI analysiert dein Rezept…</Text>
        <Text style={styles.analyzingSubtext}>Das kann einige Sekunden dauern.</Text>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container}>
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
              <View style={styles.progressRow}>
                <View style={styles.progressPill}>
                  <Text style={styles.progressText}>
                    {confirmedIngredients.length} von {ingredients.length} bestätigt
                  </Text>
                </View>
              </View>

              {ingredients.length === 0 && (
                <Text style={styles.emptyHint}>
                  Keine Zutaten erkannt. Füge sie manuell hinzu.
                </Text>
              )}

              {ingredients.map((ing) => {
                const isExpanded = expandedIngId === ing.id;
                const isResolved =
                  ing.status === 'confirmed' || ing.status === 'auto-matched' || ing.status === 'seasoning';

                return (
                  <View
                    key={ing.id}
                    style={[styles.card, isResolved && styles.cardResolved]}
                  >
                    {/* Card header */}
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.cardTitleRow}>
                          <Text style={styles.cardTitle}>{ing.parserItem.displayName}</Text>
                          {ing.status === 'seasoning' && (
                            <View style={styles.seasoningBadge}>
                              <Text style={styles.seasoningBadgeText}>Gewürz</Text>
                            </View>
                          )}
                        </View>
                        {ing.parserItem.inputAmount != null && (
                          <Text style={styles.cardMeta}>
                            {ing.parserItem.inputAmount}
                            {ing.parserItem.inputMode === 'grams' ? ' g' : ' Stk.'}
                            {ing.resolvedIngredient
                              ? ` · ${Math.round(ing.resolvedIngredient.nutritionContribution.calories)} kcal`
                              : ''}
                          </Text>
                        )}
                      </View>
                      {isResolved && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                      {!isResolved && ing.status !== 'ai-estimating' && (
                        <TouchableOpacity onPress={() => handleRemoveIngredient(ing.id)}>
                          <Text style={styles.removeText}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Resolved row */}
                    {isResolved && ing.resolvedIngredient && (() => {
                      const ri = ing.resolvedIngredient;
                      const edit = amountEdits[ing.id] ?? { mode: ri.inputMode, value: String(ri.inputAmount) };
                      const hasPortions = ri.portionWeightGrams != null && ri.portionWeightGrams > 0;
                      return (
                        <>
                          <View style={styles.resolvedRow}>
                            <Text style={styles.resolvedName} numberOfLines={1}>
                              {ri.isAiEstimate ? '✦ KI-Schätzung' : ri.displayName}
                            </Text>
                            <TouchableOpacity onPress={() => { setReplacingIngId(ing.id); setAddIngredientVisible(true); }}>
                              <Text style={styles.changeLink}>Ersetzen</Text>
                            </TouchableOpacity>
                            {ing.status !== 'seasoning' && (
                              <TouchableOpacity onPress={() => handleRemoveIngredient(ing.id)}>
                                <Text style={styles.changeLink}>Entfernen</Text>
                              </TouchableOpacity>
                            )}
                          </View>

                          {/* g / Portion toggle — only when portion data is available */}
                          {hasPortions && (
                            <View style={styles.segmentedControl}>
                              <TouchableOpacity
                                style={[styles.segment, edit.mode === 'grams' && styles.segmentActive]}
                                onPress={() => handleUpdateIngredientAmount(ing.id, 'grams', '100')}
                              >
                                <Text style={[styles.segmentText, edit.mode === 'grams' && styles.segmentTextActive]}>Gramm</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.segment, edit.mode === 'portion' && styles.segmentActive]}
                                onPress={() => handleUpdateIngredientAmount(ing.id, 'portion', '1')}
                              >
                                <Text style={[styles.segmentText, edit.mode === 'portion' && styles.segmentTextActive]}>
                                  {ri.portionLabel ?? 'Portion'}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          )}

                          {/* Amount input */}
                          <View style={styles.amountRow}>
                            <TextInput
                              style={[styles.amountInput, ing.status === 'seasoning' && styles.amountInputReadOnly]}
                              value={edit.value}
                              onChangeText={(v) => handleUpdateIngredientAmount(ing.id, edit.mode, v)}
                              keyboardType="decimal-pad"
                              selectTextOnFocus
                              editable={ing.status !== 'seasoning'}
                            />
                            <Text style={styles.amountUnit}>
                              {edit.mode === 'grams' ? 'g' : (ri.portionLabel ?? 'Portion')}
                            </Text>
                            <Text style={styles.amountKcal}>
                              {Math.round(ri.nutritionContribution.calories)} kcal
                            </Text>
                          </View>

                          {/* Hint: 1 Portion = X g */}
                          {edit.mode === 'portion' && ri.portionWeightGrams != null && (
                            <Text style={styles.portionHint}>
                              1 {ri.portionLabel ?? 'Portion'} = {ri.portionWeightGrams} g
                            </Text>
                          )}
                        </>
                      );
                    })()}

                    {/* Needs AI estimate */}
                    {ing.status === 'needs-ai' && (
                      <TouchableOpacity
                        style={styles.aiBtn}
                        onPress={() => handleAiEstimate(ing.id)}
                      >
                        <Text style={styles.aiBtnText}>✦ KI-Schätzung verwenden</Text>
                      </TouchableOpacity>
                    )}

                    {/* AI estimating */}
                    {ing.status === 'ai-estimating' && (
                      <View style={styles.estimatingRow}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={styles.estimatingText}>Schätze Nährwerte…</Text>
                      </View>
                    )}

                    {/* Needs selection */}
                    {ing.status === 'needs-selection' && (
                      <>
                        <View style={styles.selectionActionRow}>
                          <TouchableOpacity
                            style={styles.candidateToggleBtn}
                            onPress={() =>
                              setExpandedIngId(isExpanded ? null : ing.id)
                            }
                          >
                            <Text style={styles.candidateToggleText}>
                              {isExpanded
                                ? '▲ Treffer verbergen'
                                : `▼ ${ing.parserItem.candidates.length} Treffer wählen`}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.aiBtn}
                            onPress={() => handleAiEstimate(ing.id)}
                          >
                            <Text style={styles.aiBtnText}>✦ KI</Text>
                          </TouchableOpacity>
                        </View>

                        {isExpanded &&
                          ing.parserItem.candidates.map((c) => (
                            <TouchableOpacity
                              key={c.id}
                              style={styles.candidateRow}
                              onPress={() => handleSelectCandidate(ing.id, c)}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={styles.candidateName}>{c.name}</Text>
                                <Text style={styles.candidateMeta}>{c.displayLabel}</Text>
                              </View>
                              <Text style={styles.candidateArrow}>›</Text>
                            </TouchableOpacity>
                          ))}
                      </>
                    )}
                  </View>
                );
              })}

              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => setAddIngredientVisible(true)}
              >
                <Text style={styles.addBtnText}>+ Zutat hinzufügen</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  !allIngredientsResolved && styles.primaryBtnDisabled,
                ]}
                onPress={() => setPhase('steps')}
                disabled={!allIngredientsResolved}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryBtnText}>Weiter zu den Schritten →</Text>
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
      </KeyboardAvoidingView>

      <AddIngredientModal
        visible={addIngredientVisible}
        onClose={() => { setAddIngredientVisible(false); setReplacingIngId(null); }}
        onAdd={(ing) => {
          handleAddManualIngredient(ing);
          setAddIngredientVisible(false);
        }}
        replacingIngId={replacingIngId}
      />
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
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },

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

  // Progress pill
  progressRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  progressPill: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  progressText: { ...typography.caption, color: colors.primaryBright, fontWeight: '600' },

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
  seasoningBadge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    marginLeft: spacing.xs,
  },
  seasoningBadgeText: { ...typography.overline, color: colors.textMuted },
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  resolvedName: {
    ...typography.caption,
    color: colors.primary,
    flex: 1,
    marginRight: spacing.sm,
  },
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

  // Selection action row
  selectionActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  candidateToggleBtn: { flex: 1, marginRight: spacing.sm },
  candidateToggleText: { ...typography.caption, color: colors.textSecondary },

  // Candidate list
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
  },
  candidateName: { ...typography.body2, color: colors.text, fontWeight: '600' },
  candidateMeta: { ...typography.caption, color: colors.textMuted },
  candidateArrow: { ...typography.h3, color: colors.textMuted, marginLeft: spacing.sm },

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
});
