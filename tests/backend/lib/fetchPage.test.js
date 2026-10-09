import { describe, expect, it, vi } from 'vitest';
import { fetchPage, MAX_PAGE_BYTES } from '../../../backend/lib/fetchPage.js';

const html = (body, init = {}) => new Response(body, { status: 200, headers: { 'content-type': 'text/html' }, ...init });
const redirect = (location) => new Response(null, { status: 302, headers: { location } });

describe('fetchPage (spec 07 AC-1, AC-2)', () => {
  it('returns the page HTML and final URL', async () => {
    const fetch = vi.fn(async () => html('<h1>Soup</h1>'));
    await expect(fetchPage('https://example.com/soup', fetch)).resolves.toEqual({ html: '<h1>Soup</h1>', url: 'https://example.com/soup' });
    expect(fetch).toHaveBeenCalledWith('https://example.com/soup', expect.objectContaining({ redirect: 'manual' }));
  });

  it('rejects private addresses before fetching', async () => {
    const fetch = vi.fn();
    await expect(fetchPage('http://127.0.0.1/admin', fetch)).rejects.toMatchObject({ status: 400, code: 'bad_url' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('follows public redirects', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(redirect('/final')).mockResolvedValueOnce(html('ok'));
    await expect(fetchPage('https://example.com/start', fetch)).resolves.toEqual({ html: 'ok', url: 'https://example.com/final' });
  });

  it('refuses redirects to private addresses', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(redirect('http://169.254.169.254/latest'));
    await expect(fetchPage('https://example.com/start', fetch)).rejects.toMatchObject({ status: 502, code: 'fetch_failed' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('gives up after too many redirects', async () => {
    const fetch = vi.fn(async () => redirect('https://example.com/loop'));
    await expect(fetchPage('https://example.com/loop', fetch)).rejects.toMatchObject({ code: 'fetch_failed' });
  });

  it('maps HTTP errors and network failures to fetch_failed', async () => {
    await expect(fetchPage('https://example.com/x', async () => html('nope', { status: 404 }))).rejects.toMatchObject({ status: 502, code: 'fetch_failed' });
    await expect(fetchPage('https://example.com/x', async () => { throw new TypeError('network'); })).rejects.toMatchObject({ code: 'fetch_failed' });
  });

  it('caps the downloaded size', async () => {
    const big = 'a'.repeat(MAX_PAGE_BYTES + 5000);
    const { html: body } = await fetchPage('https://example.com/big', async () => html(big));
    expect(body.length).toBe(MAX_PAGE_BYTES);
  });
});
