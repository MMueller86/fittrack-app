import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from '@typescript/typescript6';

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(scriptsDirectory, '..');
const sourceRoot = join(backendRoot, 'src');
const functionsRoot = join(sourceRoot, 'functions');

export const EXPECTED_FUNCTION_COUNT = 79;
export const FUNCTION_BASELINE_PATH = join(scriptsDirectory, 'fixtures', 'functions-baseline.v1.json');

export function validateFunctionBaseline(baseline) {
  if (!baseline || typeof baseline !== 'object' || Array.isArray(baseline)) {
    throw new Error('Azure Functions baseline must be a JSON object.');
  }
  if (baseline.version !== 1) {
    throw new Error('Azure Functions baseline version must be 1.');
  }
  if (baseline.expectedCount !== EXPECTED_FUNCTION_COUNT) {
    throw new Error(`Azure Functions baseline expectedCount must be ${EXPECTED_FUNCTION_COUNT}.`);
  }
  if (!Array.isArray(baseline.names) || baseline.names.length !== EXPECTED_FUNCTION_COUNT) {
    throw new Error(`Azure Functions baseline must contain exactly ${EXPECTED_FUNCTION_COUNT} names.`);
  }
  if (baseline.names.some((name) => typeof name !== 'string' || name.length === 0)) {
    throw new Error('Azure Functions baseline names must be non-empty strings.');
  }
  if (new Set(baseline.names).size !== EXPECTED_FUNCTION_COUNT) {
    throw new Error('Azure Functions baseline names must be unique.');
  }

  const sortedNames = [...baseline.names].sort();
  if (baseline.names.some((name, index) => name !== sortedNames[index])) {
    throw new Error('Azure Functions baseline names must be sorted deterministically.');
  }

  return baseline;
}

export function readFunctionBaseline() {
  const baseline = JSON.parse(readFileSync(FUNCTION_BASELINE_PATH, 'utf8'));
  return validateFunctionBaseline(baseline);
}

export function getSourceFunctionNames() {
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

export function assertFunctionNamesMatchBaseline(actualNames, baseline, sourceLabel) {
  if (!Array.isArray(actualNames) || actualNames.some((name) => typeof name !== 'string')) {
    throw new Error(`${sourceLabel} returned an invalid function name list.`);
  }
  if (!Array.isArray(baseline?.names)) {
    throw new Error('Azure Functions baseline names are unavailable.');
  }

  const expectedNames = baseline.names;
  const actualSet = new Set(actualNames);
  const expectedSet = new Set(expectedNames);
  const missing = expectedNames.filter((name) => !actualSet.has(name));
  const unexpected = actualNames.filter((name) => !expectedSet.has(name));
  const seen = new Set();
  const duplicateSet = new Set();
  for (const name of actualNames) {
    if (seen.has(name)) duplicateSet.add(name);
    seen.add(name);
  }
  const duplicates = [...duplicateSet];

  if (actualNames.length !== expectedNames.length || missing.length > 0 || unexpected.length > 0 || duplicates.length > 0) {
    throw new Error(
      `${sourceLabel} differ from fixed baseline: expected ${expectedNames.length}, received ${actualNames.length}; `
      + `missing [${missing.join(', ')}], unexpected [${unexpected.join(', ')}], duplicates [${duplicates.join(', ')}].`,
    );
  }
}

export function assertSourceFunctionsMatchBaseline(baseline, sourceNames = getSourceFunctionNames()) {
  assertFunctionNamesMatchBaseline(sourceNames, baseline, 'Source declarations');
}

export function assertHostFunctionsMatchBaseline(payload, baseline) {
  if (!Array.isArray(payload) || payload.some((entry) => typeof entry?.name !== 'string')) {
    throw new Error('/admin/functions returned an invalid function list.');
  }

  assertFunctionNamesMatchBaseline(payload.map((entry) => entry.name), baseline, 'Host registrations');
}