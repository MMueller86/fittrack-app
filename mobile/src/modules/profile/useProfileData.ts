// useProfileData — lädt GET /api/profile für Profil-Hub und Profil-Details (Laden bei Fokus).

import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { UserProfile, ProfileTargets } from '@fittrack/shared';
import { profileApi } from '../../shared/api/profileApi';
import { useSnackbar } from '../../shared/components/Snackbar';

export type ProfileLoadStatus = 'loading' | 'ready' | 'error';

export function useProfileData() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [targets, setTargets] = useState<ProfileTargets | null>(null);
  const [status, setStatus] = useState<ProfileLoadStatus>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);
  const { ref: snackbarRef, show: showSnackbar } = useSnackbar();

  const loadProfile = useCallback(async () => {
    try {
      const res = await profileApi.getMe();
      setProfile(res.profile as UserProfile | null);
      setTargets(res.targets);
      hasLoadedRef.current = true;
      setStatus('ready');
    } catch {
      // Bereits geladene Daten bleiben sichtbar; sonst Fehlerzustand mit Retry.
      if (hasLoadedRef.current) {
        showSnackbar({ message: 'Profil konnte nicht aktualisiert werden.' });
      } else {
        setStatus('error');
      }
    } finally {
      setRefreshing(false);
    }
  }, [showSnackbar]);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedRef.current) setStatus('loading');
      void loadProfile();
    }, [loadProfile])
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    void loadProfile();
  }, [loadProfile]);

  const retry = useCallback(() => {
    setStatus('loading');
    void loadProfile();
  }, [loadProfile]);

  return { status, profile, targets, refreshing, refresh, retry, snackbarRef };
}
