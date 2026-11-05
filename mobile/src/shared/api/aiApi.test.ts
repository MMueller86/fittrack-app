import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMock = vi.hoisted(() => vi.fn());
const postMock = vi.hoisted(() => vi.fn());
const getLocalDateContextMock = vi.hoisted(() => vi.fn());
const getLocalTimezoneOffsetMinutesMock = vi.hoisted(() => vi.fn());

vi.mock('./client', () => ({
  apiClient: { get: getMock, post: postMock },
}));

describe('aiApi.estimateMeal', () => {
  beforeEach(() => {
    postMock.mockReset();
    postMock.mockResolvedValue({ data: { mealName: 'Reis', components: [] } });
  });

  it('sends an initial estimate as JSON without refinement data', async () => {
    await aiApi.estimateMeal('Reis');

    expect(postMock).toHaveBeenCalledWith('/ai/meal-estimate/preview', {
      text: 'Reis',
    }, { timeout: 60_000 });
  });

  it('sends an initial estimate with a photo as multipart without refinement data', async () => {
    class CaptureFormData {
      readonly fields: Array<[string, unknown]> = [];
      append(name: string, value: unknown) {
        this.fields.push([name, value]);
      }
    }
    vi.stubGlobal('FormData', CaptureFormData);

    try {
      await aiApi.estimateMeal('Reis', '/meal.jpg', 'image/jpeg');
      const requestForm = postMock.mock.calls[0]?.[1] as CaptureFormData | undefined;
      expect(requestForm?.fields).toEqual([
        ['text', 'Reis'],
        ['image', { uri: '/meal.jpg', type: 'image/jpeg', name: 'meal.jpg' }],
      ]);
      expect(postMock.mock.calls[0]?.[2]).toMatchObject({
        headers: {
          'Content-Type': 'multipart/form-data',
          Accept: 'application/x-ndjson',
        },
        timeout: 60_000,
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('sends the complete prior V2 snapshot and size hint as JSON', async () => {
    const refine = {
      previous: {
        mealName: 'Reis',
        estimatedTotalGrams: 250,
        mealEstimate: { calories: 300, protein: 8, carbs: 60, fat: 2, fiber: 1 },
        componentItems: [{ name: 'Reis', estimatedGrams: 250, calories: 300 }],
      },
      hints: ['larger' as const],
      note: 'mit Käse',
    };

    await aiApi.estimateMeal('Reis', undefined, undefined, refine);

    expect(postMock).toHaveBeenCalledWith('/ai/meal-estimate/preview', {
      text: 'Reis',
      refine,
    }, { timeout: 60_000 });
  });

  it('serializes the refinement snapshot in multipart requests with a photo', async () => {
    const refine = {
      previous: {
        mealName: 'Reis',
        estimatedTotalGrams: 250,
        mealEstimate: { calories: 300, protein: 8, carbs: 60, fat: 2, fiber: 1 },
        componentItems: [{ name: 'Reis', estimatedGrams: 250, calories: 300 }],
      },
      hints: ['smaller' as const],
      note: 'ohne Soße',
    };
    class CaptureFormData {
      readonly fields: Array<[string, unknown]> = [];
      append(name: string, value: unknown) {
        this.fields.push([name, value]);
      }
    }
    vi.stubGlobal('FormData', CaptureFormData);

    try {
      await aiApi.estimateMeal('Reis', '/meal.jpg', 'image/jpeg', refine);
      const requestForm = postMock.mock.calls[0]?.[1] as CaptureFormData | undefined;
      expect(requestForm?.fields).toEqual([
        ['text', 'Reis'],
        ['refine', JSON.stringify(refine)],
        ['image', { uri: '/meal.jpg', type: 'image/jpeg', name: 'meal.jpg' }],
      ]);
      expect(postMock.mock.calls[0]?.[2]).toMatchObject({
        headers: {
          'Content-Type': 'multipart/form-data',
          Accept: 'application/x-ndjson',
        },
        timeout: 60_000,
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('emits only complete progress records when XHR responseText grows in partial chunks', () => {
    const onProgress = vi.fn();
    const parse = createAiMealEstimateProgressParser(onProgress);
    const photoCheck = '{"event":"photo_check.completed"}\n';

    parse(photoCheck.slice(0, 17));
    expect(onProgress).not.toHaveBeenCalled();
    parse(photoCheck);

    expect(onProgress).toHaveBeenCalledWith({ event: 'photo_check.completed' });
  });

  it('processes multiple complete records from one progress update in order', () => {
    const onProgress = vi.fn();
    const parse = createAiMealEstimateProgressParser(onProgress);

    parse('{"event":"photo_check.completed"}\n{"event":"estimate.started"}\n');

    expect(onProgress.mock.calls).toEqual([
      [{ event: 'photo_check.completed' }],
      [{ event: 'estimate.started' }],
    ]);
  });

  it('does not replay buffered phases when result arrives in the same progress update', () => {
    const onProgress = vi.fn();
    const parse = createAiMealEstimateProgressParser(onProgress);

    parse([
      '{"event":"photo_check.completed"}',
      '{"event":"estimate.started"}',
      JSON.stringify({ event: 'result', data: streamedEstimate }),
    ].join('\n'));

    expect(onProgress).not.toHaveBeenCalled();
  });

  it('does not show buffered phases when a terminal error shares the progress update', () => {
    const onProgress = vi.fn();
    const parse = createAiMealEstimateProgressParser(onProgress);

    parse('{"event":"photo_check.completed"}\n{"event":"error","code":"processing_failed"}');

    expect(onProgress).not.toHaveBeenCalled();
  });

  it('forwards only complete phase records from the existing Axios download callback', async () => {
    const onProgress = vi.fn();
    await aiApi.estimateMeal('Reis', '/meal.jpg', 'image/jpeg', undefined, { onProgress });
    const requestConfig = postMock.mock.calls[0]?.[2] as {
      onDownloadProgress?: (event: {
        event: { target: { responseText: string } };
        loaded: number;
        bytes: number;
        lengthComputable: boolean;
      }) => void;
    } | undefined;

    requestConfig?.onDownloadProgress?.({
      event: { target: { responseText: '{"event":"photo_check.completed"}\n' } },
      loaded: 34,
      bytes: 34,
      lengthComputable: false,
    });

    expect(onProgress).toHaveBeenCalledWith({ event: 'photo_check.completed' });
  });

  it('returns the final result from the NDJSON response without replaying buffered phases', async () => {
    postMock.mockResolvedValueOnce({ data: [
      '{"event":"photo_check.completed"}',
      '{"event":"estimate.started"}',
      JSON.stringify({ event: 'result', data: streamedEstimate }),
      '',
    ].join('\n') });

    await expect(aiApi.estimateMeal('Reis', '/meal.jpg', 'image/jpeg')).resolves.toEqual(streamedEstimate);
  });

  it('rejects a terminal processing error instead of resolving a preview', async () => {
    postMock.mockResolvedValueOnce({ data: '{"event":"error","code":"processing_failed"}\n' });

    await expect(aiApi.estimateMeal('Reis', '/meal.jpg', 'image/jpeg'))
      .rejects.toThrow('Die KI-Schätzung konnte nicht abgeschlossen werden. Bitte versuche es erneut.');
  });

  it('propagates a transport failure without fabricating a completed phase', async () => {
    const transportError = new Error('network unavailable');
    const onProgress = vi.fn();
    postMock.mockRejectedValueOnce(transportError);

    await expect(aiApi.estimateMeal('Reis', '/meal.jpg', 'image/jpeg', undefined, { onProgress }))
      .rejects.toBe(transportError);
    expect(onProgress).not.toHaveBeenCalled();
  });

  it('passes an AbortSignal to the existing photo request', async () => {
    const controller = new AbortController();
    let requestSignal: AbortSignal | undefined;
    postMock.mockImplementationOnce((_url, _body, config) => {
      requestSignal = (config as { signal: AbortSignal }).signal;
      return new Promise((_resolve, reject) => {
        requestSignal?.addEventListener('abort', () => reject(new Error('request aborted')), { once: true });
      });
    });

    const request = aiApi.estimateMeal('Reis', '/meal.jpg', 'image/jpeg', undefined, { signal: controller.signal });
    controller.abort();

    await expect(request).rejects.toThrow('request aborted');
    expect(requestSignal).toBe(controller.signal);
  });
});

vi.mock('../date/localDate', () => ({
  getLocalDateContext: getLocalDateContextMock,
  getLocalTimezoneOffsetMinutes: getLocalTimezoneOffsetMinutesMock,
}));

import { aiApi, createAiMealEstimateProgressParser } from './aiApi';

const streamedEstimate = {
  mealName: 'Reis',
  mealEstimate: { calories: 300, protein: 8, carbs: 60, fat: 2, fiber: 1 },
  components: ['Reis'],
  contextDetected: null,
  portionConfidence: 'medium',
  photoUsed: true,
  assumptions: [],
  warnings: [],
};

describe('aiApi.getDailyInsight', () => {
  beforeEach(() => {
    getMock.mockReset();
    getLocalDateContextMock.mockReset();
    getLocalTimezoneOffsetMinutesMock.mockReset();
    getMock.mockResolvedValue({ data: { status: 'fresh' } });
  });

  it('sends the requested local date with local hour and offset', async () => {
    getLocalDateContextMock.mockReturnValue({ currentLocalDate: '2026-08-20', currentHour: 7 });
    getLocalTimezoneOffsetMinutesMock.mockReturnValue(120);

    await aiApi.getDailyInsight('2026-08-20');

    expect(getMock).toHaveBeenCalledWith('/ai/daily-insight', {
      params: {
        date: '2026-08-20',
        localHour: 7,
        timezoneOffsetMinutes: 120,
      },
    });
  });

  it('omits unknown local time values instead of inventing defaults', async () => {
    getLocalDateContextMock.mockReturnValue({ currentLocalDate: '2026-08-20', currentHour: null });
    getLocalTimezoneOffsetMinutesMock.mockReturnValue(null);

    await aiApi.getDailyInsight();

    expect(getMock).toHaveBeenCalledWith('/ai/daily-insight', {
      params: { date: '2026-08-20' },
    });
  });
});