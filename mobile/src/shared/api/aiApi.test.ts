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
        headers: { 'Content-Type': 'multipart/form-data' },
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
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60_000,
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

vi.mock('../date/localDate', () => ({
  getLocalDateContext: getLocalDateContextMock,
  getLocalTimezoneOffsetMinutes: getLocalTimezoneOffsetMinutesMock,
}));

import { aiApi } from './aiApi';

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