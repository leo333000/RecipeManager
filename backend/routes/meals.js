import { json, noContent, readJson } from '../http.js';

export function registerMealRoutes(router, { meals, pantry }) {
  router.get('/api/meals', async () => json({ selections: await meals.list() }));

  router.post('/api/meals', async ({ request }) => {
    const { name, recipeIds } = await readJson(request);
    return json({ selection: await meals.create({ name, recipeIds }) }, 201);
  });

  router.post('/api/meals/random', async ({ request }) => {
    const { count, tag, name } = await readJson(request);
    return json({ selection: await meals.createRandom({ count, tag, name }) }, 201);
  });

  router.get('/api/meals/:id', async ({ params }) => json({ selection: await meals.get(params.id) }));

  router.patch('/api/meals/:id', async ({ request, params }) => {
    const { name } = await readJson(request);
    return json({ selection: await meals.rename(params.id, name) });
  });

  router.delete('/api/meals/:id', async ({ params }) => {
    await meals.remove(params.id);
    return noContent();
  });

  router.post('/api/meals/:id/items', async ({ request, params }) => {
    const { recipeId } = await readJson(request);
    return json({ selection: await meals.addRecipe(params.id, recipeId) }, 201);
  });

  router.post('/api/meals/:id/external', async ({ request, params }) => {
    const { title, servings } = await readJson(request);
    return json({ selection: await meals.addExternal(params.id, { title, servings }) }, 201);
  });

  router.delete('/api/meals/:id/items/:itemId', async ({ params }) =>
    json({ selection: await meals.removeItem(params.id, params.itemId) }),
  );

  router.get('/api/meals/:id/shopping-list', async ({ params }) => json(await meals.shoppingList(params.id)));

  // Pantry
  router.get('/api/pantry', async () => json({ items: await pantry.list() }));

  router.post('/api/pantry', async ({ request }) => {
    const { names } = await readJson(request);
    return json({ items: await pantry.add(names) });
  });

  router.delete('/api/pantry/:itemId', async ({ params }) => json({ items: await pantry.remove(params.itemId) }));

  router.delete('/api/pantry', async () => json({ items: await pantry.clear() }));
}
