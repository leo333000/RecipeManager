// "What should I cook?" suggestions.

import { fitToLimits, validateRecipe } from '../../shared/recipe.js';
import { badRequest, HttpError } from '../http.js';
import { rankRecipesByPantry } from './pantryMatch.js';

const MAX_IDEAS = 6;
const TASTE_SAMPLE = { recipes: 150, topRated: 10, notes: 30, minRating: 4 };

export function createIdeaService({ repos, recipeIndex, pantry, ai }) {
  async function pantryMatches() {
    return rankRecipesByPantry(await recipeIndex.all(), await pantry.names());
  }

  async function suggest(mode) {
    if (mode === 'pantry') {
      const names = await pantry.names();
      if (names.length === 0) throw badRequest('empty_pantry', 'Add what you have to the pantry first.');
      const titles = (await recipeIndex.all()).map((summary) => summary.title);
      const { ideas } = await ai.suggestFromPantry({ pantry: names, existingTitles: titles });
      return ideas.slice(0, MAX_IDEAS);
    }

    if (mode === 'taste') {
      const summaries = await recipeIndex.all();
      if (summaries.length === 0) throw badRequest('no_recipes', 'Add a few recipes first so Claude knows your taste.');

      const topRated = summaries
        .filter((summary) => (summary.rating ?? 0) >= TASTE_SAMPLE.minRating)
        .sort((a, b) => b.rating - a.rating)
        .slice(0, TASTE_SAMPLE.topRated);
      const reviewLists = await Promise.all(topRated.map((summary) => repos.reviews.list(summary.id)));
      const reviewNotes = reviewLists
        .flatMap((reviews, index) => reviews.filter((review) => review.notes).map((review) => `${topRated[index].title}: ${review.notes}`))
        .slice(0, TASTE_SAMPLE.notes);

      const { ideas } = await ai.suggestForTaste({ recipes: summaries.slice(0, TASTE_SAMPLE.recipes), reviewNotes });
      return ideas.slice(0, MAX_IDEAS);
    }

    throw badRequest('invalid_mode', 'mode must be "pantry" or "taste"');
  }

  async function draftFromIdea({ title, description }) {
    const dish = typeof title === 'string' ? title.trim() : '';
    if (!dish) throw badRequest('invalid_idea', 'The idea needs a title');
    const answer = await ai.draftFromIdea({
      title: dish.slice(0, 200),
      description: typeof description === 'string' ? description.slice(0, 1000) : '',
      pantry: await pantry.names(),
    });
    const { value, error } = validateRecipe({ ...fitToLimits(answer), source: { type: 'ai', url: '' } });
    if (error) throw new HttpError(422, 'ai_bad_output', `Claude's recipe was not valid (${error}). Try again.`);
    return value;
  }

  return { pantryMatches, suggest, draftFromIdea };
}
