import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AZURITE_WAIT_TIMEOUT_MS,
  isAzuriteServiceReady,
  waitForAzurite,
} from './wait-for-azurite.mjs';

function listen(server) {
  return new Promise((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
}

function close(server) {
  return new Promise((resolvePromise) => server.close(resolvePromise));
}

test('recognizes an HTTP-ready Azurite service', async () => {
  const server = createServer((_request, response) => {
    response.writeHead(403);
    response.end();
  });
  await listen(server);

  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    assert.equal(await isAzuriteServiceReady(address.port), true);
  } finally {
    await close(server);
  }
});

test('allows slow local Azurite startup', async () => {
  let attempts = 0;

  const ready = await waitForAzurite({
    ports: [10000],
    maxAttempts: 3,
    delayMs: 1,
    probe: async () => {
      attempts += 1;
      return attempts === 3;
    },
  });

  assert.equal(ready, true);
  assert.equal(attempts, 3);
});

test('uses a 60-second startup window by default', () => {
  assert.equal(AZURITE_WAIT_TIMEOUT_MS, 60_000);
});