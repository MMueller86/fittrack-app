import { app } from '@azure/functions';

// GET    /api/weights     — list entries (optional date range)
// POST   /api/weights     — add weight entry
// DELETE /api/weights/:id — delete entry
// Implemented in M3

app.http('weights-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'weights',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented — M3' } }),
});

app.http('weights-add', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'weights',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented — M3' } }),
});

app.http('weights-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'weights/{id}',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented — M3' } }),
});
