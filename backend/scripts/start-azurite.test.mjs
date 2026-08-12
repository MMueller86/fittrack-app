import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { getAzuriteLocation } from './start-azurite.mjs';

const scriptPath = fileURLToPath(new URL('./start-azurite.mjs', import.meta.url));
const backendRoot = resolve(dirname(scriptPath), '..');
const queuePort = 10001;

function listen(server, port) {
  return new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolvePromise);
  });
}

function close(server) {
  return new Promise((resolvePromise) => server.close(resolvePromise));
}

function runStartScript() {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: backendRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';

    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.once('error', reject);
    child.once('close', (code, signal) => resolvePromise({ code, signal, output }));
  });
}

test('uses an OS temp directory for Azurite data by default', () => {
  const temporaryDirectory = 'C:\\temp';

  assert.equal(
    getAzuriteLocation({}, temporaryDirectory),
    resolve(temporaryDirectory, 'fittrack-azurite'),
  );
});

test('allows overriding the Azurite data directory', () => {
  const configuredLocation = 'C:\\fittrack-azurite';

  assert.equal(
    getAzuriteLocation({ FITTRACK_AZURITE_LOCATION: configuredLocation }, 'C:\\temp'),
    configuredLocation,
  );
});

test('rejects a partially occupied Azurite installation', async () => {
  const queueBlocker = createServer();
  await listen(queueBlocker, queuePort);

  try {
    const result = await runStartScript();

    assert.notEqual(result.code, 0, result.output);
    assert.match(result.output, /partial|port.*use|service/i);
  } finally {
    await close(queueBlocker);
  }
});