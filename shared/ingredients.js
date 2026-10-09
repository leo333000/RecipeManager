// Ingredient helpers shared by the front end and back end: units, name
// normalization, pantry matching and parsing of free-text ingredient lines.

import { formatQuantity, parseQuantity, UNICODE_FRACTION_CHARS } from './quantity.js';

const UNIT_ALIASES = {
  g: ['g', 'gr', 'gram', 'grams', 'gramme', 'grammes'],
  kg: ['kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms'],
  mg: ['mg', 'milligram', 'milligrams'],
  ml: ['ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters'],
  cl: ['cl', 'centilitre', 'centilitres'],
  dl: ['dl', 'decilitre', 'decilitres'],
  l: ['l', 'litre', 'litres', 'liter', 'liters', 'lt'],
  tsp: ['tsp', 'tsps', 'teaspoon', 'teaspoons'],
  tbsp: ['tbsp', 'tbsps', 'tbs', 'tbl', 'tablespoon', 'tablespoons'],
  cup: ['cup', 'cups'],
  oz: ['oz', 'ounce', 'ounces'],
  lb: ['lb', 'lbs', 'pound', 'pounds'],
  pinch: ['pinch', 'pinches'],
  clove: ['clove', 'cloves'],
  can: ['can', 'cans', 'tin', 'tins'],
  slice: ['slice', 'slices'],
  bunch: ['bunch', 'bunches'],
  handful: ['handful', 'handfuls'],
  sprig: ['sprig', 'sprigs'],
  stick: ['stick', 'sticks'],
  piece: ['piece', 'pieces', 'pc', 'pcs'],
  packet: ['packet', 'packets', 'pack', 'packs'],
};

const UNIT_LOOKUP = new Map(
  Object.entries(UNIT_ALIASES).flatMap(([unit, aliases]) => aliases.map((alias) => [alias, unit])),
);

// Units converted to a common base before quantities are added together.
const BASE_UNITS = {
  kg: { unit: 'g', factor: 1000 },
  mg: { unit: 'g', factor: 0.001 },
  l: { unit: 'ml', factor: 1000 },
  cl: { unit: 'ml', factor: 10 },
  dl: { unit: 'ml', factor: 100 },
};

/** Ingredients everyone has: never put on a shopping list. */
export const ALWAYS_OWNED = ['water'];

/** Maps unit synonyms to one canonical unit ("Tablespoons" -> "tbsp"). Unknown units are lower-cased. */
export function normalizeUnit(unit) {
  const text = String(unit ?? '').trim().toLowerCase().replace(/\.$/, '');
  return UNIT_LOOKUP.get(text) ?? text;
}

export function isKnownUnit(unit) {
  return UNIT_LOOKUP.has(String(unit ?? '').trim().toLowerCase().replace(/\.$/, ''));
}

/** Converts kg/mg to g and l/cl/dl to ml so quantities can be added. */
export function toBaseUnit(quantity, unit) {
  const base = BASE_UNITS[unit];
  if (!base) return { quantity, unit };
  return { quantity: quantity === null ? null : quantity * base.factor, unit: base.unit };
}

/** The reverse of toBaseUnit for display: 1200 g -> 1.2 kg, 1500 ml -> 1.5 l. */
export function toDisplayUnit(quantity, unit) {
  if (quantity !== null && quantity >= 1000 && (unit === 'g' || unit === 'ml')) {
    return { quantity: quantity / 1000, unit: unit === 'g' ? 'kg' : 'l' };
  }
  return { quantity, unit };
}

/** Lower-cases, strips accents and punctuation, and singularizes each word. */
export function normalizeIngredientName(name) {
  return String(name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(singularize)
    .join(' ');
}

function singularize(word) {
  if (word.length <= 3) return word;
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.endsWith('oes')) return word.slice(0, -2);
  if (/(ches|shes|sses|xes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us')) return word.slice(0, -1);
  return word;
}

/**
 * Returns the pantry name that covers this ingredient, or null.
 * A pantry item covers an ingredient when every word of the pantry item
 * appears in the ingredient name ("olive oil" covers "extra virgin olive oil").
 */
export function findPantryMatch(ingredientName, pantryNames) {
  const ingredientWords = new Set(normalizeIngredientName(ingredientName).split(' ').filter(Boolean));
  if (ingredientWords.size === 0) return null;

  for (const pantryName of [...ALWAYS_OWNED, ...pantryNames]) {
    const pantryWords = normalizeIngredientName(pantryName).split(' ').filter(Boolean);
    if (pantryWords.length > 0 && pantryWords.every((word) => ingredientWords.has(word))) {
      return pantryName;
    }
  }
  return null;
}

const QUANTITY_PATTERN = new RegExp(
  `^(\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d*\\s?[${UNICODE_FRACTION_CHARS}]|\\d+(?:[.,]\\d+)?)` +
    '(?:\\s*(?:-|–|to)\\s*(?:\\d+\\/\\d+|\\d+(?:[.,]\\d+)?))?',
);

/**
 * Parses a free-text line such as "200 g flour, sifted" or "1 (400 g) can chickpeas"
 * into { name, quantity, unit, note }. Returns null for blank lines.
 */
export function parseIngredientLine(line) {
  let text = String(line ?? '')
    .trim()
    .replace(/^[-•*·▪◦]\s*/, '')
    .replace(/\s+/g, ' ');
  if (!text) return null;

  const notes = [];
  text = text.replace(/\(([^)]*)\)/g, (_, inside) => {
    if (inside.trim()) notes.push(inside.trim());
    return ' ';
  }).replace(/\s+/g, ' ').trim();

  let quantity = null;
  const quantityMatch = text.match(QUANTITY_PATTERN);
  if (quantityMatch) {
    quantity = parseQuantity(quantityMatch[1]);
    text = text.slice(quantityMatch[0].length).trim();
  }

  let unit = '';
  if (quantity !== null) {
    const unitMatch = text.match(/^([a-zA-Z]+\.?)(?:\s+|$)/);
    if (unitMatch && isKnownUnit(unitMatch[1])) {
      unit = normalizeUnit(unitMatch[1]);
      text = text.slice(unitMatch[0].length).replace(/^of\s+/i, '').trim();
    }
  }

  const commaIndex = text.indexOf(',');
  if (commaIndex !== -1) {
    const afterComma = text.slice(commaIndex + 1).trim();
    if (afterComma) notes.push(afterComma);
    text = text.slice(0, commaIndex).trim();
  }

  if (!text) return null;
  return { name: text, quantity, unit, note: notes.join(', ') };
}

/** "2 tbsp olive oil", without the note. */
export function formatIngredient({ quantity, unit, name }) {
  return [formatQuantity(quantity), unit, name].filter(Boolean).join(' ');
}
