import { json, readJson } from '../http.js';

export function registerImageRoutes(router, { images }) {
  router.post('/api/images', async ({ request }) => {
    const { data, mediaType } = await readJson(request);
    return json({ id: await images.save({ data, mediaType }) }, 201);
  });

  router.get('/api/images/:id', async ({ params }) => {
    const image = await images.get(params.id);
    return new Response(image.data, {
      headers: {
        'Content-Type': image.contentType,
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    });
  });
}
