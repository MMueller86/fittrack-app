import { app } from '@azure/functions';

// POST /api/auth/google    — validate Google ID token, return { accessToken, refreshToken }
// POST /api/auth/refresh   — exchange refresh token for new access token
// POST /api/auth/logout    — invalidate refresh token server-side
// Implemented in M2

app.http('auth-google', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/google',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented — M2' } }),
});

app.http('auth-refresh', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/refresh',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented — M2' } }),
});

app.http('auth-logout', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/logout',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented — M2' } }),
});
