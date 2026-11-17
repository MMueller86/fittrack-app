import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ record: vi.fn() }));

vi.mock('./telemetry', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./telemetry')>()),
  record: mocks.record,
}));

import { recordClientError, sanitizeStack } from './errorTelemetry';

beforeEach(() => mocks.record.mockReset());

describe('recordClientError', () => {
  it('sends the error name and a code-location stack, never the message', () => {
    const error = new TypeError('secret@example.com broke');
    error.stack = [
      'TypeError: secret@example.com broke',
      '    at render (http://localhost:8081/index.bundle?platform=android:123:45)',
      '    at foo (address at secret@example.com:1:2)',
    ].join('\n');
    recordClientError(error);

    const event = mocks.record.mock.calls.at(-1)![0] as { type: string; name: string; stack: string };
    expect(event.type).toBe('error');
    expect(event.name).toBe('TypeError');
    expect(JSON.stringify(event)).not.toContain('secret@example.com');
    expect(event.stack).toContain('at render (index.bundle:123:45)');
  });

  it('truncates the stack to 1000 characters', () => {
    const lines = Array.from({ length: 200 }, (_, i) => `    at fn${i} (app.js:${i}:1)`).join('\n');
    expect(sanitizeStack(`Error: x\n${lines}`).length).toBeLessThanOrEqual(1000);
  });

  it('never throws and falls back to a generic name', () => {
    expect(() => recordClientError(null)).not.toThrow();
    expect(() => recordClientError({ name: 'user@example.com' })).not.toThrow();
    const last = mocks.record.mock.calls.at(-1)![0] as { name: string };
    expect(last.name).toBe('Error');
  });
});
