// Episode origin of the cold start. Must stay the second import of mobile/index.ts, directly after
// the gesture handler import, so that it is evaluated as early as the app's own code can be.
// Keep this module free of imports and side effects beyond the two timestamps.

type PerfLike = { now?: () => number };

/** Monotonic clock in whole milliseconds (performance.now(), Date.now() as fallback). */
export function nowMs(): number {
  const perf = (globalThis as { performance?: PerfLike }).performance;
  return Math.round(typeof perf?.now === 'function' ? perf.now() : Date.now());
}

/** performance.now() at JS entry; also the origin of the cold-start episode. */
export const jsEntryPerfMs: number = nowMs();

let appRegisteredPerfMs: number | null = null;

/** Called from index.ts after all imports are evaluated, right before registerRootComponent. */
export function markAppRegistered(): void {
  if (appRegisteredPerfMs === null) appRegisteredPerfMs = nowMs();
}

export function getAppRegisteredPerfMs(): number | null {
  return appRegisteredPerfMs;
}
