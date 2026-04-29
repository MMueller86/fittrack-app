import { app } from '@azure/functions';

// GET  /api/reusable-items   — search library ?q= (used by AddItemSheet picker only)
// POST /api/reusable-items   — create item (auto-create on AI confirm; no management UI)
// Implemented in M4

app.http('reusable-items-search', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'reusable-items',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented — M4' } }),
});

app.http('reusable-items-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'reusable-items',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented — M4' } }),
});
