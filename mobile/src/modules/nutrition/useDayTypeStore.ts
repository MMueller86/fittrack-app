// useDayTypeStore — globaler Zustand für DayType + Targets.
// Wird von HomeScreen (Toggle schreiben) und DiaryScreen (Targets lesen) geteilt.

import { create } from 'zustand';
import type { DayType, ProfileTargets, WorkoutType } from '@fittrack/shared';
import { profileApi } from '../../shared/api/profileApi';

const TODAY = () => new Date().toISOString().split('T')[0];

interface DayTypeState {
  dayType: DayType;
  workoutType: WorkoutType | null;
  /** ISO-Datum (YYYY-MM-DD) für das dayType gilt — verhindert Cross-Day-Vergleiche */
  dayTypeDate: string | null;
  targets: ProfileTargets | null;
  initialized: boolean;
  setTargets: (t: ProfileTargets | null) => void;
  /** Schreibt dayType + Datum aus API-Response lokal — ruft KEIN Backend auf */
  hydrateDayType: (type: DayType, date: string, workoutType?: WorkoutType | null) => void;
  setDayType: (type: DayType, workoutType?: WorkoutType | null) => Promise<void>;
}

export const useDayTypeStore = create<DayTypeState>((set, get) => ({
  dayType: 'rest',
  workoutType: null,
  dayTypeDate: null,
  targets: null,
  initialized: false,

  setTargets: (t) => set({ targets: t, initialized: true }),

  hydrateDayType: (type: DayType, date: string, workoutType?: WorkoutType | null) =>
    set({ dayType: type, dayTypeDate: date, workoutType: workoutType ?? null }),

  setDayType: async (type: DayType, workoutType?: WorkoutType | null) => {
    const prev = get().dayType;
    const prevWorkout = get().workoutType;
    const resolved = type === 'rest' ? null : (workoutType ?? get().workoutType);
    set({ dayType: type, workoutType: resolved });
    try {
      await profileApi.setDayType(TODAY(), type, resolved);
    } catch {
      // Revert on error
      set({ dayType: prev, workoutType: prevWorkout });
    }
  },
}));
