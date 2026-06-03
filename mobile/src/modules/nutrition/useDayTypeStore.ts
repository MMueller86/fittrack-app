// useDayTypeStore — globaler Zustand für DayType + Targets.
// Wird von HomeScreen (Toggle schreiben) und DiaryScreen (Targets lesen) geteilt.

import { create } from 'zustand';
import type { DayType, ProfileTargets } from '@fittrack/shared';
import { profileApi } from '../../shared/api/profileApi';

const TODAY = () => new Date().toISOString().split('T')[0];

interface DayTypeState {
  dayType: DayType;
  targets: ProfileTargets | null;
  initialized: boolean;
  setTargets: (t: ProfileTargets | null) => void;
  setDayType: (type: DayType) => Promise<void>;
}

export const useDayTypeStore = create<DayTypeState>((set, get) => ({
  dayType: 'rest',
  targets: null,
  initialized: false,

  setTargets: (t) => set({ targets: t, initialized: true }),

  setDayType: async (type: DayType) => {
    const prev = get().dayType;
    set({ dayType: type });
    try {
      await profileApi.setDayType(TODAY(), type);
    } catch {
      // Revert on error
      set({ dayType: prev });
    }
  },
}));
