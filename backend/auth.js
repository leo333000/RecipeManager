// Single-password access with an HMAC-signed session cookie.

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'lr_session';
export const SESSION_SECONDS = 30 * 24 * 60 * 60;

/** The signing key: SESSION_SECRET when set, otherwise derived from APP_PASSWORD. */
export function sessionKey(env) {
  const secret = env.SESSION_SECRET || env.APP_PASSWORD;
  if (!secret) return null;
  return createHmac('sha256', 'leos-recipes-session-v1').update(secret).digest();
}

function sign(key, value) {
  return createHmac('sha256', key).update(value).digest('base64url');
}

function safeEqual(a, b) {
  const hashA = createHash('sha256').update(String(a)).digest();
  const hashB = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(hashA, hashB);
}

export function passwordMatches(given, expected) {
  return typeof given === 'string' && given.length > 0 && safeEqual(given, expected);
}

export function createSessionToken(key, nowMs) {
  const expires = Math.floor(nowMs / 1000) + SESSION_SECONDS;
  return `${expires}.${sign(key, String(expires))}`;
}

export function verifySessionToken(token, key, nowMs) {
  if (!key || typeof token !== 'string') return false;
  const [expires, signature] = token.split('.');
  if (!/^\d+$/.test(expires ?? '') || !signature) return false;
  if (!safeEqual(signature, sign(key, expires))) return false;
  return Number(expires) > Math.floor(nowMs / 1000);
}

export function readCookie(request, name) {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

function cookieAttributes(request) {
  // Browsers drop Secure cookies on plain http, which `netlify dev` uses locally.
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `Path=/; HttpOnly; SameSite=Strict${secure}`;
}

export function sessionCookie(request, token) {
  return `${SESSION_COOKIE}=${token}; Max-Age=${SESSION_SECONDS}; ${cookieAttributes(request)}`;
}

export function clearedSessionCookie(request) {
  return `${SESSION_COOKIE}=; Max-Age=0; ${cookieAttributes(request)}`;
}

export function isAuthenticated(request, env, nowMs) {
  return verifySessionToken(readCookie(request, SESSION_COOKIE), sessionKey(env), nowMs);
}
