// RecipeWizardScreen — AI-powered recipe creation wizard
// Flow: input → analyzing → ingredients (resolve) → steps (review) → preview (save)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { randomUUID } from 'expo-crypto';
import { useSharedValue } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AiFoodEstimatePreview, FoodSearchResult } from '@fittrack/shared';
import { calculateRecipeNutrition } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { aiApi, type AiRecipeStep, type MealParserPreviewItem } from '../../shared/api/aiApi';
import { recipeApi } from '../../shared/api/recipeApi';
import { buildFromProduct, buildIngFromCandidate, buildWizardIngredientFromAiEstimate, buildIngFromSeasoning } from './ingredientBuilders';
import { buildRecipePreviewViewModel } from './recipePreviewViewModel';
import { useFoodEntryHubStore } from '../nutrition/hub/useFoodEntryHubStore';
import { Snackbar, useSnackbar } from '../../shared/components/Snackbar';
import { ConfirmSheet } from '../../shared/components/ConfirmSheet';
import { InfoOverlay } from '../../shared/components/InfoOverlay';
import type { RecipeStackParamList } from '../../app/navigation/RootNavigator';
import { RecipeWizardInputPhase } from './RecipeWizardInputPhase';
import { RecipeWizardIngredientsPhase } from './RecipeWizardIngredientsPhase';
import { RecipeWizardPreviewPhase } from './RecipeWizardPreviewPhase';
import { RecipeWizardStepsPhase } from './RecipeWizardStepsPhase';
import type {
  AmountEdit,
  PendingWizardImage,
  WizardIngredient,
  WizardPhase,
  WizardStepItem,
} from './recipeWizardTypes';

type Props = NativeStackScreenProps<RecipeStackParamList, 'RecipeWizard'>;

function calculateStepDropIndex(
  steps: WizardStepItem[],
  stepId: string,
  translationY: number,
  heights: Record<string, number>,
) {
  const sourceIndex = steps.findIndex((step) => step.id === stepId);
  if (sourceIndex < 0) return 0;

  const getHeight = (id: string) => heights[id] ?? spacing.xxl * 3;
  let currentTop = 0;
  const stepCenters: number[] = [];
  for (const step of steps) {
    const height = getHeight(step.id);
    stepCenters.push(currentTop + height / 2);
    currentTop += height + spacing.md;
  }

  const sourceCenter = stepCenters[sourceIndex];
  if (sourceCenter == null) return sourceIndex + 1;
  const draggedCenter = sourceCenter + translationY;
  let crossedIndex = sourceIndex;

  if (translationY >= 0) {
    while (
      crossedIndex < steps.length - 1
      && draggedCenter > (stepCenters[crossedIndex + 1] ?? Number.POSITIVE_INFINITY)
    ) {
      crossedIndex += 1;
    }
    return crossedIndex + 1;
  }

  while (
    crossedIndex > 0
    && draggedCenter < (stepCenters[crossedIndex - 1] ?? Number.NEGATIVE_INFINITY)
  ) {
    crossedIndex -= 1;
  }
  return crossedIndex;
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
        userConfirmed: false,
        resolvedIngredient: buildIngFromCandidate(id, item, candidate),
      };
    }
  }
  if (item.status === 'seasoning') {
    return {
      id,
      parserItem: item,
      status: 'seasoning',
      userConfirmed: true,
      resolvedIngredient: buildIngFromSeasoning(id, item),
    };
  }
  if (item.status === 'needsSelection') {
    return { id, parserItem: item, status: 'needs-selection', userConfirmed: false };
  }
  return { id, parserItem: item, status: 'needs-ai', userConfirmed: false };
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
  const [reviewHelpVisible, setReviewHelpVisible] = useState(false);
  const hasMeaningfulRecipeText = inputText.trim().length >= 10;

  // Recipe metadata (filled from AI analysis)
  const [recipeName, setRecipeName] = useState('');
  const [recipeDescription, setRecipeDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [portions, setPortions] = useState(4);

  // Ingredients
  const [ingredients, setIngredients] = useState<WizardIngredient[]>([]);
  // Steps
  const [steps, setSteps] = useState<WizardStepItem[]>([]);
  const stepHeightsRef = useRef<Record<string, number>>({});
  const [draggingStepId, setDraggingStepId] = useState<string | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const lastDropTargetRef = useRef<number | null>(null);
  const stepsScrollRef = useRef<ScrollView>(null);
  const stepsScrollOffsetRef = useRef(0);
  const stepsScrollContentHeightRef = useRef(0);
  const stepsScrollViewportHeightRef = useRef(0);
  const dragStartScrollOffsetRef = useRef(0);
  const stepDragActiveRef = useRef(false);
  const stepAutoScrollDirectionRef = useRef<-1 | 0 | 1>(0);
  const stepAutoScrollFrameRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const activeStepDragIdRef = useRef<string | null>(null);
  const activeStepTranslationYRef = useRef(0);
  const dragScrollAdjustment = useSharedValue(0);
  const { height: windowHeight } = useWindowDimensions();

  // Image
  const [pendingImages, setPendingImages] = useState<PendingWizardImage[]>([]);

  // Save
  const [saving, setSaving] = useState(false);
  const { ref: snackbarRef, show: showSnackbar } = useSnackbar();
  const openHub = useFoodEntryHubStore((s) => s.open);

  const [seasoningsExpanded, setSeasoningsExpanded] = useState(false);
  const [backConfirmVisible, setBackConfirmVisible] = useState(false);

  // Amount editor state per resolved ingredient: { mode, value }
  const [amountEdits, setAmountEdits] = useState<Record<string, AmountEdit>>({});

  // ---------------------------------------------------------------------------
  // Back handling
  // ---------------------------------------------------------------------------

  const handleBack = useCallback(() => {
    if (phase === 'input') {
      navigation.goBack();
      return true;
    }
    if (phase === 'analyzing') return true; // block back while analyzing

    setBackConfirmVisible(true);
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

  const handleAnalyzePress = useCallback(() => {
    if (!hasMeaningfulRecipeText) return;
    Keyboard.dismiss();
    setTimeout(() => {
      void runAnalysis();
    }, 0);
  }, [hasMeaningfulRecipeText, runAnalysis]);

  // ---------------------------------------------------------------------------
  // Ingredient actions
  // ---------------------------------------------------------------------------

  const handleSelectViaHub = (ingId: string, product: FoodSearchResult, mode: 'grams' | 'portion', amount: number) => {
    const ingredient = buildFromProduct(product, mode, amount);
    setIngredients(prev => prev.map(i => i.id !== ingId ? i : {
      ...i,
      status: 'confirmed',
      userConfirmed: true,
      resolvedIngredient: { ...ingredient, id: ingId },
    }));
    setAmountEdits(e => ({ ...e, [ingId]: { mode, value: String(amount) } }));
  };

  const handleAiEstimateResult = (ingId: string, estimate: AiFoodEstimatePreview) => {
    const ing = ingredients.find((i) => i.id === ingId);
    if (!ing) return;
    const estimatedState = buildWizardIngredientFromAiEstimate(ingId, ing.parserItem, estimate);
    setAmountEdits((e) => ({ ...e, [ingId]: { mode: estimatedState.resolvedIngredient.inputMode, value: String(estimatedState.resolvedIngredient.inputAmount) } }));
    setIngredients((prev) =>
      prev.map((i) => i.id === ingId
        ? { ...i, ...estimatedState }
        : i),
    );
  };

  const handleReviewHelp = () => {
    setReviewHelpVisible(true);
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
      userConfirmed: true,
      resolvedIngredient: ingredient,
    };
    setAmountEdits(e => ({ ...e, [ingredient.id]: { mode, value: String(amount) } }));
    setIngredients(prev => [...prev, wi]);
  };

  const handleAddAiEstimateViaHub = (estimate: AiFoodEstimatePreview, query: string) => {
    const id = randomUUID();
    const parserItem: MealParserPreviewItem = {
      rawText: query,
      displayName: query,
      status: 'unmatched',
      selectedProductId: null,
      selectedProductName: null,
      candidates: [],
      inputMode: 'grams',
      inputAmount: 100,
      amountGrams: 100,
      needsReview: false,
      warnings: [],
    };
    const estimatedState = buildWizardIngredientFromAiEstimate(id, parserItem, estimate);
    setAmountEdits((prev) => ({ ...prev, [id]: { mode: estimatedState.resolvedIngredient.inputMode, value: String(estimatedState.resolvedIngredient.inputAmount) } }));
    setIngredients((prev) => [
      ...prev,
      {
        id,
        parserItem,
        ...estimatedState,
      },
    ]);
  };

  const handleReplaceViaHub = (ingId: string, product: FoodSearchResult, mode: 'grams' | 'portion', amount: number) => {
    const ingredient = buildFromProduct(product, mode, amount);
    setIngredients(prev => prev.map(i => i.id !== ingId ? i : {
      ...i,
      status: 'confirmed',
      userConfirmed: true,
      resolvedIngredient: { ...ingredient, id: ingId },
    }));
    setAmountEdits(e => ({ ...e, [ingId]: { mode, value: String(amount) } }));
  };

  const handleOpenIngredient = (ingredient: WizardIngredient) => {
    openHub({
      initialQuery: ingredient.parserItem.displayName,
      prefillAmount: ingredient.parserItem.inputAmount != null && ingredient.parserItem.inputMode !== 'unknown'
        ? { mode: ingredient.parserItem.inputMode as 'grams' | 'portion', amount: ingredient.parserItem.inputAmount }
        : null,
      onSelectIngredient: (product, mode, amount) => handleSelectViaHub(ingredient.id, product, mode, amount),
      onEstimateIngredient: (estimate) => handleAiEstimateResult(ingredient.id, estimate),
    });
  };

  const handleOpenAddIngredient = () => {
    openHub({
      onSelectIngredient: (product, mode, amount) => handleAddManualViaHub(product, mode, amount),
      onEstimateIngredient: (estimate, query) => handleAddAiEstimateViaHub(estimate, query),
    });
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

  const handleRemoveStep = (id: string) => {
    const removedStep = steps.find((step) => step.id === id);
    if (!removedStep) return;
    const originalIndex = steps.findIndex((step) => step.id === id);

    setSteps((prev) => prev.filter((step) => step.id !== id));
    delete stepHeightsRef.current[id];

    showSnackbar({
      message: `Schritt ${originalIndex + 1} entfernt`,
      undoLabel: 'Rückgängig',
      onUndo: () => {
        setSteps((prev) => {
          const next = [...prev];
          next.splice(Math.min(originalIndex, next.length), 0, removedStep);
          return next;
        });
      },
      durationMs: 3500,
    });
  };

  const stopStepAutoScroll = useCallback(() => {
    stepDragActiveRef.current = false;
    stepAutoScrollDirectionRef.current = 0;
    if (stepAutoScrollFrameRef.current != null) {
      cancelAnimationFrame(stepAutoScrollFrameRef.current);
      stepAutoScrollFrameRef.current = null;
    }
  }, []);

  const updateStepDropTarget = useCallback((id: string, translationY: number) => {
    const effectiveTranslationY = translationY
      + stepsScrollOffsetRef.current
      - dragStartScrollOffsetRef.current;
    const nextTargetIndex = calculateStepDropIndex(
      steps,
      id,
      effectiveTranslationY,
      stepHeightsRef.current,
    );
    if (lastDropTargetRef.current !== nextTargetIndex) {
      lastDropTargetRef.current = nextTargetIndex;
      void Haptics.selectionAsync();
      setDropTargetIndex(nextTargetIndex);
    }
  }, [steps]);

  const runStepAutoScroll = useCallback(() => {
    if (!stepDragActiveRef.current || stepAutoScrollDirectionRef.current === 0) {
      stepAutoScrollFrameRef.current = null;
      return;
    }

    const maxOffset = Math.max(
      0,
      stepsScrollContentHeightRef.current - stepsScrollViewportHeightRef.current,
    );
    const nextOffset = Math.max(
      0,
      Math.min(
        maxOffset,
        stepsScrollOffsetRef.current + stepAutoScrollDirectionRef.current * spacing.sm,
      ),
    );
    if (nextOffset !== stepsScrollOffsetRef.current) {
      stepsScrollOffsetRef.current = nextOffset;
      dragScrollAdjustment.value = nextOffset - dragStartScrollOffsetRef.current;
      stepsScrollRef.current?.scrollTo({ y: nextOffset, animated: false });
    }
    if (activeStepDragIdRef.current != null) {
      updateStepDropTarget(activeStepDragIdRef.current, activeStepTranslationYRef.current);
    }
    stepAutoScrollFrameRef.current = requestAnimationFrame(runStepAutoScroll);
  }, [dragScrollAdjustment, updateStepDropTarget]);

  const setStepAutoScrollDirection = useCallback((direction: -1 | 0 | 1) => {
    stepAutoScrollDirectionRef.current = direction;
    if (direction === 0) {
      if (stepAutoScrollFrameRef.current != null) {
        cancelAnimationFrame(stepAutoScrollFrameRef.current);
        stepAutoScrollFrameRef.current = null;
      }
      return;
    }
    if (stepAutoScrollFrameRef.current == null) {
      stepAutoScrollFrameRef.current = requestAnimationFrame(runStepAutoScroll);
    }
  }, [runStepAutoScroll]);

  const handleStepsScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = event.nativeEvent.contentOffset.y;
    stepsScrollOffsetRef.current = offset;
    if (stepDragActiveRef.current) {
      dragScrollAdjustment.value = offset - dragStartScrollOffsetRef.current;
    }
  }, [dragScrollAdjustment]);

  const handleStepDragStart = useCallback((id: string) => {
    const sourceIndex = steps.findIndex((step) => step.id === id);
    if (sourceIndex < 0) return;
    stopStepAutoScroll();
    stepDragActiveRef.current = true;
    activeStepDragIdRef.current = id;
    activeStepTranslationYRef.current = 0;
    dragStartScrollOffsetRef.current = stepsScrollOffsetRef.current;
    dragScrollAdjustment.value = 0;
    const initialTargetIndex = sourceIndex + 1;
    lastDropTargetRef.current = initialTargetIndex;
    setDraggingStepId(id);
    setDropTargetIndex(initialTargetIndex);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [dragScrollAdjustment, steps, stopStepAutoScroll]);

  const handleStepDragMove = useCallback((id: string, translationY: number, absoluteY: number) => {
    activeStepTranslationYRef.current = translationY;
    const edgeThreshold = spacing.xxl * 2;
    const autoScrollDirection = absoluteY < edgeThreshold
      ? -1
      : absoluteY > windowHeight - edgeThreshold
        ? 1
        : 0;
    setStepAutoScrollDirection(autoScrollDirection);

    updateStepDropTarget(id, translationY);
  }, [setStepAutoScrollDirection, updateStepDropTarget, windowHeight]);

  const handleStepLayout = useCallback((id: string, height: number) => {
    stepHeightsRef.current[id] = height;
  }, []);

  const handleStepDragEnd = useCallback((id: string, translationY: number) => {
    const effectiveTranslationY = translationY
      + stepsScrollOffsetRef.current
      - dragStartScrollOffsetRef.current;
    const targetIndex = calculateStepDropIndex(steps, id, effectiveTranslationY, stepHeightsRef.current);
    const sourceIndex = steps.findIndex((step) => step.id === id);
    const insertionIndex = targetIndex > sourceIndex ? targetIndex - 1 : targetIndex;
    if (sourceIndex >= 0 && insertionIndex !== sourceIndex) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    stopStepAutoScroll();
    dragScrollAdjustment.value = 0;
    stepDragActiveRef.current = false;
    activeStepDragIdRef.current = null;
    activeStepTranslationYRef.current = 0;
    lastDropTargetRef.current = null;
    setDraggingStepId(null);
    setDropTargetIndex(null);

    setSteps((prev) => {
      const sourceIndex = prev.findIndex((step) => step.id === id);
      const sourceStep = prev[sourceIndex];
      if (sourceIndex < 0 || !sourceStep) return prev;

      const targetIndex = calculateStepDropIndex(prev, id, effectiveTranslationY, stepHeightsRef.current);
      const insertionIndex = targetIndex > sourceIndex ? targetIndex - 1 : targetIndex;
      if (insertionIndex === sourceIndex) return prev;
      const reorderedSteps = [...prev];
      reorderedSteps.splice(sourceIndex, 1);
      reorderedSteps.splice(insertionIndex, 0, sourceStep);
      return reorderedSteps;
    });
  }, [dragScrollAdjustment, steps, stopStepAutoScroll]);

  useEffect(() => () => {
    stopStepAutoScroll();
  }, [stopStepAutoScroll]);

  const getStepOriginTop = (index: number) => {
    let top = 0;
    for (let stepIndex = 0; stepIndex < index; stepIndex += 1) {
      const step = steps[stepIndex];
      if (step) top += (stepHeightsRef.current[step.id] ?? spacing.xxl * 3) + spacing.md;
    }
    return top;
  };

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
  const confirmedMainIngredientCount = mainIngredients.filter(i => i.userConfirmed).length;
  const allMainIngredientsConfirmed =
    mainIngredients.length > 0 && confirmedMainIngredientCount === mainIngredients.length;
  const reviewProgressPercent = mainIngredients.length > 0
    ? Math.round((confirmedMainIngredientCount / mainIngredients.length) * 100)
    : 0;
  const orderedMainIngredients = [
    ...mainIngredients.filter(i => !i.userConfirmed && i.resolvedIngredient != null),
    ...mainIngredients.filter(i => !i.userConfirmed && i.resolvedIngredient == null),
    ...mainIngredients.filter(i => i.userConfirmed),
  ];

  const confirmedIngredients = ingredients
    .filter((i) => i.status === 'confirmed' || i.status === 'auto-matched' || i.status === 'seasoning')
    .map((i) => i.resolvedIngredient!)
    .filter(Boolean);

  const allIngredientsResolved =
    ingredients.length > 0 &&
    ingredients.every((i) => i.status === 'seasoning' || (i.resolvedIngredient != null && i.userConfirmed));

  const liveNutrition =
    confirmedIngredients.length > 0 && portions > 0
      ? calculateRecipeNutrition(confirmedIngredients, portions)
      : null;
  const previewViewModel = buildRecipePreviewViewModel(confirmedIngredients);

  const handleConfirmIngredient = (ingId: string) => {
    setIngredients((prev) => prev.map((ingredient) => {
      if (ingredient.id === ingId && ingredient.status !== 'seasoning' && ingredient.resolvedIngredient) {
        return { ...ingredient, status: 'confirmed', userConfirmed: true };
      }
      return ingredient;
    }));
  };

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
        <View style={styles.headerSide} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {phase === 'ingredients' ? (
          <RecipeWizardIngredientsPhase
            ingredients={ingredients}
            seasoningIngredients={seasoningIngredients}
            mainIngredients={mainIngredients}
            orderedMainIngredients={orderedMainIngredients}
            amountEdits={amountEdits}
            confirmedMainIngredientCount={confirmedMainIngredientCount}
            allMainIngredientsConfirmed={allMainIngredientsConfirmed}
            reviewProgressPercent={reviewProgressPercent}
            seasoningsExpanded={seasoningsExpanded}
            onToggleSeasonings={() => setSeasoningsExpanded((expanded) => !expanded)}
            onReviewHelp={handleReviewHelp}
            onRemoveIngredient={handleRemoveIngredient}
            onConfirmIngredient={handleConfirmIngredient}
            onOpenIngredient={handleOpenIngredient}
            onAddIngredient={handleOpenAddIngredient}
          />
        ) : phase === 'input' ? (
          <RecipeWizardInputPhase
            inputText={inputText}
            hasMeaningfulRecipeText={hasMeaningfulRecipeText}
            onChangeText={setInputText}
            onAnalyze={handleAnalyzePress}
          />
        ) : phase === 'steps' ? (
          <RecipeWizardStepsPhase
            steps={steps}
            draggingStepId={draggingStepId}
            dropTargetIndex={dropTargetIndex}
            stepsScrollRef={stepsScrollRef}
            dragScrollAdjustment={dragScrollAdjustment}
            getStepOriginTop={getStepOriginTop}
            onStepsScroll={handleStepsScroll}
            onStepsContentSizeChange={(_width, height) => {
              stepsScrollContentHeightRef.current = height;
            }}
            onStepsLayout={(event) => {
              stepsScrollViewportHeightRef.current = event.nativeEvent.layout.height;
            }}
            onAddStep={handleAddStep}
            onUpdateStep={handleUpdateStep}
            onRemoveStep={handleRemoveStep}
            onDragStart={handleStepDragStart}
            onDragMove={handleStepDragMove}
            onDragEnd={handleStepDragEnd}
            onStepLayout={handleStepLayout}
            onContinue={() => setPhase('preview')}
          />
        ) : (
        <ScrollView
          style={styles.phaseScroll}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >

          {/* ================================================================
              PHASE: preview
          ================================================================ */}
          {phase === 'preview' && (
            <RecipeWizardPreviewPhase
              recipeName={recipeName}
              recipeDescription={recipeDescription}
              tags={tags}
              portions={portions}
              pendingImages={pendingImages}
              steps={steps}
              liveNutrition={liveNutrition}
              previewViewModel={previewViewModel}
              saving={saving}
              onRecipeNameChange={setRecipeName}
              onPortionsChange={setPortions}
              onPickImage={handlePickImage}
              onRemoveImage={(index) => setPendingImages((prev) => prev.filter((_, i) => i !== index))}
              onSave={handleSave}
            />
          )}
        </ScrollView>
        )}
        {phase === 'ingredients' && (
          <View style={styles.stickyFooter}>
            {!allIngredientsResolved && mainIngredients.length > 0 && (
              <TouchableOpacity
                style={styles.stickyFooterHintButton}
                onPress={handleReviewHelp}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Erklärung zum Bestätigen der Hauptzutaten anzeigen"
              >
                <Text style={styles.stickyFooterHint}>
                  {mainIngredients.length - confirmedMainIngredientCount === 1
                    ? 'Noch 1 Hauptzutat bestätigen.'
                    : `Noch ${mainIngredients.length - confirmedMainIngredientCount} Hauptzutaten bestätigen.`}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.primaryBtn, styles.stickyPrimaryBtn, !allIngredientsResolved && styles.primaryBtnDisabled]}
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

      <ConfirmSheet
        visible={backConfirmVisible}
        title="Zurück?"
        subtitle={phase === 'ingredients'
          ? 'Die KI-Analyse geht verloren. Fortfahren?'
          : 'Nicht gespeicherter Fortschritt geht verloren.'}
        actions={[
          {
            label: 'Zurück',
            destructive: true,
            onPress: () => setPhase(PHASE_PREV[phase]),
          },
        ]}
        onClose={() => setBackConfirmVisible(false)}
      />
      <InfoOverlay
        visible={reviewHelpVisible}
        title="Zutaten bestätigen"
        body="Mit dem grünen Haken kannst du eine Zuordnung direkt bestätigen. Tippe auf eine Zutatenkarte, um im Such-Hub nach dem passenden Lebensmittel zu suchen."
        onClose={() => setReviewHelpVisible(false)}
      />
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
  headerBack: { ...typography.body1, color: colors.primary, minWidth: spacing.xxl + spacing.md },
  headerTitle: { ...typography.h3, color: colors.text, flex: 1, textAlign: 'center' },
  headerSide: { width: spacing.xxl + spacing.md },

  // Scroll
  phaseScroll: { flex: 1 },
  scroll: { padding: spacing.md, paddingBottom: spacing.md },
  inputPhaseContent: {
    flex: 1,
    padding: spacing.md,
  },

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

  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  primaryBtnDisabled: { backgroundColor: colors.border },
  primaryBtnText: { ...typography.button, color: colors.white },

  // Sticky footer (ingredients phase CTA)
  stickyFooter: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  stickyFooterHint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center' as const,
  },
  stickyFooterHintButton: {
    alignItems: 'center' as const,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  stepsDragStatus: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  stepsDragStatusText: {
    ...typography.caption,
    color: colors.primaryBright,
  },
  stickyPrimaryBtn: { marginTop: 0 },
});
