// `screen` events: time from opening a screen until it shows data, an empty state or an error state.
// A load that never finishes, or a screen left before it finished, records nothing.

import { clampMs, episodeTime, getCurrentEpisode, markReady } from './episode';
import { nowMs } from './startMark';
import { record, type ScreenName, type ScreenResult, type ScreenTrigger } from './telemetry';

export type { ScreenName, ScreenResult, ScreenTrigger };

export interface ScreenMeasure {
  /** The last required API response arrived (or failed). */
  dataReady(result: ScreenResult): void;
  /** The first state after the data (content, empty or error) was committed to the screen. */
  rendered(): void;
  /** The screen was left or superseded before it finished. */
  cancel(): void;
}

const TAB_ROUTE_TO_SCREEN: Readonly<Record<string, ScreenName>> = {
  Home: 'Home',
  Nutrition: 'Nutrition',
  Recipes: 'Recipes',
  Weight: 'Progress',
  Profile: 'Profile',
};

// A tab press can precede the screen's mount/focus by a noticeable time on slow devices.
const TAB_PRESS_WINDOW_MS = 10_000;
const pendingTabPress = new Map<ScreenName, number>();

/** Records the moment the user pressed a tab; the next load of that screen starts from here. */
export function notifyTabPress(routeName: string): void {
  try {
    const screen = TAB_ROUTE_TO_SCREEN[routeName];
    if (screen) pendingTabPress.set(screen, nowMs());
  } catch {
    // ignore
  }
}

const NOOP_MEASURE: ScreenMeasure = { dataReady() {}, rendered() {}, cancel() {} };

export function beginScreenLoad(name: ScreenName): ScreenMeasure {
  try {
    const episode = getCurrentEpisode();
    const now = nowMs();

    const pressedAt = pendingTabPress.get(name);
    pendingTabPress.delete(name);
    const tabPressed = pressedAt !== undefined && now - pressedAt <= TAB_PRESS_WINDOW_MS;

    let trigger: ScreenTrigger;
    if (episode.trigger === 'cold_start' && name === 'Home' && !episode.homeStarted) trigger = 'cold_start';
    else if (episode.trigger === 'resume' && !episode.firstScreenStarted) trigger = 'resume';
    else trigger = tabPressed ? 'tab_switch' : 'focus';
    episode.firstScreenStarted = true;
    if (name === 'Home') episode.homeStarted = true;

    const startPerfMs = tabPressed && trigger !== 'cold_start' ? (pressedAt as number) : now;
    let dataPerfMs: number | null = null;
    let result: ScreenResult = 'data';
    let done = false;

    return {
      dataReady(r) {
        if (done || dataPerfMs !== null) return;
        dataPerfMs = nowMs();
        result = r;
      },
      rendered() {
        try {
          if (done || dataPerfMs === null) return;
          done = true;
          const endPerfMs = nowMs();
          const startedAtMs = episodeTime(startPerfMs, episode);
          const durationMs = clampMs(endPerfMs - startPerfMs);
          record({
            type: 'screen',
            episodeId: episode.id,
            name,
            trigger,
            startedAtMs,
            durationMs,
            dataReadyMs: clampMs(dataPerfMs - startPerfMs),
            renderMs: clampMs(endPerfMs - dataPerfMs),
            result,
          });
          if (trigger === 'cold_start') markReady(startedAtMs + durationMs);
        } catch {
          // ignore
        }
      },
      cancel() {
        done = true;
      },
    };
  } catch {
    return NOOP_MEASURE;
  }
}
