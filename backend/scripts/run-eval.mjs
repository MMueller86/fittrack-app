import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const backendDirectory = resolve(dirname(scriptPath), '..');
const defaultSettingsPath = resolve(backendDirectory, 'local.settings.json');
const require = createRequire(import.meta.url);

export const EVAL_UNVERIFIED_EXIT_CODE = 2;
export const REQUIRED_EVAL_ENV_KEYS = Object.freeze([
  'AZURE_OPENAI_ENDPOINT',
  'AZURE_OPENAI_API_KEY',
]);
export const EVAL_ENV_KEYS = Object.freeze([
  ...REQUIRED_EVAL_ENV_KEYS,
  'AZURE_OPENAI_API_VERSION',
  'AZURE_OPENAI_DEPLOYMENT_NAME',
]);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

async function readSettingsValues(settingsPath) {
  try {
    const rawSettings = await readFile(settingsPath, 'utf8');
    const settings = JSON.parse(rawSettings);
    const values = settings?.Values;

    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      throw new Error('the file must contain a Values object');
    }

    return values;
  } catch (error) {
    if (error?.code === 'ENOENT') return {};

    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read ${settingsPath}: ${message}`);
  }
}

export async function loadEvalEnvironment({
  settingsPath = defaultSettingsPath,
  baseEnvironment = process.env,
} = {}) {
  const settingsValues = await readSettingsValues(settingsPath);
  const environment = { ...baseEnvironment };

  for (const key of EVAL_ENV_KEYS) {
    if (!isNonEmptyString(environment[key]) && isNonEmptyString(settingsValues[key])) {
      environment[key] = settingsValues[key];
    }
  }

  return environment;
}

export function getMissingRequiredEvalKeys(environment) {
  return REQUIRED_EVAL_ENV_KEYS.filter((key) => !isNonEmptyString(environment[key]));
}

export function buildVitestArgs(extraArgs = []) {
  return ['run', '--config', 'vitest.eval.config.mts', ...extraArgs];
}

function runVitest(environment, extraArgs = []) {
  const child = spawn(
    process.execPath,
    [
      require.resolve('vitest/vitest.mjs', { paths: [backendDirectory] }),
      ...buildVitestArgs(extraArgs),
    ],
    {
      cwd: backendDirectory,
      env: environment,
      stdio: 'inherit',
    },
  );

  return new Promise((resolveExitCode, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      resolveExitCode(signal ? 1 : (code ?? 1));
    });
  });
}

async function main() {
  const environment = await loadEvalEnvironment();
  const missingKeys = getMissingRequiredEvalKeys(environment);
  const extraArgs = process.argv.slice(2);

  if (missingKeys.length > 0) {
    console.error(
      `Live prompt evals are UNVERIFIED: missing ${missingKeys.join(', ')}. ` +
        'Set them in backend/local.settings.json or the process environment.',
    );
    const vitestExitCode = await runVitest(environment, extraArgs);
    process.exitCode = vitestExitCode === 0 ? EVAL_UNVERIFIED_EXIT_CODE : vitestExitCode;
    return;
  }

  process.exitCode = await runVitest(environment, extraArgs);
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}