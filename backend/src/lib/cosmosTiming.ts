// Per-invocation Cosmos network timing.
//
// `CosmosTimingHttpClient` is passed to `CosmosClient` as `httpClient` and records the
// duration and request charge of every network request into the counters of the current
// handler invocation (AsyncLocalStorage). It must never change a request: only
// constant-time synchronous work around the delegated call, no I/O, no logging.

import { AsyncLocalStorage } from 'node:async_hooks';
import {
  createDefaultHttpClient,
  type HttpClient,
  type PipelineRequest,
  type PipelineResponse,
} from '@azure/core-rest-pipeline';

export interface CosmosTimingCounters {
  calls: number;
  totalMs: number;
  maxMs: number;
  requestCharge: number;
}

const storage = new AsyncLocalStorage<CosmosTimingCounters>();

// One shared default client keeps connection reuse across requests.
let sharedDefaultClient: HttpClient | undefined;

function getSharedDefaultClient(): HttpClient {
  sharedDefaultClient ??= createDefaultHttpClient();
  return sharedDefaultClient;
}

/** Runs `fn` inside a fresh counter store; the counters fill while `result` is pending. */
export function runWithCosmosTiming<T>(
  fn: () => Promise<T>,
): { counters: CosmosTimingCounters; result: Promise<T> } {
  const counters: CosmosTimingCounters = { calls: 0, totalMs: 0, maxMs: 0, requestCharge: 0 };
  return { counters, result: storage.run(counters, fn) };
}

/** Log fields of the invocation; empty when it made no Cosmos request. */
export function cosmosTimingLogFields(counters: CosmosTimingCounters): {
  cosmos_ms?: number;
  cosmos_calls?: number;
  cosmos_max_ms?: number;
  cosmos_ru?: number;
} {
  if (counters.calls === 0) return {};
  return {
    cosmos_ms: Math.round(counters.totalMs * 10) / 10,
    cosmos_calls: counters.calls,
    cosmos_max_ms: Math.round(counters.maxMs * 10) / 10,
    cosmos_ru: Math.round(counters.requestCharge * 100) / 100,
  };
}

function record(startedMs: number, response: PipelineResponse | undefined): void {
  try {
    const counters = storage.getStore();
    if (!counters) return;
    const elapsed = performance.now() - startedMs;
    counters.calls += 1;
    counters.totalMs += elapsed;
    if (elapsed > counters.maxMs) counters.maxMs = elapsed;
    const charge = Number.parseFloat(response?.headers.get('x-ms-request-charge') ?? '');
    if (Number.isFinite(charge)) counters.requestCharge += charge;
  } catch {
    // A measurement failure must not affect the request.
  }
}

export class CosmosTimingHttpClient implements HttpClient {
  constructor(private readonly inner?: HttpClient) {}

  async sendRequest(request: PipelineRequest): Promise<PipelineResponse> {
    const client = this.inner ?? getSharedDefaultClient();
    let startedMs = 0;
    try {
      startedMs = performance.now();
    } catch {
      // Fall through with 0; the recorded value is then meaningless but harmless.
    }
    let response: PipelineResponse | undefined;
    try {
      response = await client.sendRequest(request);
      return response;
    } finally {
      record(startedMs, response);
    }
  }
}
