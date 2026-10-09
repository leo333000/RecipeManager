// List of meal plans, with "new" and "pick at random".

import { api } from '../api.js';
import { h, replace } from '../dom.js';
import { formatDate, plural } from '../lib/format.js';
import { allTags } from '../lib/search.js';
import { navigate } from '../router.js';
import { button, emptyState, field, loading, pageHead, toggle } from '../ui/components.js';
import { withBusy } from '../ui/feedback.js';

function randomForm(recipes) {
  const count = h('input', { type: 'number', min: 1, max: 14, value: '5', inputmode: 'numeric' });
  const tag = h('select', {}, h('option', { value: '', text: 'Any recipe' }), allTags(recipes).map((name) => h('option', { value: name, text: name })));
  const go = button('Pick for me', { variant: 'primary', type: 'submit' });

  return h('form', {
    class: 'panel',
    onsubmit: (event) => {
      event.preventDefault();
      withBusy(go, 'Picking…', async () => {
        const selection = await api.randomMeal({ count: Number(count.value), tag: tag.value || undefined });
        navigate(`/meals/${encodeURIComponent(selection.id)}`);
      });
    },
  },
    h('div', { class: 'field-row' }, field('How many meals', count), field('Only with tag', tag)),
    go,
  );
}

export async function mealsPage(container) {
  replace(container, loading());
  const [selections, recipes] = await Promise.all([api.listMeals(), api.listRecipes()]);

  const create = button('+ New', {
    variant: 'primary',
    onclick: () =>
      withBusy(create, 'Creating…', async () => {
        const selection = await api.createMeal();
        navigate(`/meals/${encodeURIComponent(selection.id)}`);
      }),
  });

  replace(container,
    pageHead('Meal plans', create),
    recipes.length ? toggle('Pick meals at random', () => randomForm(recipes), { variant: 'inline' }) : null,
    selections.length
      ? h('ul', { class: 'list sections' },
          selections.map((selection) =>
            h('li', {},
              h('div', { class: 'list-row' },
                h('a', { href: `#/meals/${encodeURIComponent(selection.id)}` },
                  h('div', { text: selection.name }),
                  h('div', { class: 'meta' }, h('span', { text: plural(selection.itemCount, 'dish', 'dishes') }), h('span', { text: formatDate(selection.updatedAt) })),
                ),
                h('span', { class: 'muted', 'aria-hidden': 'true', text: '→' }),
              ),
            ),
          ),
        )
      : emptyState('No meal plans yet. Start one, or let the app pick for you.'),
  );
}
