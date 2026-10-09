import { beforeEach, describe, expect, it } from 'vitest';
import { AiError } from '../../../backend/ai/client.js';
import { createTestApp, fakeRecipeDraft } from '../../helpers/testApp.js';

let app;
let recipe;

beforeEach(async () => {
  app = createTestApp();
  await app.signIn();
  recipe = await app.createRecipe({
    hue: 'teal',
    ingredients: [
      { name: 'Tomatoes', quantity: 800, unit: 'g', note: 'ripe ones' },
      { name: 'onion', quantity: 1, unit: '', note: '' },
    ],
  });
  await app.post(`/api/recipes/${recipe.id}/notes`, { text: 'family favourite' });
});

describe('AI recipe changes (spec 03)', () => {
  it('AC-1: format returns a proposal and saves nothing', async () => {
    const { status, data } = await app.post(`/api/recipes/${recipe.id}/ai/format`, { instructions: 'use metric' });
    expect(status).toBe(200);
    expect(data).toMatchObject({ summary: 'Tidied.', changes: ['Split steps'], baseVersion: 1 });
    expect(data.proposed.title).toBe('Tomato soup');
    expect(app.ai.formatRecipe).toHaveBeenCalledWith(expect.objectContaining({ id: recipe.id }), 'use metric');
    expect((await app.get(`/api/recipes/${recipe.id}`)).data.recipe.version).toBe(1);
  });

  it('AC-3: matching ingredients keep their id and note; id, notes, hue and source are carried over', async () => {
    app.ai.formatRecipe.mockResolvedValueOnce({
      summary: 's',
      changes: [],
      recipe: fakeRecipeDraft({
        ingredients: [
          { name: 'tomato', quantity: 800, unit: 'g', note: '' },
          { name: 'garlic', quantity: 2, unit: 'clove', note: '' },
        ],
      }),
    });
    const { data } = await app.post(`/api/recipes/${recipe.id}/ai/format`, {});
    const [tomato, garlic] = data.proposed.ingredients;
    expect(tomato).toMatchObject({ id: recipe.ingredients[0].id, note: 'ripe ones' });
    expect(garlic.id).not.toBe(recipe.ingredients[1].id);
    expect(data.proposed).toMatchObject({ id: recipe.id, hue: 'teal', source: recipe.source, version: 1 });
    expect(data.proposed.notes.map((note) => note.text)).toEqual(['family favourite']);
  });

  it('AC-7: applying the proposal saves a new version with the AI reason', async () => {
    const { data } = await app.post(`/api/recipes/${recipe.id}/ai/format`, {});
    const saved = await app.put(`/api/recipes/${recipe.id}`, { recipe: data.proposed, baseVersion: data.baseVersion, reason: 'ai-format' });
    expect(saved.data.recipe).toMatchObject({ version: 2, changeReason: 'ai-format' });
  });

  it('AC-2: improve needs at least one review', async () => {
    const { status, data } = await app.post(`/api/recipes/${recipe.id}/ai/improve`);
    expect(status).toBe(400);
    expect(data.error.code).toBe('no_reviews');
    expect(app.ai.improveFromReviews).not.toHaveBeenCalled();
  });

  it('AC-2: improve passes the recipe and its reviews to Claude', async () => {
    await app.post(`/api/recipes/${recipe.id}/reviews`, { rating: 3, notes: 'too salty', improvements: 'halve the salt' });
    const { status, data } = await app.post(`/api/recipes/${recipe.id}/ai/improve`);
    expect(status).toBe(200);
    expect(data.summary).toBe('Less salt.');
    const [, reviews] = app.ai.improveFromReviews.mock.lastCall;
    expect(reviews).toEqual([expect.objectContaining({ rating: 3, improvements: 'halve the salt' })]);
  });

  it('AC-4: an invalid proposal returns 422 ai_bad_output', async () => {
    app.ai.formatRecipe.mockResolvedValueOnce({ summary: '', changes: [], recipe: fakeRecipeDraft({ title: '' }) });
    const { status, data } = await app.post(`/api/recipes/${recipe.id}/ai/format`, {});
    expect(status).toBe(422);
    expect(data.error.code).toBe('ai_bad_output');
  });

  it('rejects overly long instructions', async () => {
    const { status } = await app.post(`/api/recipes/${recipe.id}/ai/format`, { instructions: 'x'.repeat(1001) });
    expect(status).toBe(400);
  });

  it.each([
    ['ai_not_configured', 503],
    ['ai_unavailable', 502],
    ['ai_refused', 422],
    ['ai_bad_output', 422],
  ])('AC-8: %s maps to HTTP %d', async (code, httpStatus) => {
    app.ai.formatRecipe.mockRejectedValueOnce(new AiError(code, 'message for Leo'));
    const { status, data } = await app.post(`/api/recipes/${recipe.id}/ai/format`, {});
    expect(status).toBe(httpStatus);
    expect(data.error).toEqual({ code, message: 'message for Leo' });
  });

  it('AC-8: without an API key the real AI module reports ai_not_configured', async () => {
    const { createApp } = await import('../../../backend/app.js');
    const { createMemoryStore } = await import('../../../backend/db/store.js');
    const handle = createApp({ store: createMemoryStore(), env: { APP_PASSWORD: 'pw' } });
    const login = await handle(new Request('https://x.app/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"password":"pw"}' }));
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const create = await handle(new Request('https://x.app/api/recipes', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ recipe: { title: 'x' } }) }));
    const { recipe: created } = await create.json();
    const response = await handle(new Request(`https://x.app/api/recipes/${created.id}/ai/format`, { method: 'POST', headers: { cookie } }));
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe('ai_not_configured');
  });
});
