// Unit tests for the Cosmos timing HTTP client wrapper. Uses a fake inner client; no network.

import { describe, expect, it } from 'vitest';
import type { HttpClient, PipelineRequest, PipelineResponse } from '@azure/core-rest-pipeline';

import {
  CosmosTimingHttpClient,
  cosmosTimingLogFields,
  runWithCosmosTiming,
} from './cosmosTiming';

const request = { url: 'https://example.invalid/dbs' } as PipelineRequest;

function fakeResponse(charge?: string): PipelineResponse {
  const headers = new Map<string, string>();
  if (charge !== undefined) headers.set('x-ms-request-charge', charge);
  return { status: 200, headers: { get: (n: string) => headers.get(n) } } as unknown as PipelineResponse;
}

function delayedClient(ms: number, response: PipelineResponse | Error): HttpClient {
  return {
    sendRequest: async () => {
      await new Promise((r) => setTimeout(r, ms));
      if (response instanceof Error) throw response;
      return response;
    },
  };
}

describe('CosmosTimingHttpClient', () => {
  it('sums calls, durations, max and request charge for concurrent requests', async () => {
    const { counters, result } = runWithCosmosTiming(async () => {
      await Promise.all([
        new CosmosTimingHttpClient(delayedClient(30, fakeResponse('2.5'))).sendRequest(request),
        new CosmosTimingHttpClient(delayedClient(50, fakeResponse('3.5'))).sendRequest(request),
      ]);
    });
    await result;
    const fields = cosmosTimingLogFields(counters);
    expect(fields.cosmos_calls).toBe(2);
    expect(fields.cosmos_ms).toBeGreaterThanOrEqual(75);
    expect(fields.cosmos_ms).toBeLessThan(200);
    expect(fields.cosmos_max_ms).toBeGreaterThanOrEqual(48);
    expect(fields.cosmos_max_ms).toBeLessThan(fields.cosmos_ms!);
    expect(fields.cosmos_ru).toBe(6);
  });

  it('omits all fields when no request was made', async () => {
    const { counters, result } = runWithCosmosTiming(async () => 1);
    await result;
    expect(cosmosTimingLogFields(counters)).toEqual({});
  });

  it('returns the identical response object', async () => {
    const response = fakeResponse('1');
    const client = new CosmosTimingHttpClient(delayedClient(0, response));
    const { result } = runWithCosmosTiming(() => client.sendRequest(request));
    expect(await result).toBe(response);
  });

  it('counts a failing request and rethrows the identical error', async () => {
    const error = new Error('throttled');
    const client = new CosmosTimingHttpClient(delayedClient(5, error));
    const { counters, result } = runWithCosmosTiming(() => client.sendRequest(request));
    await expect(result).rejects.toBe(error);
    expect(counters.calls).toBe(1);
    expect(counters.requestCharge).toBe(0);
  });

  it('works without a store and leaves response and error unchanged', async () => {
    const response = fakeResponse('1');
    expect(await new CosmosTimingHttpClient(delayedClient(0, response)).sendRequest(request)).toBe(response);
    const error = new Error('x');
    await expect(new CosmosTimingHttpClient(delayedClient(0, error)).sendRequest(request)).rejects.toBe(error);
  });

  it('ignores a throwing counter and a malformed charge header', async () => {
    const response = fakeResponse('1');
    const client = new CosmosTimingHttpClient(delayedClient(0, response));
    const { counters, result } = runWithCosmosTiming(async () => {
      await Promise.resolve();
      Object.defineProperty(counters, 'calls', {
        get: () => 0,
        set: () => {
          throw new Error('counter broken');
        },
      });
      return client.sendRequest(request);
    });
    expect(await result).toBe(response);

    const error = new Error('x');
    const failing = new CosmosTimingHttpClient(delayedClient(0, error));
    const second = runWithCosmosTiming(async () => {
      await Promise.resolve();
      Object.defineProperty(second.counters, 'totalMs', {
        set: () => {
          throw new Error('counter broken');
        },
        get: () => 0,
      });
      return failing.sendRequest(request);
    });
    await expect(second.result).rejects.toBe(error);

    const bad = runWithCosmosTiming(() =>
      new CosmosTimingHttpClient(delayedClient(0, fakeResponse('abc'))).sendRequest(request),
    );
    await bad.result;
    expect(bad.counters.requestCharge).toBe(0);
    expect(bad.counters.calls).toBe(1);
  });

  it('delegates exactly once per request and adds no extra calls', async () => {
    let sends = 0;
    const inner: HttpClient = { sendRequest: async () => { sends += 1; return fakeResponse(); } };
    await new CosmosTimingHttpClient(inner).sendRequest(request);
    expect(sends).toBe(1);
  });
});
