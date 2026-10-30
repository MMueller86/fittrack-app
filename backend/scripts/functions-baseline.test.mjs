import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EXPECTED_FUNCTION_COUNT,
  assertHostFunctionsMatchBaseline,
  assertSourceFunctionsMatchBaseline,
  getSourceFunctionNames,
  readFunctionBaseline,
  validateFunctionBaseline,
} from './functions-baseline.mjs';

const baseline = readFunctionBaseline();

function makeSourceCases() {
  return [
    ['missing', baseline.names.slice(1), /missing \[/],
    ['unexpected', [...baseline.names.slice(1), 'unexpected-function'], /unexpected \[/],
    ['duplicate', [...baseline.names, baseline.names[0]], /duplicates \[/],
  ];
}

function makeHostPayload(names) {
  return names.map((name) => ({ name }));
}

test('checked-in baseline is version 1 with exactly 79 sorted, unique names', () => {
  assert.equal(baseline.version, 1);
  assert.equal(baseline.expectedCount, EXPECTED_FUNCTION_COUNT);
  assert.equal(baseline.names.length, EXPECTED_FUNCTION_COUNT);
  assert.equal(new Set(baseline.names).size, EXPECTED_FUNCTION_COUNT);
  assert.deepEqual(baseline.names, [...baseline.names].sort());
});

test('baseline validation rejects a changed fixed count, duplicates, and nondeterministic order', () => {
  assert.throws(() => validateFunctionBaseline({ ...baseline, expectedCount: 78 }), /expectedCount must be 79/);
  assert.throws(() => validateFunctionBaseline({ ...baseline, names: baseline.names.slice(1) }), /exactly 79 names/);
  assert.throws(
    () => validateFunctionBaseline({ ...baseline, names: [...baseline.names.slice(1), baseline.names[0]] }),
    /sorted deterministically/,
  );
  assert.throws(
    () => validateFunctionBaseline({ ...baseline, names: [...baseline.names.slice(1), baseline.names[1]] }),
    /unique/,
  );
});

test('current source declarations match the fixed baseline', () => {
  assert.equal(getSourceFunctionNames().length, EXPECTED_FUNCTION_COUNT);
  assert.doesNotThrow(() => assertSourceFunctionsMatchBaseline(baseline));
});

test('source comparison rejects missing, unexpected, and duplicate names', (t) => {
  for (const [kind, names, errorPattern] of makeSourceCases()) {
    t.test(kind, () => {
      assert.throws(() => assertSourceFunctionsMatchBaseline(baseline, names), errorPattern);
    });
  }
});

test('host registration comparison matches the fixed baseline without starting the host', () => {
  assert.doesNotThrow(() => assertHostFunctionsMatchBaseline(makeHostPayload(baseline.names), baseline));
});

test('host comparison rejects missing, unexpected, and duplicate names', (t) => {
  for (const [kind, names, errorPattern] of makeSourceCases()) {
    t.test(kind, () => {
      assert.throws(() => assertHostFunctionsMatchBaseline(makeHostPayload(names), baseline), errorPattern);
    });
  }
});