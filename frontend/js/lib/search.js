// Filtering and sorting of the recipe list (recipe index summaries).

export const SORTS = {
  title: 'Title',
  recent: 'Recently updated',
  rating: 'Rating',
};

const byTitle = (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });

const COMPARATORS = {
  title: byTitle,
  recent: (a, b) => b.updatedAt.localeCompare(a.updatedAt) || byTitle(a, b),
  rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || byTitle(a, b),
};

/** Matches the query against title, tags and ingredient names (case-insensitive). */
export function filterRecipes(recipes, { query = '', tag = '', sort = 'title' } = {}) {
  const needle = query.trim().toLowerCase();
  const matches = recipes.filter((recipe) => {
    if (tag && !recipe.tags.includes(tag)) return false;
    if (!needle) return true;
    return [recipe.title, ...recipe.tags, ...recipe.ingredientNames].some((text) => text.toLowerCase().includes(needle));
  });
  return matches.sort(COMPARATORS[sort] ?? byTitle);
}

export function allTags(recipes) {
  return [...new Set(recipes.flatMap((recipe) => recipe.tags))].sort();
}
