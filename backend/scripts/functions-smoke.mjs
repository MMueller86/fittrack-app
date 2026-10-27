import { readdirSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = join(backendRoot, 'src');
const functionsRoot = join(sourceRoot, 'functions');
const baseUrl = 'http://127.0.0.1:7071';
const startupTimeoutMs = 180_000;

const cloudIntegrationKeys = [
  'COSMOS_ENDPOINT',
  'COSMOS_KEY',
  'STORAGE_CONNECTION_STRING',
  'AZURE_OPENAI_ENDPOINT',
  'AZURE_OPENAI_API_KEY',
  'AZURE_DI_ENDPOINT',
  'AZURE_DI_KEY',
  'AUTH_ISSUER',
  'AUTH_AUDIENCE',
  'AUTH_JWKS_URI',
];

const backgroundFunctionSettings = {
  'AzureWebJobs.reusable-items-enrich.Disabled': 'true',
  'AzureWebJobs.reusable-items-enrich-scheduler.Disabled': 'true',
};

const localHostSettings = {
  AzureWebJobsStorage: 'UseDevelopmentStorage=true',
  FUNCTIONS_WORKER_RUNTIME: 'node',
  ENRICH_QUEUE_NAME: 'reusable-items-enrich',
};

function getSourceFunctionNames() {
  const functionFiles = readdirSync(functionsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts'))
    .map((entry) => join(functionsRoot, entry.name));
  const sourceFiles = [join(sourceRoot, 'index.ts'), ...functionFiles];
  const names = [];

  for (const filePath of sourceFiles) {
    const source = ts.createSourceFile(
      filePath,
      readFileSync(filePath, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const visit = (node) => {
      if (
        ts.isCallExpression(node)
        && ts.isPropertyAccessExpression(node.expression)
        && ts.isIdentifier(node.expression.expression)
        && node.expression.expression.text === 'app'
        && node.arguments.length > 0
        && ts.isStringLiteralLike(node.arguments[0])
      ) {
        names.push(node.arguments[0].text);
      }
      ts.forEachChild(node, visit);
    };

    visit(source);
  }

  if (names.length === 0) {
    throw new Error('No Azure Functions registrations found in backend/src.');
  }
  if (new Set(names).size !== names.length) {
    throw new Error('Duplicate Azure Functions names found in backend/src.');
  }

  return names.sort();
}

function getSmokeEnvironment() {
  const env = { ...process.env, ...localHostSettings, ...backgroundFunctionSettings };
  for (const key of cloudIntegrationKeys) delete env[key];
  return env;
}

async function waitForHost(child) {
  const deadline = Date.now() + startupTimeoutMs;
  let spawnError;
  child.once('error', (error) => { spawnError = error; });

  while (Date.now() < deadline) {
    if (spawnError) throw new Error(`Could not start the Functions dev host: ${spawnError.message}`);
    if (child.exitCode !== null) {
      throw new Error(`Functions dev host exited before becoming ready (code ${child.exitCode}).`);
    }

    try {
      const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(1_000) });
      if (response.status === 200) return;
    } catch {
      // The local host can take over a minute to initialize its worker.
    }

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }

  throw new Error(`Functions dev host did not become ready within ${startupTimeoutMs / 1_000}s.`);
}

async function assertStatus(path, expectedStatus) {
  const response = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(10_000) });
  if (response.status !== expectedStatus) {
    throw new Error(`${path}: expected HTTP ${expectedStatus}, received ${response.status}.`);
  }
  return response;
}

async function assertRegisteredFunctions() {
  const response = await fetch(`${baseUrl}/admin/functions`, { signal: AbortSignal.timeout(10_000) });
  if (response.status !== 200) {
    throw new Error(`/admin/functions: expected HTTP 200, received ${response.status}.`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload) || payload.some((entry) => typeof entry?.name !== 'string')) {
    throw new Error('/admin/functions returned an invalid function list.');
  }

  const actualNames = payload.map((entry) => entry.name).sort();
  const expectedNames = getSourceFunctionNames();
  const actualSet = new Set(actualNames);
  const expectedSet = new Set(expectedNames);
  const missing = expectedNames.filter((name) => !actualSet.has(name));
  const unexpected = actualNames.filter((name) => !expectedSet.has(name));

  if (actualNames.length !== expectedNames.length || missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `Registered Functions differ from source declarations: expected ${expectedNames.length}, received ${actualNames.length}; `
      + `missing [${missing.join(', ')}], unexpected [${unexpected.join(', ')}].`,
    );
  }

  console.log(`[functions-smoke] ${actualNames.length} registered function names match source declarations.`);
}

async function stopProcessTree(child) {
  if (!child || child.exitCode !== null || !child.pid) return;

  if (process.platform === 'win32') {
    await new Promise((resolvePromise) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      killer.once('error', resolvePromise);
      killer.once('close', resolvePromise);
    });
    return;
  }

  child.kill('SIGTERM');
  await new Promise((resolvePromise) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      resolvePromise();
    }, 5_000);
    child.once('close', () => {
      clearTimeout(timeout);
      resolvePromise();
    });
  });
}

async function main() {
  const devScript = join(backendRoot, 'scripts', 'dev.mjs');
  const child = spawn(process.execPath, [devScript], {
    cwd: backendRoot,
    env: getSmokeEnvironment(),
    stdio: 'inherit',
    windowsHide: true,
  });

  try {
    await waitForHost(child);
    await assertStatus('/api/health', 200);
    console.log('[functions-smoke] GET /api/health -> 200.');
    await assertStatus('/api/diary/meals', 401);
    console.log('[functions-smoke] GET /api/diary/meals without a token -> 401.');
    await assertRegisteredFunctions();
  } finally {
    await stopProcessTree(child);
  }
}

main().catch((error) => {
  console.error(`[functions-smoke] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});