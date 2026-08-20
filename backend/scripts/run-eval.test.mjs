import { strict as assert } from 'node:assert';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';

import {
  getMissingRequiredEvalKeys,
  loadEvalEnvironment,
  REQUIRED_EVAL_ENV_KEYS,
} from './run-eval.mjs';

async function withSettings(values, callback) {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'fittrack-eval-'));
  const settingsPath = join(temporaryDirectory, 'local.settings.json');

  try {
    await writeFile(settingsPath, JSON.stringify({ Values: values }), 'utf8');
    return await callback(settingsPath);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

test('loads Azure settings without overriding an existing environment value', async () => {
  await withSettings(
    {
      AZURE_OPENAI_ENDPOINT: 'from-settings',
      AZURE_OPENAI_API_KEY: 'configured-value',
      AZURE_OPENAI_DEPLOYMENT_NAME: 'settings-deployment',
    },
    async (settingsPath) => {
      const environment = await loadEvalEnvironment({
        settingsPath,
        baseEnvironment: {
          AZURE_OPENAI_ENDPOINT: 'from-ci',
        },
      });

      assert.equal(environment.AZURE_OPENAI_ENDPOINT, 'from-ci');
      assert.equal(environment.AZURE_OPENAI_API_KEY, 'configured-value');
      assert.equal(environment.AZURE_OPENAI_DEPLOYMENT_NAME, 'settings-deployment');
      assert.deepEqual(getMissingRequiredEvalKeys(environment), []);
    },
  );
});

test('reports missing required settings without exposing values', async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'fittrack-eval-'));
  const missingSettingsPath = join(temporaryDirectory, 'missing-local.settings.json');

  try {
    const environment = await loadEvalEnvironment({
      settingsPath: missingSettingsPath,
      baseEnvironment: {},
    });

    assert.deepEqual(getMissingRequiredEvalKeys(environment), REQUIRED_EVAL_ENV_KEYS);
    assert.equal(await readFile(missingSettingsPath, 'utf8').catch(() => null), null);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});