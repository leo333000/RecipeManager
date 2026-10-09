import { json, readJson } from '../http.js';

export function registerImportRoutes(router, { imports }) {
  router.post('/api/import/url', async ({ request }) => {
    const { url } = await readJson(request);
    return json(await imports.fromUrl(url));
  });

  router.post('/api/import/photo', async ({ request }) => {
    const { images } = await readJson(request);
    return json({ draft: await imports.fromPhotos(images) });
  });

  router.post('/api/import/pdf', async ({ request }) => {
    const { data } = await readJson(request);
    return json({ draft: await imports.fromPdf(data) });
  });
}
