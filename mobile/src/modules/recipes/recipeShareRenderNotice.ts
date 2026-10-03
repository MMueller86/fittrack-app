import axios from 'axios';
import type { RecipeShareRenderStage } from './recipeShareDraftState';

export interface RecipeShareRenderNotice {
  kind: 'render' | 'missing' | 'photo';
  title: string;
  body: string;
  actionLabel?: string;
}

export function logRecipeShareRenderFailure(
  error: unknown,
  recipeId: string,
  stage: RecipeShareRenderStage,
): void {
  const details: Record<string, string | number> = {
    recipeId,
    stage: stage ?? 'unknown',
    errorName: error instanceof Error ? error.name : 'NonError',
    errorMessage: error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Unknown share preview failure',
  };
  if (error instanceof Error && error.stack) details['errorStack'] = error.stack;

  if (axios.isAxiosError<{ code?: unknown; error?: unknown }>(error)) {
    if (typeof error.code === 'string') details['axiosCode'] = error.code;
    if (typeof error.response?.status === 'number') details['httpStatus'] = error.response.status;
    const responseData = error.response?.data;
    if (typeof responseData?.code === 'string') details['apiCode'] = responseData.code;
    if (typeof responseData?.error === 'string') details['apiError'] = responseData.error;
  }

  console.error(`[RecipeDetail] Share preview render failed ${JSON.stringify(details)}`);
}

export function getRecipeShareRenderNotice(
  error: unknown,
  stage: RecipeShareRenderStage,
): RecipeShareRenderNotice {
  if (axios.isAxiosError<{ code?: string }>(error)) {
    const code = error.response?.data?.code;
    if (code === 'NO_RECIPE_IMAGE') {
      return {
        kind: 'photo',
        title: 'Rezeptfoto fehlt',
        body: 'Bitte lade zuerst ein Rezeptfoto hoch, bevor du das Rezept teilst.',
      };
    }
    if (code === 'MISSING_EXPORT_VIEW') {
      return {
        kind: 'missing',
        title: 'Exportansicht fehlt',
        body: 'Die Exportansicht ist nicht mehr verfügbar. Du kannst die Texte hier erneut vorbereiten und prüfen.',
        actionLabel: 'Erneut vorbereiten',
      };
    }
  }

  return {
    kind: 'render',
    title: 'Vorschau konnte nicht erstellt werden',
    body: stage === 'final'
      ? 'Die neuen Vorschauen konnten nicht erstellt werden. Deine letzte vollständige Vorschau bleibt erhalten.'
      : 'Die beiden Vorschauen konnten nicht erstellt werden. Bitte versuche es erneut.',
    actionLabel: 'Erneut versuchen',
  };
}