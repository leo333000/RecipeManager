import {
  clearedSessionCookie,
  createSessionToken,
  isAuthenticated,
  passwordMatches,
  sessionCookie,
  sessionKey,
} from '../auth.js';
import { HttpError, json, noContent, readJson } from '../http.js';

export function registerAuthRoutes(router, { env, now }) {
  router.post(
    '/api/login',
    async ({ request }) => {
      if (!env.APP_PASSWORD) {
        throw new HttpError(503, 'not_configured', 'Set APP_PASSWORD in the Netlify environment variables first.');
      }
      const { password } = await readJson(request);
      if (!passwordMatches(password, env.APP_PASSWORD)) {
        throw new HttpError(401, 'bad_password', 'Wrong password');
      }
      const token = createSessionToken(sessionKey(env), now().getTime());
      return noContent({ 'Set-Cookie': sessionCookie(request, token) });
    },
    { isPublic: true },
  );

  router.post('/api/logout', ({ request }) => noContent({ 'Set-Cookie': clearedSessionCookie(request) }), {
    isPublic: true,
  });

  router.get(
    '/api/session',
    ({ request }) => {
      if (!isAuthenticated(request, env, now().getTime())) throw new HttpError(401, 'unauthorized', 'Please sign in');
      return json({ authenticated: true });
    },
    { isPublic: true },
  );
}
