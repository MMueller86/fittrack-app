import assert from 'node:assert/strict';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
} from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = resolve(mobileRoot, '..');
const workspaceNodeModules = join(workspaceRoot, 'node_modules');
const require = createRequire(import.meta.url);
const expoCliPath = require.resolve('expo/bin/cli');
const configPluginsRequire = createRequire(require.resolve('@expo/config-plugins/package.json'));
const { parseStringPromise } = configPluginsRequire('xml2js');

function spawnProcess(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? mobileRoot,
      env: options.env ?? process.env,
      stdio: 'inherit',
      windowsHide: true,
      ...options,
    });
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`Command failed (${code ?? signal}): ${command} ${args.join(' ')}`));
    });
  });
}

function getStandardEnvironment() {
  const env = { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' };
  delete env.APP_VARIANT;
  return env;
}

function findFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    return entry.isDirectory() ? findFiles(entryPath) : [entryPath];
  });
}

async function runBundleSmoke() {
  const outputDir = mkdtempSync(join(tmpdir(), 'fittrack-android-bundle-'));
  try {
    await spawnProcess(process.execPath, [
      expoCliPath,
      'export',
      '--platform',
      'android',
      '--output-dir',
      outputDir,
    ], { env: getStandardEnvironment() });

    const bundleFiles = findFiles(join(outputDir, '_expo', 'static', 'js', 'android'))
      .filter((filePath) => /\.(?:hbc|js)$/.test(filePath) && statSync(filePath).size > 0);
    assert.ok(bundleFiles.length > 0, 'Expo export produced no non-empty Android JavaScript bundle.');
    console.log(`[mobile-smoke] Android bundle export produced ${bundleFiles.length} non-empty bundle file(s).`);
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
}

function getArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function getAndroidName(node) {
  return node?.$?.['android:name'];
}

async function verifyGeneratedManifest(projectRoot) {
  const manifestPath = join(projectRoot, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
  const manifestXml = readFileSync(manifestPath, 'utf8');
  const parsed = await parseStringPromise(manifestXml);
  const manifest = parsed.manifest;
  const permissions = getArray(manifest['uses-permission']).map(getAndroidName);

  for (const permission of [
    'android.permission.health.WRITE_WEIGHT',
    'android.permission.health.READ_WEIGHT',
    'android.permission.health.WRITE_NUTRITION',
  ]) {
    assert.ok(permissions.includes(permission), `Android manifest is missing ${permission}.`);
  }

  const queriedPackages = getArray(manifest.queries)
    .flatMap((query) => getArray(query.package))
    .map(getAndroidName);
  assert.ok(
    queriedPackages.includes('com.google.android.apps.healthdata'),
    'Android manifest is missing Health Connect package visibility.',
  );

  const { host: callbackHost } = JSON.parse(readFileSync(join(projectRoot, 'auth-callback-host.json'), 'utf8'));
  const intentFilters = getArray(manifest.application)
    .flatMap((application) => getArray(application.activity))
    .flatMap((activity) => getArray(activity['intent-filter']));
  const appLinkFilter = intentFilters.find((filter) => {
    const actions = getArray(filter.action).map(getAndroidName);
    const categories = getArray(filter.category).map(getAndroidName);
    const data = getArray(filter.data);
    return actions.includes('android.intent.action.VIEW')
      && categories.includes('android.intent.category.DEFAULT')
      && categories.includes('android.intent.category.BROWSABLE')
      && data.some((entry) => (
        entry.$?.['android:scheme'] === 'https'
        && entry.$?.['android:host'] === callbackHost
        && entry.$?.['android:pathPrefix'] === '/auth/callback/alpha'
      ))
      && filter.$?.['android:autoVerify'] === 'true';
  });
  assert.ok(appLinkFilter, 'Android manifest is missing the verified Alpha auth App Link.');

  const hasScheme = intentFilters.some((filter) => getArray(filter.data)
    .some((entry) => entry.$?.['android:scheme'] === 'fittrack'));
  assert.ok(hasScheme, 'Android manifest is missing the fittrack URI scheme.');

  const gradleProperties = readFileSync(join(projectRoot, 'android', 'gradle.properties'), 'utf8');
  assert.match(gradleProperties, /^android\.minSdkVersion\s*=\s*26\s*$/m);
  console.log('[mobile-smoke] Generated Android manifest and Gradle properties match the native baseline.');
}

async function withTemporaryAndroidProject(prefix, action) {
  const temporaryProject = mkdtempSync(join(tmpdir(), prefix));
  try {
    for (const filename of [
      'app.json',
      'app.config.js',
      'auth-callback-host.json',
      'babel.config.js',
      'index.ts',
      'metro.config.js',
      'package.json',
      'tsconfig.json',
    ]) {
      copyFileSync(join(mobileRoot, filename), join(temporaryProject, filename));
    }
    cpSync(join(mobileRoot, 'assets'), join(temporaryProject, 'assets'), { recursive: true });
    cpSync(join(mobileRoot, 'src'), join(temporaryProject, 'src'), { recursive: true });
    symlinkSync(workspaceNodeModules, join(temporaryProject, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');

    return await action(temporaryProject);
  } finally {
    rmSync(temporaryProject, { recursive: true, force: true });
  }
}

async function prebuildAndroidProject(projectRoot) {
  await spawnProcess(process.execPath, [expoCliPath, 'prebuild', '--platform', 'android', '--no-install'], {
    cwd: projectRoot,
    env: getStandardEnvironment(),
  });
  const entry = spawnSync(process.execPath, [
    '-e',
    "require('expo/scripts/resolveAppEntry')",
    projectRoot,
    'android',
    'absolute',
  ], {
    cwd: projectRoot,
    env: getStandardEnvironment(),
    encoding: 'utf8',
    windowsHide: true,
  });
  if (entry.error) throw entry.error;
  assert.equal(entry.status, 0, `Expo entry resolver failed: ${entry.stderr.trim()}`);
  const entryFile = entry.stdout.trim();
  assert.ok(entryFile, 'Expo entry resolver returned an empty path.');
  assert.ok(existsSync(entryFile), `Expo entry resolver returned a missing file: ${entryFile}`);

  const wrapper = process.platform === 'win32' ? 'gradlew.bat' : 'gradlew';
  assert.ok(
    existsSync(join(projectRoot, 'android', wrapper)),
    `Expo prebuild did not generate the Android Gradle wrapper: ${wrapper}`,
  );
}

async function runManifestSmoke() {
  await withTemporaryAndroidProject('fittrack-android-manifest-', async (temporaryProject) => {
    await prebuildAndroidProject(temporaryProject);
    await verifyGeneratedManifest(temporaryProject);
  });
}

function runExpoDoctorSmoke() {
  const args = ['--yes', 'expo-doctor@1.21.5'];
  const command = process.platform === 'win32'
    ? process.execPath
    : 'npx';
  const commandArgs = process.platform === 'win32'
    ? [join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js'), ...args]
    : args;
  const result = spawnSync(command, commandArgs, {
    cwd: mobileRoot,
    env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' },
    encoding: 'utf8',
    timeout: 120_000,
    windowsHide: true,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  process.stdout.write(output);
  if (result.error) throw result.error;
  if (result.status === 0) return;

  const knownPatchMismatch = result.status === 1
    && /^\d+\/\d+ checks passed\. 1 checks failed\./m.test(output)
    && output.includes('Check that packages match versions required by installed Expo SDK')
    && /^expo\s+~54\.0\.37\s+54\.0\.36\s*$/m.test(output)
    && /^1 package out of date\.$/m.test(output);
  if (!knownPatchMismatch) {
    throw new Error('Expo Doctor reported a new or changed finding; compare it with the Phase-0 baseline.');
  }

  console.log('[mobile-smoke] Accepted the documented Expo 54 patch-version baseline; no additional findings.');
}

function runAndroidAssembleSmoke() {
  const java = spawnSync('java', ['-version'], { encoding: 'utf8', windowsHide: true });
  const javaOutput = `${java.stdout ?? ''}${java.stderr ?? ''}`;
  const version = javaOutput.match(/version "(?:1\.)?(\d+)/);
  if (java.error || java.status !== 0 || !version || Number(version[1]) < 17) {
    throw new Error('Android debug assemble requires JDK 17 or newer, with java available on PATH.');
  }

  return withTemporaryAndroidProject('fittrack-android-assemble-', async (temporaryProject) => {
    await prebuildAndroidProject(temporaryProject);
    const wrapper = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
    await spawnProcess(wrapper, ['assembleDebug'], {
      cwd: join(temporaryProject, 'android'),
      shell: process.platform === 'win32',
    });
  });
}

const smokes = {
  bundle: runBundleSmoke,
  manifest: runManifestSmoke,
  doctor: runExpoDoctorSmoke,
  'android-debug': runAndroidAssembleSmoke,
};

const requestedSmoke = process.argv[2];
if (!requestedSmoke || !smokes[requestedSmoke]) {
  console.error(`[mobile-smoke] Choose one of: ${Object.keys(smokes).join(', ')}.`);
  process.exitCode = 2;
} else {
  try {
    await smokes[requestedSmoke]();
  } catch (error) {
    console.error(`[mobile-smoke] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}