import { app } from '@azure/functions';

// POST /api/ai/analyze-meal-item
// Accepts { text: string } — e.g. "100g chicken breast"
// Returns macro preview. Caller saves after explicit user confirmation.
// No generic AI chat. Backend-only OpenAI access.
// Implemented in M4

app.http('ai-analyze-meal-item', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'ai/analyze-meal-item',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented — M4' } }),
});
