// Test helpers for the backend Vitest suite.
//
// These helpers fabricate just enough of the Azure Functions HTTP types
// for handler unit tests. We only stub the surface area our handlers use:
//   - `request.json()`     — POST body parsing
//   - `request.params.id`  — DELETE :id route param
//   - `request.headers`    — touched by future auth code
//
// Anything beyond that intentionally throws so we notice when a handler
// starts depending on more of the runtime than the tests cover.

import type { HttpRequest, InvocationContext } from '@azure/functions';

export interface FakeRequestInit {
  body?: unknown;
  rawBody?: string; // when provided, body is ignored — used for invalid-JSON tests
  params?: Record<string, string>;
  headers?: Record<string, string>;
}

export function makeRequest(init: FakeRequestInit = {}): HttpRequest {
  const params = init.params ?? {};
  const headers = init.headers ?? {};
  const rawBody = init.rawBody;
  const body = init.body;

  return {
    params,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
    json: async () => {
      if (rawBody !== undefined) {
        // Mimic real behaviour: invalid JSON throws.
        return JSON.parse(rawBody);
      }
      if (body === undefined) {
        throw new SyntaxError('No body');
      }
      return body;
    },
    // Lazily reject any other property access so tests fail loudly instead
    // of silently passing on undefined behaviour.
  } as unknown as HttpRequest;
}

export function makeContext(): InvocationContext {
  return {
    log: () => {},
    error: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
    trace: () => {},
  } as unknown as InvocationContext;
}
