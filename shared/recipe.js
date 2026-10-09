// Recipe validation and normalization, shared by the editor and the API.
// The rules are listed in docs/specs/00-architecture.md.

import { parseQuantity } from './quantity.js';

export const HUES = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'violet', 'grape', 'pink'];
export const DEFAULT_HUE = 'violet';
export const SOURCE_TYPES = ['manual', 'url', 'photo', 'pdf', 'ai'];
export const EDIT_REASONS = ['edit', 'ai-format', 'review-improvement'];

export const LIMITS = {
  title: 120,
  description: 2000,
  servings: 100,
  minutes: 2880,
  tags: 20,
  tag: 30,
  ingredients: 200,
  ingredientName: 120,
  unit: 20,
  ingredientNote: 500,
  quantity: 100000,
  steps: 100,
  stepText: 2000,
  noteText: 2000,
  url: 2000,
};

class RecipeValidationError extends Error {}

function fail(message) {
  throw new RecipeValidationError(message);
}

export function createId() {
  return globalThis.crypto.randomUUID();
}

function cleanText(value, field, max, { required = false } = {}) {
  const text = value === null || value === undefined ? '' : String(value).trim();
  if (required && !text) fail(`${field} is required`);
  if (text.length > max) fail(`${field} must be at most ${max} characters`);
  return text;
}

function cleanWholeNumber(value, field, min, max) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) fail(`${field} must be a number`);
  const rounded = Math.round(number);
  if (rounded < min || rounded > max) fail(`${field} must be between ${min} and ${max}`);
  return rounded;
}

function cleanId(value) {
  return typeof value === 'string' && /^[\w-]{1,64}$/.test(value) ? value : createId();
}

/** Accepts an array or a comma separated string; returns unique lower-case tags. */
function cleanTags(value) {
  const list = Array.isArray(value) ? value : String(value ?? '').split(',');
  const tags = [...new Set(list.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))];
  if (tags.length > LIMITS.tags) fail(`at most ${LIMITS.tags} tags are allowed`);
  const tooLong = tags.find((tag) => tag.length > LIMITS.tag);
  if (tooLong) fail(`tag "${tooLong}" must be at most ${LIMITS.tag} characters`);
  return tags;
}

function isBlankIngredient(item) {
  return ['name', 'quantity', 'unit', 'note'].every((key) => {
    const value = item?.[key];
    return value === null || value === undefined || String(value).trim() === '';
  });
}

function cleanIngredients(value) {
  const list = Array.isArray(value) ? value.filter((item) => !isBlankIngredient(item)) : [];
  if (list.length > LIMITS.ingredients) fail(`at most ${LIMITS.ingredients} ingredients are allowed`);

  return list.map((item, index) => {
    const label = `ingredient ${index + 1}`;
    const rawQuantity = item.quantity;
    const quantity = parseQuantity(rawQuantity);
    const hasQuantity = rawQuantity !== null && rawQuantity !== undefined && String(rawQuantity).trim() !== '';
    if (hasQuantity && quantity === null) fail(`${label}: quantity "${rawQuantity}" is not a number`);
    if (quantity !== null && quantity > LIMITS.quantity) fail(`${label}: quantity is too large`);

    return {
      id: cleanId(item.id),
      name: cleanText(item.name, `${label} name`, LIMITS.ingredientName, { required: true }),
      quantity,
      unit: cleanText(item.unit, `${label} unit`, LIMITS.unit),
      note: cleanText(item.note, `${label} note`, LIMITS.ingredientNote),
    };
  });
}

function cleanSteps(value) {
  const list = (Array.isArray(value) ? value : [])
    .map((step) => (typeof step === 'string' ? { text: step } : step ?? {}))
    .filter((step) => String(step.text ?? '').trim() !== '');
  if (list.length > LIMITS.steps) fail(`at most ${LIMITS.steps} steps are allowed`);

  return list.map((step, index) => ({
    id: cleanId(step.id),
    text: cleanText(step.text, `step ${index + 1}`, LIMITS.stepText, { required: true }),
  }));
}

function cleanSource(value) {
  const type = SOURCE_TYPES.includes(value?.type) ? value.type : 'manual';
  return { type, url: cleanText(value?.url, 'source url', LIMITS.url) };
}

const numberInRange = (value, min, max) => (typeof value === 'number' && value >= min && value <= max ? value : null);
const truncate = (value, max) => String(value ?? '').slice(0, max);

/**
 * Trims a machine-made draft (from Claude or an imported page) to the field
 * limits, so a long tag or an odd servings value is dropped instead of
 * failing validation. Run validateRecipe afterwards.
 */
export function fitToLimits(draft) {
  return {
    ...draft,
    title: truncate(draft.title, LIMITS.title),
    description: truncate(draft.description, LIMITS.description),
    servings: numberInRange(draft.servings, 1, LIMITS.servings),
    prepMinutes: numberInRange(draft.prepMinutes, 0, LIMITS.minutes),
    cookMinutes: numberInRange(draft.cookMinutes, 0, LIMITS.minutes),
    tags: [...new Set((draft.tags ?? []).map((tag) => String(tag).trim().toLowerCase()))]
      .filter((tag) => tag && tag.length <= LIMITS.tag)
      .slice(0, LIMITS.tags),
    ingredients: (draft.ingredients ?? []).slice(0, LIMITS.ingredients).map((ingredient) => ({
      ...ingredient,
      name: truncate(ingredient.name, LIMITS.ingredientName),
      quantity: numberInRange(ingredient.quantity, 0, LIMITS.quantity),
      unit: truncate(ingredient.unit, LIMITS.unit),
      note: truncate(ingredient.note, LIMITS.ingredientNote),
    })),
    steps: (draft.steps ?? [])
      .slice(0, LIMITS.steps)
      .map((step) => truncate(typeof step === 'string' ? step : step?.text, LIMITS.stepText)),
  };
}

/**
 * Validates the editable fields of a recipe.
 * Returns { value } with the normalized fields, or { error } with a message
 * naming the first invalid field.
 */
export function validateRecipe(input) {
  try {
    if (!input || typeof input !== 'object') fail('recipe is required');
    return {
      value: {
        title: cleanText(input.title, 'title', LIMITS.title, { required: true }),
        description: cleanText(input.description, 'description', LIMITS.description),
        servings: cleanWholeNumber(input.servings, 'servings', 1, LIMITS.servings),
        prepMinutes: cleanWholeNumber(input.prepMinutes, 'prep time', 0, LIMITS.minutes),
        cookMinutes: cleanWholeNumber(input.cookMinutes, 'cook time', 0, LIMITS.minutes),
        tags: cleanTags(input.tags),
        hue: HUES.includes(input.hue) ? input.hue : DEFAULT_HUE,
        ingredients: cleanIngredients(input.ingredients),
        steps: cleanSteps(input.steps),
        source: cleanSource(input.source),
      },
    };
  } catch (error) {
    if (error instanceof RecipeValidationError) return { error: error.message };
    throw error;
  }
}
