// Zustand auth state store — drives the authenticated app shell.
// Checks SecureStore on mount, listens for forced logout from API client.

import { create } from 'zustand';
import { authService } from '../../services/authService';
import { authEvents } from '../../shared/api/client';

interface AuthState {
  /** null = still loading, true = authenticated, false = unauthenticated */
  isAuthenticated: boolean | null;
  /** Called once on app start to check stored tokens. */
  initialize: () => Promise<void>;
  /** Called after successful login. */
  login: () => void;
  /** Called to clear tokens and return to login screen. */
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: null,

  initialize: async () => {
    const token = await authService.getAccessToken();
    if (!token) {
      set({ isAuthenticated: false });
      return;
    }
    // If token is expired, try silent refresh
    if (authService.isTokenExpired(token)) {
      const refreshed = await authService.refreshAccessToken();
      set({ isAuthenticated: refreshed !== null });
    } else {
      set({ isAuthenticated: true });
    }
  },

  login: () => set({ isAuthenticated: true }),

  logout: async () => {
    await authService.clearTokens();
    set({ isAuthenticated: false });
  },
}));

// Listen for forced logout from the API client (e.g. 401 after failed refresh)
authEvents.on('logout', () => {
  useAuthStore.getState().logout();
});
