import { app } from '@azure/functions';

// GET /api/dashboard/today
// Returns today's macro totals vs saved targets + latest weight.
// Single call used by HomeScreen on load.
// Implemented in M3

app.http('dashboard-today', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'dashboard/today',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented — M3' } }),
});
