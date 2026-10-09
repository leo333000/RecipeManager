import { describe, expect, it } from 'vitest';
import { matchRoute, parseHash } from '../../frontend/js/router.js';

const routes = [
  { pattern: '/recipes' },
  { pattern: '/recipes/:id' },
  { pattern: '/recipes/:id/edit' },
  { pattern: '/meals/:id/shopping' },
];

describe('parseHash', () => {
  it('splits path and query', () => {
    const { path, query } = parseHash('#/new?draft=1');
    expect(path).toBe('/new');
    expect(query.get('draft')).toBe('1');
  });

  it('defaults to "/" and adds a leading slash', () => {
    expect(parseHash('').path).toBe('/');
    expect(parseHash('#recipes').path).toBe('/recipes');
  });
});

describe('matchRoute', () => {
  it('matches static and parameter routes', () => {
    expect(matchRoute(routes, '/recipes')).toEqual({ route: routes[0], params: {} });
    expect(matchRoute(routes, '/recipes/abc')).toEqual({ route: routes[1], params: { id: 'abc' } });
    expect(matchRoute(routes, '/recipes/abc/edit')).toEqual({ route: routes[2], params: { id: 'abc' } });
    expect(matchRoute(routes, '/meals/m1/shopping').params).toEqual({ id: 'm1' });
  });

  it('decodes parameters and rejects malformed ones', () => {
    expect(matchRoute(routes, '/recipes/a%20b').params.id).toBe('a b');
    expect(matchRoute(routes, '/recipes/%E0%A4%A')).toBeNull();
  });

  it('returns null for unknown paths', () => {
    expect(matchRoute(routes, '/nope')).toBeNull();
    expect(matchRoute(routes, '/recipes/abc/delete')).toBeNull();
  });
});
