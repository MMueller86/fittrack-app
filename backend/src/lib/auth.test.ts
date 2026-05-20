import { describe, it, expect } from 'vitest';
import type { HttpRequest } from '@azure/functions';

import { DEV_USER_ID, requireUser, parseBearer, isDevMode } from './auth';

const fakeRequest = {} as unknown as HttpRequest;

describe('auth (dev mode)', () => {
  it('isDevMode returns true when AUTH_MODE is unset', () => {
    expect(isDevMode()).toBe(true);
  });

  it('requireUser returns full UserContext in dev mode', () => {
    const ctx = requireUser(fakeRequest);
    expect(ctx.userId).toBe(DEV_USER_ID);
    expect(ctx.tier).toBe('internal');
    expect(ctx.source).toBe('dev');
  });

  it('DEV_USER_ID is "dev-user"', () => {
    expect(DEV_USER_ID).toBe('dev-user');
  });
});

describe('parseBearer', () => {
  it('returns null when no authorization header', () => {
    const req = { headers: new Map() } as unknown as HttpRequest;
    expect(parseBearer(req)).toBeNull();
  });

  it('extracts token from valid Bearer header', () => {
    const headers = new Map([['authorization', 'Bearer abc123']]);
    const req = { headers: { get: (k: string) => headers.get(k) } } as unknown as HttpRequest;
    expect(parseBearer(req)).toBe('abc123');
  });

  it('returns null for malformed authorization header', () => {
    const headers = new Map([['authorization', 'Basic abc123']]);
    const req = { headers: { get: (k: string) => headers.get(k) } } as unknown as HttpRequest;
    expect(parseBearer(req)).toBeNull();
  });

  it('returns null for empty Bearer value', () => {
    const headers = new Map([['authorization', 'Bearer ']]);
    const req = { headers: { get: (k: string) => headers.get(k) } } as unknown as HttpRequest;
    expect(parseBearer(req)).toBeNull();
  });
});
