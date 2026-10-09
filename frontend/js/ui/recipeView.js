// Read-only rendering of a recipe, used for history snapshots and the before/after view.

import { formatQuantity } from '../../../shared/quantity.js';
import { h } from '../dom.js';
import { formatMinutes, plural } from '../lib/format.js';

export function quantityText(ingredient) {
  return [formatQuantity(ingredient.quantity), ingredient.unit].filter(Boolean).join(' ');
}

export function metaLine(recipe) {
  const parts = [
    recipe.servings ? plural(recipe.servings, 'serving') : null,
    recipe.prepMinutes ? `prep ${formatMinutes(recipe.prepMinutes)}` : null,
    recipe.cookMinutes ? `cook ${formatMinutes(recipe.cookMinutes)}` : null,
    recipe.tags.length ? recipe.tags.join(', ') : null,
  ].filter(Boolean);
  return h('div', { class: 'meta' }, parts.map((part) => h('span', { text: part })));
}

export function recipeBody(recipe) {
  return h(
    'div',
    { class: 'recipe-snapshot' },
    h('div', { class: 'recipe-head' },
      h('h3', { text: recipe.title }),
      recipe.description ? h('p', { text: recipe.description }) : null,
      metaLine(recipe),
    ),
    h('h4', { class: 'section-title', text: 'Ingredients' }),
    h('ul', { class: 'ingredients' },
      recipe.ingredients.map((ingredient) =>
        h('li', { class: 'ingredient' },
          h('span', {}),
          h('span', { class: 'ingredient-text' },
            h('span', { class: 'qty', text: quantityText(ingredient) }),
            quantityText(ingredient) ? ' ' : '',
            ingredient.name,
            ingredient.note ? h('span', { class: 'muted small', text: ` (${ingredient.note})` }) : null,
          ),
        ),
      ),
    ),
    h('h4', { class: 'section-title', text: 'Steps' }),
    h('ol', { class: 'steps' }, recipe.steps.map((step) => h('li', { text: step.text }))),
  );
}
