import { describe, expect, it } from 'vitest';
import { createRouter } from '../../backend/router.js';

describe('createRouter', () => {
  const router = createRouter();
  const list = () => 'list';
  const one = () => 'one';
  const random = () => 'random';
  router.get('/api/meals', list);
  router.post('/api/meals/random', random);
  router.get('/api/meals/:id', one);
  router.post('/api/login', list, { isPublic: true });

  it('matches static paths', () => {
    expect(router.match('GET', '/api/meals').handler).toBe(list);
  });

  it('extracts and decodes parameters', () => {
    expect(router.match('GET', '/api/meals/a%20b')).toMatchObject({ handler: one, params: { id: 'a b' } });
  });

  it('prefers the route registered first', () => {
    expect(router.match('POST', '/api/meals/random').handler).toBe(random);
  });

  it('accepts a trailing slash', () => {
    expect(router.match('GET', '/api/meals/').handler).toBe(list);
  });

  it('reports a wrong method separately from an unknown path', () => {
    expect(router.match('DELETE', '/api/meals')).toEqual({ methodNotAllowed: true });
    expect(router.match('GET', '/api/nothing')).toBeNull();
  });

  it('does not let parameters span segments', () => {
    expect(router.match('GET', '/api/meals/a/b')).toBeNull();
  });

  it('carries the public flag', () => {
    expect(router.match('POST', '/api/login').isPublic).toBe(true);
    expect(router.match('GET', '/api/meals').isPublic).toBe(false);
  });
});
