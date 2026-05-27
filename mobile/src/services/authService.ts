// authService — token lifecycle management using expo-secure-store.
// Stores access_token + refresh_token, checks expiry, performs silent refresh.

import * as SecureStore from 'expo-secure-store';
import { authConfig } from './authConfig';

const ACCESS_TOKEN_KEY = 'fittrack_access_token';
const REFRESH_TOKEN_KEY = 'fittrack_refresh_token';

/**
 * Decode a JWT payload without signature verification (client-side only).
 * Used to read `exp` for proactive refresh — the backend still verifies fully.
 */
function decodePayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(payload);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export const authService = {
  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },

  async saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
    ]);
  },

  async clearTokens(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    ]);
  },

  /**
   * Check if the stored access token is expired or will expire within the buffer window.
   * Returns true if expired/missing/malformed — caller should refresh.
   */
  isTokenExpired(token: string | null, bufferSeconds = 60): boolean {
    if (!token) return true;
    const payload = decodePayload(token);
    if (!payload || typeof payload.exp !== 'number') return true;
    const nowSeconds = Math.floor(Date.now() / 1000);
    return payload.exp - bufferSeconds <= nowSeconds;
  },

  /**
   * Attempt a silent token refresh using the stored refresh_token.
   * Returns the new access_token on success, null on failure.
   */
  async refreshAccessToken(): Promise<string | null> {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    if (!refreshToken) return null;

    try {
      const body = new URLSearchParams({
        client_id: authConfig.clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: authConfig.scopes.join(' '),
      });

      const response = await fetch(authConfig.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!response.ok) return null;

      const data = await response.json();
      const newAccessToken = data.access_token as string | undefined;
      const newRefreshToken = (data.refresh_token as string | undefined) ?? refreshToken;

      if (!newAccessToken) return null;

      await authService.saveTokens(newAccessToken, newRefreshToken);
      return newAccessToken;
    } catch {
      return null;
    }
  },
};
