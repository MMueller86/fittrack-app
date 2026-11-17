// useProfileData — lädt GET /api/profile für Profil-Hub und Profil-Details (Laden bei Fokus).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { UserProfile, ProfileTargets } from '@fittrack/shared';
import { profileApi } from '../../shared/api/profileApi';
import { useSnackbar } from '../../shared/components/Snackbar';
import type { ScreenMeasure } from '../../services/telemetry/screenTelemetry';
import { useScreenMeasure } from '../../services/telemetry/useScreenMeasure';

export type ProfileLoadStatus = 'loading' | 'ready' | 'error';

/** `measureScreen`: report the focus load as the `Profile` tab screen event (hub only, not the details screen). */
export function useProfileData(options: { measureScreen?: boolean } = {}) {
  const measureScreen = options.measureScreen === true;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [targets, setTargets] = useState<ProfileTargets | null>(null);
  const [status, setStatus] = useState<ProfileLoadStatus>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [measuredLoads, setMeasuredLoads] = useState(0);
  const hasLoadedRef = useRef(false);
  const { ref: snackbarRef, show: showSnackbar } = useSnackbar();
  const { begin: beginMeasure, rendered: reportRendered } = useScreenMeasure('Profile');

  const loadProfile = useCallback(async (measure?: ScreenMeasure) => {
    try {
      const res = await profileApi.getMe();
      setProfile(res.profile as UserProfile | null);
      setTargets(res.targets);
      hasLoadedRef.current = true;
      setStatus('ready');
      measure?.dataReady(res.profile ? 'data' : 'empty');
    } catch {
      // Bereits geladene Daten bleiben sichtbar; sonst Fehlerzustand mit Retry.
      if (hasLoadedRef.current) {
        showSnackbar({ message: 'Profil konnte nicht aktualisiert werden.' });
        measure?.dataReady('data');
      } else {
        setStatus('error');
        measure?.dataReady('error');
      }
    } finally {
      setRefreshing(false);
      if (measure) setMeasuredLoads((count) => count + 1);
    }
  }, [showSnackbar]);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedRef.current) setStatus('loading');
      const measure = measureScreen ? beginMeasure() : undefined;
      void loadProfile(measure);
      return () => measure?.cancel();
    }, [loadProfile, beginMeasure, measureScreen])
  );

  // The settled load has been committed: status, profile and the hub content are on screen.
  useEffect(() => {
    if (measuredLoads > 0) reportRendered();
  }, [measuredLoads, reportRendered]);

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
