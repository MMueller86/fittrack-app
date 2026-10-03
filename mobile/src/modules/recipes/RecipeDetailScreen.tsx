// RecipeDetailScreen — read-only recipe preview with logging and management actions
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  RECIPE_PORTION_MAX,
  RECIPE_PORTION_MIN,
  scaleRecipeIngredients,
} from '@fittrack/shared';
import type { Recipe, RecipeImageHeroCrop } from '@fittrack/shared';
import { colors, radius, spacing, typography } from '../../app/theme';
import { aiApi } from '../../shared/api/aiApi';
import { recipeApi } from '../../shared/api/recipeApi';
import { isQuotaExceededError } from '../../shared/api/client';
import { favoritesApi } from '../../shared/api/favoritesApi';
import { ConfirmSheet } from '../../shared/components/ConfirmSheet';
import { Icon } from '../../shared/components/Icon';
import { InfoOverlay } from '../../shared/components/InfoOverlay';
import { NutritionTile } from '../../shared/components/NutritionTile';
import {
  RecipeShareMediaError,
  recipeShareMediaService,
  type RecipeShareMediaSession,
} from '../../services/recipeShareMediaService';
import { computeRecipeQuickEntryData } from './recipeUtils';
import { buildRecipePreviewViewModel } from './recipePreviewViewModel';
import { RecipeIngredientGroup } from './RecipeIngredientGroup';
import { RecipeImageHeroImage } from './RecipeImageHeroImage';
import { RecipeImageHeroCropEditor } from './RecipeImageHeroCropEditor';
import { RecipeInstagramPreview } from './RecipeInstagramPreview';
import {
  getRecipeShareRenderNotice,
  logRecipeShareRenderFailure,
} from './recipeShareRenderNotice';
import { RECIPE_HERO_ASPECT_RATIO } from './recipeImageSource';
import {
  createRecipeShareDraftController,
  createRecipeShareDraftState,
  hasDistinctRecipeShareUris,
  type RecipeShareDraftController,
  type RecipeShareDraftState,
} from './recipeShareDraftState';
import {
  createRecipeScalePreviewController,
  type RecipeScalePreviewController,
  type RecipeScalePreviewErrorNotice,
  type RecipeTextPreviewState,
} from './recipeScalePreviewState';
import { consumeRecipeDetailNavigationIntent } from './recipeWizardNavigation';
import { isRecipeRevisionConflict } from './recipeWizardExportView';
import {
  buildRecipeShareExportDraftFromPending,
  buildRecipeShareExportDraftFromPreparation,
  buildRecipeShareExportDraftFromStored,
  buildRecipeShareExportDraftFromView,
  isSameRecipeExportView,
  validateRecipeShareExportDraft,
} from './recipeShareExportView';
import {
  getInitialRecipeInstagramTags,
  type RecipeInstagramOptions,
} from './recipeInstagramOptions';
import type { WizardExportDraft } from './recipeWizardTypes';
import type { RecipeStackParamList } from '../../app/navigation/RootNavigator';
import LogRecipeModal from './LogRecipeModal';

type Props = NativeStackScreenProps<RecipeStackParamList, 'RecipeDetail'>;

const RECIPE_SCALE_LOADING_MESSAGE =
  'Die KI passt die Texte an die neuen Rezeptmengen an. Die KI kann Fehler machen.';
const RECIPE_SHARE_PREPARING_MESSAGE = 'Exportvorschau wird vorbereitet.';
const RECIPE_SHARE_AI_PREPARING_MESSAGE =
  'Die KI macht deine Texte gerade fit fürs Bild ... Gleich kannst du beide Bilder checken und die Texte noch anpassen.';

function clampTargetPortions(value: number): number {
  return Math.min(RECIPE_PORTION_MAX, Math.max(RECIPE_PORTION_MIN, value));
}

type RecipeShareStage = 'closed' | 'preparing' | 'preview';
type RecipeShareNoticeKind =
  | 'render'
  | 'photo'
  | 'missing'
  | 'media'
  | 'success'
  | 'preparation'
  | 'save'
  | 'conflict';

interface RecipeShareNotice {
  kind: RecipeShareNoticeKind;
  title: string;
  body: string;
  actionLabel?: string;
  openSettings?: boolean;
}

interface RecipeSharePreflightRequest {
  requestId: number;
  flowRevision: number;
  recipe: Recipe;
  forceFresh: boolean;
  keepFlowOnFailure: boolean;
}

function getRecipeSharePreparationNotice(error: unknown): RecipeShareNotice {
  if (isQuotaExceededError(error)) {
    const resetsAt = error.quotaExceeded?.resetsAt;
    const resetDate = resetsAt ? new Date(resetsAt) : null;
    const resetCopy = resetDate && !Number.isNaN(resetDate.getTime())
      ? ` Dein Kontingent wird am ${resetDate.toLocaleDateString('de-DE')} zurückgesetzt.`
      : '';
    return {
      kind: 'preparation',
      title: 'Kontingent ausgeschöpft',
      body: `Das monatliche Kontingent für Rezeptanalysen ist ausgeschöpft.${resetCopy} Du kannst die Exportvorschau danach erneut vorbereiten.`,
      actionLabel: 'Erneut versuchen',
    };
  }

  const status = typeof error === 'object' && error !== null && 'response' in error
    && typeof error.response === 'object' && error.response !== null && 'status' in error.response
    ? error.response.status
    : null;
  const body = status === 422
    ? 'Die vorgeschlagenen Exporttexte konnten nicht zuverlässig geprüft werden. Deine Rezeptdaten bleiben unverändert.'
    : status === 502
      ? 'Der Textdienst ist gerade nicht erreichbar. Deine Rezeptdaten bleiben unverändert.'
      : 'Die Exportvorschau konnte nicht vorbereitet werden. Bitte prüfe deine Verbindung. Deine Rezeptdaten bleiben unverändert.';

  return {
    kind: 'preparation',
    title: 'Exportvorschau konnte nicht vorbereitet werden',
    body,
    actionLabel: 'Erneut versuchen',
  };
}

function getRecipeShareMediaNotice(error: unknown): RecipeShareNotice {
  if (!(error instanceof RecipeShareMediaError)) {
    return {
      kind: 'media',
      title: 'Bilder konnten nicht gespeichert werden',
      body: 'Die Bilder konnten nicht im Album FitTrack gespeichert werden. Deine Vorschau bleibt für einen neuen Versuch erhalten.',
      actionLabel: 'Erneut versuchen',
    };
  }

  switch (error.code) {
    case 'permission-denied':
      return {
        kind: 'media',
        title: 'Fotozugriff erforderlich',
        body: error.openSettings
          ? 'Der Zugriff auf die Fotomediathek ist deaktiviert. Erlaube FitTrack den Fotozugriff in den Geräteeinstellungen und versuche es danach erneut.'
          : 'Der Zugriff auf die Fotomediathek wurde nicht erteilt. Bitte erlaube den Zugriff und versuche es erneut.',
        actionLabel: error.retryable ? 'Erneut versuchen' : undefined,
        openSettings: error.openSettings,
      };
    case 'media-library-unavailable':
      return {
        kind: 'media',
        title: 'Fotomediathek nicht verfügbar',
        body: 'Die Fotomediathek ist auf diesem Gerät nicht verfügbar. Deine Vorschau bleibt erhalten.',
        actionLabel: 'Erneut versuchen',
      };
    case 'album-lookup-failed':
    case 'album-create-failed':
    case 'album-asset-failed':
    case 'asset-create-failed':
      return {
        kind: 'media',
        title: 'Bilder konnten nicht gespeichert werden',
        body: 'Die Bilder konnten nicht im Album FitTrack gespeichert werden. Deine Vorschau bleibt für einen neuen Versuch erhalten.',
        actionLabel: 'Erneut versuchen',
      };
    case 'sharing-unavailable':
      return {
        kind: 'media',
        title: 'Teilen nicht verfügbar',
        body: 'Beide Bilder wurden im Album FitTrack gespeichert. Auf diesem Gerät ist derzeit kein Teilen verfügbar.',
        actionLabel: 'Erneut versuchen',
      };
    case 'share-failed':
      return {
        kind: 'media',
        title: 'Teilen nicht abgeschlossen',
        body: 'Beide Bilder wurden im Album FitTrack gespeichert, aber das Teilen wurde abgebrochen oder ist fehlgeschlagen. Es wurde nichts an Instagram übermittelt.',
        actionLabel: 'Erneut teilen',
      };
    case 'cleanup-failed':
      return {
        kind: 'media',
        title: 'Aufräumen nicht abgeschlossen',
        body: 'Beide Bilder wurden gespeichert, aber die temporären Vorschauen konnten nicht bereinigt werden. Deine Vorschau bleibt für einen neuen Versuch erhalten.',
        actionLabel: 'Erneut teilen',
      };
    case 'preview-file-write-failed':
      return {
        kind: 'render',
        title: 'Vorschau konnte nicht gespeichert werden',
        body: 'Eine der beiden Vorschauen konnte nicht vorbereitet werden. Bitte versuche es erneut.',
        actionLabel: 'Erneut versuchen',
      };
    default:
      return {
        kind: 'media',
        title: 'Bilder konnten nicht gespeichert werden',
        body: 'Die Bilder konnten nicht im Album FitTrack gespeichert werden. Deine Vorschau bleibt für einen neuen Versuch erhalten.',
        actionLabel: 'Erneut versuchen',
      };
  }
}

function describeShareError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export default function RecipeDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [logVisible, setLogVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [seasoningsExpanded, setSeasoningsExpanded] = useState(false);
  const [errorNotice, setErrorNotice] = useState<RecipeScalePreviewErrorNotice | null>(null);
  const [scaleInfoVisible, setScaleInfoVisible] = useState(false);
  const [targetPortions, setTargetPortions] = useState(RECIPE_PORTION_MIN);
  const [textPreview, setTextPreview] = useState<RecipeTextPreviewState>({
    status: 'original',
    description: null,
    steps: [],
  });
  const [shareStage, setShareStage] = useState<RecipeShareStage>('closed');
  const [shareDraft, setShareDraft] = useState<RecipeShareDraftState | null>(null);
  const [shareCropVisible, setShareCropVisible] = useState(false);
  const [shareNotice, setShareNotice] = useState<RecipeShareNotice | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareExportDraft, setShareExportDraft] = useState<WizardExportDraft | null>(null);
  const [sharePreparationMessage, setSharePreparationMessage] = useState<string | null>(null);
  const [sharePreflightRequest, setSharePreflightRequest] = useState<RecipeSharePreflightRequest | null>(null);
  const recipeRef = useRef<Recipe | null>(null);
  const logIntentConsumedRef = useRef(false);
  const targetPortionsRef = useRef(RECIPE_PORTION_MIN);
  const recipeIdRef = useRef(id);
  const shareControllerRef = useRef<RecipeShareDraftController | null>(null);
  const shareDraftRef = useRef<RecipeShareDraftState | null>(null);
  const shareSessionRef = useRef<RecipeShareMediaSession | null>(null);
  const shareAssetSavedRef = useRef(false);
  const sharePreviewUrisRef = useRef(new Set<string>());
  const shareFlowActiveRef = useRef(false);
  const shareBusyRef = useRef(false);
  const shareInFlightRef = useRef(false);
  const shareCleanupRequestedRef = useRef(false);
  const mountedRef = useRef(true);
  const shareExportDraftRef = useRef<WizardExportDraft | null>(null);
  const shareExportDraftRecipeIdRef = useRef<string | null>(null);
  const shareFlowRevisionRef = useRef(0);
  const sharePreflightRequestSequenceRef = useRef(0);
  const handledSharePreflightRequestRef = useRef(0);
  const sharePreparationInFlightRef = useRef(false);
  const missingRecoveryUsedRef = useRef(false);
  recipeIdRef.current = id;
  const setTargetPortionsValue = useCallback((value: number) => {
    targetPortionsRef.current = value;
    setTargetPortions(value);
  }, []);

  const storeShareExportDraft = useCallback((draft: WizardExportDraft | null, recipeId = id) => {
    shareExportDraftRef.current = draft;
    shareExportDraftRecipeIdRef.current = draft ? recipeId : null;
    setShareExportDraft(draft);
  }, [id]);

  const startSharePreflight = useCallback((
    currentRecipe: Recipe,
    flowRevision: number,
    forceFresh = false,
    keepFlowOnFailure = false,
  ) => {
    const requestId = ++sharePreflightRequestSequenceRef.current;
    setSharePreparationMessage(RECIPE_SHARE_PREPARING_MESSAGE);
    setShareStage('preparing');
    setSharePreflightRequest({
      requestId,
      flowRevision,
      recipe: currentRecipe,
      forceFresh,
      keepFlowOnFailure,
    });
  }, []);

  const resolveSharePreflight = useCallback(async (request: RecipeSharePreflightRequest) => {
    const isCurrentFlow = () => mountedRef.current
      && shareFlowActiveRef.current
      && shareFlowRevisionRef.current === request.flowRevision;

    try {
      let draft: WizardExportDraft | null = null;
      const cachedDraft = shareExportDraftRecipeIdRef.current === request.recipe.id
        ? shareExportDraftRef.current
        : null;

      if (request.recipe.exportView) {
        draft = buildRecipeShareExportDraftFromStored(request.recipe);
      } else if (!request.forceFresh && cachedDraft) {
        draft = cachedDraft;
      } else if (!request.forceFresh && route.params.pendingExportDraft) {
        draft = buildRecipeShareExportDraftFromPending(route.params.pendingExportDraft);
      } else {
        setSharePreparationMessage(RECIPE_SHARE_AI_PREPARING_MESSAGE);
        sharePreparationInFlightRef.current = true;
        const response = await recipeApi.prepareExportView(request.recipe.id);
        sharePreparationInFlightRef.current = false;
        if (response.recipeId !== request.recipe.id) {
          throw new Error('Recipe export preparation response does not match the active recipe.');
        }
        draft = buildRecipeShareExportDraftFromPreparation(request.recipe, response.suggestion);
      }

      if (!isCurrentFlow() || !draft) return false;
      const validation = validateRecipeShareExportDraft(draft, request.recipe);
      const controller = shareControllerRef.current;
      if (!controller) return false;
      const shareState = controller.getState();
      controller.setOptions({
        selectedTags: shareState.selectedTags,
        nutritionHighlight: shareState.nutritionHighlight,
        exportViewDraft: validation.bundleDraft,
      });
      storeShareExportDraft(draft, request.recipe.id);
      setSharePreparationMessage(null);
      setShareStage('preview');
      if (validation.bundleDraft) {
        controller.startInitialPreview(
          hasDistinctRecipeShareUris(shareState.instagramUri, shareState.detailUri),
        );
      }
      return true;
    } catch (error: unknown) {
      sharePreparationInFlightRef.current = false;
      if (!isCurrentFlow()) return false;
      setSharePreparationMessage(null);
      if (request.keepFlowOnFailure) {
        setShareStage('preview');
      } else {
        shareFlowActiveRef.current = false;
        setShareStage('closed');
      }
      setShareNotice(getRecipeSharePreparationNotice(error));
      return false;
    }
  }, [route.params.pendingExportDraft, storeShareExportDraft]);

  const recoverMissingShareView = useCallback(async () => {
    if (!shareFlowActiveRef.current || shareBusyRef.current) return;
    const flowRevision = shareFlowRevisionRef.current;
    storeShareExportDraft(null, id);
    setShareNotice(null);
    setSharePreparationMessage(RECIPE_SHARE_PREPARING_MESSAGE);
    setShareStage('preparing');

    try {
      const currentRecipe = await recipeApi.get(id);
      if (!mountedRef.current
        || !shareFlowActiveRef.current
        || shareFlowRevisionRef.current !== flowRevision) return;
      recipeRef.current = currentRecipe;
      setRecipe(currentRecipe);
      startSharePreflight(currentRecipe, flowRevision, true, true);
    } catch (error: unknown) {
      if (!mountedRef.current
        || !shareFlowActiveRef.current
        || shareFlowRevisionRef.current !== flowRevision) return;
      setSharePreparationMessage(null);
      setShareStage('preview');
      setShareNotice(getRecipeSharePreparationNotice(error));
    }
  }, [id, startSharePreflight, storeShareExportDraft]);

  const reloadShareAfterRevisionConflict = useCallback(async (
    draftToReview?: WizardExportDraft,
  ) => {
    if (!shareFlowActiveRef.current) return;
    const flowRevision = shareFlowRevisionRef.current;
    setShareNotice(null);
    setSharePreparationMessage(RECIPE_SHARE_PREPARING_MESSAGE);
    setShareStage('preparing');

    try {
      const currentRecipe = await recipeApi.get(id);
      if (!mountedRef.current
        || !shareFlowActiveRef.current
        || shareFlowRevisionRef.current !== flowRevision) return;
      recipeRef.current = currentRecipe;
      setRecipe(currentRecipe);
      const storedDraft = buildRecipeShareExportDraftFromStored(currentRecipe);
      if (storedDraft) {
        const validation = validateRecipeShareExportDraft(storedDraft, currentRecipe);
        const controller = shareControllerRef.current;
        const shareState = controller?.getState();
        storeShareExportDraft(storedDraft, id);
        setSharePreparationMessage(null);
        setShareStage('preview');
        if (controller && shareState) {
          controller.setOptions({
            selectedTags: shareState.selectedTags,
            nutritionHighlight: shareState.nutritionHighlight,
            exportViewDraft: validation.bundleDraft,
          });
          if (validation.bundleDraft) {
            controller.startInitialPreview(
              hasDistinctRecipeShareUris(shareState.instagramUri, shareState.detailUri),
            );
          }
        }
        setShareNotice({
          kind: 'save',
          title: 'Rezept wurde geändert',
          body: 'Der nicht gespeicherte Exportentwurf wurde verworfen. Bitte prüfe die Exporttexte der aktuellen Rezeptfassung erneut.',
        });
        return;
      }

      const localDraft = draftToReview ?? shareExportDraftRef.current;
      if (!localDraft) {
        setSharePreparationMessage(null);
        setShareStage('preview');
        setShareNotice({
          kind: 'conflict',
          title: 'Rezept wurde geändert',
          body: 'Die aktuelle Rezeptfassung enthält keine gespeicherte Exportansicht und es ist kein lokaler Entwurf verfügbar. Schließe die Vorschau und starte Teilen erneut, um Exporttexte vorzubereiten.',
        });
        return;
      }

      const localValidation = validateRecipeShareExportDraft(localDraft, currentRecipe);
      const unresolvedIngredientIds = localValidation.ingredientResolution.unresolvedIngredientIds;
      const reviewDraft = unresolvedIngredientIds.length > 0
        ? {
            ...localDraft,
            includedIngredientIds: localValidation.ingredientResolution.includedIngredientIds,
          }
        : localDraft;
      const reviewValidation = reviewDraft === localDraft
        ? localValidation
        : validateRecipeShareExportDraft(reviewDraft, currentRecipe);
      const controller = shareControllerRef.current;
      const shareState = controller?.getState();
      storeShareExportDraft(reviewDraft, id);
      setSharePreparationMessage(null);
      setShareStage('preview');
      if (controller && shareState) {
        controller.setOptions({
          selectedTags: shareState.selectedTags,
          nutritionHighlight: shareState.nutritionHighlight,
          exportViewDraft: reviewValidation.bundleDraft,
        });
        controller.reset();
      }
      setShareNotice({
        kind: 'conflict',
        title: 'Rezept wurde geändert',
        body: unresolvedIngredientIds.length > 0
          ? 'Dein nicht gespeicherter Exportentwurf wurde beibehalten. Ausgewählte Zutaten, die sich der aktuellen Rezeptfassung nicht eindeutig zuordnen ließen, wurden aus der Auswahl entfernt. Prüfe den Entwurf und aktualisiere die Vorschau manuell.'
          : 'Dein nicht gespeicherter Exportentwurf wurde beibehalten. Prüfe die Exporttexte für die aktuelle Rezeptfassung und aktualisiere die Vorschau manuell.',
      });
    } catch {
      if (!mountedRef.current
        || !shareFlowActiveRef.current
        || shareFlowRevisionRef.current !== flowRevision) return;
      setSharePreparationMessage(null);
      setShareStage('preview');
      setShareNotice({
        kind: 'conflict',
        title: 'Rezept konnte nicht neu geladen werden',
        body: 'Dein nicht bestätigter Exportentwurf bleibt erhalten. Lade die aktuelle Rezeptfassung, bevor du fortfährst.',
        actionLabel: 'Erneut laden',
      });
    }
  }, [id, storeShareExportDraft]);

  useEffect(() => {
    if (!sharePreflightRequest
      || sharePreflightRequest.requestId <= handledSharePreflightRequestRef.current) return;
    handledSharePreflightRequestRef.current = sharePreflightRequest.requestId;
    setSharePreflightRequest(null);
    void resolveSharePreflight(sharePreflightRequest);
  }, [resolveSharePreflight, sharePreflightRequest]);

  const scalePreviewControllerRef = useRef<RecipeScalePreviewController | null>(null);
  if (scalePreviewControllerRef.current === null) {
    scalePreviewControllerRef.current = createRecipeScalePreviewController({
      getScreenRecipeId: () => recipeIdRef.current,
      getCurrentRecipe: () => recipeRef.current,
      getTargetPortions: () => targetPortionsRef.current,
      setTargetPortions: setTargetPortionsValue,
      setTextPreview,
      setErrorNotice,
      previewRecipeScale: aiApi.previewRecipeScale,
    });
  }
  const scalePreviewController = scalePreviewControllerRef.current;

  const cleanupShareResources = useCallback(async () => {
    shareCleanupRequestedRef.current = true;
    const session = shareSessionRef.current;
    shareSessionRef.current = null;

    if (session) {
      try {
        await session.cleanup();
      } catch (error: unknown) {
        console.error('[RecipeDetail] Share preview cleanup failed', error);
      }
    }

    const previewUris = [...sharePreviewUrisRef.current];
    sharePreviewUrisRef.current.clear();
    for (const previewUri of previewUris) {
      try {
        await recipeShareMediaService.cleanupPreviewUri(previewUri);
      } catch (error: unknown) {
        console.error('[RecipeDetail] Share preview cleanup failed', error);
      }
    }
  }, []);

  const closeShareFlow = useCallback(() => {
    if (shareBusyRef.current || shareInFlightRef.current) return;

    shareFlowRevisionRef.current += 1;
    shareFlowActiveRef.current = false;
    sharePreparationInFlightRef.current = false;
    shareAssetSavedRef.current = false;
    setShareStage('closed');
    setSharePreflightRequest(null);
    setSharePreparationMessage(null);
    setShareCropVisible(false);
    setShareNotice(null);
    shareControllerRef.current?.dispose();
    shareControllerRef.current = null;
    shareDraftRef.current = null;
    setShareDraft(null);
    void cleanupShareResources();
  }, [cleanupShareResources]);

  const handleRetryRender = useCallback(() => {
    if (shareBusyRef.current) return;
    setShareNotice(null);
    setShareStage('preview');
    shareControllerRef.current?.retryRender();
  }, []);

  const createShareController = useCallback((currentRecipe: Recipe) => {
    shareCleanupRequestedRef.current = false;
    const initialState = createRecipeShareDraftState(currentRecipe, {
      recipeId: currentRecipe.id,
      selectedTags: getInitialRecipeInstagramTags(currentRecipe.tags),
      nutritionHighlight: null,
    });
    shareDraftRef.current = initialState;
    setShareDraft(initialState);

    const controller = createRecipeShareDraftController({
      initialState,
      renderApi: { renderShareBundle: recipeApi.renderShareBundle },
      createPreviewUri: async (png) => {
        const previewUri = await recipeShareMediaService.createPreviewUri(png);
        if (shareCleanupRequestedRef.current || !shareFlowActiveRef.current) {
          try {
            await recipeShareMediaService.cleanupPreviewUri(previewUri);
          } catch (error: unknown) {
            console.error('[RecipeDetail] Stale share preview cleanup failed', error);
          }
        } else {
          sharePreviewUrisRef.current.add(previewUri);
        }
        return previewUri;
      },
      cleanupPreviewUri: recipeShareMediaService.cleanupPreviewUri,
      onStateChange: (nextState) => {
        if (!mountedRef.current) return;
        shareDraftRef.current = nextState;
        setShareDraft(nextState);
        if (nextState.renderStatus === 'error') {
          logRecipeShareRenderFailure(nextState.error, nextState.recipeId, nextState.renderStage);
          const notice = getRecipeShareRenderNotice(nextState.error, nextState.renderStage);
          if (notice.kind === 'photo') {
            closeShareFlow();
            const currentRecipe = recipeRef.current;
            if (currentRecipe) {
              const recipeWithoutPhoto = { ...currentRecipe, images: [] };
              recipeRef.current = recipeWithoutPhoto;
              setRecipe(recipeWithoutPhoto);
              setImgIndex(0);
            }
            setShareNotice(notice);
          } else if (notice.kind === 'missing') {
            if (!missingRecoveryUsedRef.current) {
              missingRecoveryUsedRef.current = true;
              void recoverMissingShareView();
            } else {
              setShareNotice({ ...notice, actionLabel: 'Erneut vorbereiten' });
            }
          } else {
            setShareNotice(notice);
          }
        }
      },
    });

    shareControllerRef.current = controller;
    return controller;
  }, [closeShareFlow, recoverMissingShareView]);

  const handleOpenShare = useCallback(() => {
    const currentRecipe = recipeRef.current;
    if (!currentRecipe || shareFlowActiveRef.current || shareBusyRef.current) return;
    if (currentRecipe.images.length === 0) return;

    shareFlowActiveRef.current = true;
    shareAssetSavedRef.current = false;
    shareFlowRevisionRef.current += 1;
    missingRecoveryUsedRef.current = false;
    setShareNotice(null);
    setShareCropVisible(false);
    createShareController(currentRecipe);
    startSharePreflight(currentRecipe, shareFlowRevisionRef.current);
  }, [createShareController, startSharePreflight]);

  const handleShareOptionsChange = useCallback((options: RecipeInstagramOptions) => {
    const controller = shareControllerRef.current;
    const currentRecipe = recipeRef.current;
    const currentDraft = shareExportDraftRef.current;
    if (!controller || !currentRecipe || !currentDraft
      || shareBusyRef.current || shareAssetSavedRef.current) return;
    const validation = validateRecipeShareExportDraft(currentDraft, currentRecipe);
    controller.setOptions({ ...options, exportViewDraft: validation.bundleDraft });
    setShareNotice(null);
  }, []);

  const handleUpdateSharePreview = useCallback(() => {
    const currentRecipe = recipeRef.current;
    const currentDraft = shareExportDraftRef.current;
    const controller = shareControllerRef.current;
    if (!currentRecipe || !currentDraft || !controller
      || shareBusyRef.current || shareAssetSavedRef.current) return;
    const validation = validateRecipeShareExportDraft(currentDraft, currentRecipe);
    if (!validation.bundleDraft) return;
    const shareState = controller.getState();
    controller.setOptions({
      selectedTags: shareState.selectedTags,
      nutritionHighlight: shareState.nutritionHighlight,
      exportViewDraft: validation.bundleDraft,
    });
    setShareNotice(null);
    setShareStage('preview');
    controller.startInitialPreview(
      hasDistinctRecipeShareUris(shareState.instagramUri, shareState.detailUri),
    );
  }, []);

  const handleOpenCrop = useCallback(() => {
    const currentDraft = shareDraftRef.current;
    if (
      shareBusyRef.current
      || shareAssetSavedRef.current
      || !currentDraft?.cropImageUri
      || !hasDistinctRecipeShareUris(currentDraft.instagramUri, currentDraft.detailUri)
    ) return;
    setShareNotice(null);
    setShareCropVisible(true);
  }, []);

  const handleCropConfirmed = useCallback((crop: RecipeImageHeroCrop) => {
    const currentRecipe = recipeRef.current;
    const currentExportDraft = shareExportDraftRef.current;
    const currentShareDraft = shareDraftRef.current;
    if (
      shareBusyRef.current
      || !currentRecipe
      || !currentExportDraft
      || !currentShareDraft
      || !hasDistinctRecipeShareUris(currentShareDraft.instagramUri, currentShareDraft.detailUri)
    ) return;

    const validation = validateRecipeShareExportDraft(currentExportDraft, currentRecipe);
    if (!validation.bundleDraft) return;
    setShareCropVisible(false);
    setShareNotice(null);
    setShareStage('preview');
    const shareState = shareControllerRef.current?.getState();
    if (!shareState) return;
    shareControllerRef.current?.setOptions({
      selectedTags: shareState.selectedTags,
      nutritionHighlight: shareState.nutritionHighlight,
      exportViewDraft: validation.bundleDraft,
    });
    shareControllerRef.current?.confirmCrop(crop);
  }, []);

  const handleShareExportDraftChange = useCallback((draft: WizardExportDraft) => {
    const currentRecipe = recipeRef.current;
    const controller = shareControllerRef.current;
    if (!shareFlowActiveRef.current || shareBusyRef.current || !currentRecipe || !controller) return;
    storeShareExportDraft(draft, id);
    const validation = validateRecipeShareExportDraft(draft, currentRecipe);
    const shareState = controller.getState();
    controller.setOptions({
      selectedTags: shareState.selectedTags,
      nutritionHighlight: shareState.nutritionHighlight,
      exportViewDraft: validation.bundleDraft,
    });
  }, [id, storeShareExportDraft]);

  const handleToggleShareIncludedIngredient = useCallback((ingredientId: string) => {
    const currentRecipe = recipeRef.current;
    const currentDraft = shareExportDraftRef.current;
    const controller = shareControllerRef.current;
    if (!currentRecipe || !currentDraft || !controller || shareBusyRef.current) return;
    const matches = currentRecipe.ingredients.filter((ingredient) => ingredient.id === ingredientId);
    if (matches.length !== 1 || (matches[0]?.category ?? 'food') === 'seasoning') return;

    const includedIngredientIds = currentDraft.includedIngredientIds.includes(ingredientId)
      ? currentDraft.includedIngredientIds.filter((selectedId) => selectedId !== ingredientId)
      : [...currentDraft.includedIngredientIds, ingredientId];
    const nextDraft = { ...currentDraft, includedIngredientIds };
    storeShareExportDraft(nextDraft, id);
    const validation = validateRecipeShareExportDraft(nextDraft, currentRecipe);
    const shareState = controller.getState();
    controller.setOptions({
      selectedTags: shareState.selectedTags,
      nutritionHighlight: shareState.nutritionHighlight,
      exportViewDraft: validation.bundleDraft,
    });
  }, [id, storeShareExportDraft]);

  const handleSaveShareExportDraft = useCallback(async () => {
    const currentRecipe = recipeRef.current;
    const currentDraft = shareExportDraftRef.current;
    const controller = shareControllerRef.current;
    if (
      !currentRecipe
      || !currentDraft
      || !controller
      || !shareFlowActiveRef.current
      || shareBusyRef.current
      || sharePreparationInFlightRef.current
    ) return false;

    const validation = validateRecipeShareExportDraft(currentDraft, currentRecipe);
    const exportView = validation.exportView;
    if (!exportView) return false;
    if (isSameRecipeExportView(currentRecipe.exportView, exportView)) return false;

    const flowRevision = shareFlowRevisionRef.current;
    shareBusyRef.current = true;
    setShareBusy(true);
    setShareNotice(null);

    try {
      const savedRecipe = await recipeApi.update(id, {
        exportView,
        exportViewAction: 'confirm',
      });
      if (!mountedRef.current
        || !shareFlowActiveRef.current
        || shareFlowRevisionRef.current !== flowRevision) return false;
      if (!savedRecipe.exportView
        || !isSameRecipeExportView(savedRecipe.exportView, exportView)) {
        throw new Error('Recipe save response did not contain the saved export view.');
      }
      recipeRef.current = savedRecipe;
      setRecipe(savedRecipe);
      storeShareExportDraft(buildRecipeShareExportDraftFromView(savedRecipe.exportView), id);
      setSharePreparationMessage(null);
      setShareStage('preview');
      const shareState = controller.getState();
      controller.setOptions({
        selectedTags: shareState.selectedTags,
        nutritionHighlight: shareState.nutritionHighlight,
        exportViewDraft: null,
      });
      controller.startInitialPreview(
        hasDistinctRecipeShareUris(shareState.instagramUri, shareState.detailUri),
      );
      return true;
    } catch (error: unknown) {
      if (!mountedRef.current
        || !shareFlowActiveRef.current
        || shareFlowRevisionRef.current !== flowRevision) return false;
      if (isRecipeRevisionConflict(error)) {
        void reloadShareAfterRevisionConflict(currentDraft);
      } else {
        setShareNotice({
          kind: 'save',
          title: 'Exporttexte konnten nicht gespeichert werden',
          body: 'Deine Änderungen wurden nicht gespeichert. Die bisherige Vorschau bleibt erhalten. Bitte prüfe deine Verbindung und versuche es erneut.',
          actionLabel: 'Erneut speichern',
        });
      }
      return false;
    } finally {
      shareBusyRef.current = false;
      if (mountedRef.current) setShareBusy(false);
    }
  }, [id, reloadShareAfterRevisionConflict, storeShareExportDraft]);

  const handleSaveAndShare = useCallback(async () => {
    const currentRecipe = recipeRef.current;
    const currentExportDraft = shareExportDraftRef.current;
    const exportValidation = currentRecipe && currentExportDraft
      ? validateRecipeShareExportDraft(currentExportDraft, currentRecipe)
      : null;
    const currentDraft = shareDraftRef.current;
    const controller = shareControllerRef.current;
    if (
      !currentRecipe
      || !exportValidation?.bundleDraft
      || !currentDraft?.instagramUri ||
      !currentDraft.detailUri ||
      !hasDistinctRecipeShareUris(currentDraft.instagramUri, currentDraft.detailUri) ||
      !currentDraft.instagramBytes ||
      !currentDraft.detailBytes ||
      currentDraft.renderStatus !== 'ready' ||
      !controller ||
      shareBusyRef.current ||
      shareInFlightRef.current
    ) return;

    const instagramUri = currentDraft.instagramUri;
    const detailUri = currentDraft.detailUri;
    const existingSession = shareSessionRef.current?.previewUri === instagramUri
      && shareSessionRef.current.detailUri === detailUri
      ? shareSessionRef.current
      : null;
    const session = existingSession ?? recipeShareMediaService.createSession(instagramUri, detailUri);
    if (!existingSession) shareAssetSavedRef.current = false;
    shareSessionRef.current = session;
    shareBusyRef.current = true;
    shareInFlightRef.current = true;
    setShareBusy(true);
    setShareNotice(null);
    controller.setAssetStatus('loading');
    controller.setShareStatus('loading');

    try {
      await session.save();
      shareAssetSavedRef.current = true;
      controller.setAssetStatus('ready');
      await session.share();
      if (!mountedRef.current) return;
      controller.setAssetStatus('ready');
      controller.setShareStatus('ready');
      setShareStage('closed');
      setShareNotice({
        kind: 'success',
        title: 'Bilder gespeichert',
        body: 'Beide Bilder wurden im Album FitTrack gespeichert.',
      });
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      console.error('[RecipeDetail] Recipe share failed', {
        code: error instanceof RecipeShareMediaError ? error.code : 'unknown',
        message: describeShareError(error),
        cause: error instanceof RecipeShareMediaError ? describeShareError(error.cause) : undefined,
        rollback: error instanceof RecipeShareMediaError ? error.rollback : undefined,
      });
      const notice = getRecipeShareMediaNotice(error);
      const assetWasSaved = error instanceof RecipeShareMediaError
        && ['sharing-unavailable', 'share-failed', 'cleanup-failed'].includes(error.code);
      shareAssetSavedRef.current = assetWasSaved;
      controller.setAssetStatus(assetWasSaved ? 'ready' : 'error');
      controller.setShareStatus('error');
      setShareNotice(notice);
    } finally {
      shareInFlightRef.current = false;
      shareBusyRef.current = false;
      if (!mountedRef.current) {
        await cleanupShareResources();
        return;
      }
      setShareBusy(false);
    }
  }, [cleanupShareResources]);

  const handleOpenSettings = useCallback(() => {
    void Linking.openSettings().catch(() => undefined);
  }, []);

  const handleShareNoticeAction = useCallback(() => {
    const notice = shareNotice;
    setShareNotice(null);
    if (!notice) return;
    if (notice.kind === 'missing') {
      void recoverMissingShareView();
      return;
    }
    if (notice.kind === 'preparation') {
      if (shareFlowActiveRef.current) void recoverMissingShareView();
      else handleOpenShare();
      return;
    }
    if (notice.kind === 'conflict') {
      void reloadShareAfterRevisionConflict();
      return;
    }
    if (notice.kind === 'save') {
      void handleSaveShareExportDraft();
      return;
    }
    if (notice.kind === 'render') {
      handleRetryRender();
      return;
    }
    void handleSaveAndShare();
  }, [
    handleSaveShareExportDraft,
    handleOpenShare,
    handleRetryRender,
    handleSaveAndShare,
    recoverMissingShareView,
    reloadShareAfterRevisionConflict,
    shareNotice,
  ]);

  const handleShareNoticeClose = useCallback(() => {
    if (shareNotice?.kind === 'success') {
      closeShareFlow();
      return;
    }
    setShareNotice(null);
  }, [closeShareFlow, shareNotice?.kind]);

  useEffect(() => () => {
    mountedRef.current = false;
    shareFlowRevisionRef.current += 1;
    shareFlowActiveRef.current = false;
    sharePreparationInFlightRef.current = false;
    shareControllerRef.current?.dispose();
    if (!shareInFlightRef.current) void cleanupShareResources();
  }, [cleanupShareResources]);

  const load = useCallback(async () => {
    const currentRecipe = recipeRef.current;
    scalePreviewController.resetForReload(currentRecipe);
    setLoading(true);
    try {
      const data = await recipeApi.get(id);
      recipeRef.current = data;
      setRecipe(data);
      scalePreviewController.restoreOriginalPreview(data);
      setImgIndex(0);
      setLoadError(false);
    } catch (err: unknown) {
      console.error('[RecipeDetail] Load failed for id', id, err);
      if (recipeRef.current == null) {
        setLoadError(true);
      } else {
        setErrorNotice({
          title: 'Rezept konnte nicht aktualisiert werden',
          body: 'Die zuletzt geladenen Daten bleiben sichtbar. Bitte versuche es später erneut.',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [id, scalePreviewController]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const requestScalePreview = useCallback(
    (nextTargetPortions: number, currentRecipe: Recipe) => {
      scalePreviewController.requestScalePreview(nextTargetPortions, currentRecipe);
    },
    [scalePreviewController],
  );

  const handleTargetPortionsChange = useCallback(
    (delta: number) => {
      const currentRecipe = recipeRef.current;
      if (!currentRecipe) return;

      const nextTargetPortions = clampTargetPortions(targetPortionsRef.current + delta);
      if (nextTargetPortions === targetPortionsRef.current) return;

      targetPortionsRef.current = nextTargetPortions;
      setTargetPortions(nextTargetPortions);
      requestScalePreview(nextTargetPortions, currentRecipe);
    },
    [requestScalePreview],
  );

  useEffect(() => () => scalePreviewController.dispose(), [scalePreviewController]);

  useEffect(() => {
    if (recipe == null) return;
    if (!consumeRecipeDetailNavigationIntent(route.params.intent, logIntentConsumedRef)) return;
    navigation.setParams({ intent: undefined });
    setLogVisible(true);
  }, [navigation, recipe, route.params.intent]);

  useEffect(() => {
    let cancelled = false;
    favoritesApi
      .listFavorites()
      .then((favs) => {
        if (!cancelled) setIsFavorite(favs.some((f) => f.foodRef === id));
      })
      .catch(() => {
        // The heart remains unfavorited when favorites are unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleToggleFavorite = useCallback(async () => {
    if (!recipe) return;
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      if (next) {
        const { nutritionPer100g, portion } = computeRecipeQuickEntryData(recipe);
        await favoritesApi.addFavorite({
          foodRef: recipe.id,
          foodRefType: 'recipe',
          displayName: recipe.name,
          imageUrl: recipe.images[0]?.url ?? null,
          nutritionPer100g,
          portion,
        });
      } else {
        await favoritesApi.removeFavorite(recipe.id);
      }
    } catch {
      setIsFavorite(!next);
    }
  }, [recipe, isFavorite]);

  const handleDeleteConfirmed = async () => {
    setDeleting(true);
    try {
      await recipeApi.delete(id);
      navigation.goBack();
    } catch (err: unknown) {
      console.error('[RecipeDetail] Delete failed for id', id, err);
      setErrorNotice({
        title: 'Rezept konnte nicht gelöscht werden',
        body: 'Bitte versuche es später erneut.',
      });
    } finally {
      setDeleting(false);
    }
  };

  const topBar = (
    <View style={styles.topBar}>
      <TouchableOpacity
        style={styles.topBarAction}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Zurück"
      >
        <Icon lib="ion" name="chevron-back" size="lg" color={colors.text} />
      </TouchableOpacity>
      <Text style={styles.topBarTitle}>Rezept</Text>
      {recipe ? (
        <TouchableOpacity
          style={styles.topBarAction}
          onPress={() => void handleToggleFavorite()}
          accessibilityRole="button"
          accessibilityLabel={isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
        >
          <Icon
            lib="ion"
            name={isFavorite ? 'heart' : 'heart-outline'}
            size="lg"
            color={isFavorite ? colors.negative : colors.textMuted}
          />
        </TouchableOpacity>
      ) : (
        <View style={styles.topBarAction} />
      )}
    </View>
  );

  if (loading && !recipe && !loadError) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {topBar}
        <View style={styles.stateContent}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!recipe) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {topBar}
        <View style={styles.stateContent}>
          <Text style={styles.stateTitle}>Rezept konnte nicht geladen werden</Text>
          <Text style={styles.stateText}>Bitte prüfe deine Verbindung und versuche es erneut.</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              setLoadError(false);
              void load();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Erneut versuchen</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const displayedIngredients =
    targetPortions === recipe.portions
      ? recipe.ingredients
      : scaleRecipeIngredients(recipe.ingredients, recipe.portions, targetPortions);
  const previewViewModel = buildRecipePreviewViewModel(displayedIngredients);
  const visibleIngredientGroups = previewViewModel.groups.filter((group) => group.ingredients.length > 0);
  const foodGroups = visibleIngredientGroups.filter((group) => group.category !== 'seasoning');
  const seasoningGroup = visibleIngredientGroups.find((group) => group.category === 'seasoning');
  const isTextPreviewLoading = textPreview.status === 'loading';
  const visibleSteps = isTextPreviewLoading
    ? []
    : textPreview.steps.filter((step) => step.description.trim().length > 0);
  const imageEntries = recipe.images.filter(
    (image): image is typeof image & { url: string } => typeof image.url === 'string' && image.url.length > 0,
  );
  const currentImage = imageEntries[imgIndex] ?? imageEntries[0];
  const shareCrop = shareDraft
    ? shareDraft.presentation
      ? { ...shareDraft.primaryImageCrop, ...shareDraft.presentation }
      : shareDraft.primaryImageCrop
    : null;
  const shareExportValidation = shareExportDraft
    ? validateRecipeShareExportDraft(shareExportDraft, recipe)
    : null;
  const shareExportDraftNeedsSaving = Boolean(
    shareExportValidation?.exportView
    && !isSameRecipeExportView(recipe.exportView, shareExportValidation.exportView),
  );
  const shareInteractionDisabled = shareFlowActiveRef.current || shareStage !== 'closed' || shareNotice != null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {topBar}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scroll}>
        <Text style={styles.title} accessibilityRole="header">{recipe.name}</Text>

        {recipe.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {recipe.tags.map((tag) => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {recipe.description && <Text style={styles.description}>{recipe.description}</Text>}

        <View style={styles.portionsSection}>
          <View style={styles.portionSummaryRow}>
            <View style={styles.portionSummary}>
              <Text style={styles.portionLabel}>Portionen</Text>
              <Text style={styles.portionValue}>{recipe.portions}</Text>
              <Text style={styles.portionMeta}>gespeichert</Text>
            </View>
            <View style={[styles.portionSummary, styles.targetPortionSummary]}>
              <View style={[styles.portionLabelRow, styles.targetPortionLabelRow]}>
                <Text style={styles.portionLabel}>Nachkochen für</Text>
                <TouchableOpacity
                  style={styles.infoButton}
                  onPress={() => setScaleInfoVisible(true)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Erklärung zum Skalieren öffnen"
                >
                  <Icon lib="ion" name="information-circle-outline" size="md" color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={[
                    styles.stepperButton,
                    targetPortions <= RECIPE_PORTION_MIN && styles.stepperButtonDisabled,
                  ]}
                  onPress={() => handleTargetPortionsChange(-1)}
                  disabled={targetPortions <= RECIPE_PORTION_MIN}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Portionszahl verringern"
                >
                  <Text
                    style={[
                      styles.stepperButtonText,
                      targetPortions <= RECIPE_PORTION_MIN && styles.stepperButtonTextDisabled,
                    ]}
                  >
                    −
                  </Text>
                </TouchableOpacity>
                <Text style={styles.targetPortionValue}>{targetPortions}</Text>
                <TouchableOpacity
                  style={[
                    styles.stepperButton,
                    targetPortions >= RECIPE_PORTION_MAX && styles.stepperButtonDisabled,
                  ]}
                  onPress={() => handleTargetPortionsChange(1)}
                  disabled={targetPortions >= RECIPE_PORTION_MAX}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Portionszahl erhöhen"
                >
                  <Text
                    style={[
                      styles.stepperButtonText,
                      targetPortions >= RECIPE_PORTION_MAX && styles.stepperButtonTextDisabled,
                    ]}
                  >
                    +
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.portionMeta, styles.targetPortionMeta]}>temporär</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonPrimary]}
            onPress={() => setLogVisible(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Text style={styles.actionButtonPrimaryText}>Portion eintragen</Text>
          </TouchableOpacity>
        </View>

        {targetPortions !== recipe.portions && !isTextPreviewLoading && (
          <Text style={styles.scaleWarning}>Die KI kann Fehler machen.</Text>
        )}

        <Text style={styles.sectionLabel}>Nährwerte pro Portion</Text>
        <View style={styles.macroRow}>
          <NutritionTile label="Kalorien" value={recipe.nutritionPerPortion.calories} unit="kcal" />
          <NutritionTile label="Protein" value={recipe.nutritionPerPortion.protein} unit="g" />
          <NutritionTile label="Kohlenhydr." value={recipe.nutritionPerPortion.carbs} unit="g" />
          <NutritionTile label="Fett" value={recipe.nutritionPerPortion.fat} unit="g" />
        </View>

        {currentImage && (
          <>
            <Text style={styles.sectionLabel}>Fotos ({imageEntries.length})</Text>
            <View style={styles.imageContainer}>
              <RecipeImageHeroImage
                uri={currentImage.url}
                heroCrop={currentImage.heroCrop}
                style={styles.image}
                accessibilityLabel={`Rezeptfoto ${imgIndex + 1}`}
              />
              {imageEntries.length > 1 && (
                <View style={styles.imageDots}>
                  {imageEntries.map((_, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => setImgIndex(index)}
                      accessibilityRole="button"
                      accessibilityLabel={`Foto ${index + 1} von ${imageEntries.length} anzeigen`}
                    >
                      <View style={[styles.dot, index === imgIndex && styles.dotActive]} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </>
        )}

        {visibleIngredientGroups.length > 0 && (
          <>
            <Text style={styles.contentSectionLabel}>Zutaten</Text>
            {foodGroups.map((group) => (
              <RecipeIngredientGroup key={group.category} group={group} />
            ))}
            {seasoningGroup && (
              <RecipeIngredientGroup
                group={seasoningGroup}
                collapsible
                expanded={seasoningsExpanded}
                onToggle={() => setSeasoningsExpanded((expanded) => !expanded)}
              />
            )}
          </>
        )}

        {isTextPreviewLoading ? (
          <Animated.View
            key="recipe-scale-loading"
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(150)}
            layout={LinearTransition.duration(300)}
          >
            <Text style={styles.contentSectionLabel}>Zubereitung</Text>
            <View style={styles.scaleLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
              <View style={styles.scaleLoadingCopy}>
                <Text style={styles.scaleLoadingTitle}>Zubereitung wird angepasst</Text>
                <Text style={styles.scaleLoadingText}>{RECIPE_SCALE_LOADING_MESSAGE}</Text>
              </View>
            </View>
          </Animated.View>
        ) : visibleSteps.length > 0 ? (
          <Animated.View
            key={`recipe-steps-${textPreview.status}`}
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(150)}
            layout={LinearTransition.duration(300)}
          >
            <Text style={styles.contentSectionLabel}>Zubereitung</Text>
            {visibleSteps.map((step, index) => (
              <View key={step.order} style={styles.stepRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{index + 1}</Text>
                </View>
                <View style={styles.stepContent}>
                  {step.title?.trim() && <Text style={styles.stepTitle}>{step.title}</Text>}
                  <Text style={styles.stepDescription}>{step.description}</Text>
                </View>
              </View>
            ))}
          </Animated.View>
        ) : null}

      </ScrollView>

      <View style={styles.stickyFooter}>
        <TouchableOpacity
          style={styles.stickyAction}
          onPress={() => navigation.navigate('RecipeWizard', { editId: id })}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          <Icon lib="ion" name="create-outline" size="md" color={colors.textSecondary} />
          <Text style={styles.stickyActionText}>Bearbeiten</Text>
        </TouchableOpacity>
        {recipe.images.length > 0 ? <TouchableOpacity
          style={[styles.stickyAction, shareInteractionDisabled && styles.stickyActionDisabled]}
          onPress={handleOpenShare}
          disabled={shareInteractionDisabled}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Rezept teilen"
          accessibilityState={{ disabled: shareInteractionDisabled }}
        >
          <Icon lib="ion" name="share-outline" size="md" color={colors.primaryBright} />
          <Text style={styles.stickyShareText}>Teilen</Text>
        </TouchableOpacity> : null}
        <TouchableOpacity
          style={styles.stickyAction}
          onPress={() => setDeleteConfirmVisible(true)}
          disabled={deleting}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          <Icon lib="ion" name="trash-outline" size="md" color={colors.negative} />
          <Text style={styles.stickyDeleteText}>Löschen</Text>
        </TouchableOpacity>
      </View>

      <LogRecipeModal
        visible={logVisible}
        recipe={recipe}
        onClose={() => setLogVisible(false)}
        onLogged={() => {
          setLogVisible(false);
          void load();
        }}
      />

      <ConfirmSheet
        visible={deleteConfirmVisible}
        title="Rezept löschen?"
        subtitle="Das Rezept und seine gespeicherten Daten werden dauerhaft gelöscht."
        actions={[{ label: 'Löschen', destructive: true, onPress: () => void handleDeleteConfirmed() }]}
        onClose={() => setDeleteConfirmVisible(false)}
      />

      <RecipeInstagramPreview
        visible={shareStage === 'preparing' || shareStage === 'preview'}
        preparationMessage={shareStage === 'preparing'
          ? sharePreparationMessage ?? RECIPE_SHARE_PREPARING_MESSAGE
          : null}
        providerRequestInFlight={sharePreparationInFlightRef.current}
        instagramUri={shareDraft?.instagramUri ?? null}
        detailUri={shareDraft?.detailUri ?? null}
        exportDraft={shareExportDraft}
        exportIngredients={recipe.ingredients}
        recipeTags={recipe.tags}
        selectedTags={shareDraft?.selectedTags ?? getInitialRecipeInstagramTags(recipe.tags)}
        nutritionHighlight={shareDraft?.nutritionHighlight ?? null}
        previewErrors={shareExportValidation?.previewErrors ?? []}
        saveErrors={shareExportValidation?.saveErrors ?? []}
        exportDraftValid={Boolean(shareExportValidation?.bundleDraft)}
        exportDraftSaveValid={Boolean(shareExportValidation?.exportView)}
        exportDraftNeedsSaving={shareExportDraftNeedsSaving}
        canChangeOptions={!shareAssetSavedRef.current}
        renderStatus={shareDraft?.renderStatus ?? 'idle'}
        renderStage={shareDraft?.renderStage ?? null}
        assetStatus={shareDraft?.assetStatus ?? 'idle'}
        shareStatus={shareDraft?.shareStatus ?? 'idle'}
        canAdjustCrop={Boolean(shareDraft?.cropImageUri)
          && hasDistinctRecipeShareUris(shareDraft?.instagramUri ?? null, shareDraft?.detailUri ?? null)
          && !shareAssetSavedRef.current}
        busy={shareBusy}
        onClose={closeShareFlow}
        onChangeExportDraft={handleShareExportDraftChange}
        onToggleIncludedIngredient={handleToggleShareIncludedIngredient}
        onChangeOptions={handleShareOptionsChange}
        onUpdatePreview={handleUpdateSharePreview}
        onSaveExportDraft={handleSaveShareExportDraft}
        onAdjustCrop={handleOpenCrop}
        onRetryRender={handleRetryRender}
        onSaveAndShare={() => void handleSaveAndShare()}
      />

      <RecipeImageHeroCropEditor
        visible={shareCropVisible}
        imageUri={shareDraft?.cropImageUri ?? null}
        initialCrop={shareCrop}
        onCancel={() => setShareCropVisible(false)}
        onConfirm={handleCropConfirmed}
      />

      <InfoOverlay
        visible={scaleInfoVisible}
        title="Für wie viele kochst du?"
        body="Zutatenmengen und Zubereitung werden automatisch an die gewählte Portionszahl angepasst. Dein Originalrezept bleibt unverändert."
        onClose={() => setScaleInfoVisible(false)}
      />

      <InfoOverlay
        visible={errorNotice != null}
        title={errorNotice?.title ?? 'Fehler'}
        body={errorNotice?.body ?? ''}
        onClose={() => setErrorNotice(null)}
      />

      <InfoOverlay
        visible={shareNotice != null}
        title={shareNotice?.title ?? 'Fehler'}
        body={shareNotice?.body ?? ''}
        onClose={handleShareNoticeClose}
        secondaryAction={
          shareNotice?.openSettings
            ? {
                label: 'Geräteeinstellungen öffnen',
                onPress: handleOpenSettings,
                accessibilityLabel: 'Geräteeinstellungen öffnen',
              }
            : shareNotice?.actionLabel
              ? {
                  label: shareNotice.actionLabel,
                  onPress: handleShareNoticeAction,
                  accessibilityLabel: shareNotice.actionLabel,
                }
              : undefined
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topBarAction: {
    width: spacing.xxl,
    height: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: { ...typography.h3, color: colors.text, flex: 1, textAlign: 'center' },
  scrollView: { flex: 1 },
  scroll: { padding: spacing.md, paddingBottom: spacing.md },
  stateContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  stateTitle: { ...typography.h3, color: colors.text, textAlign: 'center' },
  stateText: {
    ...typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
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
    paddingVertical: spacing.xs,
  },
  tagText: { ...typography.caption, color: colors.primaryBright, fontWeight: '600' },
  description: {
    ...typography.body2,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  portionsSection: {
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'stretch',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scaleLoading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  scaleLoadingCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  scaleLoadingTitle: {
    ...typography.body1,
    color: colors.text,
    fontWeight: '600',
  },
  scaleLoadingText: {
    ...typography.body2,
    color: colors.textSecondary,
    flex: 1,
  },
  portionSummaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  portionSummary: {
    flex: 1,
    minWidth: 0,
  },
  targetPortionSummary: {
    alignItems: 'flex-end',
  },
  portionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  targetPortionLabelRow: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  portionLabel: {
    ...typography.overline,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  portionMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  targetPortionMeta: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
  },
  infoButton: {
    width: spacing.lg,
    height: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepperButton: {
    width: spacing.xl,
    height: spacing.xl,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonDisabled: {
    backgroundColor: colors.surface,
  },
  stepperButtonText: {
    ...typography.h2,
    color: colors.primaryBright,
  },
  stepperButtonTextDisabled: {
    color: colors.textDisabled,
  },
  targetPortionValue: {
    ...typography.h2,
    color: colors.primaryBright,
    minWidth: spacing.xl,
    textAlign: 'center',
  },
  portionValue: {
    ...typography.h1,
    color: colors.primaryBright,
    fontWeight: '800',
  },
  scaleWarning: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    ...typography.overline,
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  imageContainer: {
    position: 'relative',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  image: { width: '100%', aspectRatio: RECIPE_HERO_ASPECT_RATIO },
  imageDots: {
    position: 'absolute',
    bottom: spacing.sm,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: spacing.xs,
    height: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.textMuted,
    opacity: 0.65,
  },
  dotActive: { backgroundColor: colors.white, opacity: 1 },
  contentSectionLabel: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stepBadge: {
    width: spacing.lg,
    height: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepBadgeText: { ...typography.body2, color: colors.primaryBright, fontWeight: '700' },
  stepContent: { flex: 1, marginLeft: spacing.md },
  stepTitle: { ...typography.body1, color: colors.text, fontWeight: '600', marginBottom: spacing.xs },
  stepDescription: { ...typography.body2, color: colors.textSecondary, lineHeight: 22 },
  actionButton: {
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  actionButtonPrimary: { backgroundColor: colors.primary },
  actionButtonPrimaryText: { ...typography.button, color: colors.white },
  stickyFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  stickyAction: {
    flex: 1,
    minHeight: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  stickyActionDisabled: {
    opacity: 0.5,
  },
  stickyActionText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  stickyShareText: { ...typography.caption, color: colors.primaryBright, fontWeight: '600' },
  stickyDeleteText: { ...typography.caption, color: colors.negative, fontWeight: '600' },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  primaryButtonText: { ...typography.button, color: colors.white },
});
