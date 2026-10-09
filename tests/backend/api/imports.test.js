import { describe, expect, it, vi } from 'vitest';
import { createTestApp, TINY_JPEG, TINY_PDF } from '../../helpers/testApp.js';

const pageResponse = (html) => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });

async function appWithPage(html) {
  const fetch = vi.fn(async () => pageResponse(html));
  const app = createTestApp({ fetch });
  await app.signIn();
  return { app, fetch };
}

const JSON_LD_PAGE = `<html><head><script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Recipe',
  name: 'Shakshuka',
  recipeYield: '2 servings',
  totalTime: 'PT30M',
  cookTime: 'PT20M',
  recipeIngredient: ['4 eggs', '400 g chopped tomatoes'],
  recipeInstructions: [{ '@type': 'HowToStep', text: 'Simmer the sauce.' }, { '@type': 'HowToStep', text: 'Poach the eggs.' }],
})}</script></head><body></body></html>`;

describe('import from a website (spec 07)', () => {
  it('AC-3: uses JSON-LD without calling Claude', async () => {
    const { app } = await appWithPage(JSON_LD_PAGE);
    const { status, data } = await app.post('/api/import/url', { url: 'https://example.com/shakshuka' });
    expect(status).toBe(200);
    expect(data.method).toBe('json-ld');
    expect(data.draft).toMatchObject({
      title: 'Shakshuka',
      servings: 2,
      cookMinutes: 20,
      source: { type: 'url', url: 'https://example.com/shakshuka' },
    });
    expect(data.draft.ingredients.map((ingredient) => ingredient.name)).toEqual(['eggs', 'chopped tomatoes']);
    expect(data.draft.steps.map((step) => step.text)).toEqual(['Simmer the sauce.', 'Poach the eggs.']);
    expect(app.ai.extractFromText).not.toHaveBeenCalled();
  });

  it('AC-4: falls back to Claude with the visible page text', async () => {
    const { app } = await appWithPage('<html><body><script>x()</script><h1>Gran’s scones</h1><p>Rub butter into flour.</p></body></html>');
    const { status, data } = await app.post('/api/import/url', { url: 'https://example.com/scones' });
    expect(status).toBe(200);
    expect(data.method).toBe('ai');
    expect(data.draft.source).toEqual({ type: 'url', url: 'https://example.com/scones' });
    const [text, url] = app.ai.extractFromText.mock.lastCall;
    expect(text).toBe('Gran’s scones\nRub butter into flour.');
    expect(url).toBe('https://example.com/scones');
  });

  it('AC-4: reports no_recipe_found when Claude finds none', async () => {
    const { app } = await appWithPage('<p>About us</p>');
    app.ai.extractFromText.mockResolvedValueOnce({ found: false, recipe: { title: '', description: '', servings: null, prepMinutes: null, cookMinutes: null, tags: [], ingredients: [], steps: [] } });
    const { status, data } = await app.post('/api/import/url', { url: 'https://example.com/about' });
    expect(status).toBe(422);
    expect(data.error.code).toBe('no_recipe_found');
  });

  it('AC-1: rejects private addresses without fetching', async () => {
    const { app, fetch } = await appWithPage(JSON_LD_PAGE);
    const { status, data } = await app.post('/api/import/url', { url: 'http://192.168.1.10/recipe' });
    expect(status).toBe(400);
    expect(data.error.code).toBe('bad_url');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('AC-2: a failing site returns 502 fetch_failed', async () => {
    const app = createTestApp({ fetch: async () => new Response('down', { status: 503 }) });
    await app.signIn();
    const { status, data } = await app.post('/api/import/url', { url: 'https://example.com/x' });
    expect(status).toBe(502);
    expect(data.error.code).toBe('fetch_failed');
  });
});

describe('import from photos and PDF (spec 07)', () => {
  it('AC-5: reads 1 to 4 photos with Claude', async () => {
    const app = createTestApp();
    await app.signIn();
    const images = [{ data: TINY_JPEG, mediaType: 'image/jpeg' }];
    const { status, data } = await app.post('/api/import/photo', { images });
    expect(status).toBe(200);
    expect(data.draft).toMatchObject({ title: 'Tomato soup', source: { type: 'photo', url: '' } });
    expect(app.ai.extractFromImages).toHaveBeenCalledWith(images);

    expect((await app.post('/api/import/photo', { images: [] })).status).toBe(400);
    expect((await app.post('/api/import/photo', { images: Array(5).fill(images[0]) })).status).toBe(400);
    expect((await app.post('/api/import/photo', { images: [{ data: TINY_JPEG, mediaType: 'image/heic' }] })).status).toBe(400);
  });

  it('AC-6: reads a PDF with Claude and rejects other files', async () => {
    const app = createTestApp();
    await app.signIn();
    const { status, data } = await app.post('/api/import/pdf', { data: TINY_PDF });
    expect(status).toBe(200);
    expect(data.draft.source).toEqual({ type: 'pdf', url: '' });
    expect(app.ai.extractFromPdf).toHaveBeenCalledWith(TINY_PDF);

    const notPdf = await app.post('/api/import/pdf', { data: TINY_JPEG });
    expect(notPdf.status).toBe(400);
    expect(notPdf.data.error.code).toBe('bad_pdf');
    expect((await app.post('/api/import/pdf', {})).status).toBe(400);
  });

  it('AC-6: rejects PDFs over 4 MB', async () => {
    const app = createTestApp();
    await app.signIn();
    const big = Buffer.alloc(4_000_001);
    big.write('%PDF-');
    expect((await app.post('/api/import/pdf', { data: big.toString('base64') })).status).toBe(400);
  });
});
