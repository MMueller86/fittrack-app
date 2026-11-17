// Pure URL -> route template. Only allowlisted literal path segments survive; everything else
// becomes {id} or {date}, so no concrete resource ID, query string or free text can leave the device.

// Literal segments of docs/kb/tech/09-api-reference.md (plus `day-type`, used by profileApi.setDayType).
const ALLOWED_SEGMENTS: ReadonlySet<string> = new Set([
  'api', 'health', 'profile', 'me', 'calculate-preview',
  'weights', 'changes',
  'diary', 'meals', 'items', 'bulk-delete', 'bulk-move', 'bulk-copy', 'day', 'meta', 'special-activity', 'day-type',
  'reusable-items', 'enrich',
  'recipes', 'visibility', 'images', 'hero-crop', 'order', 'log', 'export-view', 'prepare',
  'instagram-render', 'share-bundle',
  'community-recipes', 'copy',
  'food-search', 'food-products', 'search',
  'favorites', 'food-relations', 'recent', 'frequent',
  'ai', 'meal-parser', 'preview', 'meal-estimate', 'food-estimate', 'batch', 'label-scan',
  'recipe-analyze', 'recipe-scale', 'daily-insight', 'feedback', 'status', 'weekly-insight',
  'telemetry', 'client',
]);

const METHODS: ReadonlySet<string> = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const DATE_SEGMENT = /^\d{4}-\d{2}-\d{2}$/;
const ORIGIN = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i;

export const ROUTE_PATTERN = /^(GET|POST|PUT|PATCH|DELETE) \/api(\/([a-z0-9-]+|\{id\}|\{date\}))+$/;
export const UNKNOWN_ROUTE = 'unknown';

export function routeTemplate(method: string | undefined, url: string | undefined): string {
  try {
    const verb = (method ?? 'GET').toUpperCase();
    if (!METHODS.has(verb) || typeof url !== 'string' || url.length === 0) return UNKNOWN_ROUTE;

    const path = url.replace(ORIGIN, '').split(/[?#]/)[0] ?? '';
    const segments = path.split('/').filter((s) => s.length > 0);
    if (segments[0] === 'api') segments.shift();
    if (segments.length === 0) return UNKNOWN_ROUTE;

    const templated = segments.map((segment) => {
      if (ALLOWED_SEGMENTS.has(segment)) return segment;
      return DATE_SEGMENT.test(segment) ? '{date}' : '{id}';
    });
    const route = `${verb} /api/${templated.join('/')}`;
    return route.length <= 120 && ROUTE_PATTERN.test(route) ? route : UNKNOWN_ROUTE;
  } catch {
    return UNKNOWN_ROUTE;
  }
}
