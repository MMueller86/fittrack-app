// Persistent sync diagnostics log — survives Metro disconnection in Preview builds.
// Writes to AsyncStorage so log entries are visible in HealthConnectScreen without adb.

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'hc:sync:log';
const MAX_ENTRIES = 150;

export interface SyncLogEntry {
  ts: string;       // ISO timestamp
  level: 'info' | 'warn' | 'error';
  tag: string;
  message: string;
  detail?: string;
}

// In-memory buffer so rapid log calls don't thrash AsyncStorage.
let memoryBuffer: SyncLogEntry[] = [];
let flushScheduled = false;

function scheduleFlush(): void {
  if (flushScheduled) return;
  flushScheduled = true;
  setTimeout(() => {
    flushScheduled = false;
    void flushToStorage();
  }, 500);
}

async function flushToStorage(): Promise<void> {
  if (memoryBuffer.length === 0) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const existing: SyncLogEntry[] = raw ? (JSON.parse(raw) as SyncLogEntry[]) : [];
    const merged = [...existing, ...memoryBuffer].slice(-MAX_ENTRIES);
    memoryBuffer = [];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    memoryBuffer = [];
  }
}

function write(level: SyncLogEntry['level'], tag: string, message: string, detail?: string): void {
  const entry: SyncLogEntry = { ts: new Date().toISOString(), level, tag, message, detail };
  memoryBuffer.push(entry);
  // Mirror to native logcat — visible via `adb logcat -s ReactNativeJS` even in Preview builds.
  const line = detail ? `[${tag}] ${message} | ${detail}` : `[${tag}] ${message}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
  scheduleFlush();
}

export const syncLogger = {
  info: (tag: string, message: string, detail?: string) => write('info', tag, message, detail),
  warn: (tag: string, message: string, detail?: string) => write('warn', tag, message, detail),
  error: (tag: string, message: string, detail?: string) => write('error', tag, message, detail),

  async readAll(): Promise<SyncLogEntry[]> {
    await flushToStorage();
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as SyncLogEntry[]) : [];
    } catch {
      return [];
    }
  },

  async clear(): Promise<void> {
    memoryBuffer = [];
    await AsyncStorage.removeItem(STORAGE_KEY);
  },
};
