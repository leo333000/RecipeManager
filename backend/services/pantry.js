// Items Leo already has at home.

import { normalizeIngredientName } from '../../shared/ingredients.js';
import { createId } from '../../shared/recipe.js';
import { badRequest, notFound } from '../http.js';

export const PANTRY_LIMITS = { items: 500, name: 80 };

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

export function createPantryService({ repos }) {
  async function list() {
    return (await repos.pantry.get()).items.sort(byName);
  }

  async function add(names) {
    if (!Array.isArray(names)) throw badRequest('invalid_pantry', 'names must be a list');
    const items = await list();
    const known = new Set(items.map((item) => normalizeIngredientName(item.name)));

    for (const raw of names) {
      const name = String(raw ?? '').trim();
      const key = normalizeIngredientName(name);
      if (!key || known.has(key)) continue;
      if (name.length > PANTRY_LIMITS.name) {
        throw badRequest('invalid_pantry', `"${name.slice(0, 20)}…" is longer than ${PANTRY_LIMITS.name} characters`);
      }
      known.add(key);
      items.push({ id: createId(), name });
    }

    if (items.length > PANTRY_LIMITS.items) throw badRequest('invalid_pantry', 'The pantry is full');
    items.sort(byName);
    await repos.pantry.save({ items });
    return items;
  }

  async function remove(itemId) {
    const items = await list();
    if (!items.some((item) => item.id === itemId)) throw notFound('Pantry item');
    const remaining = items.filter((item) => item.id !== itemId);
    await repos.pantry.save({ items: remaining });
    return remaining;
  }

  async function clear() {
    await repos.pantry.save({ items: [] });
    return [];
  }

  async function names() {
    return (await list()).map((item) => item.name);
  }

  return { list, add, remove, clear, names };
}
