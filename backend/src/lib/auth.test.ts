import { describe, it, expect } from 'vitest';
import type { HttpRequest } from '@azure/functions';

import { DEV_USER_ID, getUserId, requireUser } from './auth';

// While the auth stub is active, these helpers should behave deterministically:
// every request maps to the dev user, regardless of headers. The test seam
// stays the same when real JWT auth replaces the stub later.

const fakeRequest = {} as unknown as HttpRequest;

describe('auth (dev stub)', () => {
  it('getUserId returns the dev user id', () => {
    expect(getUserId(fakeRequest)).toBe(DEV_USER_ID);
    expect(DEV_USER_ID).toBe('dev-user');
  });

  it('requireUser returns { userId } shape', () => {
    expect(requireUser(fakeRequest)).toEqual({ userId: DEV_USER_ID });
  });
});
