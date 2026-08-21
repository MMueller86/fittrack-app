import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyPromptReleaseHistory } from './verify-daily-insight-prompt.mjs';

const promptPath = 'backend/src/lib/prompts/dailyInsightPrompt.ts';
const manifestPath = 'backend/src/lib/prompts/dailyInsightPromptManifest.ts';
const validationPath = 'backend/src/lib/dailyInsightValidation.ts';
const nonProviderPath = 'backend/src/lib/dailyInsightValidation.test.ts';

function releaseSource(releases) {
  return `export const DAILY_INSIGHT_PROMPT_RELEASES = [\n${releases.join(',\n')}\n] as const;`;
}

function release(releaseId, fingerprintCharacter) {
  return `{
    releaseId: '${releaseId}',
    promptVersion: '${releaseId}',
    assemblyVersion: 'v1',
    promptFingerprint: 'sha256:${fingerprintCharacter.repeat(64)}',
    providerInputCompatibility: 'byte-identical-to-v14-baseline',
  }`;
}

const baseSource = releaseSource([release('v14', 'a')]);

test('allows the initial release when the base has no manifest', () => {
  const result = verifyPromptReleaseHistory({
    currentSource: baseSource,
    baseSource: null,
    changedFiles: new Set([promptPath, manifestPath]),
  });

  assert.equal(result.currentRelease.releaseId, 'v14');
  assert.equal(result.baseReleaseCount, 0);
});

test('requires a new release when provider input changes', () => {
  assert.throws(
    () => verifyPromptReleaseHistory({
      currentSource: baseSource,
      baseSource,
      changedFiles: new Set([promptPath, manifestPath]),
    }),
    /new release entry/,
  );
});

test('requires the manifest to change with provider input', () => {
  assert.throws(
    () => verifyPromptReleaseHistory({
      currentSource: baseSource,
      baseSource,
      changedFiles: new Set([promptPath]),
    }),
    /require a manifest change/,
  );
});

test('requires a new release when provider-visible validation constants change', () => {
  assert.throws(
    () => verifyPromptReleaseHistory({
      currentSource: baseSource,
      baseSource,
      changedFiles: new Set([validationPath]),
    }),
    /require a manifest change/,
  );

  assert.throws(
    () => verifyPromptReleaseHistory({
      currentSource: baseSource,
      baseSource,
      changedFiles: new Set([validationPath, manifestPath]),
    }),
    /new release entry/,
  );
});

test('does not classify non-provider changes as provider input', () => {
  const result = verifyPromptReleaseHistory({
    currentSource: baseSource,
    baseSource,
    changedFiles: new Set([nonProviderPath]),
  });

  assert.equal(result.providerInputChanged, false);
});

test('rejects edits to historical releases', () => {
  const changedHistoricalSource = releaseSource([release('v14', 'b'), release('v15', 'c')]);

  assert.throws(
    () => verifyPromptReleaseHistory({
      currentSource: changedHistoricalSource,
      baseSource,
      changedFiles: new Set([promptPath, manifestPath]),
    }),
    /Historical prompt release at index 0 was modified/,
  );
});

test('accepts an appended release with an unchanged history', () => {
  const currentSource = releaseSource([release('v14', 'a'), release('v15', 'b')]);
  const result = verifyPromptReleaseHistory({
    currentSource,
    baseSource,
    changedFiles: new Set([promptPath, manifestPath]),
  });

  assert.equal(result.currentRelease.releaseId, 'v15');
  assert.equal(result.baseReleaseCount, 1);
});