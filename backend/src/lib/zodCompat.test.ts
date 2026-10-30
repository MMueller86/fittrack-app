import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { legacyIssueCode } from './zodCompat';

function firstIssue(schema: z.ZodType, value: unknown) {
  const result = schema.safeParse(value);
  if (result.success) throw new Error('expected a validation failure');
  return result.error.issues[0]!;
}

describe('zodCompat default messages (Zod 3 wording)', () => {
  const object = z.object({ text: z.string() });

  it.each([
    ['missing value', object, {}, 'Required'],
    ['null for string', object, { text: null }, 'Expected string, received null'],
    ['number for string', object, { text: 7 }, 'Expected string, received number'],
    ['array for string', object, { text: [] }, 'Expected string, received array'],
    ['string for number', z.number(), 'x', 'Expected number, received string'],
    ['float for integer', z.number().int(), 1.5, 'Expected integer, received float'],
    ['string minimum', z.string().min(2), 'a', 'String must contain at least 2 character(s)'],
    ['string maximum', z.string().max(2), 'abc', 'String must contain at most 2 character(s)'],
    ['exact string length', z.string().length(2), 'abc', 'String must contain exactly 2 character(s)'],
    ['number minimum', z.number().min(1), 0, 'Number must be greater than or equal to 1'],
    ['number maximum', z.number().max(1), 2, 'Number must be less than or equal to 1'],
    ['exclusive number minimum', z.number().positive(), 0, 'Number must be greater than 0'],
    ['array minimum', z.array(z.string()).min(1), [], 'Array must contain at least 1 element(s)'],
    ['array maximum', z.array(z.string()).max(1), ['a', 'b'], 'Array must contain at most 1 element(s)'],
    ['unknown key', z.object({}).strict(), { extra: 1 }, "Unrecognized key(s) in object: 'extra'"],
    ['enum', z.enum(['a', 'b']), 'c', "Invalid enum value. Expected 'a' | 'b', received 'c'"],
    ['literal', z.literal(1), 2, 'Invalid literal value, expected 1'],
    ['guid', z.guid(), 'nope', 'Invalid uuid'],
  ])('%s', (_label, schema, value, message) => {
    expect(firstIssue(schema, value).message).toBe(message);
  });

  it('keeps explicit schema messages', () => {
    expect(firstIssue(z.string().min(1, 'text must not be empty'), '').message).toBe('text must not be empty');
  });

  it('reports a coerced missing number as nan', () => {
    expect(firstIssue(z.object({ n: z.coerce.number() }), {}).message).toBe('Expected number, received nan');
  });
});

describe('legacyIssueCode', () => {
  it('maps renamed Zod 4 codes back to the Zod 3 names', () => {
    expect(legacyIssueCode(firstIssue(z.guid(), 'nope'))).toBe('invalid_string');
    expect(legacyIssueCode(firstIssue(z.enum(['a', 'b']), 'c'))).toBe('invalid_enum_value');
    expect(legacyIssueCode(firstIssue(z.literal(1), 2))).toBe('invalid_literal');
  });

  it('passes unchanged codes through', () => {
    expect(legacyIssueCode(firstIssue(z.string().min(2), 'a'))).toBe('too_small');
    expect(legacyIssueCode(firstIssue(z.string(), 1))).toBe('invalid_type');
  });
});

describe('Zod 4 string length semantics', () => {
  it('counts code points for .max(), unlike JS length', () => {
    expect(z.string().max(2).safeParse('\u{1F44B}\u{1F44B}').success).toBe(true);
  });
});
