import { app } from '@azure/functions';

// POST /api/ai/meal-analyze
// Accepts { text: string } — e.g. "2 slices whole grain toast with butter"
// Returns a stub response. Real AI analysis planned for a future milestone.
// The endpoint exists now so the mobile UI can call it without 404.

app.http('ai-analyze-meal-item', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'ai/meal-analyze',
  handler: async () => ({
    status: 200,
    jsonBody: { message: 'Not supported yet' },
  }),
});
