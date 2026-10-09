// Ranks Leo's own recipes by how much of each can be made from the pantry.

import { findPantryMatch } from '../../shared/ingredients.js';

/**
 * @param summaries    recipe index entries ({ id, title, hue, ingredientNames })
 * @param pantryNames  names of items already owned
 * @returns [{ id, title, hue, coverage, have, missing }] for recipes with coverage > 0,
 *          best coverage first, then fewest missing ingredients.
 */
export function rankRecipesByPantry(summaries, pantryNames) {
  return summaries
    .filter((summary) => summary.ingredientNames.length > 0)
    .map((summary) => {
      const have = [];
      const missing = [];
      for (const name of summary.ingredientNames) {
        (findPantryMatch(name, pantryNames) ? have : missing).push(name);
      }
      const coverage = Math.round((have.length / summary.ingredientNames.length) * 100) / 100;
      return { id: summary.id, title: summary.title, hue: summary.hue, coverage, have, missing };
    })
    .filter((match) => match.coverage > 0)
    .sort((a, b) => b.coverage - a.coverage || a.missing.length - b.missing.length || a.title.localeCompare(b.title));
}
