// Starts Azurite if not already HTTP-ready, waits until all three services respond, then stays alive as a keeper.
import http from 'node:http';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QueueServiceClient } from '@azure/storage-queue';

export const AZURITE_PORTS = [10000, 10001, 10002];
const AZURITE_LOCATION_ENV = 'FITTRACK_AZURITE_LOCATION';
const READY_TIMEOUT_MS = 120_000;
const PROBE_INTERVAL_MS = 250;
const DEFAULT_ENRICH_QUEUE_NAME = 'reusable-items-enrich';
const DEVELOPMENT_STORAGE_CONNECTION_STRING = 'UseDevelopmentStorage=true';
const require = createRequire(import.meta.url);

export function getAzuriteLocation(env = process.env, tmpDir = tmpdir()) {
  return env[AZURITE_LOCATION_ENV]?.trim() || join(tmpDir, 'fittrack-azurite');
}

export function getEnrichmentQueueName(env = process.env) {
  return env['ENRICH_QUEUE_NAME']?.trim() || DEFAULT_ENRICH_QUEUE_NAME;
}

export async function ensureLocalEnrichmentQueue({
  env = process.env,
  connectionString = DEVELOPMENT_STORAGE_CONNECTION_STRING,
  queueServiceClientFactory = (value) => QueueServiceClient.fromConnectionString(value),
} = {}) {
  const queueName = getEnrichmentQueueName(env);
  const serviceClient = queueServiceClientFactory(connectionString);
  await serviceClient.getQueueClient(queueName).createIfNotExists();
  return queueName;
}

export function isAzuriteReady(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/' }, (res) => {
      res.resume();
      res.once('end', () => resolve((res.statusCode ?? 500) < 500));
    });
    req.once('error', () => resolve(false));
    req.setTimeout(500, () => { req.destroy(); resolve(false); });
  });
}

function isPortBound(port) {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.listen(port, '127.0.0.1');
    probe.on('listening', () => { probe.close(); resolve(false); });
    probe.on('error', () => resolve(true));
  });
}

export async function pollUntilReady(
  proc,
  timeoutMs = READY_TIMEOUT_MS,
  intervalMs = PROBE_INTERVAL_MS,
  probe = isAzuriteReady,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null || proc.killed) {
      console.error(`[azurite] Process exited (code ${proc.exitCode ?? 'unknown'}) before services were ready.`);
      return false;
    }
    const states = await Promise.all(AZURITE_PORTS.map(probe));
    if (states.every(Boolean)) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  console.error(
    `[azurite] Services were not ready on ports ${AZURITE_PORTS.join(', ')} after ${timeoutMs / 1000}s.`,
  );
  return false;
}

async function main() {
  const httpStates = await Promise.all(AZURITE_PORTS.map(isAzuriteReady));
  if (httpStates.every(Boolean)) {
    console.log('[azurite] Already running — skipping start.');
    const queueName = await ensureLocalEnrichmentQueue();
    console.log(`[azurite] Queue "${queueName}" is ready.`);
    return;
  }

  const bound = await Promise.all(AZURITE_PORTS.map(isPortBound));
  const occupied = AZURITE_PORTS.filter((_, i) => bound[i]);
  if (occupied.length > 0) {
    console.error(
      `[azurite] Port(s) ${occupied.join(', ')} are in use but not responding. ` +
        'Stop the conflicting process and retry.',
    );
    process.exit(1);
  }

  const proc = spawn(
    process.execPath,
    [require.resolve('azurite/dist/src/azurite.js'), '--location', getAzuriteLocation(), '--skipApiVersionCheck'],
    { stdio: 'inherit' },
  );

  proc.once('error', (err) => {
    console.error(`[azurite] Failed to start: ${err.message}`);
    process.exit(1);
  });

  const onExit = new Promise((resolve) => {
    proc.once('exit', (code) => resolve(code ?? 0));
  });

  if (!(await pollUntilReady(proc))) {
    proc.kill();
    process.exit(1);
  }

  const queueName = await ensureLocalEnrichmentQueue();
  console.log(`[azurite] Queue "${queueName}" is ready.`);
  console.log('[azurite] Blob, queue, and table services are ready.');
  process.exit(await onExit);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
