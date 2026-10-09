// Builds a shopping list from several ingredient lists, minus the pantry.

import { findPantryMatch, normalizeIngredientName, normalizeUnit, toBaseUnit, toDisplayUnit } from '../../shared/ingredients.js';

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/**
 * @param sources      [{ title, ingredients: [{ name, quantity, unit }] }]
 * @param pantryNames  names of items already owned
 * @returns { toBuy, alreadyHave }, each a list of { name, quantity, unit, sources }
 *
 * Lines with the same normalized name and unit are merged (kg/g and l/ml are
 * converted first, and totals of 1000 g or ml or more are shown in kg or l).
 * Numeric quantities are summed; a line where every quantity is unknown
 * keeps quantity null.
 */
export function buildShoppingList(sources, pantryNames) {
  const lines = new Map();

  for (const source of sources) {
    for (const ingredient of source.ingredients) {
      const key = normalizeIngredientName(ingredient.name);
      if (!key) continue;
      const { quantity, unit } = toBaseUnit(ingredient.quantity ?? null, normalizeUnit(ingredient.unit));
      const lineKey = `${key}|${unit}`;

      const line = lines.get(lineKey) ?? { name: ingredient.name.trim(), quantity: null, unit, sources: [] };
      if (quantity !== null) line.quantity = roundQuantity((line.quantity ?? 0) + quantity);
      if (!line.sources.includes(source.title)) line.sources.push(source.title);
      lines.set(lineKey, line);
    }
  }

  const toBuy = [];
  const alreadyHave = [];
  for (const line of lines.values()) {
    const shown = { ...line, ...toDisplayUnit(line.quantity, line.unit) };
    (findPantryMatch(line.name, pantryNames) ? alreadyHave : toBuy).push(shown);
  }
  return { toBuy: toBuy.sort(byName), alreadyHave: alreadyHave.sort(byName) };
}

function roundQuantity(value) {
  return Math.round(value * 1000) / 1000;
}
