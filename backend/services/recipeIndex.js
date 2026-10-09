// Keeps the recipe index (one small document listing every recipe) in sync,
// so the list page, search and pantry matching never load every recipe.

export function averageRating(reviews) {
  if (reviews.length === 0) return null;
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return Math.round((total / reviews.length) * 10) / 10;
}

export function summarizeRecipe(recipe, reviews) {
  const minutes = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
  return {
    id: recipe.id,
    title: recipe.title,
    tags: recipe.tags,
    hue: recipe.hue,
    servings: recipe.servings,
    totalMinutes: minutes > 0 ? minutes : null,
    ingredientNames: recipe.ingredients.map((ingredient) => ingredient.name),
    rating: averageRating(reviews),
    reviewCount: reviews.length,
    updatedAt: recipe.updatedAt,
  };
}

const byTitle = (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });

export function createRecipeIndex({ repos }) {
  async function all() {
    return (await repos.recipeIndex.get()).recipes.sort(byTitle);
  }

  async function upsert(recipe) {
    const reviews = await repos.reviews.list(recipe.id);
    const index = await repos.recipeIndex.get();
    const others = index.recipes.filter((entry) => entry.id !== recipe.id);
    await repos.recipeIndex.save({ recipes: [...others, summarizeRecipe(recipe, reviews)].sort(byTitle) });
  }

  async function remove(id) {
    const index = await repos.recipeIndex.get();
    await repos.recipeIndex.save({ recipes: index.recipes.filter((entry) => entry.id !== id) });
  }

  return { all, upsert, remove };
}
