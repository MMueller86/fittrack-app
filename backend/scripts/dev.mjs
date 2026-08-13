import { execFileSync, spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AZURITE_PORTS,
  ensureLocalEnrichmentQueue,
  getAzuriteLocation,
  isAzuriteReady,
  pollUntilReady,
} from './storage.mjs';

const require = createRequire(import.meta.url);
const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const FUNCTIONS_PORT = 7071;

const children = new Set();
let shuttingDown = false;

function startChild(command, args) {
  const child = spawn(command, args, { cwd: backendRoot, stdio: 'inherit' });
  children.add(child);
  child.once('close', () => children.delete(child));
  return child;
}

function waitForExit(child) {
  return new Promise((resolvePromise, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolvePromise({ code, signal }));
  });
}

export function isPortInUse(port) {
  return new Promise((resolvePromise) => {
    const probe = createConnection({ host: '127.0.0.1', port });
    let settled = false;
    const finish = (v) => {
      if (settled) return;
      settled = true;
      probe.destroy();
      resolvePromise(v);
    };
    probe.once('connect', () => finish(true));
    probe.once('error', () => finish(false));
    probe.setTimeout(250, () => finish(false));
  });
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.killed) return;
  if (process.platform === 'win32') {
    await new Promise((resolvePromise) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
      killer.once('error', resolvePromise);
      killer.once('close', resolvePromise);
    });
    return;
  }
  child.kill('SIGTERM');
}

async function stopAllChildren() {
  await Promise.all([...children].map(stopChild));
}

function getBuildCommand() {
  if (process.platform !== 'win32') return ['npm', ['run', 'build']];
  const npmCli = resolve(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  return [process.execPath, [npmCli, 'run', 'build']];
}

function getFunctionsCommand() {
  if (process.platform !== 'win32') return ['func', ['start']];
  const funcShim = execFileSync('where.exe', ['func.cmd'], { encoding: 'utf8' })
    .split(/\r?\n/)
    .find((line) => line.trim());
  if (!funcShim) throw new Error('Azure Functions Core Tools not found on PATH');
  return [
    process.execPath,
    [resolve(dirname(funcShim.trim()), 'node_modules', 'azure-functions-core-tools', 'lib', 'main.js'), 'start'],
  ];
}

async function main() {
  if (await isPortInUse(FUNCTIONS_PORT)) {
    throw new Error(
      `[functions] Port ${FUNCTIONS_PORT} is already in use. ` +
        'Stop the existing Azure Functions host before running npm run dev again.',
    );
  }

  const [buildCmd, buildArgs] = getBuildCommand();
  const build = startChild(buildCmd, buildArgs);
  const { code: buildCode } = await waitForExit(build);
  if (buildCode !== 0) process.exit(buildCode ?? 1);

  // Skip starting Azurite if it is already HTTP-ready (e.g. started via npm run storage:start)
  const httpStates = await Promise.all(AZURITE_PORTS.map(isAzuriteReady));
  let azurite = null;

  if (httpStates.every(Boolean)) {
    console.log('[azurite] Already running.');
  } else {
    const anyBound = (await Promise.all(AZURITE_PORTS.map((p) => isPortInUse(p)))).some(Boolean);
    if (anyBound) {
      throw new Error(
        '[azurite] One or more ports are in use but Azurite is not responding. ' +
          'Stop the conflicting process and retry.',
      );
    }
    azurite = startChild(process.execPath, [
      require.resolve('azurite/dist/src/azurite.js'),
      '--location', getAzuriteLocation(),
      '--skipApiVersionCheck',
    ]);
    azurite.once('error', (err) => {
      throw new Error(`[azurite] Failed to start: ${err.message}`);
    });
    if (!(await pollUntilReady(azurite))) {
      await stopAllChildren();
      process.exit(1);
    }
    console.log('[azurite] Blob, queue, and table services are ready.');
  }

  const queueName = await ensureLocalEnrichmentQueue();
  console.log(`[azurite] Queue "${queueName}" is ready.`);

  const [funcCmd, funcArgs] = getFunctionsCommand();
  const functions = startChild(funcCmd, funcArgs);
  const { code: funcCode } = await waitForExit(functions);

  if (azurite) await stopChild(azurite);
  process.exit(funcCode ?? 1);
}

async function handleShutdown(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  await stopAllChildren();
  process.exit(exitCode);
}

process.once('SIGINT', () => { void handleShutdown(130); });
process.once('SIGTERM', () => { void handleShutdown(143); });

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(`[dev] Failed to start: ${error instanceof Error ? error.message : String(error)}`);
    await stopAllChildren();
    process.exit(1);
  }
}
