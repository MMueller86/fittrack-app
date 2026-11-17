// Episodes and cold-start milestones. An episode starts with the cold start (origin: JS entry) or with
// a return to the foreground (origin: the `active` app state) and ends when the app moves to the
// background. All event times are milliseconds relative to the origin of their episode.
// This module has no React Native import: App.tsx passes in AppState.

import { getAppRegisteredPerfMs, jsEntryPerfMs, nowMs } from './startMark';
import { newUuid } from './ids';
import {
  flush, record, setForeground, startTelemetry,
  type AppInfo, type AuthPath, type MilestoneName,
} from './telemetry';

export interface Episode {
  id: string;
  trigger: 'cold_start' | 'resume';
  originPerfMs: number;
  /** Set by screenTelemetry: first screen load / first Home load of this episode already started. */
  firstScreenStarted: boolean;
  homeStarted: boolean;
}

export interface AppStateLike {
  addEventListener(type: 'change', listener: (state: string) => void): { remove(): void };
}

const MAX_TIME_MS = 604_800_000;

export function clampMs(value: number, max = MAX_TIME_MS): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(0, Math.round(value))) : 0;
}

let current: Episode | null = null;
const emitted = new Set<MilestoneName>();
let initialised = false;
let subscription: { remove(): void } | null = null;
let backgroundedAtWallMs: number | null = null;

function milestone(name: MilestoneName, atMs: number, extra: { authPath?: AuthPath; authMs?: number } = {}): boolean {
  if (current === null || current.trigger !== 'cold_start' || emitted.has(name)) return false;
  emitted.add(name);
  record({ type: 'milestone', episodeId: current.id, name, atMs: clampMs(atMs), ...extra });
  return true;
}

function startColdStart(): Episode {
  const episode: Episode = {
    id: newUuid(), trigger: 'cold_start', originPerfMs: jsEntryPerfMs, firstScreenStarted: false, homeStarted: false,
  };
  current = episode;
  emitted.clear();
  record({ type: 'episode', episodeId: episode.id, trigger: 'cold_start', jsEntryPerfMs: clampMs(jsEntryPerfMs) });
  milestone('js_entry', 0);
  milestone('app_registered', (getAppRegisteredPerfMs() ?? nowMs()) - jsEntryPerfMs);
  return episode;
}

function startResume(backgroundMs: number): Episode {
  const episode: Episode = {
    id: newUuid(), trigger: 'resume', originPerfMs: nowMs(), firstScreenStarted: false, homeStarted: false,
  };
  current = episode;
  emitted.clear();
  record({ type: 'episode', episodeId: episode.id, trigger: 'resume', backgroundMs: clampMs(backgroundMs) });
  return episode;
}

/** The running episode; starts the cold-start episode if none exists yet. */
export function getCurrentEpisode(): Episode {
  return current ?? startColdStart();
}

export function episodeTime(perfMs: number, episode: Episode = getCurrentEpisode()): number {
  return clampMs(perfMs - episode.originPerfMs);
}

function onAppStateChange(state: string): void {
  try {
    if (state === 'background') {
      if (backgroundedAtWallMs === null) backgroundedAtWallMs = Date.now();
      setForeground(false);
      void flush();
    } else if (state === 'active' && backgroundedAtWallMs !== null) {
      const backgroundMs = Date.now() - backgroundedAtWallMs;
      backgroundedAtWallMs = null;
      startResume(backgroundMs);
      setForeground(true);
    }
  } catch {
    // ignore
  }
}

/** Starts the cold-start episode, the flush timer and the foreground/background tracking. Idempotent. */
export function initEpisodes(appState: AppStateLike, appInfo: AppInfo): void {
  try {
    if (initialised) return;
    initialised = true;
    getCurrentEpisode();
    startTelemetry(appInfo);
    subscription = appState.addEventListener('change', onAppStateChange);
  } catch {
    // ignore
  }
}

export function stopEpisodes(): void {
  try {
    subscription?.remove();
  } catch {
    // ignore
  }
  subscription = null;
}

export function markRootMounted(): void {
  try {
    const episode = getCurrentEpisode();
    milestone('root_mounted', nowMs() - episode.originPerfMs);
  } catch {
    // ignore
  }
}

export function markAuthReady(authPath: AuthPath, authMs: number): void {
  try {
    const episode = getCurrentEpisode();
    milestone('auth_ready', nowMs() - episode.originPerfMs, { authPath, authMs: clampMs(authMs) });
  } catch {
    // ignore
  }
}

export function markNavigatorMounted(): void {
  try {
    const episode = getCurrentEpisode();
    milestone('navigator_mounted', nowMs() - episode.originPerfMs);
  } catch {
    // ignore
  }
}

/** `ready` = end of the first Home screen event of the cold-start episode. */
export function markReady(atEpisodeMs: number): void {
  try {
    getCurrentEpisode();
    // Early flush: started, not awaited; flush() swallows its own errors and checks authentication.
    if (milestone('ready', atEpisodeMs)) flush().catch(() => {});
  } catch {
    // ignore
  }
}
