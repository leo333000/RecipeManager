import { json, readJson } from '../http.js';

export function registerIdeaRoutes(router, { ideas }) {
  router.get('/api/ideas/pantry-matches', async () => json({ matches: await ideas.pantryMatches() }));

  router.post('/api/ideas', async ({ request }) => {
    const { mode } = await readJson(request);
    return json({ ideas: await ideas.suggest(mode) });
  });

  router.post('/api/ideas/recipe', async ({ request }) => {
    const { title, description } = await readJson(request);
    return json({ draft: await ideas.draftFromIdea({ title, description }) });
  });
}
