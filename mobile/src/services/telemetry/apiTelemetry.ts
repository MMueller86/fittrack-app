// Per-request telemetry for the axios interceptors in shared/api/client.ts.
// One RequestTrace per logical request (retries and the 401 re-run share it) produces exactly one
// `api` event with total duration, per-attempt timings, retry waits and token refresh time.
// Nothing here changes request or response behaviour; every function swallows its own errors.

import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { clampMs, episodeTime, getCurrentEpisode } from './episode';
import { newUuid } from './ids';
import { ROUTE_PATTERN, routeTemplate, UNKNOWN_ROUTE } from './routeTemplate';
import { nowMs } from './startMark';
import { record, type ApiSource } from './telemetry';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Telemetry label; defaults to `ui`. `warmup` and `sync` are set by their callers. */
    telemetrySource?: ApiSource;
    telemetryTrace?: RequestTrace;
  }
}

export const REQUEST_ID_HEADER = 'x-fittrack-request-id';
const MAX_CALL_MS = 600_000;
const MAX_ATTEMPTS = 3;

type ErrorClass = 'timeout' | 'network' | 'http' | 'canceled';

export class RequestTrace {
  readonly requestId = newUuid();
  readonly episode = getCurrentEpisode();
  readonly startPerfMs = nowMs();
  readonly startedAtMs = episodeTime(this.startPerfMs, this.episode);
  attemptStartPerfMs: number | null = null;
  readonly attemptMs: number[] = [];
  readonly attemptStatus: number[] = [];
  retryWaitMs = 0;
  tokenRefreshMs: number | undefined;
  tokenRefreshOk: boolean | undefined;
  errorClass: ErrorClass | undefined;
  finished = false;

  constructor(readonly route: string, readonly source: ApiSource) {}
}

function joinUrl(baseURL: string | undefined, url: string | undefined): string | undefined {
  if (!url) return baseURL;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url) || !baseURL) return url;
  return `${baseURL.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
}

/** Creates the trace on first sight of a request and (re)sets the request ID header. */
export function beginRequestTrace(config: InternalAxiosRequestConfig): RequestTrace | undefined {
  try {
    let trace = config.telemetryTrace;
    if (!trace) {
      const route = routeTemplate(config.method, joinUrl(config.baseURL, config.url));
      trace = new RequestTrace(route, config.telemetrySource ?? 'ui');
      config.telemetryTrace = trace;
    }
    config.headers.set(REQUEST_ID_HEADER, trace.requestId);
    return trace;
  } catch {
    return undefined;
  }
}

/** Call at the end of the request interceptor, right before the network attempt. */
export function markAttemptStart(trace: RequestTrace | undefined): void {
  try {
    if (trace) trace.attemptStartPerfMs = nowMs();
  } catch {
    // ignore
  }
}

export function addRetryWait(trace: RequestTrace | undefined, delayMs: number): void {
  try {
    if (trace) trace.retryWaitMs += delayMs;
  } catch {
    // ignore
  }
}

/** Runs a token refresh and records its duration and outcome on the trace; result and errors pass through. */
export async function measureTokenRefresh(
  trace: RequestTrace | undefined,
  refresh: () => Promise<string | null>,
): Promise<string | null> {
  const start = nowMs();
  let ok = false;
  try {
    const result = await refresh();
    ok = result !== null;
    return result;
  } finally {
    try {
      if (trace) {
        trace.tokenRefreshMs = (trace.tokenRefreshMs ?? 0) + (nowMs() - start);
        trace.tokenRefreshOk = ok;
      }
    } catch {
      // ignore
    }
  }
}

function endAttempt(trace: RequestTrace, status: number): void {
  if (trace.attemptStartPerfMs === null) return;
  trace.attemptMs.push(nowMs() - trace.attemptStartPerfMs);
  trace.attemptStatus.push(status);
  trace.attemptStartPerfMs = null;
}

function classify(error: unknown): ErrorClass {
  if (axios.isCancel(error)) return 'canceled';
  if (axios.isAxiosError(error)) {
    if (error.code === 'ERR_CANCELED') return 'canceled';
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') return 'timeout';
    if (error.response) return 'http';
  }
  return 'network';
}

function emit(trace: RequestTrace): void {
  if (trace.finished) return;
  trace.finished = true;
  if (trace.attemptMs.length === 0 || trace.route === UNKNOWN_ROUTE || !ROUTE_PATTERN.test(trace.route)) return;

  // The relay accepts at most 3 attempts; keep the last ones so the final status stays visible.
  const attemptMs = trace.attemptMs.slice(-MAX_ATTEMPTS).map((ms) => clampMs(ms, MAX_CALL_MS));
  const attemptStatus = trace.attemptStatus.slice(-MAX_ATTEMPTS);
  const status = attemptStatus[attemptStatus.length - 1] ?? 0;
  record({
    type: 'api',
    episodeId: trace.episode.id,
    clientRequestId: trace.requestId,
    route: trace.route,
    source: trace.source,
    startedAtMs: trace.startedAtMs,
    status,
    ...(trace.errorClass ? { errorClass: trace.errorClass } : {}),
    durationMs: clampMs(nowMs() - trace.startPerfMs, MAX_CALL_MS),
    attempts: Math.min(trace.attemptMs.length, MAX_ATTEMPTS),
    attemptMs,
    attemptStatus,
    retryWaitMs: clampMs(trace.retryWaitMs, 10_000),
    ...(trace.tokenRefreshMs !== undefined ? { tokenRefreshMs: clampMs(trace.tokenRefreshMs, MAX_CALL_MS) } : {}),
    ...(trace.tokenRefreshOk !== undefined && trace.tokenRefreshMs !== undefined
      ? { tokenRefreshOk: trace.tokenRefreshOk }
      : {}),
  });
}

/** Success path of the response interceptor: the logical request is complete. */
export function traceSuccess(config: InternalAxiosRequestConfig | undefined, status: number): void {
  try {
    const trace = config?.telemetryTrace;
    if (!trace) return;
    endAttempt(trace, status);
    trace.errorClass = undefined;
    emit(trace);
  } catch {
    // ignore
  }
}

/** Start of the error handler: closes the failed attempt (the request may still be retried). */
export function traceAttemptFailure(error: unknown): void {
  try {
    const config = (error as { config?: InternalAxiosRequestConfig } | null)?.config;
    const trace = config?.telemetryTrace;
    if (!trace) return;
    const status = axios.isAxiosError(error) ? error.response?.status ?? 0 : 0;
    endAttempt(trace, status);
    trace.errorClass = classify(error);
  } catch {
    // ignore
  }
}

/** The error handler gave up: the logical request failed. No-op if a nested retry already finished it. */
export function traceFailure(error: unknown): void {
  try {
    const config = (error as { config?: InternalAxiosRequestConfig } | null)?.config;
    if (config?.telemetryTrace) emit(config.telemetryTrace);
  } catch {
    // ignore
  }
}
