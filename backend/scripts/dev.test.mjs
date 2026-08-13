import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import test from 'node:test';
import { isPortInUse } from './dev.mjs';

function listen(server) {
  return new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, '0.0.0.0', resolvePromise);
  });
}

function close(server) {
  return new Promise((resolvePromise) => server.close(resolvePromise));
}

test('detects an occupied port and recognizes it after release', async () => {
  const server = createServer();
  await listen(server);

  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    assert.equal(await isPortInUse(address.port), true);

    await close(server);
    assert.equal(await isPortInUse(address.port), false);
  } finally {
    if (server.listening) await close(server);
  }
});
