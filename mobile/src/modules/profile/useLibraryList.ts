// Gemeinsame Lade-Logik der Bibliotheks-Listen: Laden, Fehler und Daten bleiben unterscheidbar.
// Ein Fehler beim Erstladen führt in den Fehlerzustand (nie in eine leere Liste); schlägt ein späteres
// Aktualisieren fehl, bleiben die vorhandenen Daten sichtbar und der Aufrufer meldet es per Snackbar.

import { useCallback, useRef, useState } from 'react';

export type LibraryLoadStatus = 'loading' | 'ready' | 'error';

export function useLibraryList<T>(fetcher: () => Promise<T[]>, onRefreshError: () => void) {
  const [items, setItems] = useState<T[]>([]);
  const [status, setStatus] = useState<LibraryLoadStatus>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);
  const fetcherRef = useRef(fetcher);
  const onRefreshErrorRef = useRef(onRefreshError);
  fetcherRef.current = fetcher;
  onRefreshErrorRef.current = onRefreshError;

  const load = useCallback(async () => {
    try {
      const data = await fetcherRef.current();
      setItems(data);
      hasLoadedRef.current = true;
      setStatus('ready');
    } catch {
      if (hasLoadedRef.current) onRefreshErrorRef.current();
      else setStatus('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  const retry = useCallback(() => {
    setStatus('loading');
    void load();
  }, [load]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  return { items, setItems, status, refreshing, load, retry, refresh };
}
