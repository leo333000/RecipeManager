import { describe, expect, it } from 'vitest';
import { allTags, filterRecipes } from '../../../frontend/js/lib/search.js';

const recipes = [
  { title: 'banana bread', tags: ['baking'], ingredientNames: ['bananas', 'flour'], rating: 4, updatedAt: '2026-10-01' },
  { title: 'Apple pie', tags: ['baking', 'dessert'], ingredientNames: ['apples', 'butter'], rating: null, updatedAt: '2026-10-05' },
  { title: 'Chili', tags: ['dinner'], ingredientNames: ['beans', 'beef'], rating: 5, updatedAt: '2026-09-01' },
];

const titles = (list) => list.map((recipe) => recipe.title);

describe('filterRecipes (spec 02 AC-2)', () => {
  it('sorts by title by default, ignoring case', () => {
    expect(titles(filterRecipes(recipes))).toEqual(['Apple pie', 'banana bread', 'Chili']);
  });

  it('matches title, tag or ingredient, case-insensitively', () => {
    expect(titles(filterRecipes(recipes, { query: 'BREAD' }))).toEqual(['banana bread']);
    expect(titles(filterRecipes(recipes, { query: 'dessert' }))).toEqual(['Apple pie']);
    expect(titles(filterRecipes(recipes, { query: 'beef' }))).toEqual(['Chili']);
    expect(titles(filterRecipes(recipes, { query: '  ' }))).toHaveLength(3);
  });

  it('filters by one tag', () => {
    expect(titles(filterRecipes(recipes, { tag: 'baking' }))).toEqual(['Apple pie', 'banana bread']);
    expect(titles(filterRecipes(recipes, { tag: 'baking', query: 'apple' }))).toEqual(['Apple pie']);
  });

  it('sorts by recent update or by rating (unrated last)', () => {
    expect(titles(filterRecipes(recipes, { sort: 'recent' }))).toEqual(['Apple pie', 'banana bread', 'Chili']);
    expect(titles(filterRecipes(recipes, { sort: 'rating' }))).toEqual(['Chili', 'banana bread', 'Apple pie']);
  });

  it('does not modify the input list', () => {
    const copy = [...recipes];
    filterRecipes(copy, { sort: 'rating' });
    expect(copy).toEqual(recipes);
  });
});

describe('allTags', () => {
  it('returns unique sorted tags', () => {
    expect(allTags(recipes)).toEqual(['baking', 'dessert', 'dinner']);
  });
});
