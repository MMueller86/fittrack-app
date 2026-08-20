import React, { type ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyInsightResponse } from '../../services/insightService';
import { aiApi } from '../../shared/api/aiApi';
import { InsightCard } from './InsightCard';

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const cryptoMock = vi.hoisted(() => ({
  randomUUID: vi.fn(),
}));

vi.mock('expo-crypto', () => cryptoMock);

vi.mock('../../shared/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('react-native', async () => {
  const ReactModule = await import('react');

  class AnimatedValue {
    constructor(public value: number) {}

    setValue(value: number) {
      this.value = value;
    }
  }

  const immediateAnimation = () => ({
    start(callback?: () => void) {
      callback?.();
    },
  });

  const Modal = ({ visible, children, ...props }: { visible: boolean; children?: ReactNode }) => (
    visible ? ReactModule.createElement('Modal', { ...props, visible }, children) : null
  );

  return {
    ActivityIndicator: 'ActivityIndicator',
    Animated: {
      Value: AnimatedValue,
      loop: immediateAnimation,
      sequence: () => ({}),
      timing: immediateAnimation,
      View: 'Animated.View',
    },
    Modal,
    StyleSheet: {
      absoluteFillObject: {},
      create: <T,>(styles: T) => styles,
    },
    Text: 'Text',
    TouchableOpacity: 'TouchableOpacity',
    View: 'View',
  };
});

vi.mock('@gorhom/bottom-sheet', async () => {
  const ReactModule = await import('react');

  type BottomSheetHandle = {
    present: () => void;
    dismiss: () => void;
  };

  type BottomSheetProps = {
    children?: ReactNode;
    onDismiss?: () => void;
  };

  const BottomSheetModal = ReactModule.forwardRef<BottomSheetHandle, BottomSheetProps>(
    ({ children, onDismiss }, ref) => {
      const [visible, setVisible] = ReactModule.useState(false);
      const dismiss = ReactModule.useCallback(() => {
        setVisible(false);
        onDismiss?.();
      }, [onDismiss]);

      ReactModule.useImperativeHandle(ref, () => ({
        present: () => setVisible(true),
        dismiss,
      }), [dismiss]);

      return visible
        ? ReactModule.createElement('BottomSheetModal', { testID: 'feedback-sheet' }, children)
        : null;
    },
  );

  return {
    BottomSheetBackdrop: 'BottomSheetBackdrop',
    BottomSheetModal,
    BottomSheetScrollView: 'BottomSheetScrollView',
    BottomSheetTextInput: 'BottomSheetTextInput',
  };
});

vi.mock('../../shared/components/Icon', () => ({ Icon: 'Icon' }));

const DATE = '2026-08-20';
const GENERATED_AT = '2026-08-20T08:30:00.000Z';
const FIRST_SUBMISSION_ID = '11111111-1111-4111-8111-111111111111';
const SECOND_SUBMISSION_ID = '22222222-2222-4222-8222-222222222222';
const THIRD_SUBMISSION_ID = '33333333-3333-4333-8333-333333333333';

const BASE_INSIGHT: DailyInsightResponse = {
  title: 'Dein Tagesfokus',
  summary: 'Eine stabile Analyse für den heutigen Tag.',
  recommendation: 'Plane den nächsten kleinen Schritt.',
  cta: 'Ernährung öffnen',
  ctaTarget: 'Nutrition',
  generatedAt: GENERATED_AT,
  promptVersion: 'v11',
  status: 'fresh',
  feedbackAvailable: true,
};

function makeInsight(overrides: Partial<DailyInsightResponse> = {}): DailyInsightResponse {
  return { ...BASE_INSIGHT, ...overrides };
}

function feedbackApiMock() {
  return vi.mocked(aiApi.submitDailyInsightFeedback);
}

function getByLabel(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  const matches = renderer.root.findAll((node) => node.props.accessibilityLabel === label);
  if (matches.length !== 1) {
    throw new Error(`Expected one element with accessibilityLabel ${label}, found ${matches.length}`);
  }
  return matches[0]!;
}

function queryByLabel(renderer: ReactTestRenderer, label: string): ReactTestInstance | undefined {
  return renderer.root.findAll((node) => node.props.accessibilityLabel === label)[0];
}

function getText(renderer: ReactTestRenderer, text: string): ReactTestInstance {
  const matches = renderer.root.findAll((node) => node.type === 'Text' && node.props.children === text);
  if (matches.length !== 1) {
    throw new Error(`Expected one Text node with value ${text}, found ${matches.length}`);
  }
  return matches[0]!;
}

function hasFeedbackSheet(renderer: ReactTestRenderer): boolean {
  return renderer.root.findAll((node) => node.props.testID === 'feedback-sheet').length === 1;
}

async function renderCard(options: {
  insight?: DailyInsightResponse | null;
  date?: string | null;
  onFeedbackSuccess?: () => void;
} = {}): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <InsightCard
        insight={options.insight === undefined ? makeInsight() : options.insight}
        date={options.date === undefined ? DATE : options.date}
        onFeedbackSuccess={options.onFeedbackSuccess}
      />,
    );
  });
  activeRenderers.push(renderer);
  return renderer;
}

async function press(instance: ReactTestInstance): Promise<void> {
  const onPress = instance.props.onPress as (() => void) | undefined;
  if (!onPress) throw new Error('Expected an onPress handler');
  await act(async () => {
    onPress();
  });
}

async function changeComment(renderer: ReactTestRenderer, value: string): Promise<void> {
  const input = getByLabel(renderer, 'Kommentar');
  const onChangeText = input.props.onChangeText as ((nextValue: string) => void) | undefined;
  if (!onChangeText) throw new Error('Expected an onChangeText handler');
  await act(async () => {
    onChangeText(value);
  });
}

async function startSubmit(renderer: ReactTestRenderer): Promise<void> {
  const button = queryByLabel(renderer, 'Feedback erneut senden')
    ?? getByLabel(renderer, 'Feedback senden');
  const onPress = button.props.onPress as (() => void) | undefined;
  if (!onPress) throw new Error('Expected a submit handler');
  await act(async () => {
    onPress();
    await Promise.resolve();
  });
}

async function flushAsync(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function openFeedbackSheet(renderer: ReactTestRenderer): Promise<void> {
  await press(getByLabel(renderer, 'Weitere Optionen'));
  await press(getByLabel(renderer, 'Feedback geben'));
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function feedbackError(status: number, code: string) {
  return {
    isAxiosError: true,
    response: { status, data: { code } },
  };
}

const activeRenderers: ReactTestRenderer[] = [];

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  const ids = [FIRST_SUBMISSION_ID, SECOND_SUBMISSION_ID, THIRD_SUBMISSION_ID];
  let idIndex = 0;
  cryptoMock.randomUUID.mockImplementation(() => ids[idIndex++] ?? THIRD_SUBMISSION_ID);
  vi.spyOn(aiApi, 'submitDailyInsightFeedback')
    .mockResolvedValue({ feedbackId: 'feedback-1', created: true });
});

afterEach(() => {
  for (const renderer of activeRenderers.splice(0)) {
    act(() => {
      renderer.unmount();
    });
  }
  vi.restoreAllMocks();
});

describe('InsightCard feedback interaction matrix', () => {
  it.each([
    { name: 'fresh insight', insight: makeInsight({ status: 'fresh' }), date: DATE, visible: true },
    { name: 'cached insight', insight: makeInsight({ status: 'cached' }), date: DATE, visible: true },
    { name: 'fresh insight without explicit false provenance flag', insight: makeInsight({ feedbackAvailable: undefined }), date: DATE, visible: true },
    { name: 'skeleton', insight: null, date: DATE, visible: false },
    { name: 'quota exceeded', insight: makeInsight({ status: 'quota_exceeded' }), date: DATE, visible: false },
    { name: 'unavailable insight', insight: makeInsight({ status: 'unavailable' }), date: DATE, visible: false },
    { name: 'missing date', insight: makeInsight(), date: null, visible: false },
    { name: 'feedback provenance unavailable', insight: makeInsight({ feedbackAvailable: false }), date: DATE, visible: false },
  ])('$name controls the feedback trigger', async ({ insight, date, visible }) => {
    const renderer = await renderCard({ insight, date });

    if (visible) {
      expect(queryByLabel(renderer, 'Weitere Optionen')).toBeDefined();
    } else {
      expect(queryByLabel(renderer, 'Weitere Optionen')).toBeUndefined();
    }
  });

  it('opens the sheet, trims the comment, rejects invalid lengths, and locks submit while pending', async () => {
    const request = createDeferred<{ feedbackId: string; created: boolean }>();
    feedbackApiMock().mockReturnValueOnce(request.promise);
    const renderer = await renderCard();

    await openFeedbackSheet(renderer);
    expect(hasFeedbackSheet(renderer)).toBe(true);

    await changeComment(renderer, '   ');
    expect(getByLabel(renderer, 'Feedback senden').props.disabled).toBe(true);

    await changeComment(renderer, 'a'.repeat(501));
    expect(getByLabel(renderer, 'Kommentar').props.maxLength).toBe(500);
    expect(getByLabel(renderer, 'Feedback senden').props.disabled).toBe(true);

    await changeComment(renderer, '  Nicht hilfreich  ');
    await startSubmit(renderer);

    expect(feedbackApiMock()).toHaveBeenCalledWith({
      date: DATE,
      insightGeneratedAt: GENERATED_AT,
      submissionId: FIRST_SUBMISSION_ID,
      userComment: 'Nicht hilfreich',
    });
    expect(getByLabel(renderer, 'Feedback senden').props.disabled).toBe(true);
    expect(getByLabel(renderer, 'Kommentar').props.editable).toBe(false);

    await press(getByLabel(renderer, 'Feedback senden'));
    expect(feedbackApiMock()).toHaveBeenCalledTimes(1);

    request.resolve({ feedbackId: 'feedback-pending', created: false });
    await act(async () => {
      await request.promise;
    });
    expect(hasFeedbackSheet(renderer)).toBe(false);
  });

  it('reuses the ID after a network failure and rotates it for a changed trimmed comment', async () => {
    const firstRequest = createDeferred<{ feedbackId: string; created: boolean }>();
    const secondRequest = createDeferred<{ feedbackId: string; created: boolean }>();
    feedbackApiMock()
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise)
      .mockResolvedValueOnce({ feedbackId: 'feedback-3', created: true });
    const renderer = await renderCard();

    await openFeedbackSheet(renderer);
    await changeComment(renderer, '  Erster Kommentar  ');
    await startSubmit(renderer);
    firstRequest.reject(new Error('offline'));
    await act(async () => {
      await firstRequest.promise.catch(() => undefined);
    });

    expect(getText(renderer, 'Feedback konnte nicht gesendet werden. Prüfe deine Verbindung und versuche es erneut.')).toBeDefined();
    expect(getByLabel(renderer, 'Kommentar').props.value).toBe('  Erster Kommentar  ');

    await startSubmit(renderer);
    expect(feedbackApiMock()).toHaveBeenNthCalledWith(2, {
      date: DATE,
      insightGeneratedAt: GENERATED_AT,
      submissionId: FIRST_SUBMISSION_ID,
      userComment: 'Erster Kommentar',
    });
    secondRequest.reject(new Error('still offline'));
    await act(async () => {
      await secondRequest.promise.catch(() => undefined);
    });

    await changeComment(renderer, '  Neuer Kommentar  ');
    await startSubmit(renderer);
    expect(feedbackApiMock()).toHaveBeenNthCalledWith(3, {
      date: DATE,
      insightGeneratedAt: GENERATED_AT,
      submissionId: SECOND_SUBMISSION_ID,
      userComment: 'Neuer Kommentar',
    });
  });

  it.each([true, false])('closes on success when created is %s and calls the success callback', async (created) => {
    const onFeedbackSuccess = vi.fn();
    feedbackApiMock().mockResolvedValue({ feedbackId: 'feedback-success', created });
    const renderer = await renderCard({ onFeedbackSuccess });

    await openFeedbackSheet(renderer);
    await changeComment(renderer, '  Passt nicht  ');
    await startSubmit(renderer);
    await flushAsync();

    expect(hasFeedbackSheet(renderer)).toBe(false);
    expect(onFeedbackSuccess).toHaveBeenCalledTimes(1);
    expect(feedbackApiMock()).toHaveBeenCalledWith({
      date: DATE,
      insightGeneratedAt: GENERATED_AT,
      submissionId: FIRST_SUBMISSION_ID,
      userComment: 'Passt nicht',
    });
  });

  it.each([
    {
      name: 'insight_not_found',
      status: 404,
      code: 'insight_not_found',
      message: 'Diese Analyse ist nicht mehr verfügbar. Dein Kommentar bleibt erhalten.',
      canRetry: true,
      expectedRetryId: FIRST_SUBMISSION_ID,
    },
    {
      name: 'insight_generation_changed',
      status: 409,
      code: 'insight_generation_changed',
      message: 'Diese Analyse wurde inzwischen neu erzeugt. Dein Kommentar wurde nicht an die neue Analyse gebunden.',
      canRetry: true,
      expectedRetryId: FIRST_SUBMISSION_ID,
    },
    {
      name: 'feedback_snapshot_unavailable',
      status: 409,
      code: 'feedback_snapshot_unavailable',
      message: 'Für diese Analyse ist kein vollständiger Feedback-Snapshot verfügbar. Dein Kommentar wurde nicht gesendet.',
      canRetry: false,
      expectedRetryId: null,
    },
    {
      name: 'feedback_submission_conflict',
      status: 409,
      code: 'feedback_submission_conflict',
      message: 'Diese Feedback-ID ist bereits mit einem anderen Kommentar verknüpft. Dein Kommentar bleibt erhalten; beim nächsten Versuch wird eine neue ID verwendet.',
      canRetry: true,
      expectedRetryId: SECOND_SUBMISSION_ID,
    },
  ])('$name retains the comment and applies its subsequent-submit rule', async ({ status, code, message, canRetry, expectedRetryId }) => {
    const onFeedbackSuccess = vi.fn();
    feedbackApiMock()
      .mockRejectedValueOnce(feedbackError(status, code))
      .mockRejectedValueOnce(new Error('retry failed'));
    const renderer = await renderCard({ onFeedbackSuccess });

    await openFeedbackSheet(renderer);
    await changeComment(renderer, '  Begründung  ');
    await startSubmit(renderer);
    await flushAsync();

    expect(getText(renderer, message)).toBeDefined();
    expect(getByLabel(renderer, 'Kommentar').props.value).toBe('  Begründung  ');
    expect(onFeedbackSuccess).not.toHaveBeenCalled();

    const retryButton = getByLabel(renderer, 'Feedback erneut senden');
    expect(retryButton.props.disabled).toBe(!canRetry);
    if (!canRetry) {
      expect(getByLabel(renderer, 'Kommentar').props.editable).toBe(false);
      expect(queryByLabel(renderer, 'Weitere Optionen')).toBeUndefined();
      await press(retryButton);
      expect(feedbackApiMock()).toHaveBeenCalledTimes(1);
      return;
    }

    await startSubmit(renderer);
    expect(feedbackApiMock()).toHaveBeenCalledTimes(2);
    expect(feedbackApiMock().mock.calls[1]?.[0]).toMatchObject({
      date: DATE,
      insightGeneratedAt: GENERATED_AT,
      submissionId: expectedRetryId,
      userComment: 'Begründung',
    });
    expect(onFeedbackSuccess).not.toHaveBeenCalled();
  });
});