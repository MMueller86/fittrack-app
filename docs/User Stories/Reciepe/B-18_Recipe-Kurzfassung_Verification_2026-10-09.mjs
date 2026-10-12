import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../..');
const backend = path.join(root, 'backend');
const require = createRequire(path.join(backend, 'package.json'));
const ts = require('typescript');
const output = path.join(directory, 'B-18_Recipe-Kurzfassung_OfflineEvidence_2026-10-09.json');
const baselinePatch = path.join(directory, 'B-18_Recipe-Kurzfassung_Ausgangsdiff_2026-10-09.patch');
const ownPatch = path.join(directory, 'B-18_Recipe-Kurzfassung_Enddiff_2026-10-09.patch');
const isolatedIndex = path.join(backend, 'output', 'b18-verification.index');
const paths = [
  'backend/src/lib/recipeAnalyzeValidation.ts',
  'backend/src/lib/recipeAnalyzeValidation.test.ts',
  'backend/src/functions/recipes.ts',
  'backend/src/functions/recipes.test.ts',
  'backend/src/lib/prompts/recipeAnalyze.ts',
  'backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts',
  'backend/src/lib/prompts/recipeAnalyze.eval.test.ts',
  'backend/src/functions/ai.test.ts',
  'backend/src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts',
];
const evidence = {
  recordedAt: new Date().toISOString(),
  phase: 'B-18 handoff recovery; new offline checks, no live calls',
  redGreenKind: 'reconstructed baseline replay, not original chronological capture',
  commands: [],
  sourceFiles: [],
};
function hash(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function git(args, isolated = false) {
  const result = spawnSync('git', args, {
    cwd: root, encoding: 'utf8',
    env: isolated ? { ...process.env, GIT_INDEX_FILE: isolatedIndex } : process.env,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout;
}
function validator(source) {
  const filename = path.join(backend, 'src/lib/recipeAnalyzeValidation.ts');
  const localRequire = createRequire(filename);
  const exports = {};
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const execute = new Function('require', 'exports', compiled);
  execute((name) => {
    if (name === '../../../shared/types/recipeExport') {
      const shared = {};
      const sharedSource = fs.readFileSync(path.join(root, 'shared/types/recipeExport.ts'), 'utf8');
      const sharedCompiled = ts.transpileModule(sharedSource, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText;
      new Function('require', 'exports', sharedCompiled)(localRequire, shared);
      return shared;
    }
    return localRequire(name);
  }, exports);
  return exports;
}
function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: backend, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' },
    maxBuffer: 32 * 1024 * 1024,
  });
  const text = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.replace(/\u001b\[[0-9;]*m/g, '');
  const summary = text.split(/\r?\n/).filter((line) =>
    /Test Files|Tests\s+\d|Duration|FAIL |Error:|error TS|Build verification|Verified|passed|failed/i.test(line));
  const entry = {
    command: [command, ...args].join(' '), cwd: 'backend',
    exitCode: result.status, signal: result.signal, summary,
    ...(result.error ? { spawnError: result.error.message } : {}),
  };
  evidence.commands.push(entry);
  fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(entry));
}

if (fs.existsSync(isolatedIndex)) throw new Error('Refusing to reuse an existing isolated index');
try {
  evidence.head = git(['rev-parse', 'HEAD']).trim();
  evidence.initialStatus = git(['status', '--short']);
  git(['read-tree', 'HEAD'], true);
  git(['apply', '--cached', ...paths.map((relative) => `--include=${relative}`), baselinePatch], true);
  const beforeSource = git(['show', ':backend/src/lib/recipeAnalyzeValidation.ts'], true);
  const currentSource = fs.readFileSync(path.join(backend, 'src/lib/recipeAnalyzeValidation.ts'), 'utf8');
  const before = validator(beforeSource);
  const after = validator(currentSource);
  const raw = {
    suggestedName: 'Synthetischer Teiltrace', description: 'Synthetischer Test.',
    suggestedPortions: 2, tags: [], ingredients: [],
    steps: Array.from({ length: 8 }, (_, index) => ({ order: index + 1, title: null, description: 'Synthetische Quelle.' })),
    exportSuggestion: {
      version: 1, teaser: 'Synthetischer Test', totalTimeMinutes: null, difficulty: null,
      includedIngredientKeys: [],
      steps: [[1], [2], [3], [4], [6, 7]].map((sourceStepOrders, index) => ({
        order: index + 1, description: 'Synthetischer Schritt.', sourceStepOrders, ingredientKeys: [],
      })),
    },
  };
  const original = structuredClone(raw);
  evidence.redGreen = {
    input: raw,
    baselineImport: before.validateRecipeAnalyzeOutput(raw),
    baselinePreparation: before.validateRecipeExportPreparationOutput(raw),
    currentImport: after.validateRecipeAnalyzeOutput(raw),
    currentPreparation: after.validateRecipeExportPreparationOutput(raw),
    unchanged: JSON.stringify(raw) === JSON.stringify(original),
  };
  if (evidence.redGreen.baselineImport.ok || evidence.redGreen.baselinePreparation.ok ||
      !evidence.redGreen.currentImport.ok || !evidence.redGreen.currentPreparation.ok || !evidence.redGreen.unchanged) {
    throw new Error('Red/Green discriminator did not match the approved partial-trace hypothesis');
  }
  git(['diff', '--no-ext-diff', '--binary', `--output=${ownPatch}`, '--', ...paths], true);
  evidence.artifacts = {
    baselinePatch: { path: path.relative(root, baselinePatch).replaceAll('\\', '/'), sha256: hash(baselinePatch) },
    ownEndPatch: { path: path.relative(root, ownPatch).replaceAll('\\', '/'), sha256: hash(ownPatch) },
  };
  evidence.sourceFiles = paths.map((relative) => ({ path: relative, sha256: hash(path.join(root, relative)) }));
} finally {
  fs.rmSync(isolatedIndex, { force: true });
  fs.rmSync(`${isolatedIndex}.lock`, { force: true });
}

const vitest = path.join(root, 'node_modules/vitest/vitest.mjs');
run(process.execPath, [vitest, 'run', 'src/lib/recipeAnalyzeValidation.test.ts']);
run(process.execPath, [vitest, 'run', 'src/functions/ai.test.ts', 'src/functions/recipes.test.ts', 'src/lib/recipeAnalyzeValidation.test.ts', 'src/lib/recipeValidation.test.ts']);
run(process.execPath, [vitest, 'run', 'src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts']);
run(process.execPath, [vitest, 'run']);
run(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '--noEmit']);
run(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '--project', 'tsconfig.json']);
run(process.execPath, ['scripts/copy-instagram-assets.mjs']);
run(process.execPath, ['scripts/verify-build.mjs']);
run('git', ['diff', '--check']);
evidence.finishedAt = new Date().toISOString();
evidence.finalSourceFiles = paths.map((relative) => ({ path: relative, sha256: hash(path.join(root, relative)) }));
evidence.sourceUnchangedDuringVerification = JSON.stringify(evidence.sourceFiles) === JSON.stringify(evidence.finalSourceFiles);
fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
console.log(`Repository evidence: ${path.relative(root, output)}`);
process.exitCode = evidence.commands.some((entry) => entry.exitCode !== 0) || !evidence.sourceUnchangedDuringVerification ? 1 : 0;