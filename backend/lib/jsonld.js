// Reads schema.org Recipe data embedded in web pages as JSON-LD, which most
// recipe sites publish. When present, no AI call is needed.

import { parseIngredientLine } from '../../shared/ingredients.js';
import { fitToLimits } from '../../shared/recipe.js';
import { decodeEntities, stripTags } from './html.js';

const MAX_DEPTH = 6;

function isRecipeNode(node) {
  const types = [].concat(node['@type'] ?? []);
  return types.some((type) => typeof type === 'string' && /(^|[:/])Recipe$/.test(type));
}

function findRecipeNode(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > MAX_DEPTH) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipeNode(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (isRecipeNode(node)) return node;
  return findRecipeNode(node['@graph'], depth + 1) ?? findRecipeNode(node.mainEntity, depth + 1);
}

/** Returns the first schema.org Recipe object found in the page's JSON-LD scripts, or null. */
export function findJsonLdRecipe(html) {
  const scripts = String(html ?? '').matchAll(
    /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const [, body] of scripts) {
    try {
      const found = findRecipeNode(JSON.parse(body.trim()));
      if (found) return found;
    } catch {
      // Some sites ship broken JSON-LD; skip that block.
    }
  }
  return null;
}

/** "PT1H20M" -> 80. Returns null when the value is missing or not a duration. */
export function parseIsoDuration(value) {
  const match = String(value ?? '').match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!match || match[0] === 'P' || /^PT$/i.test(match[0])) return null;
  const [, days, hours, minutes, seconds] = match.map((part) => Number(part ?? 0));
  const total = days * 1440 + hours * 60 + minutes + Math.round(seconds / 60);
  return total > 0 ? total : null;
}

function firstNumber(value) {
  const text = Array.isArray(value) ? value.join(' ') : String(value ?? '');
  const match = text.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function textList(value) {
  if (!value) return [];
  return (Array.isArray(value) ? value : String(value).split(','))
    .map((item) => decodeEntities(String(item)).trim().toLowerCase())
    .filter(Boolean);
}

function flattenInstructions(value) {
  if (!value) return [];
  if (typeof value === 'string') {
    return stripTags(value.replace(/<\/(p|li)>|<br\s*\/?>/gi, '\n').replace(/\n/g, '\u0000'))
      .split('\u0000')
      .map((line) => line.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) return value.flatMap(flattenInstructions);
  if (typeof value === 'object') {
    if (value.itemListElement) return flattenInstructions(value.itemListElement);
    const text = stripTags(value.text ?? value.name ?? '');
    return text ? [text] : [];
  }
  return [];
}

/** Maps a schema.org Recipe object to a RecipeDraft (not yet validated). */
export function jsonLdToDraft(node, url) {
  return fitToLimits({
    title: stripTags(node.name),
    description: stripTags(node.description),
    servings: firstNumber(node.recipeYield),
    prepMinutes: parseIsoDuration(node.prepTime),
    cookMinutes: parseIsoDuration(node.cookTime),
    tags: [...textList(node.keywords), ...textList(node.recipeCategory), ...textList(node.recipeCuisine)],
    ingredients: [].concat(node.recipeIngredient ?? node.ingredients ?? [])
      .map((line) => parseIngredientLine(stripTags(line)))
      .filter(Boolean),
    steps: flattenInstructions(node.recipeInstructions),
    source: { type: 'url', url },
  });
}
