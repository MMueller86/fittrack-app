import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { join } from 'node:path';
import test from 'node:test';
import {
  AZURITE_PORTS,
  ensureLocalEnrichmentQueue,
  getAzuriteLocation,
  getEnrichmentQueueName,
  isAzuriteReady,
  isPortBound,
  pollUntilReady,
} from './storage.mjs';

function listenHttp(server) {
  return new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolvePromise);
  });
}

function closeServer(server) {
  return new Promise((resolvePromise) => server.close(resolvePromise));
}

function listenTcp(server, port) {
  return new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolvePromise);
  });
}

test('AZURITE_PORTS contains the three default service ports', () => {
  assert.deepEqual(AZURITE_PORTS, [10000, 10001, 10002]);
});

test('uses an OS temp directory for Azurite data by default', () => {
  const tmpDir = 'C:\\temp';
  assert.equal(getAzuriteLocation({}, tmpDir), join(tmpDir, 'fittrack-azurite'));
});

test('allows overriding the Azurite data directory', () => {
  const custom = 'C:\\fittrack-azurite';
  assert.equal(getAzuriteLocation({ FITTRACK_AZURITE_LOCATION: custom }, 'C:\\temp'), custom);
});

test('uses the default enrichment queue name when none is configured', () => {
  assert.equal(getEnrichmentQueueName({}), 'reusable-items-enrich');
});

test('ensures the configured enrichment queue exists in local storage', async () => {
  let connectionString;
  let queueName;
  let createIfNotExistsCalled = false;

  await ensureLocalEnrichmentQueue({
    env: { ENRICH_QUEUE_NAME: 'custom-enrichment' },
    connectionString: 'UseDevelopmentStorage=true',
    queueServiceClientFactory: (value) => {
      connectionString = value;
      return {
        getQueueClient: (value) => {
          queueName = value;
          return {
            createIfNotExists: async () => {
              createIfNotExistsCalled = true;
            },
          };
        },
      };
    },
  });

  assert.equal(connectionString, 'UseDevelopmentStorage=true');
  assert.equal(queueName, 'custom-enrichment');
  assert.equal(createIfNotExistsCalled, true);
});

test('recognizes a responding Azurite service port as ready', async () => {
  const server = createHttpServer((_req, res) => { res.writeHead(403); res.end(); });
  await listenHttp(server);

  try {
    const { port } = server.address();
    assert.equal(await isAzuriteReady(port), true);
  } finally {
    await closeServer(server);
  }
});

test('reports a non-listening port as not ready', async () => {
  assert.equal(await isAzuriteReady(19999), false);
});

test('pollUntilReady resolves immediately for a mock-ready process', async () => {
  // Simulate a process that never exits and all ports immediately "ready"
  const fakeProc = { exitCode: null, killed: false };
  const ready = await pollUntilReady(fakeProc, 2000, 50, async () => true);
  assert.equal(ready, true);
});

test('isPortBound logic detects a server already listening on a port', async () => {
  const blocker = createNetServer((socket) => socket.on('error', () => {}));
  await listenTcp(blocker, 0);
  const address = blocker.address();
  assert.ok(address && typeof address === 'object');

  try {
    assert.equal(await isPortBound(address.port), true);
  } finally {
    await closeServer(blocker);
  }
});
