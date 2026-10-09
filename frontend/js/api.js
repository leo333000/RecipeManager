// The only module that talks to the server. Endpoints match docs/specs/.

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Fired on window when any call returns 401, so the app can show sign-in. */
export const AUTH_REQUIRED_EVENT = 'auth-required';

const segment = encodeURIComponent;

async function request(method, path, body) {
  const options = { method, headers: {}, credentials: 'same-origin' };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`/api${path}`, options);
  } catch {
    throw new ApiError(0, 'network', 'No connection. Check your internet and try again.');
  }

  if (response.status === 401 && path !== '/login') window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message ?? (response.status >= 500 ? 'The server had a problem. Try again.' : `Request failed (${response.status})`);
    throw new ApiError(response.status, data?.error?.code ?? 'error', message);
  }
  return data;
}

const get = (path) => request('GET', path);
const post = (path, body = {}) => request('POST', path, body);
const put = (path, body) => request('PUT', path, body);
const patch = (path, body) => request('PATCH', path, body);
const del = (path) => request('DELETE', path);

export const api = {
  // Access
  login: (password) => post('/login', { password }),
  logout: () => post('/logout'),
  session: () => get('/session'),

  // Recipes
  listRecipes: async () => (await get('/recipes')).recipes,
  getRecipe: async (id) => (await get(`/recipes/${segment(id)}`)).recipe,
  createRecipe: async (recipe) => (await post('/recipes', { recipe })).recipe,
  updateRecipe: async (id, recipe, baseVersion, reason = 'edit') =>
    (await put(`/recipes/${segment(id)}`, { recipe, baseVersion, reason })).recipe,
  deleteRecipe: (id) => del(`/recipes/${segment(id)}`),

  addNote: async (id, text) => (await post(`/recipes/${segment(id)}/notes`, { text })).recipe,
  deleteNote: async (id, noteId) => (await del(`/recipes/${segment(id)}/notes/${segment(noteId)}`)).recipe,
  setIngredientNote: async (id, ingredientId, note) =>
    (await patch(`/recipes/${segment(id)}/ingredients/${segment(ingredientId)}`, { note })).recipe,

  listVersions: (id) => get(`/recipes/${segment(id)}/versions`),
  getVersion: async (id, version) => (await get(`/recipes/${segment(id)}/versions/${version}`)).version,
  restoreVersion: async (id, version, baseVersion) =>
    (await post(`/recipes/${segment(id)}/versions/${version}/restore`, { baseVersion })).recipe,

  aiFormat: (id, instructions) => post(`/recipes/${segment(id)}/ai/format`, { instructions }),
  aiImprove: (id) => post(`/recipes/${segment(id)}/ai/improve`),

  // Reviews and images
  listReviews: async (id) => (await get(`/recipes/${segment(id)}/reviews`)).reviews,
  addReview: async (id, review) => (await post(`/recipes/${segment(id)}/reviews`, review)).review,
  deleteReview: (id, reviewId) => del(`/recipes/${segment(id)}/reviews/${segment(reviewId)}`),
  uploadImage: async (image) => (await post('/images', image)).id,
  imageUrl: (id) => `/api/images/${segment(id)}`,

  // Meal selections
  listMeals: async () => (await get('/meals')).selections,
  createMeal: async ({ name, recipeIds } = {}) => (await post('/meals', { name, recipeIds })).selection,
  randomMeal: async ({ count, tag, name }) => (await post('/meals/random', { count, tag, name })).selection,
  getMeal: async (id) => (await get(`/meals/${segment(id)}`)).selection,
  renameMeal: async (id, name) => (await patch(`/meals/${segment(id)}`, { name })).selection,
  deleteMeal: (id) => del(`/meals/${segment(id)}`),
  addMealRecipe: async (id, recipeId) => (await post(`/meals/${segment(id)}/items`, { recipeId })).selection,
  addMealDish: async (id, { title, servings }) => (await post(`/meals/${segment(id)}/external`, { title, servings })).selection,
  removeMealItem: async (id, itemId) => (await del(`/meals/${segment(id)}/items/${segment(itemId)}`)).selection,
  shoppingList: (id) => get(`/meals/${segment(id)}/shopping-list`),

  // Pantry
  getPantry: async () => (await get('/pantry')).items,
  addPantry: async (names) => (await post('/pantry', { names })).items,
  removePantry: async (itemId) => (await del(`/pantry/${segment(itemId)}`)).items,
  clearPantry: async () => (await del('/pantry')).items,

  // Ideas
  pantryMatches: async () => (await get('/ideas/pantry-matches')).matches,
  ideas: async (mode) => (await post('/ideas', { mode })).ideas,
  ideaRecipe: async ({ title, description }) => (await post('/ideas/recipe', { title, description })).draft,

  // Import
  importUrl: (url) => post('/import/url', { url }),
  importPhotos: async (images) => (await post('/import/photo', { images })).draft,
  importPdf: async (data) => (await post('/import/pdf', { data })).draft,
};
