// Error events from ErrorBoundary. Only the error class name and code locations of the stack are
// sent, never the message and never any text that is not a function name or file:line:column.

import { getCurrentEpisode } from './episode';
import { record } from './telemetry';

const NAME_PATTERN = /^[A-Za-z0-9_.$ -]{1,60}$/;
const FUNCTION_PATTERN = /^[A-Za-z0-9_$.<>[\] ]{1,60}$/;
const LOCATION_PATTERN = /([A-Za-z0-9_.$-]+)(?:\?[^:\s)]*)?:(\d+)(?::(\d+))?\)?\s*$/;
const MAX_STACK_CHARS = 1000;

export function sanitizeErrorName(name: unknown): string {
  return typeof name === 'string' && NAME_PATTERN.test(name) ? name : 'Error';
}

/** Keeps `at <function> (<file>:<line>:<col>)` lines only; the leading message lines are dropped. */
export function sanitizeStack(stack: unknown): string {
  if (typeof stack !== 'string') return '';
  const lines: string[] = [];
  for (const raw of stack.split('\n')) {
    const match = /^\s*at\s+(.*)$/.exec(raw);
    if (!match) continue;
    const rest = match[1] ?? '';
    const location = LOCATION_PATTERN.exec(rest);
    if (!location) continue;
    const open = rest.indexOf(' (');
    const fn = open > 0 ? rest.slice(0, open).trim() : '';
    const safeFn = FUNCTION_PATTERN.test(fn) ? fn : '<anonymous>';
    lines.push(`at ${safeFn} (${location[1]}:${location[2]}${location[3] ? `:${location[3]}` : ''})`);
  }
  return lines.join('\n').slice(0, MAX_STACK_CHARS);
}

export function recordClientError(error: unknown): void {
  try {
    const source = error as { name?: unknown; stack?: unknown } | null;
    record({
      type: 'error',
      episodeId: getCurrentEpisode().id,
      name: sanitizeErrorName(source?.name),
      stack: sanitizeStack(source?.stack),
    });
  } catch {
    // telemetry must never throw
  }
}
