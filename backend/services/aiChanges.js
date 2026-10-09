// Claude-proposed recipe changes. Proposals are never saved here: the front
// end shows a before/after view and saves with PUT /api/recipes/:id.

import { fitToLimits, validateRecipe } from '../../shared/recipe.js';
import { badRequest, HttpError } from '../http.js';
import { applyAiFields } from './recipes.js';

const MAX_INSTRUCTIONS = 1000;

function toProposal(current, answer) {
  const { value, error } = validateRecipe({ ...fitToLimits(answer.recipe), source: current.source });
  if (error) throw new HttpError(422, 'ai_bad_output', `Claude's version was not valid (${error}). Try again.`);
  return {
    proposed: applyAiFields(current, value),
    summary: answer.summary,
    changes: answer.changes,
    baseVersion: current.version,
  };
}

export function createAiChangeService({ repos, recipes, ai }) {
  async function format(recipeId, instructions) {
    const text = typeof instructions === 'string' ? instructions.trim() : '';
    if (text.length > MAX_INSTRUCTIONS) {
      throw badRequest('invalid_instructions', `Instructions must be at most ${MAX_INSTRUCTIONS} characters`);
    }
    const recipe = await recipes.get(recipeId);
    return toProposal(recipe, await ai.formatRecipe(recipe, text));
  }

  async function improve(recipeId) {
    const recipe = await recipes.get(recipeId);
    const reviews = await repos.reviews.list(recipeId);
    if (reviews.length === 0) throw badRequest('no_reviews', 'Add a review first, then Claude can use it.');
    return toProposal(recipe, await ai.improveFromReviews(recipe, reviews));
  }

  return { format, improve };
}
