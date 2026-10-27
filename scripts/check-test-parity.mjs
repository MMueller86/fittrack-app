import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = path.join(root, 'scripts', 'test-baseline.json');

export function validatePackageReport(packageName, expected, report) {
  const errors = [];
  const testFiles = Array.isArray(report?.testResults) ? report.testResults.length : null;
  const tests = Number.isInteger(report?.numTotalTests) ? report.numTotalTests : null;
  const failedTests = Number.isInteger(report?.numFailedTests) ? report.numFailedTests : null;
  const pendingTests = Number.isInteger(report?.numPendingTests) ? report.numPendingTests : null;
  const todoTests = Number.isInteger(report?.numTodoTests) ? report.numTodoTests : 0;
  const statuses = (report?.testResults ?? []).flatMap((result) =>
    (result.assertionResults ?? []).map((assertion) => assertion.status),
  );

  if (testFiles === null) errors.push('Vitest report has no testResults array');
  else if (testFiles < expected.testFiles) errors.push(`test files ${testFiles} below baseline ${expected.testFiles}`);

  if (tests === null) errors.push('Vitest report has no numTotalTests count');
  else if (tests < expected.tests) errors.push(`tests ${tests} below baseline ${expected.tests}`);

  if (failedTests === null) errors.push('Vitest report has no numFailedTests count');
  else if (failedTests > 0) errors.push(`${failedTests} failed tests`);

  if (pendingTests === null) errors.push('Vitest report has no numPendingTests count');
  else if (pendingTests > 0) errors.push(`${pendingTests} skipped or pending tests`);

  if (todoTests > 0) errors.push(`${todoTests} todo tests`);
  const nonPassingStatuses = statuses.filter((status) => status !== 'passed' && status !== 'failed');
  if (nonPassingStatuses.length > 0) errors.push(`${nonPassingStatuses.length} non-passing assertion statuses`);

  return { packageName, testFiles, tests, errors };
}

async function main(args) {
  const reportPaths = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const packageName = args[index]?.replace(/^--/, '');
    const reportPath = args[index + 1];
    if (!packageName || !reportPath || !args[index].startsWith('--')) {
      throw new Error('Usage: node scripts/check-test-parity.mjs --shared <json> --backend <json> --mobile <json>');
    }
    reportPaths.set(packageName, reportPath);
  }

  const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
  if (baseline.format !== 'fittrack-vitest-parity-v1') throw new Error('Unsupported test baseline format');

  let hasErrors = false;
  for (const [packageName, expected] of Object.entries(baseline.packages)) {
    const reportPath = reportPaths.get(packageName);
    if (!reportPath) {
      console.error(`FAIL ${packageName}: missing Vitest JSON report argument`);
      hasErrors = true;
      continue;
    }

    const report = JSON.parse(await readFile(path.resolve(reportPath), 'utf8'));
    const result = validatePackageReport(packageName, expected, report);
    const summary = `${result.testFiles ?? '?'} files / ${result.tests ?? '?'} tests (minimum ${expected.testFiles}/${expected.tests})`;
    if (result.errors.length > 0) {
      console.error(`FAIL ${packageName}: ${summary}; ${result.errors.join('; ')}`);
      hasErrors = true;
    } else {
      console.log(`PASS ${packageName}: ${summary}`);
    }
  }

  if (hasErrors) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}