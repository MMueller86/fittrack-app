import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyPromptReleaseHistory, validationProviderInputChanged } from './verify-daily-insight-prompt.mjs';

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
const validationSource = (extra = '', title = '40') => `import { z } from 'zod';
export const DAILY_INSIGHT_TITLE_MAX_LENGTH = ${title};
export const DAILY_INSIGHT_SUMMARY_MAX_LENGTH = 5_000;
${extra}
const maxJsLength = (max: number) => (value: string) => value.length <= max;
export const DAILY_INSIGHT_RESPONSE_SCHEMA = z.object({ title: z.string().refine(maxJsLength(DAILY_INSIGHT_TITLE_MAX_LENGTH)) });
`;

test('does not require a release when only the local Zod post-validation changes', () => {
  const base = validationSource();
  const current = base
    .replace('z.string()', 'z.string().trim().min(1)')
    .replace('value.length <= max', 'Array.from(value).length <= max')
    + 'const parsed = DAILY_INSIGHT_RESPONSE_SCHEMA.safeParse({});\n';

  assert.equal(validationProviderInputChanged(base, current), false);
});

test('requires a release when a provider-visible *_MAX_LENGTH constant changes', () => {
  assert.equal(validationProviderInputChanged(validationSource(), validationSource('', '41')), true);
});

test('requires a release when a *_MAX_LENGTH constant is added or removed', () => {
  const added = validationSource('export const DAILY_INSIGHT_GREETING_MAX_LENGTH = 120;');
  assert.equal(validationProviderInputChanged(validationSource(), added), true);
  assert.equal(validationProviderInputChanged(added, validationSource()), true);
});

test('treats a validation file missing on either side as provider-visible', () => {
  assert.equal(validationProviderInputChanged(null, validationSource()), true);
});
