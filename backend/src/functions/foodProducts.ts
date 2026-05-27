// Food Products endpoints — internal food product catalog.
//
// GET /api/food-products/search?q=   — search catalog (top 20 by relevance)
// GET /api/food-products/{id}        — product detail by id
//
// All data comes from the internal Cosmos foodProducts container.
// The live Open Food Facts API is NOT called at runtime.

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

import { requireUser } from '../lib/auth';
import { withHandler } from '../lib/http';
import { logEvent } from '../lib/log';
import { getFoodProductRepository } from '../lib/repositories/foodProductRepository';

// GET /api/food-products/search?q=
export const foodProductSearchHandler = withHandler(
  'food-products.search',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const q = request.query.get('q') ?? '';

    if (q.trim().length < 2) {
      return {
        status: 400,
        jsonBody: { error: 'Query param "q" must be at least 2 characters.' },
      };
    }

    const results = await getFoodProductRepository().search(q);

    logEvent(ctx, 'info', 'food-products.search', { userId, q, count: results.length });

    return { status: 200, jsonBody: { results } };
  },
);

// GET /api/food-products/{id}
export const foodProductGetHandler = withHandler(
  'food-products.get',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const id = request.params['id'];

    if (!id) {
      return { status: 400, jsonBody: { error: 'Missing product id.' } };
    }

    const product = await getFoodProductRepository().getById(id);

    if (!product) {
      return { status: 404, jsonBody: { error: `Food product "${id}" not found.` } };
    }

    logEvent(ctx, 'info', 'food-products.get', { userId, id });

    return { status: 200, jsonBody: product };
  },
);

// --- Route registrations ---

app.http('food-products-search', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'food-products/search',
  handler: foodProductSearchHandler,
});

app.http('food-products-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'food-products/{id}',
  handler: foodProductGetHandler,
});
