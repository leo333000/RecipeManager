// Recipe CRUD, notes, ingredient notes and version history.

import { normalizeIngredientName } from '../../shared/ingredients.js';
import { createId, EDIT_REASONS, LIMITS, validateRecipe } from '../../shared/recipe.js';
import { badRequest, HttpError, notFound } from '../http.js';

/** Validates recipe input or throws a 400 with the first problem. */
export function validateOrThrow(input) {
  const { value, error } = validateRecipe(input);
  if (error) throw badRequest('invalid_recipe', error);
  return value;
}

function cleanNoteText(text, max) {
  const value = typeof text === 'string' ? text.trim() : '';
  if (value.length > max) throw badRequest('invalid_note', `Notes must be at most ${max} characters`);
  return value;
}

/** Applies validated editable fields to a stored recipe, keeping what edits never change. */
export function applyFields(current, fields) {
  return {
    ...current,
    ...fields,
    id: current.id,
    notes: current.notes,
    source: current.source,
    createdAt: current.createdAt,
  };
}

/**
 * Like applyFields, for a recipe rewritten by Claude: the hue is kept, and
 * ingredients matching an existing one by name keep its id, and its note
 * when Claude returned an empty note.
 */
export function applyAiFields(current, fields) {
  const unused = [...current.ingredients];
  const ingredients = fields.ingredients.map((ingredient) => {
    const name = normalizeIngredientName(ingredient.name);
    const matchIndex = unused.findIndex((old) => normalizeIngredientName(old.name) === name);
    if (matchIndex === -1) return ingredient;
    const [old] = unused.splice(matchIndex, 1);
    return { ...ingredient, id: old.id, note: ingredient.note || old.note };
  });
  return applyFields(current, { ...fields, ingredients, hue: current.hue });
}

export function createRecipeService({ repos, recipeIndex, now }) {
  const timestamp = () => now().toISOString();

  async function get(id) {
    const recipe = await repos.recipes.get(id);
    if (!recipe) throw notFound('Recipe');
    return recipe;
  }

  async function store(recipe) {
    await repos.recipes.save(recipe);
    await recipeIndex.upsert(recipe);
    return recipe;
  }

  async function create(input) {
    const fields = validateOrThrow(input);
    const time = timestamp();
    return store({
      ...fields,
      id: createId(),
      notes: [],
      version: 1,
      changeReason: 'created',
      createdAt: time,
      updatedAt: time,
    });
  }

  function assertVersion(recipe, baseVersion) {
    if (baseVersion === undefined || baseVersion === null) {
      throw badRequest('base_version_required', 'baseVersion is required');
    }
    if (Number(baseVersion) !== recipe.version) {
      throw new HttpError(409, 'version_conflict', 'This recipe changed since you opened it. Reload and try again.');
    }
  }

  /** Saves the current version as a snapshot, then stores `next` as the following version. */
  async function saveNewVersion(current, next, reason) {
    await repos.versions.save(current.id, {
      version: current.version,
      savedAt: current.updatedAt,
      reason: current.changeReason,
      recipe: current,
    });
    return store({ ...next, version: current.version + 1, changeReason: reason, updatedAt: timestamp() });
  }

  async function update(id, input, baseVersion, reason) {
    const current = await get(id);
    assertVersion(current, baseVersion);
    const fields = validateOrThrow(input);
    return saveNewVersion(current, applyFields(current, fields), EDIT_REASONS.includes(reason) ? reason : 'edit');
  }

  async function remove(id) {
    await get(id);
    const reviews = await repos.reviews.list(id);
    const imageIds = reviews.flatMap((review) => review.images.map((image) => image.id));
    await Promise.all(imageIds.map((imageId) => repos.images.delete(imageId)));
    await repos.reviews.delete(id);
    await repos.versions.deleteAll(id);
    await repos.recipes.delete(id);
    await recipeIndex.remove(id);
  }

  async function addNote(id, text) {
    const recipe = await get(id);
    const value = cleanNoteText(text, LIMITS.noteText);
    if (!value) throw badRequest('invalid_note', 'Write something in the note');
    const note = { id: createId(), text: value, createdAt: timestamp() };
    return store({ ...recipe, notes: [note, ...recipe.notes] });
  }

  async function removeNote(id, noteId) {
    const recipe = await get(id);
    if (!recipe.notes.some((note) => note.id === noteId)) throw notFound('Note');
    return store({ ...recipe, notes: recipe.notes.filter((note) => note.id !== noteId) });
  }

  async function setIngredientNote(id, ingredientId, text) {
    const recipe = await get(id);
    if (!recipe.ingredients.some((ingredient) => ingredient.id === ingredientId)) throw notFound('Ingredient');
    const note = cleanNoteText(text, LIMITS.ingredientNote);
    const ingredients = recipe.ingredients.map((ingredient) =>
      ingredient.id === ingredientId ? { ...ingredient, note } : ingredient,
    );
    return store({ ...recipe, ingredients });
  }

  async function listVersions(id) {
    const recipe = await get(id);
    const versions = await repos.versions.list(id);
    return { current: recipe.version, versions: versions.sort((a, b) => b.version - a.version) };
  }

  async function getVersion(id, version) {
    await get(id);
    const snapshot = await repos.versions.get(id, version);
    if (!snapshot) throw notFound('Version');
    return snapshot;
  }

  async function restore(id, version, baseVersion) {
    const current = await get(id);
    assertVersion(current, baseVersion);
    const snapshot = await repos.versions.get(id, version);
    if (!snapshot) throw notFound('Version');
    const restored = { ...snapshot.recipe, id: current.id, notes: current.notes, createdAt: current.createdAt };
    return saveNewVersion(current, restored, 'restore');
  }

  return {
    list: () => recipeIndex.all(),
    get,
    create,
    update,
    remove,
    addNote,
    removeNote,
    setIngredientNote,
    listVersions,
    getVersion,
    restore,
  };
}
