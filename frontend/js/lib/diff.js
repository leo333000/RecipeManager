// Before/after comparison of two recipes.

import { formatIngredient } from '../../../shared/ingredients.js';
import { formatMinutes } from './format.js';

/**
 * Line diff using the longest common subsequence.
 * Returns [{ type: 'same' | 'add' | 'remove', text }] in reading order.
 */
export function diffLines(before, after) {
  const rows = before.length;
  const cols = after.length;
  const table = Array.from({ length: rows + 1 }, () => new Array(cols + 1).fill(0));

  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      table[i][j] = before[i] === after[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const result = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (before[i] === after[j]) {
      result.push({ type: 'same', text: before[i] });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      result.push({ type: 'remove', text: before[i] });
      i += 1;
    } else {
      result.push({ type: 'add', text: after[j] });
      j += 1;
    }
  }
  while (i < rows) result.push({ type: 'remove', text: before[i++] });
  while (j < cols) result.push({ type: 'add', text: after[j++] });
  return result;
}

export function ingredientLine(ingredient) {
  const text = formatIngredient(ingredient);
  return ingredient.note ? `${text} (${ingredient.note})` : text;
}

const FIELDS = [
  ['Title', (recipe) => recipe.title],
  ['Description', (recipe) => recipe.description],
  ['Servings', (recipe) => (recipe.servings ? String(recipe.servings) : '')],
  ['Prep time', (recipe) => formatMinutes(recipe.prepMinutes)],
  ['Cook time', (recipe) => formatMinutes(recipe.cookMinutes)],
  ['Tags', (recipe) => recipe.tags.join(', ')],
];

/**
 * Compares two recipes field by field.
 * Returns { fields: [{ label, before, after, changed }], ingredients, steps, changed }.
 */
export function diffRecipe(before, after) {
  const fields = FIELDS.map(([label, read]) => {
    const old = read(before);
    const next = read(after);
    return { label, before: old, after: next, changed: old !== next };
  });
  const ingredients = diffLines(before.ingredients.map(ingredientLine), after.ingredients.map(ingredientLine));
  const steps = diffLines(before.steps.map((step) => step.text), after.steps.map((step) => step.text));
  const hasChange = (lines) => lines.some((line) => line.type !== 'same');

  return {
    fields,
    ingredients,
    steps,
    changed: fields.some((field) => field.changed) || hasChange(ingredients) || hasChange(steps),
  };
}
