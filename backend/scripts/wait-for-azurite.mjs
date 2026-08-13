import http from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = '127.0.0.1';
export const AZURITE_PORTS = [10000, 10001, 10002];
const MAX_ATTEMPTS = 240;
const DELAY_MS = 250;
export const AZURITE_WAIT_TIMEOUT_MS = MAX_ATTEMPTS * DELAY_MS;

export function isAzuriteServiceReady(port) {
  return new Promise((resolve) => {
    const request = http.get({ host: HOST, port, path: '/' }, (response) => {
      response.resume();
      response.once('end', () => resolve((response.statusCode ?? 500) < 500));
    });

    request.once('error', () => resolve(false));
    request.setTimeout(500, () => {
      request.destroy();
      resolve(false);
    });
  });
}

export async function waitForAzurite({
  ports = AZURITE_PORTS,
  maxAttempts = MAX_ATTEMPTS,
  delayMs = DELAY_MS,
  probe = isAzuriteServiceReady,
} = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const openPorts = await Promise.all(ports.map((port) => probe(port)));
    if (openPorts.every(Boolean)) {
      return true;
    }

    if (attempt < maxAttempts) {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, delayMs));
    }
  }

  return false;
}

async function main() {
  if (await waitForAzurite()) {
    console.log('[azurite] Blob, queue, and table services are ready.');
    process.exit(0);
  }

  console.error(
    `[azurite] Services were not ready on ports ${AZURITE_PORTS.join(', ')} ` +
      `after ${AZURITE_WAIT_TIMEOUT_MS / 1000}s. Start Azurite with npm run storage:start.`,
  );
  process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}