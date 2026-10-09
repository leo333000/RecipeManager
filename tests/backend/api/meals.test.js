import { beforeEach, describe, expect, it } from 'vitest';
import { AiError } from '../../../backend/ai/client.js';
import { createTestApp } from '../../helpers/testApp.js';

let app;

beforeEach(async () => {
  app = createTestApp();
  await app.signIn();
});

describe('meal selections (spec 05)', () => {
  it('AC-1: creates a selection with a default name and lists newest first', async () => {
    const soup = await app.createRecipe();
    const first = await app.post('/api/meals', { recipeIds: [soup.id, soup.id] });
    expect(first.status).toBe(201);
    expect(first.data.selection).toMatchObject({ name: 'Meals 2026-10-09', items: [{ type: 'recipe', recipeId: soup.id, title: 'Tomato soup' }] });

    app.tick();
    await app.post('/api/meals', { name: 'Weekend' });
    const { data } = await app.get('/api/meals');
    expect(data.selections.map((selection) => [selection.name, selection.itemCount])).toEqual([['Weekend', 0], ['Meals 2026-10-09', 1]]);
  });

  it('AC-1: unknown recipe ids return 400', async () => {
    const { status, data } = await app.post('/api/meals', { recipeIds: ['missing'] });
    expect(status).toBe(400);
    expect(data.error.code).toBe('unknown_recipe');
  });

  it('AC-2: adds, refuses duplicates, removes items, renames and deletes', async () => {
    const soup = await app.createRecipe();
    const { data } = await app.post('/api/meals', { name: 'Week' });
    const id = data.selection.id;

    const added = await app.post(`/api/meals/${id}/items`, { recipeId: soup.id });
    expect(added.status).toBe(201);
    expect((await app.post(`/api/meals/${id}/items`, { recipeId: soup.id })).status).toBe(409);

    const itemId = added.data.selection.items[0].id;
    expect((await app.del(`/api/meals/${id}/items/${itemId}`)).data.selection.items).toEqual([]);
    expect((await app.patch(`/api/meals/${id}`, { name: '  Next week ' })).data.selection.name).toBe('Next week');
    expect((await app.del(`/api/meals/${id}`)).status).toBe(204);
    expect((await app.get(`/api/meals/${id}`)).status).toBe(404);
  });

  it('AC-3: random selection picks distinct recipes, filtered by tag', async () => {
    await app.createRecipe({ title: 'A', tags: ['quick'] });
    await app.createRecipe({ title: 'B', tags: ['quick'] });
    await app.createRecipe({ title: 'C', tags: ['slow'] });

    const quick = await app.post('/api/meals/random', { count: 5, tag: 'Quick' });
    expect(quick.status).toBe(201);
    expect(quick.data.selection.items.map((item) => item.title).sort()).toEqual(['A', 'B']);
    expect(quick.data.selection.name).toBe('Random 2026-10-09');

    const one = await app.post('/api/meals/random', { count: 1 });
    expect(one.data.selection.items).toHaveLength(1);
  });

  it('AC-3: random selection validates count and needs matching recipes', async () => {
    expect((await app.post('/api/meals/random', { count: 0 })).status).toBe(400);
    expect((await app.post('/api/meals/random', { count: 15 })).status).toBe(400);
    const none = await app.post('/api/meals/random', { count: 3 });
    expect(none.status).toBe(400);
    expect(none.data.error.code).toBe('no_recipes');
  });

  it('AC-4: adds an outside dish with ingredients from Claude', async () => {
    const { data } = await app.post('/api/meals', {});
    const { status, data: result } = await app.post(`/api/meals/${data.selection.id}/external`, { title: "Grandma's lasagne", servings: 6 });
    expect(status).toBe(201);
    expect(app.ai.generateIngredients).toHaveBeenCalledWith("Grandma's lasagne", 6);
    const [item] = result.selection.items;
    expect(item).toMatchObject({ type: 'external', title: "Grandma's lasagne", servings: 6 });
    expect(item.ingredients.map((ingredient) => ingredient.name)).toEqual(['lasagne sheets', 'minced beef']);
  });

  it('AC-4: rejects a blank dish name and passes AI failures through', async () => {
    const { data } = await app.post('/api/meals', {});
    expect((await app.post(`/api/meals/${data.selection.id}/external`, { title: ' ' })).status).toBe(400);
    app.ai.generateIngredients.mockRejectedValueOnce(new AiError('ai_unavailable', 'busy'));
    expect((await app.post(`/api/meals/${data.selection.id}/external`, { title: 'Curry' })).status).toBe(502);
    app.ai.generateIngredients.mockResolvedValueOnce({ ingredients: [] });
    expect((await app.post(`/api/meals/${data.selection.id}/external`, { title: 'Curry' })).status).toBe(422);
  });
});

describe('pantry (spec 05 AC-5)', () => {
  it('adds items, ignoring blanks and normalized duplicates, sorted by name', async () => {
    await app.post('/api/pantry', { names: ['Tomatoes', 'eggs'] });
    const { data } = await app.post('/api/pantry', { names: ['tomato', ' ', 'Butter', 'EGGS'] });
    expect(data.items.map((item) => item.name)).toEqual(['Butter', 'eggs', 'Tomatoes']);
  });

  it('removes one item or clears everything', async () => {
    const { data } = await app.post('/api/pantry', { names: ['a1', 'b2'] });
    const removed = await app.del(`/api/pantry/${data.items[0].id}`);
    expect(removed.data.items.map((item) => item.name)).toEqual(['b2']);
    expect((await app.del('/api/pantry/nope')).status).toBe(404);
    expect((await app.del('/api/pantry')).data.items).toEqual([]);
    expect((await app.get('/api/pantry')).data.items).toEqual([]);
  });

  it('rejects a body without a names list', async () => {
    expect((await app.post('/api/pantry', { names: 'eggs' })).status).toBe(400);
  });
});

describe('shopping list (spec 05 AC-6 to AC-9)', () => {
  it('combines recipes and outside dishes, minus the pantry, and reports deleted recipes', async () => {
    const soup = await app.createRecipe({
      title: 'Soup',
      ingredients: [
        { name: 'onions', quantity: 2, unit: '', note: '' },
        { name: 'olive oil', quantity: 2, unit: 'tbsp', note: '' },
        { name: 'water', quantity: 1, unit: 'l', note: '' },
      ],
    });
    const stew = await app.createRecipe({
      title: 'Stew',
      ingredients: [
        { name: 'Onion', quantity: 1, unit: '', note: '' },
        { name: 'beef', quantity: 1, unit: 'kg', note: '' },
      ],
    });
    const gone = await app.createRecipe({ title: 'Gone' });
    const { data } = await app.post('/api/meals', { recipeIds: [soup.id, stew.id, gone.id] });
    await app.post(`/api/meals/${data.selection.id}/external`, { title: 'Lasagne', servings: 4 });
    await app.del(`/api/recipes/${gone.id}`);
    await app.post('/api/pantry', { names: ['olive oil'] });

    const list = await app.get(`/api/meals/${data.selection.id}/shopping-list`);
    expect(list.status).toBe(200);
    expect(list.data.missingRecipes).toEqual(['Gone']);
    expect(list.data.toBuy).toEqual([
      { name: 'beef', quantity: 1, unit: 'kg', sources: ['Stew'] },
      { name: 'lasagne sheets', quantity: 250, unit: 'g', sources: ['Lasagne'] },
      { name: 'minced beef', quantity: 500, unit: 'g', sources: ['Lasagne'] },
      { name: 'onions', quantity: 3, unit: '', sources: ['Soup', 'Stew'] },
    ]);
    expect(list.data.alreadyHave.map((line) => line.name)).toEqual(['olive oil', 'water']);
  });
});
