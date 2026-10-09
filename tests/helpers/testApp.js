// Builds the real request handler with an in-memory store, a fixed clock and
// a fake AI module, plus helpers to sign in and call the API.

import { vi } from 'vitest';
import { createApp } from '../../backend/app.js';
import { createMemoryStore } from '../../backend/db/store.js';

export const PASSWORD = 'correct horse battery staple';
export const BASE_URL = 'https://leos-recipes.netlify.app';

export function fakeRecipeDraft(overrides = {}) {
  return {
    title: 'Tomato soup',
    description: 'Simple and warming.',
    servings: 4,
    prepMinutes: 10,
    cookMinutes: 30,
    tags: ['soup'],
    ingredients: [
      { name: 'tomatoes', quantity: 800, unit: 'g', note: '' },
      { name: 'onion', quantity: 1, unit: '', note: 'chopped' },
    ],
    steps: ['Soften the onion.', 'Add tomatoes and simmer.'],
    ...overrides,
  };
}

/** Every AI function as a vi.fn with a sensible default answer. */
export function createFakeAi() {
  return {
    formatRecipe: vi.fn(async () => ({ summary: 'Tidied.', changes: ['Split steps'], recipe: fakeRecipeDraft() })),
    improveFromReviews: vi.fn(async () => ({ summary: 'Less salt.', changes: ['Halved the salt'], recipe: fakeRecipeDraft() })),
    generateIngredients: vi.fn(async () => ({
      ingredients: [
        { name: 'lasagne sheets', quantity: 250, unit: 'g', note: '' },
        { name: 'minced beef', quantity: 500, unit: 'g', note: '' },
      ],
    })),
    extractFromText: vi.fn(async () => ({ found: true, recipe: fakeRecipeDraft() })),
    extractFromImages: vi.fn(async () => ({ found: true, recipe: fakeRecipeDraft() })),
    extractFromPdf: vi.fn(async () => ({ found: true, recipe: fakeRecipeDraft() })),
    suggestFromPantry: vi.fn(async () => ({ ideas: [{ title: 'Omelette', description: 'Quick.', uses: ['eggs'], missing: [] }] })),
    suggestForTaste: vi.fn(async () => ({ ideas: [{ title: 'Ramen', description: 'You like soups.', uses: ['noodles'], missing: [] }] })),
    draftFromIdea: vi.fn(async () => fakeRecipeDraft({ title: 'Omelette' })),
  };
}

export function createTestApp({ env = {}, fetch, random = () => 0 } = {}) {
  const clock = { time: new Date('2026-10-09T12:00:00Z') };
  const ai = createFakeAi();
  const store = createMemoryStore();
  const handle = createApp({
    store,
    env: { APP_PASSWORD: PASSWORD, ...env },
    now: () => new Date(clock.time),
    random,
    fetch,
    ai,
  });

  let cookie = '';

  async function request(method, path, body, headers = {}) {
    const init = { method, headers: { ...headers } };
    if (cookie) init.headers.cookie = cookie;
    if (body !== undefined) {
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const response = await handle(new Request(BASE_URL + path, init));
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: response.status, data, headers: response.headers };
  }

  /** Sends a request with the session cookie and returns the raw Response. */
  function raw(method, path, { body, headers = {} } = {}) {
    return handle(new Request(BASE_URL + path, { method, body, headers: { ...(cookie ? { cookie } : {}), ...headers } }));
  }

  async function signIn() {
    const response = await request('POST', '/api/login', { password: PASSWORD });
    cookie = response.headers.get('set-cookie').split(';')[0];
    return response;
  }

  /** Advances the fake clock so timestamps differ between writes. */
  function tick(ms = 1000) {
    clock.time = new Date(clock.time.getTime() + ms);
  }

  async function createRecipe(overrides = {}) {
    const { status, data } = await request('POST', '/api/recipes', { recipe: fakeRecipeDraft(overrides) });
    if (status !== 201) throw new Error(`createRecipe failed: ${JSON.stringify(data)}`);
    return data.recipe;
  }

  return {
    handle,
    store,
    ai,
    clock,
    tick,
    request,
    raw,
    signIn,
    createRecipe,
    setCookie: (value) => {
      cookie = value;
    },
    get: (path) => request('GET', path),
    post: (path, body = {}) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
    patch: (path, body) => request('PATCH', path, body),
    del: (path) => request('DELETE', path),
  };
}

/** Smallest valid JPEG header, base64. Enough for the type check. */
export const TINY_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]).toString('base64');
export const TINY_PDF = Buffer.from('%PDF-1.4\n%fake\n').toString('base64');
