import { app } from '@azure/functions';

// GET    /api/diary                              — meals + day summary for ?date=YYYY-MM-DD
// POST   /api/diary/meals                        — create meal
// PUT    /api/diary/meals/:id                    — rename/retype meal
// DELETE /api/diary/meals/:id                    — delete meal + items
// POST   /api/diary/meals/:id/items              — add item (sourceType: manual|reusableItem|recipe)
// PUT    /api/diary/meals/:id/items/:itemId      — edit item quantity
// DELETE /api/diary/meals/:id/items/:itemId      — remove item
// Implemented in M4

app.http('diary-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'diary',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented — M4' } }),
});

app.http('diary-meals-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'diary/meals',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented — M4' } }),
});

app.http('diary-meals-update', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'diary/meals/{id}',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented — M4' } }),
});

app.http('diary-meals-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'diary/meals/{id}',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented — M4' } }),
});

app.http('diary-items-add', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'diary/meals/{id}/items',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented — M4' } }),
});

app.http('diary-items-update', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'diary/meals/{id}/items/{itemId}',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented — M4' } }),
});

app.http('diary-items-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'diary/meals/{id}/items/{itemId}',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented — M4' } }),
});
