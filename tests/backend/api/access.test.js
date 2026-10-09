import { describe, expect, it } from 'vitest';
import { createTestApp, PASSWORD } from '../../helpers/testApp.js';

describe('access (spec 01)', () => {
  it('AC-1: protected routes return 401 without a session', async () => {
    const app = createTestApp();
    for (const path of ['/api/recipes', '/api/meals', '/api/pantry', '/api/session']) {
      const { status, data } = await app.get(path);
      expect(status).toBe(401);
      expect(data.error.code).toBe('unauthorized');
    }
  });

  it('AC-2: the right password sets a 30-day HttpOnly, Secure, SameSite=Strict cookie', async () => {
    const app = createTestApp();
    const { status, headers } = await app.signIn();
    expect(status).toBe(204);
    const cookie = headers.get('set-cookie');
    expect(cookie).toMatch(/^lr_session=\d+\.[\w-]+;/);
    expect(cookie).toContain('Max-Age=2592000');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Strict');
    expect((await app.get('/api/session')).data).toEqual({ authenticated: true });
    expect((await app.get('/api/recipes')).status).toBe(200);
  });

  it('AC-3: a wrong or missing password returns 401 without a cookie', async () => {
    const app = createTestApp();
    for (const body of [{ password: 'nope' }, {}]) {
      const { status, data, headers } = await app.post('/api/login', body);
      expect(status).toBe(401);
      expect(data.error.code).toBe('bad_password');
      expect(headers.get('set-cookie')).toBeNull();
    }
  });

  it('AC-4: a tampered or expired cookie is rejected', async () => {
    const app = createTestApp();
    await app.signIn();
    app.setCookie('lr_session=9999999999.forged');
    expect((await app.get('/api/recipes')).status).toBe(401);

    await app.signIn();
    app.tick(31 * 24 * 60 * 60 * 1000);
    expect((await app.get('/api/recipes')).status).toBe(401);
  });

  it('AC-5: login without APP_PASSWORD configured returns 503', async () => {
    const app = createTestApp({ env: { APP_PASSWORD: '' } });
    const { status, data } = await app.post('/api/login', { password: PASSWORD });
    expect(status).toBe(503);
    expect(data.error.code).toBe('not_configured');
  });

  it('AC-6: logout clears the cookie', async () => {
    const app = createTestApp();
    const { status, headers } = await app.post('/api/logout');
    expect(status).toBe(204);
    expect(headers.get('set-cookie')).toMatch(/^lr_session=;.*Max-Age=0/);
  });

  it('rejects form-encoded bodies (CSRF hardening)', async () => {
    const app = createTestApp();
    const response = await app.raw('POST', '/api/login', {
      body: 'password=x',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(response.status).toBe(415);
  });

  it('answers 400 for malformed JSON, 404 for unknown routes and 405 for wrong methods', async () => {
    const app = createTestApp();
    await app.signIn();
    const broken = await app.raw('POST', '/api/pantry', { body: '{"names":', headers: { 'content-type': 'application/json' } });
    expect(broken.status).toBe(400);
    expect((await app.get('/api/nothing-here')).status).toBe(404);
    expect((await app.request('PUT', '/api/pantry', {})).status).toBe(405);
  });

  it('adds nosniff and no-store headers to API responses', async () => {
    const app = createTestApp();
    const { headers } = await app.get('/api/recipes');
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('cache-control')).toBe('no-store');
  });
});
