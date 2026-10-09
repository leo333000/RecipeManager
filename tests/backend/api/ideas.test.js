import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, fakeRecipeDraft } from '../../helpers/testApp.js';

let app;

beforeEach(async () => {
  app = createTestApp();
  await app.signIn();
});

describe('ideas (spec 06)', () => {
  it('AC-1: ranks own recipes by pantry coverage', async () => {
    await app.createRecipe({ title: 'Omelette', ingredients: [{ name: 'eggs', quantity: 3 }, { name: 'cheese', quantity: 50, unit: 'g' }] });
    await app.createRecipe({ title: 'Steak', ingredients: [{ name: 'beef', quantity: 1 }] });
    await app.post('/api/pantry', { names: ['eggs'] });

    const { data } = await app.get('/api/ideas/pantry-matches');
    expect(data.matches).toEqual([
      expect.objectContaining({ title: 'Omelette', coverage: 0.5, have: ['eggs'], missing: ['cheese'] }),
    ]);
  });

  it('AC-2: pantry ideas need a pantry and are capped at 6', async () => {
    expect((await app.post('/api/ideas', { mode: 'pantry' })).data.error.code).toBe('empty_pantry');

    await app.post('/api/pantry', { names: ['rice', 'eggs'] });
    await app.createRecipe({ title: 'Fried rice' });
    app.ai.suggestFromPantry.mockResolvedValueOnce({
      ideas: Array.from({ length: 8 }, (_, index) => ({ title: `Idea ${index}`, description: '', uses: [], missing: [] })),
    });
    const { status, data } = await app.post('/api/ideas', { mode: 'pantry' });
    expect(status).toBe(200);
    expect(data.ideas).toHaveLength(6);
    expect(app.ai.suggestFromPantry).toHaveBeenCalledWith({ pantry: ['eggs', 'rice'], existingTitles: ['Fried rice'] });
  });

  it('AC-3: taste ideas need recipes and include notes from well-rated meals', async () => {
    expect((await app.post('/api/ideas', { mode: 'taste' })).data.error.code).toBe('no_recipes');

    const loved = await app.createRecipe({ title: 'Ramen' });
    const meh = await app.createRecipe({ title: 'Porridge' });
    await app.post(`/api/recipes/${loved.id}/reviews`, { rating: 5, notes: 'rich broth' });
    await app.post(`/api/recipes/${meh.id}/reviews`, { rating: 2, notes: 'boring' });

    const { data } = await app.post('/api/ideas', { mode: 'taste' });
    expect(data.ideas[0].title).toBe('Ramen');
    const [input] = app.ai.suggestForTaste.mock.lastCall;
    expect(input.recipes.map((recipe) => recipe.title)).toEqual(['Porridge', 'Ramen']);
    expect(input.reviewNotes).toEqual(['Ramen: rich broth']);
  });

  it('rejects an unknown mode', async () => {
    expect((await app.post('/api/ideas', { mode: 'magic' })).status).toBe(400);
  });

  it('AC-5: turns an idea into a validated draft marked as AI-made, without saving it', async () => {
    await app.post('/api/pantry', { names: ['eggs'] });
    const { status, data } = await app.post('/api/ideas/recipe', { title: 'Omelette', description: 'Quick' });
    expect(status).toBe(200);
    expect(data.draft).toMatchObject({ title: 'Omelette', source: { type: 'ai', url: '' } });
    expect(data.draft.ingredients[0].id).toEqual(expect.any(String));
    expect(app.ai.draftFromIdea).toHaveBeenCalledWith({ title: 'Omelette', description: 'Quick', pantry: ['eggs'] });
    expect((await app.get('/api/recipes')).data.recipes).toEqual([]);
  });

  it('AC-5: an idea needs a title, and invalid AI drafts are 422', async () => {
    expect((await app.post('/api/ideas/recipe', { title: '' })).status).toBe(400);
    app.ai.draftFromIdea.mockResolvedValueOnce(fakeRecipeDraft({ title: '' }));
    expect((await app.post('/api/ideas/recipe', { title: 'X' })).status).toBe(422);
  });
});
