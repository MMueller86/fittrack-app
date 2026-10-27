import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePackageReport } from './check-test-parity.mjs';

const baseline = { testFiles: 2, tests: 5 };

function makeReport({ testFiles = 2, tests = 5, failed = 0, pending = 0, todo = 0 } = {}) {
  return {
    testResults: Array.from({ length: testFiles }, () => ({
      assertionResults: Array.from({ length: tests / testFiles }, () => ({ status: 'passed' })),
    })),
    numTotalTests: tests,
    numFailedTests: failed,
    numPendingTests: pending,
    numTodoTests: todo,
  };
}

test('accepts a report at the recorded baseline with no skipped tests', () => {
  const result = validatePackageReport('shared', baseline, makeReport());
  assert.deepEqual(result.errors, []);
  assert.equal(result.testFiles, 2);
  assert.equal(result.tests, 5);
});

test('rejects fewer test files or tests than the baseline', () => {
  const result = validatePackageReport('shared', baseline, makeReport({ testFiles: 1, tests: 4 }));
  assert.match(result.errors.join(' '), /test files 1 below baseline 2/);
  assert.match(result.errors.join(' '), /tests 4 below baseline 5/);
});

test('rejects failed, skipped, pending, and todo tests', () => {
  const report = makeReport({ failed: 1, pending: 1, todo: 1 });
  report.testResults[0].assertionResults[0].status = 'skipped';
  const result = validatePackageReport('shared', baseline, report);
  assert.match(result.errors.join(' '), /1 failed tests/);
  assert.match(result.errors.join(' '), /1 skipped or pending tests/);
  assert.match(result.errors.join(' '), /1 todo tests/);
  assert.match(result.errors.join(' '), /non-passing assertion statuses/);
});

test('rejects malformed or incomplete Vitest reports', () => {
  const result = validatePackageReport('shared', baseline, {});
  assert.equal(result.errors.length, 4);
});