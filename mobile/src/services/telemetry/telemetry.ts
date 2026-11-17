// Client telemetry buffer and relay transport (POST /api/telemetry/client).
// record() is the only entry for events. Every public function swallows all errors, and a failing,
// slow or rejected relay call never reaches API results or the UI. The relay call goes through plain
// fetch on purpose: it is not instrumented, not retried and never triggers token refresh or logout.

import { newUuid } from './ids';

export type ApiSource = 'ui' | 'sync' | 'warmup' | 'auth';
export type ScreenName = 'Home' | 'Nutrition' | 'Recipes' | 'Progress' | 'Profile';
export type ScreenTrigger = 'cold_start' | 'resume' | 'tab_switch' | 'focus';
export type ScreenResult = 'data' | 'empty' | 'error';
export type MilestoneName =
  | 'js_entry' | 'app_registered' | 'root_mounted' | 'auth_ready' | 'navigator_mounted' | 'ready';
export type AuthPath = 'no_token' | 'valid' | 'refreshed' | 'refresh_failed';

export type TelemetryEvent =
  | { type: 'episode'; episodeId: string; trigger: 'cold_start' | 'resume'; backgroundMs?: number; jsEntryPerfMs?: number }
  | { type: 'milestone'; episodeId: string; name: MilestoneName; atMs: number; authPath?: AuthPath; authMs?: number }
  | {
      type: 'api'; episodeId: string; clientRequestId: string; route: string; source: ApiSource; screen?: ScreenName;
      startedAtMs: number; status: number; errorClass?: 'timeout' | 'network' | 'http' | 'canceled';
      durationMs: number; attempts: number; attemptMs: number[]; attemptStatus: number[]; retryWaitMs: number;
      tokenRefreshMs?: number; tokenRefreshOk?: boolean;
    }
  | {
      type: 'screen'; episodeId: string; name: ScreenName; trigger: ScreenTrigger; startedAtMs: number;
      durationMs: number; dataReadyMs: number; renderMs: number; result: ScreenResult;
    }
  | { type: 'error'; episodeId: string; name: string; stack: string };

export interface AppInfo {
  version: string;
  variant: 'development' | 'preview' | 'production';
  os: 'android' | 'ios';
  osVersion: string;
  deviceModel?: string;
}

export const MAX_BUFFER = 200;
export const FLUSH_AT = 30;
export const FLUSH_INTERVAL_MS = 60_000;
const MAX_EVENTS_PER_BATCH = 100;
const MAX_BATCHES_PER_FLUSH = 3;
const MAX_BODY_BYTES = 30_000; // relay limit is 32 KB
const REQUEST_TIMEOUT_MS = 10_000;

let buffer: TelemetryEvent[] = [];
let started = false;
let appInfo: AppInfo | null = null;
let flushing = false;
let timer: ReturnType<typeof setInterval> | null = null;
let sessionId: string | null = null;

function getSessionId(): string {
  if (sessionId === null) sessionId = newUuid();
  return sessionId;
}

/** Single entry for events. A later consent gate belongs here and nowhere else. */
export function record(event: TelemetryEvent): void {
  try {
    buffer.push(event);
    while (buffer.length > MAX_BUFFER) buffer.shift();
    if (started && buffer.length >= FLUSH_AT) void flush();
  } catch {
    // telemetry must never throw
  }
}

export function startTelemetry(info: AppInfo): void {
  try {
    appInfo = info;
    started = true;
    setForeground(true);
  } catch {
    // ignore
  }
}

/** Runs the 60 s flush timer only while the app is in the foreground. */
export function setForeground(foreground: boolean): void {
  try {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    if (foreground && started) timer = setInterval(() => { void flush(); }, FLUSH_INTERVAL_MS);
  } catch {
    // ignore
  }
}

function byteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i += 1;
    } else bytes += 3;
  }
  return bytes;
}

function takeBatch(info: AppInfo): string {
  let count = Math.min(buffer.length, MAX_EVENTS_PER_BATCH);
  const build = (n: number) => JSON.stringify({ app: info, sessionId: getSessionId(), events: buffer.slice(0, n) });
  let body = build(count);
  while (count > 1 && byteLength(body) > MAX_BODY_BYTES) {
    count = Math.max(1, Math.floor(count * 0.7));
    body = build(count);
  }
  buffer.splice(0, count);
  return body;
}

async function send(body: string, token: string): Promise<void> {
  const baseUrl = process.env['EXPO_PUBLIC_API_URL'];
  if (!baseUrl) return;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const abortTimer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;
  try {
    await fetch(`${baseUrl}/telemetry/client`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body,
      ...(controller ? { signal: controller.signal } : {}),
    });
  } finally {
    if (abortTimer !== null) clearTimeout(abortTimer);
  }
}

/** Sends queued events when authenticated. A failed batch is dropped, never retried. */
export async function flush(): Promise<void> {
  if (!started || flushing || buffer.length === 0 || appInfo === null) return;
  flushing = true;
  try {
    for (let i = 0; i < MAX_BATCHES_PER_FLUSH && buffer.length > 0; i += 1) {
      const { authService } = await import('../authService');
      const token = await authService.getAccessToken();
      if (!token || authService.isTokenExpired(token)) return;
      const body = takeBatch(appInfo);
      try {
        await send(body, token);
      } catch {
        // dropped; no retry
      }
    }
  } catch {
    // ignore
  } finally {
    flushing = false;
  }
}
