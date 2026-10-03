import { describe, expect, it, vi } from 'vitest';

const open = vi.hoisted(() => vi.fn());

vi.mock('react-native-share', () => ({
  default: { open },
}));

import {
  openNativeMultiImageShareCandidate,
  validateLocalPngUris,
} from './nativeShareCandidate';

describe('nativeShareCandidate', () => {
  it('validates that exactly two local PNG URIs are supplied', () => {
    expect(validateLocalPngUris([
      'file:///data/user/0/com.fittrack.app/cache/one.png',
      'file:///data/user/0/com.fittrack.app/cache/two.png',
    ])).toEqual([
      'file:///data/user/0/com.fittrack.app/cache/one.png',
      'file:///data/user/0/com.fittrack.app/cache/two.png',
    ]);

    expect(() => validateLocalPngUris(['file:///tmp/one.png'])).toThrow('Exactly two local PNG URIs');
    expect(() => validateLocalPngUris(['https://example.com/one.png', 'file:///tmp/two.png'])).toThrow('local PNG URI');
  });

  it('invokes Share.open exactly once with the two PNG URIs and no fallback', async () => {
    open.mockResolvedValueOnce({ success: true, message: 'ok' });

    const result = await openNativeMultiImageShareCandidate(
      'file:///data/user/0/com.fittrack.app/cache/one.png',
      'file:///data/user/0/com.fittrack.app/cache/two.png',
    );

    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith({
      urls: [
        'file:///data/user/0/com.fittrack.app/cache/one.png',
        'file:///data/user/0/com.fittrack.app/cache/two.png',
      ],
    });
    expect(result).toMatchObject({
      urls: [
        'file:///data/user/0/com.fittrack.app/cache/one.png',
        'file:///data/user/0/com.fittrack.app/cache/two.png',
      ],
      success: true,
    });
  });

  it('rejects duplicate image URIs before invoking the native bridge', async () => {
    open.mockClear();

    await expect(openNativeMultiImageShareCandidate(
      'file:///data/user/0/com.fittrack.app/cache/one.png',
      'file:///data/user/0/com.fittrack.app/cache/one.png',
    )).rejects.toThrow('must be distinct');

    expect(open).not.toHaveBeenCalled();
  });
});
