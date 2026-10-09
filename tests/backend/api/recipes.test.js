import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, fakeRecipeDraft, TINY_JPEG } from '../../helpers/testApp.js';

let app;

beforeEach(async () => {
  app = createTestApp();
  await app.signIn();
});

describe('recipes (spec 02)', () => {
  it('AC-1: lists recipe summaries sorted by title', async () => {
    await app.createRecipe({ title: 'Zucchini fritters' });
    await app.createRecipe({ title: 'apple pie', tags: ['dessert'] });
    const { status, data } = await app.get('/api/recipes');
    expect(status).toBe(200);
    expect(data.recipes.map((recipe) => recipe.title)).toEqual(['apple pie', 'Zucchini fritters']);
    expect(data.recipes[0]).toMatchObject({
      tags: ['dessert'],
      hue: 'violet',
      servings: 4,
      totalMinutes: 40,
      ingredientNames: ['tomatoes', 'onion'],
      rating: null,
      reviewCount: 0,
    });
  });

  it('AC-4: creates a recipe with id, version 1 and timestamps', async () => {
    const { status, data } = await app.post('/api/recipes', { recipe: fakeRecipeDraft({ tags: 'Soup, Winter' }) });
    expect(status).toBe(201);
    expect(data.recipe).toMatchObject({
      title: 'Tomato soup',
      version: 1,
      changeReason: 'created',
      notes: [],
      tags: ['soup', 'winter'],
      createdAt: '2026-10-09T12:00:00.000Z',
      updatedAt: '2026-10-09T12:00:00.000Z',
    });
    expect(data.recipe.id).toEqual(expect.any(String));
    expect((await app.get(`/api/recipes/${data.recipe.id}`)).data.recipe).toEqual(data.recipe);
  });

  it('AC-5: invalid input returns 400 invalid_recipe naming the field', async () => {
    const { status, data } = await app.post('/api/recipes', { recipe: { title: '' } });
    expect(status).toBe(400);
    expect(data.error).toEqual({ code: 'invalid_recipe', message: 'title is required' });
  });

  it('returns 404 for an unknown recipe', async () => {
    expect((await app.get('/api/recipes/missing')).status).toBe(404);
  });

  it('AC-6: an edit snapshots the old version and keeps notes, id, createdAt and source', async () => {
    const recipe = await app.createRecipe();
    await app.post(`/api/recipes/${recipe.id}/notes`, { text: 'Great with bread' });
    app.tick();

    const { status, data } = await app.put(`/api/recipes/${recipe.id}`, {
      recipe: { ...recipe, title: 'Roast tomato soup', source: { type: 'url', url: 'https://evil.example' } },
      baseVersion: 1,
    });
    expect(status).toBe(200);
    expect(data.recipe).toMatchObject({
      id: recipe.id,
      title: 'Roast tomato soup',
      version: 2,
      changeReason: 'edit',
      createdAt: recipe.createdAt,
      updatedAt: '2026-10-09T12:00:01.000Z',
      source: { type: 'manual', url: '' },
    });
    expect(data.recipe.notes.map((note) => note.text)).toEqual(['Great with bread']);

    const versions = await app.get(`/api/recipes/${recipe.id}/versions`);
    expect(versions.data).toEqual({ current: 2, versions: [{ version: 1, savedAt: recipe.updatedAt, reason: 'created' }] });
  });

  it('AC-6: an unknown reason is stored as edit; known reasons are kept', async () => {
    const recipe = await app.createRecipe();
    const first = await app.put(`/api/recipes/${recipe.id}`, { recipe, baseVersion: 1, reason: 'hacked' });
    expect(first.data.recipe.changeReason).toBe('edit');
    const second = await app.put(`/api/recipes/${recipe.id}`, { recipe, baseVersion: 2, reason: 'ai-format' });
    expect(second.data.recipe.changeReason).toBe('ai-format');
  });

  it('AC-7: a stale baseVersion returns 409 and changes nothing', async () => {
    const recipe = await app.createRecipe();
    await app.put(`/api/recipes/${recipe.id}`, { recipe, baseVersion: 1 });
    const { status, data } = await app.put(`/api/recipes/${recipe.id}`, { recipe: { ...recipe, title: 'Late' }, baseVersion: 1 });
    expect(status).toBe(409);
    expect(data.error.code).toBe('version_conflict');
    expect((await app.get(`/api/recipes/${recipe.id}`)).data.recipe.title).toBe('Tomato soup');
  });

  it('AC-7: a missing baseVersion returns 400', async () => {
    const recipe = await app.createRecipe();
    expect((await app.put(`/api/recipes/${recipe.id}`, { recipe })).data.error.code).toBe('base_version_required');
  });

  it('AC-10: delete removes the recipe, versions, reviews, images and index entry', async () => {
    const recipe = await app.createRecipe();
    await app.put(`/api/recipes/${recipe.id}`, { recipe, baseVersion: 1 });
    const image = await app.post('/api/images', { data: TINY_JPEG, mediaType: 'image/jpeg' });
    await app.post(`/api/recipes/${recipe.id}/reviews`, { rating: 4, images: [{ id: image.data.id, caption: '' }] });

    expect((await app.del(`/api/recipes/${recipe.id}`)).status).toBe(204);
    expect((await app.get(`/api/recipes/${recipe.id}`)).status).toBe(404);
    expect((await app.get('/api/recipes')).data.recipes).toEqual([]);
    expect((await app.get(`/api/images/${image.data.id}`)).status).toBe(404);
    expect(await app.store.listKeys(`versions/${recipe.id}/`)).toEqual([]);
    expect(await app.store.listKeys(`reviews/${recipe.id}`)).toEqual([]);
  });

  describe('notes', () => {
    it('AC-11: adds notes newest first without a new version', async () => {
      const recipe = await app.createRecipe();
      await app.post(`/api/recipes/${recipe.id}/notes`, { text: 'first' });
      app.tick();
      const { status, data } = await app.post(`/api/recipes/${recipe.id}/notes`, { text: '  second  ' });
      expect(status).toBe(201);
      expect(data.recipe.notes.map((note) => note.text)).toEqual(['second', 'first']);
      expect(data.recipe.version).toBe(1);
    });

    it('AC-11: rejects an empty note', async () => {
      const recipe = await app.createRecipe();
      expect((await app.post(`/api/recipes/${recipe.id}/notes`, { text: '  ' })).status).toBe(400);
    });

    it('AC-12: deletes a note', async () => {
      const recipe = await app.createRecipe();
      const added = await app.post(`/api/recipes/${recipe.id}/notes`, { text: 'bye' });
      const noteId = added.data.recipe.notes[0].id;
      const { data } = await app.del(`/api/recipes/${recipe.id}/notes/${noteId}`);
      expect(data.recipe.notes).toEqual([]);
      expect((await app.del(`/api/recipes/${recipe.id}/notes/${noteId}`)).status).toBe(404);
    });

    it('AC-13: sets and clears an ingredient note without a new version', async () => {
      const recipe = await app.createRecipe();
      const ingredientId = recipe.ingredients[0].id;
      const set = await app.patch(`/api/recipes/${recipe.id}/ingredients/${ingredientId}`, { note: 'San Marzano if possible' });
      expect(set.data.recipe.ingredients[0].note).toBe('San Marzano if possible');
      expect(set.data.recipe.version).toBe(1);
      const cleared = await app.patch(`/api/recipes/${recipe.id}/ingredients/${ingredientId}`, { note: '' });
      expect(cleared.data.recipe.ingredients[0].note).toBe('');
    });

    it('AC-13: an unknown ingredient returns 404', async () => {
      const recipe = await app.createRecipe();
      expect((await app.patch(`/api/recipes/${recipe.id}/ingredients/nope`, { note: 'x' })).status).toBe(404);
    });
  });

  describe('history', () => {
    it('AC-15 to AC-17: lists, reads and restores versions, keeping current notes', async () => {
      const recipe = await app.createRecipe();
      app.tick();
      const v2 = (await app.put(`/api/recipes/${recipe.id}`, { recipe: { ...recipe, title: 'Version two' }, baseVersion: 1 })).data.recipe;
      app.tick();
      await app.put(`/api/recipes/${recipe.id}`, { recipe: { ...v2, title: 'Version three' }, baseVersion: 2 });
      await app.post(`/api/recipes/${recipe.id}/notes`, { text: 'keep me' });

      const list = await app.get(`/api/recipes/${recipe.id}/versions`);
      expect(list.data.current).toBe(3);
      expect(list.data.versions.map((version) => [version.version, version.reason])).toEqual([[2, 'edit'], [1, 'created']]);

      const v1 = await app.get(`/api/recipes/${recipe.id}/versions/1`);
      expect(v1.data.version).toMatchObject({ version: 1, reason: 'created', recipe: { title: 'Tomato soup' } });
      expect((await app.get(`/api/recipes/${recipe.id}/versions/9`)).status).toBe(404);
      expect((await app.get(`/api/recipes/${recipe.id}/versions/abc`)).status).toBe(400);

      const restored = await app.post(`/api/recipes/${recipe.id}/versions/1/restore`, { baseVersion: 3 });
      expect(restored.data.recipe).toMatchObject({ title: 'Tomato soup', version: 4, changeReason: 'restore' });
      expect(restored.data.recipe.notes.map((note) => note.text)).toEqual(['keep me']);
      expect((await app.get(`/api/recipes/${recipe.id}/versions`)).data.versions).toHaveLength(3);
    });

    it('AC-17: restore with a stale baseVersion returns 409', async () => {
      const recipe = await app.createRecipe();
      await app.put(`/api/recipes/${recipe.id}`, { recipe, baseVersion: 1 });
      expect((await app.post(`/api/recipes/${recipe.id}/versions/1/restore`, { baseVersion: 1 })).status).toBe(409);
    });
  });
});
