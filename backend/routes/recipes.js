import { json, noContent, readJson, readPositiveInt } from '../http.js';

export function registerRecipeRoutes(router, { recipes, reviews, aiChanges }) {
  router.get('/api/recipes', async () => json({ recipes: await recipes.list() }));

  router.post('/api/recipes', async ({ request }) => {
    const { recipe } = await readJson(request);
    return json({ recipe: await recipes.create(recipe) }, 201);
  });

  router.get('/api/recipes/:id', async ({ params }) => json({ recipe: await recipes.get(params.id) }));

  router.put('/api/recipes/:id', async ({ request, params }) => {
    const { recipe, baseVersion, reason } = await readJson(request);
    return json({ recipe: await recipes.update(params.id, recipe, baseVersion, reason) });
  });

  router.delete('/api/recipes/:id', async ({ params }) => {
    await recipes.remove(params.id);
    return noContent();
  });

  // Notes
  router.post('/api/recipes/:id/notes', async ({ request, params }) => {
    const { text } = await readJson(request);
    return json({ recipe: await recipes.addNote(params.id, text) }, 201);
  });

  router.delete('/api/recipes/:id/notes/:noteId', async ({ params }) =>
    json({ recipe: await recipes.removeNote(params.id, params.noteId) }),
  );

  router.patch('/api/recipes/:id/ingredients/:ingredientId', async ({ request, params }) => {
    const { note } = await readJson(request);
    return json({ recipe: await recipes.setIngredientNote(params.id, params.ingredientId, note) });
  });

  // History
  router.get('/api/recipes/:id/versions', async ({ params }) => json(await recipes.listVersions(params.id)));

  router.get('/api/recipes/:id/versions/:version', async ({ params }) =>
    json({ version: await recipes.getVersion(params.id, readPositiveInt(params.version, 'version')) }),
  );

  router.post('/api/recipes/:id/versions/:version/restore', async ({ request, params }) => {
    const { baseVersion } = await readJson(request);
    const version = readPositiveInt(params.version, 'version');
    return json({ recipe: await recipes.restore(params.id, version, baseVersion) });
  });

  // AI proposals (not saved until the client PUTs them)
  router.post('/api/recipes/:id/ai/format', async ({ request, params }) => {
    const { instructions } = await readJson(request);
    return json(await aiChanges.format(params.id, instructions));
  });

  router.post('/api/recipes/:id/ai/improve', async ({ params }) => json(await aiChanges.improve(params.id)));

  // Reviews
  router.get('/api/recipes/:id/reviews', async ({ params }) => json({ reviews: await reviews.list(params.id) }));

  router.post('/api/recipes/:id/reviews', async ({ request, params }) => {
    const input = await readJson(request);
    return json({ review: await reviews.add(params.id, input) }, 201);
  });

  router.delete('/api/recipes/:id/reviews/:reviewId', async ({ params }) => {
    await reviews.remove(params.id, params.reviewId);
    return noContent();
  });
}
