// Zustand auth state store — drives the authenticated app shell.
// Checks SecureStore on mount, listens for forced logout from API client.

import { create } from 'zustand';
import { authService } from '../../services/authService';
import { apiClient, authEvents } from '../../shared/api/client';

interface AuthState {
  /** null = still loading, true = authenticated, false = unauthenticated */
  isAuthenticated: boolean | null;
  accountDeletionCleanupNotice: boolean;
  /** Called once on app start to check stored tokens. */
  initialize: () => Promise<void>;
  /** Called after successful login. */
  login: () => void;
  /** Called to clear tokens and return to login screen. */
  logout: () => Promise<void>;
  showAccountDeletionCleanupNotice: () => void;
  dismissAccountDeletionCleanupNotice: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: null,
  accountDeletionCleanupNotice: false,

  initialize: async () => {
    const token = await authService.getAccessToken();
    if (!token) {
      set({ isAuthenticated: false });
      return;
    }
    // If token is expired, try silent refresh
    if (authService.isTokenExpired(token)) {
      const refreshed = await authService.refreshAccessToken();
      if (refreshed !== null) {
        // Fire-and-forget warmup — Azure Functions cold start mitigation
        apiClient.get('/health').catch(() => { /* ignorieren */ });
      }
      set({ isAuthenticated: refreshed !== null });
    } else {
      // Fire-and-forget warmup — Azure Functions cold start mitigation
      apiClient.get('/health').catch(() => { /* ignorieren */ });
      set({ isAuthenticated: true });
    }
  },

  login: () => {
    // Fire-and-forget warmup — Azure Functions cold start mitigation
    apiClient.get('/health').catch(() => { /* ignorieren */ });
    set({ isAuthenticated: true });
  },

  logout: async () => {
    try {
      await authService.clearTokens();
    } finally {
      set({ isAuthenticated: false });
    }
  },

  showAccountDeletionCleanupNotice: () => set({ accountDeletionCleanupNotice: true }),
  dismissAccountDeletionCleanupNotice: () => set({ accountDeletionCleanupNotice: false }),
}));

// Listen for forced logout from the API client (e.g. 401 after failed refresh)
authEvents.on('logout', () => {
  useAuthStore.getState().logout();
});
