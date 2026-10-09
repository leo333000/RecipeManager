import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, TINY_JPEG } from '../../helpers/testApp.js';

let app;
let recipe;

beforeEach(async () => {
  app = createTestApp();
  await app.signIn();
  recipe = await app.createRecipe();
});

const upload = async () => (await app.post('/api/images', { data: TINY_JPEG, mediaType: 'image/jpeg' })).data.id;

describe('reviews and images (spec 04)', () => {
  it('AC-1/AC-2: uploads an image and serves it back with a long private cache', async () => {
    const { status, data } = await app.post('/api/images', { data: TINY_JPEG, mediaType: 'image/jpeg' });
    expect(status).toBe(201);
    const response = await app.raw('GET', `/api/images/${data.id}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(response.headers.get('cache-control')).toBe('private, max-age=31536000, immutable');
    expect(Buffer.from(await response.arrayBuffer()).toString('base64')).toBe(TINY_JPEG);
  });

  it('AC-1: rejects unsupported image types', async () => {
    const { status, data } = await app.post('/api/images', { data: TINY_JPEG, mediaType: 'image/svg+xml' });
    expect(status).toBe(400);
    expect(data.error.code).toBe('bad_image');
  });

  it('AC-2: unknown images return 404', async () => {
    expect((await app.get('/api/images/nope')).status).toBe(404);
  });

  it('AC-3: adds a review with photos, newest first', async () => {
    const imageId = await upload();
    const first = await app.post(`/api/recipes/${recipe.id}/reviews`, { rating: 4, notes: ' good ', improvements: 'more garlic', images: [{ id: imageId, caption: 'plated' }] });
    expect(first.status).toBe(201);
    expect(first.data.review).toMatchObject({ rating: 4, notes: 'good', improvements: 'more garlic', images: [{ id: imageId, caption: 'plated' }] });

    app.tick();
    await app.post(`/api/recipes/${recipe.id}/reviews`, { rating: 2 });
    const { data } = await app.get(`/api/recipes/${recipe.id}/reviews`);
    expect(data.reviews.map((review) => review.rating)).toEqual([2, 4]);
  });

  it.each([[0], [6], [3.5], ['five'], [undefined]])('AC-3: rejects rating %j', async (rating) => {
    const { status, data } = await app.post(`/api/recipes/${recipe.id}/reviews`, { rating });
    expect(status).toBe(400);
    expect(data.error.code).toBe('invalid_review');
  });

  it('AC-3: rejects more than 6 photos and photos that were never uploaded', async () => {
    const tooMany = Array.from({ length: 7 }, (_, index) => ({ id: `img${index}`, caption: '' }));
    expect((await app.post(`/api/recipes/${recipe.id}/reviews`, { rating: 5, images: tooMany })).status).toBe(400);
    expect((await app.post(`/api/recipes/${recipe.id}/reviews`, { rating: 5, images: [{ id: 'ghost', caption: '' }] })).status).toBe(400);
  });

  it('AC-4: the index rating follows adds and deletes', async () => {
    await app.post(`/api/recipes/${recipe.id}/reviews`, { rating: 5 });
    const low = await app.post(`/api/recipes/${recipe.id}/reviews`, { rating: 2 });
    await app.post(`/api/recipes/${recipe.id}/reviews`, { rating: 4 });
    let [summary] = (await app.get('/api/recipes')).data.recipes;
    expect(summary).toMatchObject({ rating: 3.7, reviewCount: 3 });

    await app.del(`/api/recipes/${recipe.id}/reviews/${low.data.review.id}`);
    [summary] = (await app.get('/api/recipes')).data.recipes;
    expect(summary).toMatchObject({ rating: 4.5, reviewCount: 2 });
  });

  it('AC-5: deleting a review deletes its images', async () => {
    const imageId = await upload();
    const { data } = await app.post(`/api/recipes/${recipe.id}/reviews`, { rating: 3, images: [{ id: imageId, caption: '' }] });
    expect((await app.del(`/api/recipes/${recipe.id}/reviews/${data.review.id}`)).status).toBe(204);
    expect((await app.get(`/api/images/${imageId}`)).status).toBe(404);
    expect((await app.del(`/api/recipes/${recipe.id}/reviews/${data.review.id}`)).status).toBe(404);
  });

  it('AC-6: an unreviewed recipe has an empty list; an unknown recipe is 404', async () => {
    expect((await app.get(`/api/recipes/${recipe.id}/reviews`)).data).toEqual({ reviews: [] });
    expect((await app.get('/api/recipes/missing/reviews')).status).toBe(404);
  });
});
