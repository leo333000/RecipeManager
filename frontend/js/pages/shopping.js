// Shopping list for a meal plan, with ticks remembered on this device.

import { formatIngredient } from '../../../shared/ingredients.js';
import { api } from '../api.js';
import { h, replace } from '../dom.js';
import { loadChecks, saveChecks } from '../lib/storage.js';
import { backLink, button, emptyState, linkButton, loading, pageHead, toggle } from '../ui/components.js';
import { toast, toastError } from '../ui/feedback.js';

export const lineKey = (line) => `${line.name.toLowerCase()}|${line.unit}`;

/** Plain-text list of the lines not yet ticked, for pasting into notes or messages. */
export function shoppingText(lines, checks) {
  return lines.filter((line) => !checks.has(lineKey(line))).map((line) => `- ${formatIngredient(line)}`).join('\n');
}

export async function shoppingPage(container, { id }) {
  replace(container, loading());
  const [selection, list] = await Promise.all([api.getMeal(id), api.shoppingList(id)]);
  const checks = loadChecks(id);
  const mealPath = `#/meals/${encodeURIComponent(id)}`;
  let showSources = false;

  const items = h('ul', { class: 'check-list' });
  const renderItems = () => {
    items.replaceChildren(
      ...list.toBuy.map((line) => {
        const key = lineKey(line);
        const text = h('span', { class: checks.has(key) ? 'done' : '' }, formatIngredient(line));
        const checkbox = h('input', {
          type: 'checkbox',
          checked: checks.has(key),
          onchange: (event) => {
            if (event.target.checked) checks.add(key);
            else checks.delete(key);
            text.className = event.target.checked ? 'done' : '';
            saveChecks(id, checks);
          },
        });
        return h('li', {},
          h('label', {}, checkbox, h('span', {}, text, showSources ? h('span', { class: 'sources', text: `for ${line.sources.join(', ')}` }) : null)),
        );
      }),
    );
  };
  renderItems();

  const copy = button('Copy list', {
    size: 'small',
    onclick: async () => {
      try {
        await navigator.clipboard.writeText(shoppingText(list.toBuy, checks));
        toast('List copied');
      } catch {
        toastError(new Error('Copying is not allowed in this browser'));
      }
    },
  });
  const sources = button('Show sources', {
    size: 'small',
    variant: 'ghost',
    onclick: () => {
      showSources = !showSources;
      sources.textContent = showSources ? 'Hide sources' : 'Show sources';
      sources.setAttribute('aria-pressed', String(showSources));
      renderItems();
    },
  });
  const reset = button('Untick all', {
    size: 'small',
    variant: 'ghost',
    onclick: () => {
      checks.clear();
      saveChecks(id, checks);
      renderItems();
    },
  });

  replace(container,
    backLink(mealPath, selection.name),
    pageHead('Shopping list'),
    list.missingRecipes.length
      ? h('p', { class: 'small muted', text: `Skipped deleted recipes: ${list.missingRecipes.join(', ')}` })
      : null,
    list.toBuy.length
      ? [h('div', { class: 'toolbar' }, copy, sources, reset), items]
      : emptyState(selection.items.length ? 'Nothing to buy. You have everything.' : 'Add dishes to the meal plan first.', linkButton('Back to meal plan', mealPath)),
    list.alreadyHave.length
      ? h('div', { class: 'sections' },
          toggle(`Already have (${list.alreadyHave.length})`, () =>
            h('ul', { class: 'small' }, list.alreadyHave.map((line) => h('li', { text: formatIngredient(line) }))),
          ),
        )
      : null,
  );
}
