// Cold start and resume episodes with a mocked clock and a mocked transport (AC-31, AC-32).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env['EXPO_PUBLIC_API_URL'] = 'http://localhost:7071/api';

const mocks = vi.hoisted(() => ({
  record: vi.fn(),
  flush: vi.fn(),
  getAccessToken: vi.fn(),
  isTokenExpired: vi.fn(),
  refreshAccessToken: vi.fn(),
}));

vi.mock('./telemetry', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./telemetry')>()),
  record: mocks.record,
  flush: mocks.flush,
}));
vi.mock('../authService', () => ({
  authService: {
    getAccessToken: mocks.getAccessToken,
    isTokenExpired: mocks.isTokenExpired,
    refreshAccessToken: mocks.refreshAccessToken,
    clearTokens: vi.fn().mockResolvedValue(undefined),
  },
}));

type Ev = Record<string, unknown> & { type: string };
const APP = { version: '1.0.0', variant: 'development', os: 'android', osVersion: '15' } as const;

const events = (): Ev[] => mocks.record.mock.calls.map((c) => c[0] as Ev);
const ofType = (type: string) => events().filter((e) => e.type === type);
const milestones = () => ofType('milestone');
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function settle<T>(promise: Promise<T>, ms = 200): Promise<T> {
  await vi.advanceTimersByTimeAsync(ms);
  return promise;
}

function makeAppState() {
  let listener: (state: string) => void = () => {};
  return {
    appState: {
      addEventListener: (_type: 'change', l: (state: string) => void) => {
        listener = l;
        return { remove() {} };
      },
    },
    emit: (state: string) => listener(state),
  };
}

async function loadAll() {
  const startMark = await import('./startMark');
  const episode = await import('./episode');
  const screen = await import('./screenTelemetry');
  const client = await import('../../shared/api/client');
  client.apiClient.defaults.adapter = vi.fn().mockImplementation(async (config) => {
    await sleep(10);
    return { status: 200, statusText: 'OK', headers: {}, config, data: {} };
  });
  const { useAuthStore } = await import('../../modules/auth/useAuthStore');
  const { getWeightChanges } = await import('../weightsService');
  const { diaryApi } = await import('../../shared/api/diaryApi');
  return { startMark, episode, screen, client, useAuthStore, getWeightChanges, diaryApi };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] });
  vi.setSystemTime(new Date('2026-11-16T10:00:00Z'));
  vi.resetModules();
  mocks.record.mockReset();
  mocks.flush.mockReset().mockResolvedValue(undefined);
  mocks.getAccessToken.mockReset().mockResolvedValue('tok');
  mocks.isTokenExpired.mockReset().mockReturnValue(false);
  mocks.refreshAccessToken.mockReset().mockResolvedValue('tok2');
});

afterEach(() => vi.useRealTimers());

describe('cold start (AC-31)', () => {
  it.each([
    ['no_token', { token: null, expired: false, refreshed: null }],
    ['valid', { token: 'tok', expired: false, refreshed: null }],
    ['refreshed', { token: 'tok', expired: true, refreshed: 'tok2' }],
    ['refresh_failed', { token: 'tok', expired: true, refreshed: null }],
  ])('emits the six milestones once and in order, auth path %s', async (authPath, setup) => {
    mocks.getAccessToken.mockImplementation(async () => {
      await sleep(5);
      return setup.token;
    });
    mocks.isTokenExpired.mockReturnValue(setup.expired);
    mocks.refreshAccessToken.mockImplementation(async () => {
      await sleep(40);
      return setup.refreshed;
    });

    const m = await loadAll();
    const { appState } = makeAppState();
    await vi.advanceTimersByTimeAsync(20);
    m.startMark.markAppRegistered();
    m.episode.initEpisodes(appState, APP);
    await vi.advanceTimersByTimeAsync(10);
    m.episode.markRootMounted();

    await settle(m.useAuthStore.getState().initialize());
    await vi.advanceTimersByTimeAsync(15);
    m.episode.markNavigatorMounted();

    // Home: profile and Home data calls are ui, sync services are sync.
    const home = m.screen.beginScreenLoad('Home');
    const { apiClient } = m.client;
    await settle(Promise.all([apiClient.get('/profile/me'), apiClient.get('/weights'), apiClient.get('/diary/day/2026-11-16')]));
    await settle(Promise.all([m.getWeightChanges('2026-11-01T00:00:00Z'), m.diaryApi.getMealChanges('2026-11-01T00:00:00Z', 50)]));
    home.dataReady('data');
    await vi.advanceTimersByTimeAsync(7);
    home.rendered();
    home.rendered();

    expect(ofType('episode')).toHaveLength(1);
    expect(ofType('episode')[0]).toMatchObject({ trigger: 'cold_start' });
    expect(typeof ofType('episode')[0]!['jsEntryPerfMs']).toBe('number');

    const names = milestones().map((e) => e['name']);
    expect(names).toEqual(['js_entry', 'app_registered', 'root_mounted', 'auth_ready', 'navigator_mounted', 'ready']);
    const at = milestones().map((e) => e['atMs'] as number);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(new Set(milestones().map((e) => e['episodeId'])).size).toBe(1);

    const auth = milestones().find((e) => e['name'] === 'auth_ready')!;
    expect(auth['authPath']).toBe(authPath);
    expect(typeof auth['authMs']).toBe('number');
    if (authPath === 'refreshed' || authPath === 'refresh_failed') expect(auth['authMs'] as number).toBeGreaterThanOrEqual(40);

    const screens = ofType('screen');
    expect(screens).toHaveLength(1);
    expect(screens[0]).toMatchObject({ name: 'Home', trigger: 'cold_start', result: 'data' });
    const ready = milestones().find((e) => e['name'] === 'ready')!;
    expect(ready['atMs']).toBe((screens[0]!['startedAtMs'] as number) + (screens[0]!['durationMs'] as number));

    const sources = Object.fromEntries(ofType('api').map((e) => [e['route'] as string, e['source']]));
    expect(sources['GET /api/profile/me']).toBe('ui');
    expect(sources['GET /api/weights']).toBe('ui');
    expect(sources['GET /api/diary/day/{date}']).toBe('ui');
    expect(sources['GET /api/weights/changes']).toBe('sync');
    expect(sources['GET /api/diary/changes/meals']).toBe('sync');
    expect(sources['GET /api/health']).toBeUndefined();
  });
});

describe('early flush after ready (AC-18, AC-19)', () => {
  async function coldHome(result: 'data' | 'empty' | 'error') {
    const m = await loadAll();
    m.episode.initEpisodes(makeAppState().appState, APP);
    const home = m.screen.beginScreenLoad('Home');
    await vi.advanceTimersByTimeAsync(20);
    home.dataReady(result);
    return { m, home };
  }

  it.each(['data', 'empty', 'error'] as const)('starts exactly one flush for a cold start with result %s', async (result) => {
    const { home } = await coldHome(result);
    expect(mocks.flush).not.toHaveBeenCalled();
    home.rendered();
    home.rendered();
    expect(mocks.flush).toHaveBeenCalledTimes(1);
    expect(milestones().some((e) => e['name'] === 'ready')).toBe(true);
  });

  it('flushes after the ready milestone has been recorded', async () => {
    const { home } = await coldHome('data');
    mocks.flush.mockImplementation(() => {
      expect(milestones().some((e) => e['name'] === 'ready')).toBe(true);
      return Promise.resolve();
    });
    home.rendered();
    expect(mocks.flush).toHaveBeenCalledTimes(1);
  });

  it('does not wait for a flush that never resolves', async () => {
    mocks.flush.mockReturnValue(new Promise<void>(() => {}));
    const { home } = await coldHome('data');
    expect(() => home.rendered()).not.toThrow();
    expect(ofType('screen')).toHaveLength(1);
    expect(mocks.flush).toHaveBeenCalledTimes(1);
  });

  it('a rejecting or throwing flush changes neither screen nor milestone events', async () => {
    mocks.flush.mockRejectedValue(new Error('boom'));
    const { home } = await coldHome('data');
    expect(() => home.rendered()).not.toThrow();
    await vi.advanceTimersByTimeAsync(10);
    expect(ofType('screen')).toHaveLength(1);
    expect(milestones().some((e) => e['name'] === 'ready')).toBe(true);

    mocks.flush.mockReset().mockImplementation(() => {
      throw new Error('sync boom');
    });
    vi.resetModules();
    const second = await coldHome('data');
    expect(() => second.home.rendered()).not.toThrow();
    expect(ofType('screen')).toHaveLength(2);
  });

  it('resume episode, tab switch and focus return do not flush early', async () => {
    const m = await loadAll();
    const { appState, emit } = makeAppState();
    m.episode.initEpisodes(appState, APP);
    emit('background');
    mocks.flush.mockClear();
    emit('active');

    const first = m.screen.beginScreenLoad('Home');
    first.dataReady('data');
    first.rendered();
    m.screen.notifyTabPress('Nutrition');
    const tab = m.screen.beginScreenLoad('Nutrition');
    tab.dataReady('data');
    tab.rendered();
    const focus = m.screen.beginScreenLoad('Home');
    focus.dataReady('data');
    focus.rendered();

    expect(ofType('screen')).toHaveLength(3);
    expect(mocks.flush).not.toHaveBeenCalled();
  });

  it('a tab switch or second Home load in a cold-start episode does not flush again', async () => {
    const { m, home } = await coldHome('data');
    home.rendered();
    mocks.flush.mockClear();
    const tab = m.screen.beginScreenLoad('Nutrition');
    tab.dataReady('data');
    tab.rendered();
    const again = m.screen.beginScreenLoad('Home');
    again.dataReady('data');
    again.rendered();
    expect(mocks.flush).not.toHaveBeenCalled();
  });
});

describe('resume (AC-32)', () => {
  it('starts a resume episode with backgroundMs and tab_switch screen events', async () => {
    const m = await loadAll();
    const { appState, emit } = makeAppState();
    m.episode.initEpisodes(appState, APP);
    const coldId = m.episode.getCurrentEpisode().id;

    emit('background');
    await vi.advanceTimersByTimeAsync(90_000);
    emit('active');

    const resume = ofType('episode').find((e) => e['trigger'] === 'resume')!;
    expect(resume['backgroundMs']).toBe(90_000);
    expect(resume['episodeId']).not.toBe(coldId);
    expect(milestones().every((e) => e['episodeId'] === coldId)).toBe(true);

    // first load after resume is the resume event, times are relative to the new origin
    await vi.advanceTimersByTimeAsync(500);
    const first = m.screen.beginScreenLoad('Nutrition');
    await vi.advanceTimersByTimeAsync(80);
    first.dataReady('data');
    first.rendered();
    const resumeScreen = ofType('screen')[0]!;
    expect(resumeScreen).toMatchObject({ trigger: 'resume', episodeId: resume['episodeId'], startedAtMs: 500, durationMs: 80 });

    m.screen.notifyTabPress('Weight');
    await vi.advanceTimersByTimeAsync(30);
    const tab = m.screen.beginScreenLoad('Progress');
    await vi.advanceTimersByTimeAsync(50);
    tab.dataReady('empty');
    tab.rendered();
    expect(ofType('screen')[1]).toMatchObject({
      name: 'Progress', trigger: 'tab_switch', result: 'empty', startedAtMs: 580, durationMs: 80,
    });
  });

  it('a screen left before it finished and a load that never finishes record nothing', async () => {
    const m = await loadAll();
    m.episode.initEpisodes(makeAppState().appState, APP);
    const left = m.screen.beginScreenLoad('Recipes');
    left.cancel();
    left.dataReady('data');
    left.rendered();
    const pending = m.screen.beginScreenLoad('Profile');
    pending.dataReady('data');
    expect(ofType('screen')).toHaveLength(0);
  });
});
