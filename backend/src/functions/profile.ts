import { app } from '@azure/functions';

// GET  /api/profile             — get current user profile
// PUT  /api/profile             — update profile fields
// POST /api/profile/onboarding  — save onboarding input (no calc, no AI)
// Implemented in M2

app.http('profile-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'profile',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented — M2' } }),
});

app.http('profile-update', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'profile',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented — M2' } }),
});

app.http('profile-onboarding', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'profile/onboarding',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented — M2' } }),
});
