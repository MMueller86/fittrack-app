import { app } from '@azure/functions';

// GET    /api/recipes             — list user recipes
// GET    /api/recipes/:id         — recipe detail
// POST   /api/recipes             — create recipe
// PUT    /api/recipes/:id         — update recipe
// DELETE /api/recipes/:id         — delete recipe
// POST   /api/recipes/:id/image   — upload image (backend stores to Blob)
// POST   /api/recipes/:id/ai-analyze — AI nutrition estimate + tags (preview only)
// Implemented in M5

app.http('recipes-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'recipes',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented — M5' } }),
});

app.http('recipes-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'recipes/{id}',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented — M5' } }),
});

app.http('recipes-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'recipes',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented — M5' } }),
});

app.http('recipes-update', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'recipes/{id}',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented — M5' } }),
});

app.http('recipes-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'recipes/{id}',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented — M5' } }),
});

app.http('recipes-upload-image', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'recipes/{id}/image',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented — M5' } }),
});

app.http('recipes-ai-analyze', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'recipes/{id}/ai-analyze',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented — M5' } }),
});
