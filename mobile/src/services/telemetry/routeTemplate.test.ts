import { describe, expect, it } from 'vitest';
import { ROUTE_PATTERN, routeTemplate } from './routeTemplate';

const UUID = '3f2a9c1e-7b4d-4e8a-9c3b-1a2b3c4d5e6f';
const BASE = 'https://func.example.net/api';

describe('routeTemplate', () => {
  it('replaces resource IDs by {id} and keeps the method', () => {
    expect(routeTemplate('get', `/weights/${UUID}`)).toBe('GET /api/weights/{id}');
    expect(routeTemplate('DELETE', `${BASE}/weights/${UUID}`)).toBe('DELETE /api/weights/{id}');
  });

  it('replaces dates by {date}', () => {
    expect(routeTemplate('GET', '/diary/day/2026-11-16/meta')).toBe('GET /api/diary/day/{date}/meta');
  });

  it('removes the query string', () => {
    expect(routeTemplate('GET', '/food-search?query=banane')).toBe('GET /api/food-search');
    expect(routeTemplate('GET', `${BASE}/food-search?query=banane#x`)).toBe('GET /api/food-search');
  });

  it('turns barcodes and unknown segments into {id}', () => {
    expect(routeTemplate('GET', '/food-products/4006381333931')).toBe('GET /api/food-products/{id}');
    expect(routeTemplate('GET', '/recipes/mein-geheimes-rezept')).toBe('GET /api/recipes/{id}');
  });

  it('returns unknown for unparsable input', () => {
    expect(routeTemplate('GET', undefined)).toBe('unknown');
    expect(routeTemplate('GET', '')).toBe('unknown');
    expect(routeTemplate('TRACE', '/health')).toBe('unknown');
    expect(routeTemplate('GET', '/')).toBe('unknown');
  });

  it('always matches the relay route pattern', () => {
    for (const url of ['/health', '/diary/day/2026-11-16', `/recipes/${UUID}/images/${UUID}`, '/Weights/ÄÖ?x=1']) {
      const route = routeTemplate('POST', url);
      expect(route === 'unknown' || ROUTE_PATTERN.test(route)).toBe(true);
    }
  });
});
