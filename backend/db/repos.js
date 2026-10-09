// Repositories: the only place that knows storage keys. Services call these.

const padVersion = (version) => String(version).padStart(6, '0');

export function createRepos(store) {
  const recipes = {
    get: (id) => store.getJSON(`recipes/${id}`),
    save: (recipe) => store.setJSON(`recipes/${recipe.id}`, recipe),
    delete: (id) => store.delete(`recipes/${id}`),
  };

  const recipeIndex = {
    async get() {
      return (await store.getJSON('index/recipes')) ?? { recipes: [] };
    },
    save: (index) => store.setJSON('index/recipes', index),
  };

  const versions = {
    async list(recipeId) {
      const keys = await store.listKeys(`versions/${recipeId}/`);
      const snapshots = await Promise.all(keys.map((key) => store.getJSON(key)));
      return snapshots.filter(Boolean).map(({ version, savedAt, reason }) => ({ version, savedAt, reason }));
    },
    get: (recipeId, version) => store.getJSON(`versions/${recipeId}/${padVersion(version)}`),
    save: (recipeId, snapshot) => store.setJSON(`versions/${recipeId}/${padVersion(snapshot.version)}`, snapshot),
    async deleteAll(recipeId) {
      const keys = await store.listKeys(`versions/${recipeId}/`);
      await Promise.all(keys.map((key) => store.delete(key)));
    },
  };

  const reviews = {
    async list(recipeId) {
      return (await store.getJSON(`reviews/${recipeId}`))?.reviews ?? [];
    },
    save: (recipeId, list) => store.setJSON(`reviews/${recipeId}`, { reviews: list }),
    delete: (recipeId) => store.delete(`reviews/${recipeId}`),
  };

  const images = {
    get: (id) => store.getBinary(`images/${id}`),
    save: (id, data, contentType) => store.setBinary(`images/${id}`, data, { contentType }),
    exists: (id) => store.exists(`images/${id}`),
    delete: (id) => store.delete(`images/${id}`),
  };

  const pantry = {
    async get() {
      return (await store.getJSON('pantry')) ?? { items: [] };
    },
    save: (value) => store.setJSON('pantry', value),
  };

  const meals = {
    async list() {
      const keys = await store.listKeys('meals/');
      return (await Promise.all(keys.map((key) => store.getJSON(key)))).filter(Boolean);
    },
    get: (id) => store.getJSON(`meals/${id}`),
    save: (selection) => store.setJSON(`meals/${selection.id}`, selection),
    delete: (id) => store.delete(`meals/${id}`),
  };

  return { recipes, recipeIndex, versions, reviews, images, pantry, meals };
}
