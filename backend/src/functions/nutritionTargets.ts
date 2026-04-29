import { app } from '@azure/functions';

// GET  /api/nutrition/targets           — get saved targets
// POST /api/nutrition/targets/calculate — deterministic Mifflin-St Jeor, no save
// POST /api/nutrition/targets/ai-validate — AI explanation preview, no save
// POST /api/nutrition/targets           — save targets after explicit user confirmation
// Implemented in M2

app.http('nutrition-targets-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'nutrition/targets',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented — M2' } }),
});

app.http('nutrition-targets-calculate', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'nutrition/targets/calculate',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented — M2' } }),
});

app.http('nutrition-targets-ai-validate', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'nutrition/targets/ai-validate',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented — M2' } }),
});

app.http('nutrition-targets-save', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'nutrition/targets',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented — M2' } }),
});
