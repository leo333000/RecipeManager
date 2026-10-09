// Recipe list with search, tag filter and sort.

import { api } from '../api.js';
import { h, replace } from '../dom.js';
import { recipeMeta } from '../lib/format.js';
import { allTags, filterRecipes, SORTS } from '../lib/search.js';
import { emptyState, linkButton, loading, pageHead, toggle, toggleChip } from '../ui/components.js';

export function recipeCard(summary) {
  return h('a', { class: 'card', href: `#/recipes/${encodeURIComponent(summary.id)}`, 'data-hue': summary.hue },
    h('h3', { text: summary.title }),
    h('div', { class: 'meta' }, recipeMeta(summary).map((part) => h('span', { text: part }))),
  );
}

export async function recipeListPage(container) {
  replace(container, loading());
  const recipes = await api.listRecipes();

  if (recipes.length === 0) {
    replace(container,
      pageHead('Recipes'),
      emptyState('No recipes yet.', linkButton('Write a recipe', '#/new', { variant: 'primary' }), linkButton('Import', '#/add')),
    );
    return;
  }

  const state = { query: '', tag: '', sort: 'title' };
  const grid = h('div', { class: 'card-grid' });
  const count = h('p', { class: 'muted small' });

  const update = () => {
    const list = filterRecipes(recipes, state);
    count.textContent = list.length === recipes.length ? `${recipes.length} recipes` : `${list.length} of ${recipes.length} recipes`;
    if (list.length === 0) grid.replaceChildren(h('p', { class: 'muted', text: 'Nothing matches.' }));
    else grid.replaceChildren(...list.map(recipeCard));
  };

  const search = h('input', {
    type: 'search',
    placeholder: 'Search title, tag or ingredient',
    'aria-label': 'Search recipes',
    oninput: (event) => {
      state.query = event.target.value;
      update();
    },
  });

  const tagChips = h('div', { class: 'chips' });
  const renderTags = () => {
    tagChips.replaceChildren(
      ...allTags(recipes).map((tag) =>
        toggleChip(tag, state.tag === tag, () => {
          state.tag = state.tag === tag ? '' : tag;
          renderTags();
          update();
        }),
      ),
    );
  };
  renderTags();

  const sort = h('select', {
    'aria-label': 'Sort by',
    onchange: (event) => {
      state.sort = event.target.value;
      update();
    },
  }, Object.entries(SORTS).map(([value, label]) => h('option', { value, text: label })));

  const filters = toggle('Filter and sort', () => [
    h('div', { class: 'panel' },
      tagChips.children.length ? tagChips : h('p', { class: 'muted small', text: 'No tags yet.' }),
      h('label', { class: 'field' }, h('span', { text: 'Sort by' }), sort),
    ),
  ], { variant: 'inline' });

  replace(container,
    pageHead('Recipes', linkButton('+ Add', '#/add', { variant: 'primary' })),
    h('div', { class: 'toolbar' }, search),
    filters,
    count,
    grid,
  );
  update();
}
