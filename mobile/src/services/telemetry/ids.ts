// Random UUID v4 for session, episode and request IDs (memory only, never persisted).
// expo-crypto is loaded lazily so that modules importing this file stay loadable in Node tests.

let cryptoModule: { randomUUID?: () => string } | null | undefined;

function fallbackUuid(): string {
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 36; i += 1) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += '-';
    else if (i === 14) out += '4';
    else if (i === 19) out += hex[8 + Math.floor(Math.random() * 4)];
    else out += hex[Math.floor(Math.random() * 16)];
  }
  return out;
}

export function newUuid(): string {
  try {
    if (cryptoModule === undefined) cryptoModule = require('expo-crypto') as { randomUUID?: () => string };
    const id = cryptoModule?.randomUUID?.();
    if (typeof id === 'string' && id.length === 36) return id;
  } catch {
    cryptoModule = null;
  }
  return fallbackUuid();
}
