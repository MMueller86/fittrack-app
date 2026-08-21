import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const backendDirectory = resolve(dirname(scriptPath), '..');
const manifestPath = 'backend/src/lib/prompts/dailyInsightPromptManifest.ts';
const providerInputPaths = Object.freeze([
  'backend/src/lib/prompts/dailyInsightPrompt.ts',
  manifestPath,
  'backend/src/lib/dailyInsightSchema.ts',
  'backend/src/lib/dailyInsightValidation.ts',
  'backend/src/lib/prompts/sharedTone.ts',
  'backend/src/lib/prompts/promptActivity.ts',
  'backend/src/lib/prompts/promptGeneral.ts',
  'backend/src/lib/prompts/promptMorning.ts',
  'backend/src/lib/prompts/promptNutrition.ts',
  'backend/src/lib/prompts/promptWeight.ts',
]);

const releasePattern = /\{\s*releaseId:\s*(?<releaseQuote>['"])(?<releaseId>v\d+)\k<releaseQuote>,\s*promptVersion:\s*(?<promptQuote>['"])(?<promptVersion>[^'"]+)\k<promptQuote>,\s*assemblyVersion:\s*(?<assemblyQuote>['"])(?<assemblyVersion>[^'"]+)\k<assemblyQuote>,\s*promptFingerprint:\s*(?<fingerprintQuote>['"])(?<promptFingerprint>sha256:[0-9a-f]{64})\k<fingerprintQuote>,\s*providerInputCompatibility:\s*(?<compatibilityQuote>['"])(?<providerInputCompatibility>[^'"]+)\k<compatibilityQuote>,\s*\}/gs;

export function parsePromptReleases(source) {
  const releases = [];
  for (const match of source.matchAll(releasePattern)) {
    releases.push({
      releaseId: match.groups.releaseId,
      promptVersion: match.groups.promptVersion,
      assemblyVersion: match.groups.assemblyVersion,
      promptFingerprint: match.groups.promptFingerprint,
      providerInputCompatibility: match.groups.providerInputCompatibility,
    });
  }

  if (releases.length === 0) {
    throw new Error('No prompt releases could be parsed from dailyInsightPromptManifest.ts');
  }

  return releases;
}

function assertReleaseOrdering(releases, label) {
  const releaseNumbers = releases.map((release) => Number(release.releaseId.slice(1)));
  if (new Set(releaseNumbers).size !== releaseNumbers.length) {
    throw new Error(`${label} contains duplicate release IDs`);
  }

  for (let index = 1; index < releaseNumbers.length; index += 1) {
    if (releaseNumbers[index] <= releaseNumbers[index - 1]) {
      throw new Error(`${label} release IDs are not strictly monotone`);
    }
  }
}

export function verifyPromptReleaseHistory({ currentSource, baseSource, changedFiles }) {
  const currentReleases = parsePromptReleases(currentSource);
  const baseReleases = baseSource === null ? [] : parsePromptReleases(baseSource);
  assertReleaseOrdering(currentReleases, 'Current manifest');
  if (baseReleases.length > 0) assertReleaseOrdering(baseReleases, 'Base manifest');

  if (currentReleases.length < baseReleases.length) {
    throw new Error('Prompt release history was shortened');
  }

  for (let index = 0; index < baseReleases.length; index += 1) {
    if (JSON.stringify(currentReleases[index]) !== JSON.stringify(baseReleases[index])) {
      throw new Error(`Historical prompt release at index ${index} was modified`);
    }
  }

  const providerInputChanged = providerInputPaths.some((path) => changedFiles.has(path));
  const manifestChanged = changedFiles.has(manifestPath);
  if (providerInputChanged && !manifestChanged) {
    throw new Error('Provider-visible Daily Insight changes require a manifest change');
  }
  if (providerInputChanged && currentReleases.length <= baseReleases.length) {
    throw new Error('Provider-visible Daily Insight changes require a new release entry');
  }

  return {
    currentRelease: currentReleases.at(-1),
    baseReleaseCount: baseReleases.length,
    providerInputChanged,
  };
}

function runGit(repoDirectory, args) {
  try {
    return execFileSync('git', args, {
      cwd: repoDirectory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    const stderr = error?.stderr?.toString().trim();
    const detail = stderr ? `: ${stderr}` : '';
    throw new Error(`git ${args.join(' ')} failed${detail}`);
  }
}

function resolveBaseRevision(repoDirectory) {
  const configuredBase = process.env['FITTRACK_PROMPT_GUARD_BASE']?.trim();
  if (configuredBase) {
    return runGit(repoDirectory, ['rev-parse', '--verify', `${configuredBase}^{commit}`]);
  }

  if (process.env['GITHUB_ACTIONS'] === 'true') {
    const eventName = process.env['GITHUB_EVENT_NAME'];
    if (eventName === 'pull_request') {
      const baseRef = process.env['GITHUB_BASE_REF']?.trim();
      if (!baseRef) throw new Error('GITHUB_BASE_REF is required for pull_request prompt verification');
      const remoteBase = runGit(repoDirectory, [
        'rev-parse',
        '--verify',
        `refs/remotes/origin/${baseRef}^{commit}`,
      ]);
      return runGit(repoDirectory, ['merge-base', 'HEAD', remoteBase]);
    }

    if (eventName === 'push') {
      const before = process.env['GITHUB_EVENT_BEFORE']?.trim();
      if (before && !/^0+$/.test(before)) {
        return runGit(repoDirectory, ['rev-parse', '--verify', `${before}^{commit}`]);
      }
      try {
        return runGit(repoDirectory, ['rev-parse', '--verify', 'HEAD^']);
      } catch {
        throw new Error('No previous commit is available for the push prompt verification');
      }
    }

    throw new Error(`Unsupported GitHub event for prompt verification: ${eventName ?? 'unknown'}`);
  }

  return runGit(repoDirectory, ['rev-parse', '--verify', 'HEAD^{commit}']);
}

function readBaseManifest(repoDirectory, baseRevision) {
  try {
    return runGit(repoDirectory, ['show', `${baseRevision}:${manifestPath}`]);
  } catch {
    try {
      runGit(repoDirectory, ['cat-file', '-e', `${baseRevision}:${manifestPath}`]);
    } catch {
      return null;
    }
    throw new Error(`Unable to read the base prompt manifest at ${baseRevision}`);
  }
}

function getChangedFiles(repoDirectory, baseRevision) {
  const changedFiles = new Set(
    runGit(repoDirectory, ['diff', '--name-only', baseRevision, '--', ...providerInputPaths])
      .split(/\r?\n/)
      .filter(Boolean),
  );
  const untrackedFiles = runGit(repoDirectory, [
    'ls-files',
    '--others',
    '--exclude-standard',
    '--',
    ...providerInputPaths,
  ])
    .split(/\r?\n/)
    .filter(Boolean);
  for (const path of untrackedFiles) changedFiles.add(path);
  return changedFiles;
}

function runManifestTest() {
  const require = createRequire(import.meta.url);
  const vitestPath = require.resolve('vitest/vitest.mjs', { paths: [backendDirectory] });
  const result = spawnSync(process.execPath, [
    vitestPath,
    'run',
    'src/lib/prompts/dailyInsightPromptManifest.test.ts',
    '--config',
    'vitest.config.mts',
  ], {
    cwd: backendDirectory,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Prompt manifest runtime verification exited with code ${result.status ?? 1}`);
  }
}

async function main() {
  const repoDirectory = runGit(backendDirectory, ['rev-parse', '--show-toplevel']);
  const currentSource = await readFile(resolve(repoDirectory, manifestPath), 'utf8');
  const baseRevision = resolveBaseRevision(repoDirectory);
  const baseSource = readBaseManifest(repoDirectory, baseRevision);
  const changedFiles = getChangedFiles(repoDirectory, baseRevision);

  runManifestTest();
  const result = verifyPromptReleaseHistory({ currentSource, baseSource, changedFiles });
  console.log(
    `Daily Insight prompt release guard passed: ${result.currentRelease.releaseId} `
      + `${result.currentRelease.promptFingerprint}; base releases ${result.baseReleaseCount}; `
      + `provider input changed: ${result.providerInputChanged ? 'yes' : 'no'}.`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}