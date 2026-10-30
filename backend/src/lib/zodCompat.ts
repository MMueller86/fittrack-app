import { z } from 'zod';

// Zod 4 reworded its default issue messages and renamed some issue codes. Both are part of the
// HTTP error contract, so restore the Zod 3 wording and codes. Importing this module installs it.

function parsedType(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isNaN(value) ? 'nan' : 'number';
  if (value instanceof Date) return 'date';
  if (value instanceof Map) return 'map';
  if (value instanceof Set) return 'set';
  if (value instanceof Promise) return 'promise';
  return typeof value;
}

const ORIGIN_NOUN: Record<string, string> = { string: 'String', array: 'Array', set: 'Set' };
const ORIGIN_UNIT: Record<string, string> = { string: 'character(s)', array: 'element(s)', set: 'element(s)' };

function sizeMessage(issue: z.core.$ZodRawIssue): string | undefined {
  if (issue.code !== 'too_small' && issue.code !== 'too_big') return undefined;
  const small = issue.code === 'too_small';
  const bound = small ? issue.minimum : issue.maximum;
  const origin = String(issue.origin);
  if (origin in ORIGIN_NOUN) {
    const noun = ORIGIN_NOUN[origin];
    const unit = ORIGIN_UNIT[origin];
    if (issue.exact) return `${noun} must contain exactly ${bound} ${unit}`;
    if (small) return `${noun} must contain ${issue.inclusive === false ? 'over' : 'at least'} ${bound} ${unit}`;
    return `${noun} must contain ${issue.inclusive === false ? 'under' : 'at most'} ${bound} ${unit}`;
  }
  if (origin === 'number' || origin === 'int') {
    const comparison = small
      ? (issue.inclusive === false ? 'greater than' : 'greater than or equal to')
      : (issue.inclusive === false ? 'less than' : 'less than or equal to');
    return `Number must be ${comparison} ${bound}`;
  }
  return undefined;
}

function legacyMessage(issue: z.core.$ZodRawIssue): string | undefined {
  switch (issue.code) {
    case 'invalid_type': {
      const received = issue.received === 'NaN' ? 'nan' : parsedType(issue.input);
      if (received === 'undefined') return 'Required';
      const isFloat = issue.expected === 'int' && received === 'number';
      const expected = issue.expected === 'int' ? 'integer' : issue.expected;
      return `Expected ${expected}, received ${isFloat ? 'float' : received}`;
    }
    case 'too_small':
    case 'too_big':
      return sizeMessage(issue);
    case 'unrecognized_keys':
      return `Unrecognized key(s) in object: ${issue.keys.map((key) => `'${key}'`).join(', ')}`;
    case 'invalid_format':
      return issue.format === 'uuid' || issue.format === 'guid' ? 'Invalid uuid' : undefined;
    case 'invalid_value':
      if (issue.values.length === 1) return `Invalid literal value, expected ${JSON.stringify(issue.values[0])}`;
      return `Invalid enum value. Expected ${issue.values.map((v) => (typeof v === 'string' ? `'${v}'` : String(v))).join(' | ')}, received '${String(issue.input)}'`;
    default:
      return undefined;
  }
}

z.config({ customError: legacyMessage });

/** Zod 3 issue code for a Zod 4 issue; `invalid_value` cannot tell enum from literal, so single-value is treated as literal. */
export function legacyIssueCode(issue: { code: string; values?: readonly unknown[] }): string {
  if (issue.code === 'invalid_format') return 'invalid_string';
  if (issue.code === 'invalid_value') return (issue.values?.length ?? 0) === 1 ? 'invalid_literal' : 'invalid_enum_value';
  return issue.code;
}
