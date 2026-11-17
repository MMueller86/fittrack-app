import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { z } from 'zod';

import { requireUser } from '../lib/auth';
import { withHandler } from '../lib/http';
import { logEvent, type LogFields } from '../lib/log';

// POST /api/telemetry/client — relays client performance events into server logs.
// Nothing is persisted; every accepted event becomes one structured trace.
// Free text from the client is limited to allowlisted patterns and lengths.

export const MAX_BODY_BYTES = 32 * 1024;
export const MAX_EVENTS = 100;
export const MAX_BATCHES_PER_WINDOW = 10;
export const RATE_WINDOW_MS = 60_000;

const MAX_TIME_MS = 604_800_000;
const MAX_CALL_MS = 600_000;

const timeMs = z.number().int().min(0).max(MAX_TIME_MS);
const callMs = z.number().int().min(0).max(MAX_CALL_MS);
const uuid = z.string().uuid();
const screenName = z.enum(['Home', 'Nutrition', 'Recipes', 'Progress', 'Profile']);
const ROUTE_PATTERN = /^(GET|POST|PUT|PATCH|DELETE) \/api(\/([a-z0-9-]+|\{id\}|\{date\}))+$/;

const EpisodeEventSchema = z.object({
  type: z.literal('episode'),
  episodeId: uuid,
  trigger: z.enum(['cold_start', 'resume']),
  backgroundMs: timeMs.optional(),
  jsEntryPerfMs: timeMs.optional(),
}).strict();

const MilestoneEventSchema = z.object({
  type: z.literal('milestone'),
  episodeId: uuid,
  name: z.enum(['js_entry', 'app_registered', 'root_mounted', 'auth_ready', 'navigator_mounted', 'ready']),
  atMs: timeMs,
  authPath: z.enum(['no_token', 'valid', 'refreshed', 'refresh_failed']).optional(),
  authMs: timeMs.optional(),
}).strict();

const ApiEventSchema = z.object({
  type: z.literal('api'),
  episodeId: uuid,
  clientRequestId: uuid,
  route: z.string().max(120).regex(ROUTE_PATTERN),
  source: z.enum(['ui', 'sync', 'warmup', 'auth']),
  screen: screenName.optional(),
  startedAtMs: timeMs,
  status: z.number().int().min(0).max(599),
  errorClass: z.enum(['timeout', 'network', 'http', 'canceled']).optional(),
  durationMs: callMs,
  attempts: z.number().int().min(1).max(3),
  attemptMs: z.array(callMs).min(1).max(3),
  attemptStatus: z.array(z.number().int().min(0).max(599)).min(1).max(3),
  retryWaitMs: z.number().int().min(0).max(10_000),
  tokenRefreshMs: callMs.optional(),
  tokenRefreshOk: z.boolean().optional(),
}).strict();

const ScreenEventSchema = z.object({
  type: z.literal('screen'),
  episodeId: uuid,
  name: screenName,
  trigger: z.enum(['cold_start', 'resume', 'tab_switch', 'focus']),
  startedAtMs: timeMs,
  durationMs: timeMs,
  dataReadyMs: timeMs,
  renderMs: timeMs,
  result: z.enum(['data', 'empty', 'error']),
}).strict();

const ErrorEventSchema = z.object({
  type: z.literal('error'),
  episodeId: uuid,
  name: z.string().max(60).regex(/^[A-Za-z0-9_.$ -]+$/),
  stack: z.string().max(1000),
}).strict();

const ClientTelemetryBatchSchema = z.object({
  app: z.object({
    version: z.string().max(20),
    variant: z.enum(['development', 'preview', 'production']),
    os: z.enum(['android', 'ios']),
    osVersion: z.string().max(20),
    deviceModel: z.string().max(40).regex(/^[A-Za-z0-9 ._()+-]+$/).optional(),
  }).strict(),
  sessionId: uuid,
  events: z.array(z.discriminatedUnion('type', [
    EpisodeEventSchema,
    MilestoneEventSchema,
    ApiEventSchema,
    ScreenEventSchema,
    ErrorEventSchema,
  ])).max(MAX_EVENTS),
}).strict().superRefine((batch, ctx) => {
  batch.events.forEach((event, index) => {
    if (event.type !== 'episode') return;
    if (event.trigger === 'cold_start' && event.backgroundMs !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['events', index, 'backgroundMs'], message: 'resume only' });
    }
    if (event.trigger === 'resume' && event.jsEntryPerfMs !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['events', index, 'jsEntryPerfMs'], message: 'cold start only' });
    }
  });
});

type ClientTelemetryBatch = z.infer<typeof ClientTelemetryBatchSchema>;
type ClientEvent = ClientTelemetryBatch['events'][number];

// Single place where the user identifier is attached to relayed event traces (PO-6).
export function clientEventActorFields(userId: string): LogFields {
  return { userId };
}

const batchTimestampsByUser = new Map<string, number[]>();

export function resetClientTelemetryRateLimit(): void {
  batchTimestampsByUser.clear();
}

function isRateLimited(userId: string, now: number): boolean {
  if (batchTimestampsByUser.size > 1000) {
    for (const [key, times] of batchTimestampsByUser) {
      if (times.every((t) => now - t >= RATE_WINDOW_MS)) batchTimestampsByUser.delete(key);
    }
  }
  const recent = (batchTimestampsByUser.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= MAX_BATCHES_PER_WINDOW) {
    batchTimestampsByUser.set(userId, recent);
    return true;
  }
  recent.push(now);
  batchTimestampsByUser.set(userId, recent);
  return false;
}

function eventTrace(event: ClientEvent): { name: string; fields: LogFields } {
  switch (event.type) {
    case 'episode':
      return {
        name: 'client.episode',
        fields: {
          episode_id: event.episodeId,
          trigger: event.trigger,
          background_ms: event.backgroundMs,
          js_entry_perf_ms: event.jsEntryPerfMs,
        },
      };
    case 'milestone':
      return {
        name: 'client.milestone',
        fields: {
          episode_id: event.episodeId,
          name: event.name,
          at_ms: event.atMs,
          auth_path: event.authPath,
          auth_ms: event.authMs,
        },
      };
    case 'api':
      return {
        name: 'client.api',
        fields: {
          episode_id: event.episodeId,
          client_request_id: event.clientRequestId,
          route: event.route,
          source: event.source,
          screen: event.screen,
          started_at_ms: event.startedAtMs,
          status: event.status,
          error_class: event.errorClass,
          client_ms: event.durationMs,
          attempts: event.attempts,
          attempt_ms: event.attemptMs.join(','),
          attempt_status: event.attemptStatus.join(','),
          retry_wait_ms: event.retryWaitMs,
          token_refresh_ms: event.tokenRefreshMs,
          token_refresh_ok: event.tokenRefreshOk,
        },
      };
    case 'screen':
      return {
        name: 'client.screen',
        fields: {
          episode_id: event.episodeId,
          name: event.name,
          trigger: event.trigger,
          started_at_ms: event.startedAtMs,
          client_ms: event.durationMs,
          data_ready_ms: event.dataReadyMs,
          render_ms: event.renderMs,
          result: event.result,
        },
      };
    case 'error':
      return {
        name: 'client.error',
        fields: { episode_id: event.episodeId, name: event.name, stack: event.stack },
      };
  }
}

export const clientTelemetryHandler = withHandler(
  'telemetry.client',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);

    if (isRateLimited(userId, Date.now())) return { status: 429 };

    const declaredLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return { status: 400, jsonBody: { error: 'Body too large' } };
    }
    const text = await request.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) {
      return { status: 400, jsonBody: { error: 'Body too large' } };
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return { status: 400, jsonBody: { error: 'Invalid JSON body' } };
    }
    const parsed = ClientTelemetryBatchSchema.safeParse(raw);
    if (!parsed.success) {
      return { status: 400, jsonBody: { error: 'Invalid telemetry batch' } };
    }

    const { app: appInfo, sessionId, events } = parsed.data;
    logEvent(ctx, 'info', 'client.batch', {
      session_id: sessionId,
      app_version: appInfo.version,
      app_variant: appInfo.variant,
      os: appInfo.os,
      os_version: appInfo.osVersion,
      device_model: appInfo.deviceModel,
      received_events: events.length,
    });
    for (const event of events) {
      const { name, fields } = eventTrace(event);
      logEvent(ctx, 'info', name, { ...fields, ...clientEventActorFields(userId) });
    }
    return { status: 204 };
  },
);

app.http('telemetry-client', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'telemetry/client',
  handler: clientTelemetryHandler,
});
