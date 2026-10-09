// Meal selections: recipes and outside dishes planned together.

import { createId, fitToLimits, LIMITS, validateRecipe } from '../../shared/recipe.js';
import { badRequest, HttpError, notFound } from '../http.js';
import { pickRandom } from './randomize.js';
import { buildShoppingList } from './shoppingList.js';

export const MEAL_LIMITS = { name: 80, items: 40, randomMax: 14, dishTitle: 120 };

function cleanName(value, fallback) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (name.length > MEAL_LIMITS.name) throw badRequest('invalid_selection', `Name must be at most ${MEAL_LIMITS.name} characters`);
  return name || fallback;
}

export function createMealService({ repos, ai, pantry, now, random }) {
  const timestamp = () => now().toISOString();
  const datedName = (prefix) => `${prefix} ${timestamp().slice(0, 10)}`;

  async function get(id) {
    const selection = await repos.meals.get(id);
    if (!selection) throw notFound('Meal selection');
    return selection;
  }

  async function save(selection) {
    if (selection.items.length > MEAL_LIMITS.items) {
      throw badRequest('invalid_selection', `A selection holds at most ${MEAL_LIMITS.items} dishes`);
    }
    const saved = { ...selection, updatedAt: timestamp() };
    await repos.meals.save(saved);
    return saved;
  }

  async function recipeItem(recipeId) {
    const recipe = await repos.recipes.get(recipeId);
    if (!recipe) throw badRequest('unknown_recipe', 'That recipe does not exist');
    return { id: createId(), type: 'recipe', recipeId, title: recipe.title };
  }

  async function list() {
    const selections = await repos.meals.list();
    return selections
      .map(({ id, name, items, updatedAt }) => ({ id, name, itemCount: items.length, updatedAt }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async function create({ name, recipeIds = [] }) {
    if (!Array.isArray(recipeIds)) throw badRequest('invalid_selection', 'recipeIds must be a list');
    const uniqueIds = [...new Set(recipeIds)];
    const items = await Promise.all(uniqueIds.map(recipeItem));
    return save({ id: createId(), name: cleanName(name, datedName('Meals')), createdAt: timestamp(), items });
  }

  async function createRandom({ count, tag, name }) {
    const wanted = Number(count);
    if (!Number.isInteger(wanted) || wanted < 1 || wanted > MEAL_LIMITS.randomMax) {
      throw badRequest('invalid_count', `Pick between 1 and ${MEAL_LIMITS.randomMax} meals`);
    }
    const tagFilter = typeof tag === 'string' ? tag.trim().toLowerCase() : '';
    const summaries = (await repos.recipeIndex.get()).recipes;
    const candidates = tagFilter ? summaries.filter((summary) => summary.tags.includes(tagFilter)) : summaries;
    if (candidates.length === 0) throw badRequest('no_recipes', 'No recipes match. Add some recipes or pick another tag.');

    const items = pickRandom(candidates, wanted, random).map((summary) => ({
      id: createId(),
      type: 'recipe',
      recipeId: summary.id,
      title: summary.title,
    }));
    return save({ id: createId(), name: cleanName(name, datedName('Random')), createdAt: timestamp(), items });
  }

  async function rename(id, name) {
    const selection = await get(id);
    return save({ ...selection, name: cleanName(name, selection.name) });
  }

  async function remove(id) {
    await get(id);
    await repos.meals.delete(id);
  }

  async function addRecipe(id, recipeId) {
    const selection = await get(id);
    if (selection.items.some((item) => item.type === 'recipe' && item.recipeId === recipeId)) {
      throw new HttpError(409, 'duplicate', 'That recipe is already in this selection');
    }
    return save({ ...selection, items: [...selection.items, await recipeItem(recipeId)] });
  }

  async function addExternal(id, { title, servings }) {
    const selection = await get(id);
    const dishTitle = typeof title === 'string' ? title.trim() : '';
    if (!dishTitle) throw badRequest('invalid_dish', 'Give the dish a name');
    if (dishTitle.length > MEAL_LIMITS.dishTitle) throw badRequest('invalid_dish', 'The dish name is too long');
    const portions = servings === undefined || servings === null || servings === '' ? 4 : Number(servings);
    if (!Number.isInteger(portions) || portions < 1 || portions > LIMITS.servings) {
      throw badRequest('invalid_dish', `Servings must be between 1 and ${LIMITS.servings}`);
    }

    const generated = await ai.generateIngredients(dishTitle, portions);
    const { value, error } = validateRecipe(fitToLimits({ title: dishTitle, ingredients: generated.ingredients }));
    if (error || value.ingredients.length === 0) {
      throw new HttpError(422, 'ai_bad_output', 'Claude could not produce an ingredient list for that dish');
    }

    const item = { id: createId(), type: 'external', title: dishTitle, servings: portions, ingredients: value.ingredients };
    return save({ ...selection, items: [...selection.items, item] });
  }

  async function removeItem(id, itemId) {
    const selection = await get(id);
    if (!selection.items.some((item) => item.id === itemId)) throw notFound('Item');
    return save({ ...selection, items: selection.items.filter((item) => item.id !== itemId) });
  }

  async function shoppingList(id) {
    const selection = await get(id);
    const missingRecipes = [];
    const sources = await Promise.all(
      selection.items.map(async (item) => {
        if (item.type === 'external') return { title: item.title, ingredients: item.ingredients };
        const recipe = await repos.recipes.get(item.recipeId);
        if (!recipe) {
          missingRecipes.push(item.title);
          return null;
        }
        return { title: recipe.title, ingredients: recipe.ingredients };
      }),
    );
    const list = buildShoppingList(sources.filter(Boolean), await pantry.names());
    return { ...list, missingRecipes };
  }

  return { list, get, create, createRandom, rename, remove, addRecipe, addExternal, removeItem, shoppingList };
}
