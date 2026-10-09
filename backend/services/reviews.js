// Meal reviews and their images.

import { createId } from '../../shared/recipe.js';
import { badRequest, notFound } from '../http.js';

export const REVIEW_LIMITS = { text: 4000, caption: 200, images: 6 };

function cleanText(value, field, max) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length > max) throw badRequest('invalid_review', `${field} must be at most ${max} characters`);
  return text;
}

export function validateReview(input) {
  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw badRequest('invalid_review', 'rating must be a whole number from 1 to 5');
  }
  const images = Array.isArray(input.images) ? input.images : [];
  if (images.length > REVIEW_LIMITS.images) {
    throw badRequest('invalid_review', `at most ${REVIEW_LIMITS.images} photos per review`);
  }
  return {
    rating,
    notes: cleanText(input.notes, 'notes', REVIEW_LIMITS.text),
    improvements: cleanText(input.improvements, 'improvements', REVIEW_LIMITS.text),
    images: images.map((image) => {
      if (typeof image?.id !== 'string' || !image.id) throw badRequest('invalid_review', 'each photo needs an id');
      return { id: image.id, caption: cleanText(image.caption, 'caption', REVIEW_LIMITS.caption) };
    }),
  };
}

export function createReviewService({ repos, recipeIndex, now }) {
  async function getRecipe(recipeId) {
    const recipe = await repos.recipes.get(recipeId);
    if (!recipe) throw notFound('Recipe');
    return recipe;
  }

  async function list(recipeId) {
    await getRecipe(recipeId);
    return repos.reviews.list(recipeId);
  }

  async function add(recipeId, input) {
    const recipe = await getRecipe(recipeId);
    const fields = validateReview(input);
    const existing = await Promise.all(fields.images.map((image) => repos.images.exists(image.id)));
    if (existing.includes(false)) throw badRequest('invalid_review', 'A photo was not uploaded. Add it again.');

    const review = { id: createId(), createdAt: now().toISOString(), ...fields };
    const reviews = await repos.reviews.list(recipeId);
    await repos.reviews.save(recipeId, [review, ...reviews]);
    await recipeIndex.upsert(recipe);
    return review;
  }

  async function remove(recipeId, reviewId) {
    const recipe = await getRecipe(recipeId);
    const reviews = await repos.reviews.list(recipeId);
    const review = reviews.find((item) => item.id === reviewId);
    if (!review) throw notFound('Review');

    await Promise.all(review.images.map((image) => repos.images.delete(image.id)));
    await repos.reviews.save(recipeId, reviews.filter((item) => item.id !== reviewId));
    await recipeIndex.upsert(recipe);
  }

  return { list, add, remove };
}
