// Structured logging for Azure Function handlers.
//
// Why a thin wrapper around `InvocationContext.log/...`:
//   - AppInsights ingests stringified JSON as `customDimensions`, which
//     KQL can slice. Plain text logs are unsearchable beyond regex.
//   - Centralising the format means every handler emits the same shape
//     (timestamp, level, event, ...fields). Adding correlation IDs or
//     `userId` later only touches this file.
//   - In tests, the stubbed `ctx.log` is a no-op, so this is free.

import type { InvocationContext } from '@azure/functions';

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogFields {
  [key: string]: string | number | boolean | null | undefined;
}

export interface ValidationDiagnostic {
  phase?: string;
  code: string;
  path: string;
  keys?: string[];
}

const MAX_VALIDATION_DIAGNOSTICS_TO_LOG = 8;
const MAX_UNKNOWN_KEYS_TO_LOG = 8;

export function validationDiagnosticLogFields(
  diagnostics: readonly ValidationDiagnostic[],
): LogFields {
  const visibleDiagnostics = diagnostics.slice(0, MAX_VALIDATION_DIAGNOSTICS_TO_LOG);
  return {
    validation_diagnostic_count: diagnostics.length,
    validation_diagnostics: visibleDiagnostics
      .map(({ phase, code, path, keys }) => {
        const safeKeys = keys?.slice(0, MAX_UNKNOWN_KEYS_TO_LOG) ?? [];
        const keysSuffix = safeKeys.length > 0
          ? `[${safeKeys.join(',')}${(keys?.length ?? 0) > MAX_UNKNOWN_KEYS_TO_LOG ? ',+' : ''}]`
          : '';
        return `${phase ? `${phase}:` : ''}${code}@${path}${keysSuffix}`;
      })
      .join(';'),
    validation_diagnostics_truncated: diagnostics.length > MAX_VALIDATION_DIAGNOSTICS_TO_LOG ||
      visibleDiagnostics.some((diagnostic) => (diagnostic.keys?.length ?? 0) > MAX_UNKNOWN_KEYS_TO_LOG),
  };
}

/**
 * Emit a single structured log line.
 *
 * Output shape (one line of JSON):
 *
 *   {"ts":"2026-04-30T...","level":"info","event":"handler.start",
 *    "handler":"weights.add","method":"POST"}
 *
 * Fields with `undefined` values are dropped so empty optional context
 * (e.g. missing `error_stack`) doesn't pollute the log.
 */
export function logEvent(
  ctx: InvocationContext,
  level: LogLevel,
  event: string,
  fields: LogFields = {},
): void {
  const payload: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    event,
  };
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) payload[k] = v;
  }
  const line = JSON.stringify(payload);
  switch (level) {
    case 'error':
      ctx.error(line);
      return;
    case 'warn':
      ctx.warn(line);
      return;
    default:
      ctx.log(line);
  }
}
