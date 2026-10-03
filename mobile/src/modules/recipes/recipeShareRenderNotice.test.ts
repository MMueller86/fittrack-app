import { describe, expect, it, vi } from 'vitest';
import {
  getRecipeShareRenderNotice,
  logRecipeShareRenderFailure,
} from './recipeShareRenderNotice';

function makeAxiosError(code: string) {
  return Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    response: { data: { code }, status: 422 },
  });
}

describe('recipeShareRenderNotice', () => {
  it('explains the missing photo without offering an ineffective render retry', () => {
    const notice = getRecipeShareRenderNotice(makeAxiosError('NO_RECIPE_IMAGE'), 'initial');
    expect(notice).toEqual({
      kind: 'photo',
      title: 'Rezeptfoto fehlt',
      body: 'Bitte lade zuerst ein Rezeptfoto hoch, bevor du das Rezept teilst.',
    });
    expect(notice.actionLabel).toBeUndefined();
  });

  it('treats a stale export response as a retryable render error', () => {
    expect(getRecipeShareRenderNotice(makeAxiosError('STALE_EXPORT_VIEW'), 'initial')).toMatchObject({
      kind: 'render',
      title: 'Vorschau konnte nicht erstellt werden',
      actionLabel: 'Erneut versuchen',
    });
  });

  it('offers in-Share preparation when the server has no confirmed export view', () => {
    expect(getRecipeShareRenderNotice(makeAxiosError('MISSING_EXPORT_VIEW'), 'initial')).toMatchObject({
      kind: 'missing',
      title: 'Exportansicht fehlt',
      body: expect.stringContaining('hier erneut vorbereiten'),
      actionLabel: 'Erneut vorbereiten',
    });
  });

  it('offers a retry for an initial render failure', () => {
    expect(getRecipeShareRenderNotice(new Error('network'), 'initial')).toMatchObject({
      kind: 'render',
      title: 'Vorschau konnte nicht erstellt werden',
      body: expect.stringContaining('beiden Vorschauen'),
      actionLabel: 'Erneut versuchen',
    });
  });

  it('logs render stage and safe Axios response details without request config', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = Object.assign(new Error('Request failed with status code 422'), {
      isAxiosError: true,
      code: 'ERR_BAD_REQUEST',
      config: { headers: { Authorization: 'Bearer secret-token' } },
      response: {
        status: 422,
        data: {
          error: 'Recipe detail image cannot be rendered',
          code: 'TEMPLATE_FIELD_OVERFLOW',
        },
      },
    });

    try {
      logRecipeShareRenderFailure(error, 'recipe-1', 'initial');

      expect(consoleError).toHaveBeenCalledTimes(1);
      const logCall = consoleError.mock.calls[0];
      expect(logCall).toHaveLength(1);
      const loggedLine = String(logCall?.[0]);
      const logPrefix = '[RecipeDetail] Share preview render failed ';
      expect(loggedLine.startsWith(logPrefix)).toBe(true);
      const details = JSON.parse(loggedLine.slice(logPrefix.length)) as Record<string, unknown>;
      expect(details).toMatchObject({
        recipeId: 'recipe-1',
        stage: 'initial',
        errorName: 'Error',
        errorMessage: 'Request failed with status code 422',
        axiosCode: 'ERR_BAD_REQUEST',
        httpStatus: 422,
        apiError: 'Recipe detail image cannot be rendered',
        apiCode: 'TEMPLATE_FIELD_OVERFLOW',
      });
      expect(loggedLine).not.toContain('secret-token');
    } finally {
      consoleError.mockRestore();
    }
  });

  it('keeps the last complete pair available but describes a failed replacement', () => {
    expect(getRecipeShareRenderNotice(new Error('network'), 'final')).toMatchObject({
      kind: 'render',
      body: expect.stringContaining('letzte vollständige Vorschau bleibt erhalten'),
      actionLabel: 'Erneut versuchen',
    });
  });
});