import { describe, expect, it } from 'vitest';
import {
  createSessionToken,
  passwordMatches,
  readCookie,
  SESSION_SECONDS,
  sessionCookie,
  sessionKey,
  verifySessionToken,
} from '../../backend/auth.js';

const NOW = Date.parse('2026-10-09T12:00:00Z');
const key = sessionKey({ APP_PASSWORD: 'secret' });

describe('session tokens (spec 01 AC-2, AC-4)', () => {
  it('accepts a fresh token', () => {
    expect(verifySessionToken(createSessionToken(key, NOW), key, NOW)).toBe(true);
  });

  it('rejects an expired token', () => {
    const token = createSessionToken(key, NOW);
    expect(verifySessionToken(token, key, NOW + (SESSION_SECONDS + 1) * 1000)).toBe(false);
  });

  it('rejects a tampered expiry', () => {
    const [, signature] = createSessionToken(key, NOW).split('.');
    expect(verifySessionToken(`9999999999.${signature}`, key, NOW)).toBe(false);
  });

  it('rejects a tampered signature', () => {
    const [expires] = createSessionToken(key, NOW).split('.');
    expect(verifySessionToken(`${expires}.AAAA`, key, NOW)).toBe(false);
  });

  it('rejects a token signed with another key', () => {
    const otherKey = sessionKey({ APP_PASSWORD: 'other' });
    expect(verifySessionToken(createSessionToken(otherKey, NOW), key, NOW)).toBe(false);
  });

  it('rejects garbage and missing tokens', () => {
    expect(verifySessionToken('not-a-token', key, NOW)).toBe(false);
    expect(verifySessionToken(null, key, NOW)).toBe(false);
    expect(verifySessionToken(createSessionToken(key, NOW), null, NOW)).toBe(false);
  });

  it('prefers SESSION_SECRET over APP_PASSWORD for the key', () => {
    const withSecret = sessionKey({ APP_PASSWORD: 'secret', SESSION_SECRET: 'separate' });
    expect(withSecret.equals(key)).toBe(false);
  });

  it('has no key without a password or secret', () => {
    expect(sessionKey({})).toBeNull();
  });
});

describe('passwordMatches', () => {
  it('matches only the exact password', () => {
    expect(passwordMatches('secret', 'secret')).toBe(true);
    expect(passwordMatches('Secret', 'secret')).toBe(false);
    expect(passwordMatches('', 'secret')).toBe(false);
    expect(passwordMatches(undefined, 'secret')).toBe(false);
  });
});

describe('cookies', () => {
  it('reads one cookie among several', () => {
    const request = new Request('https://x.app', { headers: { cookie: 'a=1; lr_session=abc.def; b=2' } });
    expect(readCookie(request, 'lr_session')).toBe('abc.def');
    expect(readCookie(request, 'missing')).toBeNull();
  });

  it('marks the cookie Secure on https only', () => {
    expect(sessionCookie(new Request('https://x.app'), 't')).toContain('; Secure');
    expect(sessionCookie(new Request('http://localhost:8888'), 't')).not.toContain('Secure');
  });
});
