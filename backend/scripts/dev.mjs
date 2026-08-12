import { execFileSync, spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { waitForAzurite } from './wait-for-azurite.mjs';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const storageScript = resolve(backendRoot, 'scripts', 'start-azurite.mjs');

const children = new Set();
let shuttingDown = false;

function startChild(command, args) {
  const child = spawn(command, args, {
    cwd: backendRoot,
    stdio: 'inherit',
  });
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

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.killed) return;

  if (process.platform === 'win32') {
    await new Promise((resolvePromise) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore',
      });
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
  if (process.platform !== 'win32') {
    return ['npm', ['run', 'build']];
  }

  const npmCli = resolve(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  return [process.execPath, [npmCli, 'run', 'build']];
}

function getFunctionsCommand() {
  if (process.platform !== 'win32') {
    return ['func', ['start']];
  }

  const funcShim = execFileSync('where.exe', ['func.cmd'], { encoding: 'utf8' })
    .split(/\r?\n/)
    .find((line) => line.trim());
  if (!funcShim) throw new Error('Azure Functions Core Tools executable not found on PATH');

  const funcMain = resolve(
    dirname(funcShim.trim()),
    'node_modules',
    'azure-functions-core-tools',
    'lib',
    'main.js',
  );
  return [process.execPath, [funcMain, 'start']];
}

async function main() {
  const [buildCommand, buildArgs] = getBuildCommand();
  const build = startChild(buildCommand, buildArgs);
  const buildResult = await waitForExit(build);
  if (buildResult.code !== 0) {
    process.exit(buildResult.code ?? 1);
  }

  const storage = startChild(process.execPath, [storageScript]);
  const storageResult = await waitForAzurite();
  if (!storageResult) {
    console.error('[azurite] Services were not ready. Start Azurite with npm run storage:start.');
    await stopAllChildren();
    process.exit(1);
  }

  const [functionsCommand, functionsArgs] = getFunctionsCommand();
  const functions = startChild(functionsCommand, functionsArgs);
  const functionsResult = await waitForExit(functions);
  await stopChild(storage);
  process.exit(functionsResult.code ?? 1);
}

async function handleShutdown(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  await stopAllChildren();
  process.exit(exitCode);
}

process.once('SIGINT', () => { void handleShutdown(130); });
process.once('SIGTERM', () => { void handleShutdown(143); });

try {
  await main();
} catch (error) {
  console.error(`[dev] Failed to start: ${error instanceof Error ? error.message : String(error)}`);
  await stopAllChildren();
  process.exit(1);
}