// Pending login: short-lived, single-use record that lets the app finish a login after a cold start.
// Stored only in SecureStore on the device; never logged.

import * as SecureStore from 'expo-secure-store';

export const PENDING_LOGIN_KEY = 'fittrack_pending_login';
export const PENDING_LOGIN_TTL_MS = 10 * 60 * 1000;

export interface PendingLogin {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  createdAt: number;
}

export async function savePendingLogin(
  login: Omit<PendingLogin, 'createdAt'>,
  now: number = Date.now(),
): Promise<void> {
  const record: PendingLogin = { ...login, createdAt: now };
  await SecureStore.setItemAsync(PENDING_LOGIN_KEY, JSON.stringify(record));
}

export async function clearPendingLogin(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PENDING_LOGIN_KEY);
  } catch {
    // Best effort: an undeletable entry still expires and is overwritten by the next login.
  }
}

function parse(raw: string | null): PendingLogin | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== 'object') return null;
    const r = v as Record<string, unknown>;
    if (
      typeof r['state'] === 'string' && r['state'] &&
      typeof r['codeVerifier'] === 'string' && r['codeVerifier'] &&
      typeof r['redirectUri'] === 'string' && r['redirectUri'] &&
      typeof r['createdAt'] === 'number'
    ) {
      return { state: r['state'], codeVerifier: r['codeVerifier'], redirectUri: r['redirectUri'], createdAt: r['createdAt'] };
    }
  } catch {
    // fall through
  }
  return null;
}

/** Returns the valid pending login; expired or malformed entries are deleted and yield null. */
export async function loadPendingLogin(now: number = Date.now()): Promise<PendingLogin | null> {
  let raw: string | null = null;
  try {
    raw = await SecureStore.getItemAsync(PENDING_LOGIN_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  const login = parse(raw);
  if (!login || now - login.createdAt > PENDING_LOGIN_TTL_MS || login.createdAt > now + 60_000) {
    await clearPendingLogin();
    return null;
  }
  return login;
}

/** Single-use read: the entry is deleted before it is returned. */
export async function consumePendingLogin(now: number = Date.now()): Promise<PendingLogin | null> {
  const login = await loadPendingLogin(now);
  if (login) await clearPendingLogin();
  return login;
}

/** Like consumePendingLogin, but tells a never-stored entry ('missing') from an expired/malformed one ('invalid'). */
export async function consumePendingLoginDetailed(
  now: number = Date.now(),
): Promise<{ status: 'valid'; login: PendingLogin } | { status: 'missing' } | { status: 'invalid' }> {
  let raw: string | null = null;
  try {
    raw = await SecureStore.getItemAsync(PENDING_LOGIN_KEY);
  } catch {
    return { status: 'missing' };
  }
  if (raw === null) return { status: 'missing' };
  const login = await loadPendingLogin(now);
  await clearPendingLogin();
  return login ? { status: 'valid', login } : { status: 'invalid' };
}
